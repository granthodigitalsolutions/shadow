// ── TEAM SHADOW KAI Scoring Constants ──────────────────────────────────────────────
// Single source of truth for all scoring categories and sub-categories.
// Auto-calculation distributes top-level scores (0–50) into named sub-categories.
// Total = Technical (50) + Athletic (50) = 100 → Percentage = Overall Score directly.

export interface ScoringCategory {
  id: string;
  name: string;
  maxPoints: number;
}

export interface SubCategory {
  id: string;
  name: string;
  /** Weight as a decimal: 0.12 = 12% */
  weight: number;
  category: 'technical' | 'athletic';
}

export interface SubCategoryResult {
  category: 'technical' | 'athletic';
  id: string;
  name: string;
  weight: number;
  /** Calculated score (rounded to 1 decimal) */
  score: number;
  /** Max possible score (= weight * 100, rounded to 1 decimal) */
  maxScore: number;
}

// ── Top-level scoring parameters (used by referee slider UI) ─────────────────

export const SCORING_CATEGORIES: ScoringCategory[] = [
  { id: 'technical', name: 'Technical Performance', maxPoints: 50 },
  { id: 'athletic',  name: 'Athletic Performance',  maxPoints: 50 },
];

// ── KARATE Sub-categories ──────────────────────────────────────────────────
export const KARATE_TECHNICAL_SUBCATEGORIES: SubCategory[] = [
  { id: 'tech_power',     name: 'Power',                weight: 0.15, category: 'technical' },
  { id: 'tech_speed',     name: 'Speed',                weight: 0.10, category: 'technical' },
  { id: 'tech_stance',    name: 'Stance',               weight: 0.15, category: 'technical' },
  { id: 'tech_attacks',   name: 'Attacks',              weight: 0.10, category: 'technical' },
  { id: 'tech_blocks',    name: 'Blocks',               weight: 0.10, category: 'technical' },
  { id: 'tech_accuracy',  name: 'Technique Accuracy',   weight: 0.20, category: 'technical' },
  { id: 'tech_control',   name: 'Control',              weight: 0.08, category: 'technical' },
  { id: 'tech_focus',     name: 'Focus',                weight: 0.05, category: 'technical' },
  { id: 'tech_distance',  name: 'Distance',             weight: 0.04, category: 'technical' },
  { id: 'tech_bunkai',    name: 'Bunkai',               weight: 0.03, category: 'technical' },
];

export const KARATE_ATHLETIC_SUBCATEGORIES: SubCategory[] = [
  { id: 'ath_power',       name: 'Power',                  weight: 0.20, category: 'athletic' },
  { id: 'ath_speed',       name: 'Speed',                  weight: 0.20, category: 'athletic' },
  { id: 'ath_endurance',   name: 'Endurance',              weight: 0.15, category: 'athletic' },
  { id: 'ath_balance',     name: 'Balance',                weight: 0.15, category: 'athletic' },
  { id: 'ath_coordination',name: 'Coordination',           weight: 0.15, category: 'athletic' },
  { id: 'ath_flexibility', name: 'Flexibility',            weight: 0.15, category: 'athletic' },
];

// ── SILAMBAM Sub-categories ──────────────────────────────────────────────────
// Technical: 100 marks distributed across 5 parameters
export const SILAMBAM_TECHNICAL_SUBCATEGORIES: SubCategory[] = [
  { id: 'tech_trad_form',    name: 'Traditional Form',   weight: 0.25, category: 'technical' },
  { id: 'tech_footwork',     name: 'Footwork',            weight: 0.20, category: 'technical' },
  { id: 'tech_grip',         name: 'Grip & Handling',     weight: 0.15, category: 'technical' },
  { id: 'tech_angles',       name: 'Angles & Targeting',  weight: 0.15, category: 'technical' },
  { id: 'tech_timing',       name: 'Timing',              weight: 0.25, category: 'technical' },
];

// Athletic: 100 marks distributed equally across 5 parameters
export const SILAMBAM_ATHLETIC_SUBCATEGORIES: SubCategory[] = [
  { id: 'ath_speed',      name: 'Speed',      weight: 0.20, category: 'athletic' },
  { id: 'ath_balance',    name: 'Balance',    weight: 0.20, category: 'athletic' },
  { id: 'ath_agility',    name: 'Agility',    weight: 0.20, category: 'athletic' },
  { id: 'ath_strength',   name: 'Strength',   weight: 0.20, category: 'athletic' },
  { id: 'ath_endurance',  name: 'Endurance',  weight: 0.20, category: 'athletic' },
];

// Combine all for general referencing if needed, though they shouldn't be mixed.
export const ALL_SUBCATEGORIES = [
  ...KARATE_TECHNICAL_SUBCATEGORIES, 
  ...KARATE_ATHLETIC_SUBCATEGORIES, 
  ...SILAMBAM_TECHNICAL_SUBCATEGORIES, 
  ...SILAMBAM_ATHLETIC_SUBCATEGORIES
];

// ── Auto-calculation ──────────────────────────────────────────────────────────

/**
 * Given top-level Technical score (0–50) and Athletic score (0–50),
 * and the programType, returns a fully computed SubCategoryResult[] for all sub-categories.
 * Overall = Technical + Athletic (max 100). Percentage = Overall directly.
 */
export function calculateSubScores(
  technicalScore: number,
  athleticScore: number,
  programType: 'KARATE' | 'SELAMBAM'
): SubCategoryResult[] {
  const isKarate = programType === 'KARATE';
  
  const techSubs = isKarate ? KARATE_TECHNICAL_SUBCATEGORIES : SILAMBAM_TECHNICAL_SUBCATEGORIES;
  const athSubs = isKarate ? KARATE_ATHLETIC_SUBCATEGORIES : SILAMBAM_ATHLETIC_SUBCATEGORIES;

  const tech = techSubs.map((sub) => ({
    category: 'technical' as const,
    id: sub.id,
    name: sub.name,
    weight: sub.weight,
    score: Math.round(technicalScore * sub.weight * 10) / 10,
    maxScore: Math.round(sub.weight * 50 * 10) / 10, // max = weight × 50
  }));

  const ath = athSubs.map((sub) => ({
    category: 'athletic' as const,
    id: sub.id,
    name: sub.name,
    weight: sub.weight,
    score: Math.round(athleticScore * sub.weight * 10) / 10,
    maxScore: Math.round(sub.weight * 50 * 10) / 10, // max = weight × 50
  }));

  return [...tech, ...ath];
}

/**
 * Build the top-level scoringResults array (stored alongside subCategoryResults).
 * lessonNumbers is optional — from the referee's lesson number inputs.
 */
export function buildScoringResults(
  technicalScore: number,
  athleticScore: number,
  lessonNumbers?: { [parameterId: string]: number },
) {
  return SCORING_CATEGORIES.map((cat) => ({
    parameterId: cat.id,
    parameterName: cat.name,
    score: cat.id === 'technical' ? technicalScore : athleticScore,
    maxScore: cat.maxPoints,
    lessonNumber: lessonNumbers?.[cat.id] ?? undefined,
  }));
}

// ── Grading ────────────────────────────────────────────────────────────────────

/**
 * Overall percentage → letter grade, per the standard 50+50 grading scale
 * (Percentage = Overall Score directly, since Technical + Athletic max out at 100):
 * 90–100 A+, 80–89 A, 70–79 B, 60–69 C, 50–59 D, below 50 F.
 */
export function getGrade(percentage?: number): string {
  if (percentage == null || Number.isNaN(percentage)) return "-";
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}

// ── Lesson numbering (Examiner "Volume" navigation) ───────────────────────────
// Lessons run 1–30 (see types/admin.ts ScoringParameter.lessonNumber). The
// Examiner UI groups them into "volumes" of 10 lessons purely as a navigation
// convenience — there is no separate stored "volume" field; it's always
// derived from the single lesson number that already gets saved in
// scoringResults[].lessonNumber, so there's nothing new to keep in sync.
export const LESSONS_PER_VOLUME = 10;
export const TOTAL_LESSONS = 30;
export const VOLUME_COUNT = Math.ceil(TOTAL_LESSONS / LESSONS_PER_VOLUME);

export function lessonToVolume(lessonNumber: number): number {
  return Math.min(VOLUME_COUNT, Math.max(1, Math.ceil(lessonNumber / LESSONS_PER_VOLUME)));
}

export function lessonWithinVolume(lessonNumber: number): number {
  return ((Math.max(1, lessonNumber) - 1) % LESSONS_PER_VOLUME) + 1;
}

export function volumeAndLessonToNumber(volume: number, lessonInVolume: number): number {
  const v = Math.min(VOLUME_COUNT, Math.max(1, volume));
  const l = Math.min(LESSONS_PER_VOLUME, Math.max(1, lessonInVolume));
  return (v - 1) * LESSONS_PER_VOLUME + l;
}

// ── Ranking helpers ────────────────────────────────────────────────────────────

/**
 * Given a list of {id, score}, returns a map of studentId → rank (1-based).
 * Students with the same score share the same rank.
 */
export function computeRankings(students: { id: string; score?: number }[]): Record<string, number> {
  const sorted = [...students]
    .filter((s) => s.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const rankMap: Record<string, number> = {};
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score !== sorted[i - 1].score) rank = i + 1;
    rankMap[sorted[i].id] = rank;
  }
  return rankMap;
}
