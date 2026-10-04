import type { ExamTransition } from "./examTransitions";

// Identity of a *logical* batch: one per school (or "individual"), exam type,
// examination session (the belt test) and exact belt/stage transition. The
// display name is derived from this and is never used as the identifier, so a
// rename can't break QR codes, allocations or history.

export interface BatchTransition {
  /** Fee-document id of the configured transition, or `unmapped:...` when the belt isn't in the config. */
  key: string;
  from: string | null;
  to: string;
  /** "White → Yellow" (just the stage name when nothing precedes it). */
  label: string;
  source: "config" | "unmapped";
}

/** Resolve the stored belt/stage value of a batch to its configured transition. Never guesses. */
export function resolveBatchTransition(
  programType: "KARATE" | "SELAMBAM",
  belt: string,
  karate: ExamTransition[],
  silambam: ExamTransition[],
): BatchTransition {
  const value = String(belt ?? "").trim();
  const list = programType === "KARATE" ? karate : silambam;
  const matched = programType === "KARATE"
    ? list.find((t) => t.to === value)
    : list.find((t) => t.stageNumber != null && String(t.stageNumber) === value);
  if (matched) return { key: matched.id, from: matched.from, to: matched.to, label: matched.label, source: "config" };
  const label = programType === "SELAMBAM" && /^\d+$/.test(value) ? `Stage ${value}` : value || "Mixed";
  return { key: `unmapped:${programType}:${value}`, from: null, to: label, label, source: "unmapped" };
}

const part = (v: string) => String(v).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";

/**
 * Deterministic, Firestore-safe key of a logical batch. It doubles as the
 * document id of the batch pointer (and of newly created batches), so two
 * concurrent generator runs can only ever contend for the same document.
 */
export function logicalBatchKey(p: {
  programType: "KARATE" | "SELAMBAM";
  schoolId: string; // "individual" for individual batches
  beltTestId: string; // the examination session
  transitionKey: string;
}): string {
  return ["lb", p.programType, part(p.schoolId), part(p.beltTestId), part(p.transitionKey)].join("_");
}

/** "Karate — White → Yellow" / "Silambam — Stage 1 → Stage 2". */
export function standardBatchName(programType: "KARATE" | "SELAMBAM", transitionLabel: string): string {
  return `${programType === "SELAMBAM" ? "Silambam" : "Karate"} — ${transitionLabel}`;
}

export interface CapacityPlan {
  newCapacity: number;
  outcome: "updated" | "unchanged";
  /** The lowest capacity that still covers every occupied or reserved slot. */
  floor: number;
}

/**
 * Capacity growth for an existing logical batch. Required capacity is the
 * students already in the batch plus every verified, still-unbatched student
 * who is eligible for it. Capacity only ever grows, and never drops below
 * what examiners reserved plus students placed outside an allocation.
 */
export function planCapacity(
  batch: { maxSize?: number; studentIds?: string[]; allocatedCount?: number; allocatedAssigned?: number },
  eligibleUnbatched: number,
): CapacityPlan {
  const assigned = new Set(batch.studentIds || []).size;
  const current = Number.isInteger(batch.maxSize) ? (batch.maxSize as number) : 0;
  const floor = (batch.allocatedCount || 0) + Math.max(0, assigned - (batch.allocatedAssigned || 0));
  const required = assigned + Math.max(0, eligibleUnbatched);
  const newCapacity = Math.max(current, required, floor);
  return { newCapacity, outcome: newCapacity > current ? "updated" : "unchanged", floor };
}
