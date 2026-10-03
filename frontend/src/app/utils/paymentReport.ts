import type { StudentRecord } from "../types/admin";
import type { ExamTransition } from "./examTransitions";

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
}

export const NO_COACH = "__none__";
export const DEFAULT_FILTERS: ReportFilters = {
  school: "all", coach: "all", program: "all", transition: "all", status: "all", search: "",
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

    const program: ProgramKey =
      String(s.programType || s.program || "").toUpperCase() === "SELAMBAM" ? "SELAMBAM" : "KARATE";
    const list = program === "KARATE" ? karate : silambam;
    const stored = (s as any).examTransition as { from: string | null; to: string; feeId: string } | undefined;

    let matched: ExamTransition | undefined;
    if (stored?.feeId) matched = list.find((t) => t.id === stored.feeId);
    if (!matched) {
      matched = program === "KARATE"
        ? list.find((t) => t.to === s.beltLevel)
        : list.find((t) => t.stageNumber != null && String(t.stageNumber) === String(s.stageLevel));
    }
    const storedLevel = s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "");
    const transitionLabel = stored
      ? (stored.from ? `${stored.from} → ${stored.to}` : stored.to)
      : matched?.label || storedLevel || "—";
    const currentLevel = stored?.from ?? matched?.from ?? (storedLevel || "—");

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
      transitionKey: matched?.id || stored?.feeId || `unmapped:${program}:${storedLevel}`,
      transitionLabel,
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
