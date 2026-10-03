import type { StudentRecord } from "../types/admin";
import { ExamTransition, resolveStudentTransition, programOf } from "./examTransitions";

// Pure payment-report logic for the Admin Payments page. One function builds
// one row per student registration from the existing student documents (no
// separate payment records exist - a student carries a single
// paymentDetails.amount + paymentStatus), and every number on screen, in the
// summary cards, the coach/school tables and both exports is derived from the
// SAME filtered rows, so they always reconcile and nothing is counted twice.

export type PayStatus = "verified" | "pending" | "rejected";
export type ProgramKey = "KARATE" | "SELAMBAM";

export interface PaymentRow {
  id: string;
  name: string;
  schoolKey: string;
  school: string;
  coachId: string;
  coach: string;
  program: ProgramKey;
  /** Belt/stage the student holds now (the transition's "from"), when known. */
  currentLevel: string;
  /** Config transition this registration maps to (stable key for filtering). */
  transitionKey: string;
  transitionLabel: string;
  /** stored / derived from the fee config / unmapped (never guessed). */
  transitionSource: "stored" | "derived" | "unmapped";
  /** ISO registration time ("" if unknown). */
  registeredAt: string;
  /** Registration group id set by the coach bulk registration ("" for older records). */
  groupId: string;
  /** Registration fee exactly as stored at registration; null when missing. */
  fee: number | null;
  paid: number;
  balance: number;
  status: PayStatus;
  paymentDate: string;
  reference: string;
  method: string;
}

export interface ReportFilters {
  school: string; // "all" | schoolKey
  coach: string; // "all" | coachId | NO_COACH
  program: "all" | ProgramKey;
  transition: string; // "all" | transitionKey
  status: "all" | PayStatus;
  search: string;
  /** Registration date range (yyyy-mm-dd, inclusive); "" = open. */
  dateFrom: string;
  dateTo: string;
}

export const NO_COACH = "__none__";
export const DEFAULT_FILTERS: ReportFilters = {
  school: "all", coach: "all", program: "all", transition: "all", status: "all", search: "", dateFrom: "", dateTo: "",
};

const isMoney = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function buildRows(
  students: StudentRecord[],
  coachNames: Record<string, string>,
  karate: ExamTransition[],
  silambam: ExamTransition[],
): PaymentRow[] {
  const seen = new Set<string>(); // a student document is only ever one row
  const rows: PaymentRow[] = [];
  for (const s of students) {
    if (!s.id || seen.has(s.id)) continue;
    seen.add(s.id);

    const program: ProgramKey = programOf(s);
    const tr = resolveStudentTransition(s as any, karate, silambam);
    const storedLevel = s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "");
    const transitionLabel = tr.label;
    const currentLevel = tr.from ?? (tr.source === "unmapped" ? (storedLevel || "—") : "—");

    const pd: any = s.paymentDetails;
    const fee = isMoney(pd?.amount) ? pd.amount : null;
    const status: PayStatus = s.paymentStatus === "verified" || s.paymentStatus === "rejected" ? s.paymentStatus : "pending";
    const paid = status === "verified" && fee !== null ? fee : 0;
    const coachId = s.secretaryId || "";
    const schoolName = (s.school || "").trim() || "Individual";

    rows.push({
      id: s.id,
      name: (s.name || "").trim() || "Unnamed",
      schoolKey: s.schoolId || schoolName.toLowerCase(),
      school: schoolName,
      coachId,
      coach: coachId ? coachNames[coachId] || "Unknown Coach" : "Individual",
      program,
      currentLevel,
      transitionKey: tr.key,
      transitionLabel,
      transitionSource: tr.source,
      registeredAt: s.registeredAt ? String(s.registeredAt) : "",
      groupId: (s as any).registrationGroupId ? String((s as any).registrationGroupId) : "",
      fee,
      paid,
      balance: (fee ?? 0) - paid,
      status,
      paymentDate: pd?.paymentDate ? String(pd.paymentDate) : "",
      reference: pd?.transactionId ? String(pd.transactionId) : "",
      method: pd?.method ? String(pd.method) : "",
    });
  }
  return rows;
}

export function filterRows(rows: PaymentRow[], f: ReportFilters): PaymentRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.school !== "all" && r.schoolKey !== f.school) return false;
    if (f.coach === NO_COACH ? !!r.coachId : f.coach !== "all" && r.coachId !== f.coach) return false;
    if (f.program !== "all" && r.program !== f.program) return false;
    if (f.transition !== "all" && r.transitionKey !== f.transition) return false;
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.dateFrom || f.dateTo) {
      const day = r.registeredAt.slice(0, 10);
      if (!day || (f.dateFrom && day < f.dateFrom) || (f.dateTo && day > f.dateTo)) return false;
    }
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) ||
      r.reference.toLowerCase().includes(q);
  });
}

export interface Totals {
  students: number;
  totalAmount: number;
  paidAmount: number;
  /** Unpaid balance = total - paid (includes rejected payments, which are not valid payments). */
  pendingAmount: number;
  rejectedAmount: number;
  confirmedCount: number;
  pendingCount: number;
  rejectedCount: number;
  /** Registrations with no stored fee - counted as students, contribute 0, never as paid. */
  missingFee: number;
  karate: number;
  silambam: number;
}

export function totalsOf(rows: PaymentRow[]): Totals {
  const t: Totals = {
    students: rows.length, totalAmount: 0, paidAmount: 0, pendingAmount: 0, rejectedAmount: 0,
    confirmedCount: 0, pendingCount: 0, rejectedCount: 0, missingFee: 0, karate: 0, silambam: 0,
  };
  for (const r of rows) {
    t.totalAmount += r.fee ?? 0;
    t.paidAmount += r.paid;
    t.pendingAmount += r.balance;
    if (r.status === "rejected") { t.rejectedCount++; t.rejectedAmount += r.fee ?? 0; }
    else if (r.status === "verified") t.confirmedCount++;
    else t.pendingCount++;
    if (r.fee === null) t.missingFee++;
    if (r.program === "KARATE") t.karate++; else t.silambam++;
  }
  return t;
}

export interface CoachSummaryRow extends Totals { coachId: string; coach: string; schoolKey: string; school: string }
export interface SchoolSummaryRow extends Totals { schoolKey: string; school: string; coaches: number; coachRows: CoachSummaryRow[] }

export function coachSummary(rows: PaymentRow[]): CoachSummaryRow[] {
  const groups = new Map<string, PaymentRow[]>();
  for (const r of rows) {
    const k = `${r.coachId}|${r.schoolKey}`;
    (groups.get(k) || groups.set(k, []).get(k)!).push(r);
  }
  return [...groups.values()]
    .map((g) => ({ coachId: g[0].coachId, coach: g[0].coach, schoolKey: g[0].schoolKey, school: g[0].school, ...totalsOf(g) }))
    .sort((a, b) => a.coach.localeCompare(b.coach) || a.school.localeCompare(b.school));
}

export function schoolSummary(rows: PaymentRow[]): SchoolSummaryRow[] {
  const groups = new Map<string, PaymentRow[]>();
  for (const r of rows) (groups.get(r.schoolKey) || groups.set(r.schoolKey, []).get(r.schoolKey)!).push(r);
  return [...groups.values()]
    .map((g) => ({
      schoolKey: g[0].schoolKey,
      school: g[0].school,
      coaches: new Set(g.filter((r) => r.coachId).map((r) => r.coachId)).size,
      coachRows: coachSummary(g),
      ...totalsOf(g),
    }))
    .sort((a, b) => a.school.localeCompare(b.school));
}

export interface TransitionCount { key: string; label: string; program: ProgramKey; count: number; fee: number; paid: number; pending: number }
export function transitionBreakdown(rows: PaymentRow[]): TransitionCount[] {
  const m = new Map<string, TransitionCount>();
  for (const r of rows) {
    const e = m.get(r.transitionKey) || { key: r.transitionKey, label: `${r.program === "KARATE" ? "Karate" : "Silambam"}: ${r.transitionLabel}`, program: r.program, count: 0, fee: 0, paid: 0, pending: 0 };
    e.count++; e.fee += r.fee ?? 0; e.paid += r.paid; e.pending += r.balance;
    m.set(r.transitionKey, e);
  }
  return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
}

// -- formatting / safety helpers ------------------------------------------------
export const formatINR = (n: number) => `₹${n.toLocaleString("en-IN")}`;
/** jsPDF's built-in fonts cannot draw the rupee sign (receiptGenerator.ts uses the same workaround). */
export const formatINRPdf = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

/** Neutralise spreadsheet formula injection for untrusted text cells. */
export const safeCell = (v: string): string => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export const sanitizeFilename = (name: string): string =>
  name.replace(/[^A-Za-z0-9 _.-]+/g, "").trim().replace(/\s+/g, "_").slice(0, 80) || "Report";

export const statusLabel = (s: PayStatus) => (s === "verified" ? "Confirmed" : s === "rejected" ? "Rejected" : "Pending");

// -- Registration groups (Payments -> Recent) ---------------------------------------
// A group is one coach's bulk registration. New registrations carry the
// `registrationGroupId` stamped by the coach Bulk Registration screen. Older
// records have none, so they are clustered per coach+school by registration
// time (a bulk submit stamps its students within seconds; a gap of more than
// GROUP_GAP_MS starts a new group) and flagged `inferred`. Registrations that
// belong to no coach are never grouped.
export const GROUP_GAP_MS = 2 * 60 * 1000;

export interface RegistrationGroup extends Totals {
  key: string;
  groupId: string;
  inferred: boolean;
  coachId: string;
  coach: string;
  schoolKey: string;
  school: string;
  /** Latest registration time in the group (ISO). */
  registeredAt: string;
  rows: PaymentRow[];
  /** Pending rows that can be confirmed: a valid stored fee is required. */
  eligibleIds: string[];
}

export const isEligibleForPayment = (r: PaymentRow) => r.status === "pending" && r.fee !== null && r.fee > 0;

export function buildGroups(rows: PaymentRow[]): RegistrationGroup[] {
  const make = (key: string, groupId: string, inferred: boolean, g: PaymentRow[]): RegistrationGroup => {
    const latest = g.reduce((m, r) => (r.registeredAt > m ? r.registeredAt : m), "");
    return {
      key, groupId, inferred,
      coachId: g[0].coachId, coach: g[0].coach, schoolKey: g[0].schoolKey, school: g[0].school,
      registeredAt: latest, rows: g, eligibleIds: g.filter(isEligibleForPayment).map((r) => r.id),
      ...totalsOf(g),
    };
  };
  const byId = new Map<string, PaymentRow[]>();
  const legacy = new Map<string, PaymentRow[]>();
  for (const r of rows) {
    if (!r.coachId) continue;
    if (r.groupId) (byId.get(r.groupId) || byId.set(r.groupId, []).get(r.groupId)!).push(r);
    else {
      const k = `${r.coachId}|${r.schoolKey}`;
      (legacy.get(k) || legacy.set(k, []).get(k)!).push(r);
    }
  }
  const groups: RegistrationGroup[] = [...byId.entries()].map(([id, g]) => make(`g:${id}`, id, false, g));
  for (const [k, list] of legacy) {
    const sorted = [...list].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
    let cur: PaymentRow[] = [];
    let last = NaN;
    const flush = () => { if (cur.length) groups.push(make(`i:${k}:${cur[0].registeredAt}:${cur[0].id}`, "", true, cur)); cur = []; };
    for (const r of sorted) {
      const t = r.registeredAt ? Date.parse(r.registeredAt) : NaN;
      if (cur.length && (isNaN(t) || isNaN(last) || t - last > GROUP_GAP_MS)) flush();
      cur.push(r);
      last = t;
    }
    flush();
  }
  return groups.sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
}

// -- PDF helpers --------------------------------------------------------------------
/**
 * jsPDF's built-in fonts are WinAnsi only: the arrow in "White → Yellow"
 * (U+2192) has no glyph there and prints as garbage such as "r". The PDF
 * therefore writes the same transition as "White to Yellow"; the stored value,
 * the on-screen label and the Excel export keep the arrow. Anything else
 * outside Latin-1 is replaced with "?" rather than printed as corrupt glyphs.
 */
export const pdfSafe = (v: string): string =>
  String(v ?? "")
    .replace(/\s*[\u2192\u2794\u27A1]\s*/g, " to ")
    .replace(/\u20B9/g, "Rs. ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .replace(/\s{2,}/g, " ")
    .trim();

export interface TransitionSummaryRow extends Totals {
  key: string;
  program: ProgramKey;
  label: string;
  source: PaymentRow["transitionSource"];
}

/** One row per exact transition present in `rows`, in configured order. */
export function transitionSummary(rows: PaymentRow[], order: string[] = []): TransitionSummaryRow[] {
  const groups = new Map<string, PaymentRow[]>();
  for (const r of rows) (groups.get(r.transitionKey) || groups.set(r.transitionKey, []).get(r.transitionKey)!).push(r);
  const idx = (k: string) => { const i = order.indexOf(k); return i === -1 ? 1e6 : i; };
  return [...groups.entries()]
    .map(([key, g]) => ({ key, program: g[0].program, label: g[0].transitionLabel, source: g[0].transitionSource, ...totalsOf(g) }))
    .sort((a, b) => (a.program === b.program ? 0 : a.program === "KARATE" ? -1 : 1) || idx(a.key) - idx(b.key) || a.label.localeCompare(b.label));
}

export interface CoachSection { coachId: string; coach: string; schools: string[]; rows: PaymentRow[]; totals: Totals }

/** Detail rows grouped by the coach on the registration record (no coach => "Unassigned Coach", last). */
export function coachSections(rows: PaymentRow[]): CoachSection[] {
  const groups = new Map<string, PaymentRow[]>();
  for (const r of rows) (groups.get(r.coachId) || groups.set(r.coachId, []).get(r.coachId)!).push(r);
  return [...groups.entries()]
    .map(([coachId, g]) => ({
      coachId,
      coach: coachId ? g[0].coach : "Unassigned Coach",
      schools: [...new Set(g.map((r) => r.school))].sort(),
      rows: [...g].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
      totals: totalsOf(g),
    }))
    .sort((a, b) => (a.coachId === "" ? 1 : b.coachId === "" ? -1 : a.coach.localeCompare(b.coach)));
}

/** Every section of the PDF must add up to the same numbers; refuse to export otherwise. */
export function assertReportReconciles(rows: PaymentRow[], order: string[] = []): void {
  const t = totalsOf(rows);
  const check = (label: string, parts: Totals[]) => {
    const sum = (f: (x: Totals) => number) => parts.reduce((a, x) => a + f(x), 0);
    if (sum((x) => x.students) !== t.students || sum((x) => x.totalAmount) !== t.totalAmount ||
        sum((x) => x.paidAmount) !== t.paidAmount || sum((x) => x.pendingAmount) !== t.pendingAmount ||
        sum((x) => x.confirmedCount) !== t.confirmedCount || sum((x) => x.pendingCount) !== t.pendingCount ||
        sum((x) => x.rejectedCount) !== t.rejectedCount) {
      throw new Error(`Report totals do not reconcile (${label}).`);
    }
  };
  check("transition summary", transitionSummary(rows, order));
  check("coach summary", coachSummary(rows));
  check("school summary", schoolSummary(rows));
  check("coach detail sections", coachSections(rows).map((s) => s.totals));
  if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error("Report contains a duplicated registration.");
}
