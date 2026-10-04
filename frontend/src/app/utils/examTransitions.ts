import type { FeeStructure, SilambanFeeStructure } from "../services/firebaseData";

// Builds the examination "transitions" the Coach bulk-registration dropdowns
// show — straight from the Admin fee configuration (feeStructure /
// silambanFees), so there is exactly one source of truth for names, order and
// fees. Nothing here stores or duplicates a fee.

export interface ExamTransition {
  /** Fee document id (stable key the form stores). */
  id: string;
  /** Belt/stage the student is moving from; null when nothing precedes it. */
  from: string | null;
  /** Belt/stage the examination is for (what the fee doc represents). */
  to: string;
  /** "White → Yellow" (or just the stage name when there is no "from"). */
  label: string;
  fee: number;
  /** False when the Admin fee is missing / not a positive number. */
  feeConfigured: boolean;
  order: number;
  /** Silambam only — the stage number stored on the student as stageLevel. */
  stageNumber?: number;
}

// The Admin Fee Structure page labels the first Karate fee as "White → <belt>"
// (FeeStructure.tsx) — White is the implicit starting belt, it has no fee doc.
export const FIRST_KARATE_FROM_BELT = "White";

const isUsableFee = (fee: unknown): fee is number =>
  typeof fee === "number" && Number.isFinite(fee) && fee > 0;

const byOrder = <T extends { order?: number }>(a: T, b: T) => (a.order || 0) - (b.order || 0);

// Each option's "from" is the previous entry in the FULL ordered list — even
// if that entry is hidden/inactive — exactly like the Admin page, so hiding
// one belt never rewrites its neighbours' transitions. Only active entries are
// returned as options.
export function buildKarateTransitions(allFees: FeeStructure[]): ExamTransition[] {
  const sorted = [...allFees].sort(byOrder);
  return sorted
    .map((f, i) => {
      const from = i === 0 ? FIRST_KARATE_FROM_BELT : sorted[i - 1].beltColor;
      return {
        id: f.id,
        from,
        to: f.beltColor,
        label: `${from} → ${f.beltColor}`,
        fee: isUsableFee(f.fee) ? f.fee : 0,
        feeConfigured: isUsableFee(f.fee),
        order: f.order || 0,
        active: f.active !== false,
      };
    })
    .filter((t) => t.active)
    .map(({ active, ...t }) => t);
}

// The first configured stage is the INITIAL stage, not a promotion: nobody is
// promoted "into" it, so it is never offered as a transition (just as Karate's
// White belt has no "White → White"). Its fee document is kept untouched for
// historical registrations, and it still serves as the "from" of the next stage.
export function buildSilambamTransitions(allFees: SilambanFeeStructure[]): ExamTransition[] {
  const sorted = [...allFees].sort(byOrder);
  const nameOf = (f: SilambanFeeStructure) => f.stageName || `Stage ${f.stageNumber}`;
  return sorted
    .map((f, i) => {
      const from = i === 0 ? null : nameOf(sorted[i - 1]);
      const to = nameOf(f);
      return {
        id: f.id,
        from,
        to,
        label: from ? `${from} → ${to}` : to,
        fee: isUsableFee(f.fee) ? f.fee : 0,
        feeConfigured: isUsableFee(f.fee),
        order: f.order || 0,
        stageNumber: f.stageNumber,
        active: f.active !== false,
        initial: i === 0,
      };
    })
    .filter((t) => t.active && !t.initial)
    .map(({ active, initial, ...t }) => t);
}

/** "White → Yellow — ₹1,200", or a clear "fee not set" note. */
export function formatTransitionOption(t: ExamTransition): string {
  return t.feeConfigured ? `${t.label} — ₹${t.fee.toLocaleString()}` : `${t.label} — fee not set`;
}

// -- Student -> transition (one definition shared by every Admin screen) ----------
export interface StudentTransition {
  /** Fee-document id of the transition; `unmapped:...` when it cannot be verified. */
  key: string;
  label: string;
  from: string | null;
  /** stored = recorded at registration; derived = matched via the fee config; unmapped = unverifiable. */
  source: "stored" | "derived" | "unmapped";
}

type StudentLike = {
  programType?: string; program?: string; beltLevel?: string; stageLevel?: number | string | null;
  examTransition?: { from: string | null; to: string; feeId: string };
};

export const programOf = (s: StudentLike): "KARATE" | "SELAMBAM" =>
  String(s.programType || s.program || "").toUpperCase() === "SELAMBAM" ? "SELAMBAM" : "KARATE";

/**
 * The student's registration transition. Uses the transition stored at
 * registration when present; otherwise it is derived from the Admin fee
 * configuration (a fee doc is the *target* belt/stage, "from" is the previous
 * entry - the same rule as the Fee Structure page). Anything that cannot be
 * matched stays "unmapped" - a transition is never guessed.
 */
export function resolveStudentTransition(s: StudentLike, karate: ExamTransition[], silambam: ExamTransition[]): StudentTransition {
  const program = programOf(s);
  const list = program === "KARATE" ? karate : silambam;
  const level = s.beltLevel || (s.stageLevel != null && s.stageLevel !== "" ? `Stage ${s.stageLevel}` : "");
  const st = s.examTransition;
  if (st && st.feeId) {
    return { key: st.feeId, label: st.from ? `${st.from} → ${st.to}` : st.to, from: st.from ?? null, source: "stored" };
  }
  const matched = program === "KARATE"
    ? list.find((t) => t.to === s.beltLevel)
    : list.find((t) => t.stageNumber != null && String(t.stageNumber) === String(s.stageLevel));
  if (matched) return { key: matched.id, label: matched.label, from: matched.from, source: "derived" };
  return { key: `unmapped:${program}:${level}`, label: level || "—", from: null, source: "unmapped" };
}

/** Dropdown options: complete "from → to" transitions from the config (never bare belt names). */
export function transitionFilterOptions(
  program: "all" | "KARATE" | "SELAMBAM",
  karate: ExamTransition[],
  silambam: ExamTransition[],
): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const prefix = program === "all";
  if (program !== "SELAMBAM") karate.forEach((t) => out.push({ key: t.id, label: `${prefix ? "Karate: " : ""}${t.label}` }));
  if (program !== "KARATE") silambam.forEach((t) => out.push({ key: t.id, label: `${prefix ? "Silambam: " : ""}${t.label}` }));
  return out;
}
