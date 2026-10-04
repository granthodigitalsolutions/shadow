// Reads the examiner's saved assessment breakdown from a student record.
//
// Both the Examiner Portal and the Admin "Score Student" screen save results via
// buildScoringResults() (constants/scoring.ts) into `scoringResults`:
//   [{ parameterId: "technical", score, maxScore, lessonNumber }, { parameterId: "athletic", ... }]
// alongside the stored totals `score` (technical + athletic) and `percentage`.
// Nothing is recalculated here: values are shown exactly as saved, and anything
// missing (older records) is returned as null - never invented or treated as 0.

export interface ResultBreakdown {
  technicalScore: number | null;
  technicalMax: number | null;
  technicalLesson: string | null;
  athleticScore: number | null;
  athleticMax: number | null;
  athleticLesson: string | null;
  /** Stored total exactly as saved (the Results page shows the same value). */
  total: number | null;
  /** Stored percentage exactly as saved. */
  percentage: number | null;
  /** True when both parts exist but do not add up to the stored total. */
  totalMismatch: boolean;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const lesson = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const findPart = (results: any[], key: "technical" | "athletic") =>
  results.find((r) => r && (r.parameterId === key || String(r.parameterName || "").toLowerCase().startsWith(key)));

export function extractBreakdown(student: { scoringResults?: any; score?: unknown; percentage?: unknown }): ResultBreakdown {
  const results = Array.isArray(student.scoringResults) ? student.scoringResults : [];
  const tech = findPart(results, "technical");
  const ath = findPart(results, "athletic");
  const technicalScore = num(tech?.score);
  const athleticScore = num(ath?.score);
  const total = num(student.score);
  return {
    technicalScore,
    technicalMax: num(tech?.maxScore),
    technicalLesson: lesson(tech?.lessonNumber),
    athleticScore,
    athleticMax: num(ath?.maxScore),
    athleticLesson: lesson(ath?.lessonNumber),
    total,
    percentage: num(student.percentage),
    totalMismatch:
      technicalScore !== null && athleticScore !== null && total !== null &&
      Math.abs(technicalScore + athleticScore - total) > 1e-9,
  };
}

/** Score as stored (no re-rounding); "—" when unavailable. */
export const fmtScore = (v: number | null): string => (v === null ? "—" : String(v));
