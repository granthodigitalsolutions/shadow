import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, AlertTriangle, LogOut, ArrowRight, Loader2, BookOpen, Dumbbell, Minus, Plus } from "lucide-react";
import {
  getExaminerStudents,
  submitExaminerScore,
  ExaminerStudent,
} from "../../services/examinerApi";
import { firebaseAdminSettingsService } from "../../services/firebaseData";
import {
  SCORING_CATEGORIES,
  calculateSubScores,
  buildScoringResults,
  getGrade,
} from "../../constants/scoring";

type SubmissionResult =
  | { type: "success"; percentage: number; result: "passed" | "failed" }
  | { type: "duplicate" }
  | null;

function readQueue(): string[] {
  try {
    const raw = localStorage.getItem("examinerSessionQueue");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readIndex(): number {
  const raw = localStorage.getItem("examinerSessionIndex");
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

function buildDefaultScores() {
  const scores: { [key: string]: number } = {};
  const lessonNumbers: { [key: string]: number | "" } = {};
  SCORING_CATEGORIES.forEach((param) => {
    scores[param.id] = 0;
    lessonNumbers[param.id] = 1;
  });
  return { scores, lessonNumbers };
}

const clearExaminerSession = () => {
  localStorage.removeItem("examinerToken");
  localStorage.removeItem("examinerBatch");
  localStorage.removeItem("examinerSessionQueue");
  localStorage.removeItem("examinerSessionIndex");
};

// Tailwind's scanner needs each full class name to appear literally in this
// file's text — `thumbClasses` below spells both variants out completely
// (rather than interpolating just the color) so the arbitrary slider-thumb
// selectors actually get generated for both accents.
const ACCENTS = {
  blue: {
    text: "text-blue-400",
    track: "#3b82f6",
    icon: "bg-blue-500/10 text-blue-400",
    thumbClasses: "[&::-webkit-slider-thumb]:border-blue-500 [&::-moz-range-thumb]:border-blue-500",
  },
  orange: {
    text: "text-orange-400",
    track: "#f97316",
    icon: "bg-orange-500/10 text-orange-400",
    thumbClasses: "[&::-webkit-slider-thumb]:border-orange-500 [&::-moz-range-thumb]:border-orange-500",
  },
} as const;

// ── Score card — dark, mobile-first, styled after the reference "volume
// slider" (draggable/clickable big thumb + tick labels + FINE TUNE +/-),
// plus a free-typed Lesson No. field ("older version" style). Technical and
// Athletic use this exact same component. Max is 50 for both categories
// (SCORING_CATEGORIES) — nothing else in this file changes that.
function ScoreCard({
  title,
  icon: Icon,
  accent,
  maxPoints,
  score,
  onScoreChange,
  onStep,
  lessonNumber,
  onLessonChange,
}: {
  title: string;
  icon: typeof BookOpen;
  accent: keyof typeof ACCENTS;
  maxPoints: number;
  score: number;
  onScoreChange: (value: number) => void;
  /** Fine-tune +/-1, applied against the latest state (not this render's
   * `score` prop) so a quick run of taps can never collapse into one step. */
  onStep: (delta: number) => void;
  lessonNumber: number | "";
  onLessonChange: (value: number | "") => void;
}) {
  const a = ACCENTS[accent];
  const pct = maxPoints > 0 ? (score / maxPoints) * 100 : 0;
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => Math.round(maxPoints * f));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-sm p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${a.icon}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <h3 className="text-base font-bold tracking-wide text-zinc-50 uppercase">{title}</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Lesson</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={lessonNumber === "" ? "" : lessonNumber}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              if (e.target.value === "") onLessonChange(1);
            }}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              onLessonChange(val === "" ? "" : parseInt(val, 10));
            }}
            className="w-16 px-2 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-bold text-zinc-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-center"
          />
        </div>
      </div>

      <p className="text-center text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Score</p>
      <div className="flex items-end justify-center gap-1.5 mb-4">
        <span className={`text-5xl font-bold ${a.text}`}>{score}</span>
        <span className="text-lg font-bold text-zinc-500 mb-1">/ {maxPoints}</span>
      </div>

      <input
        type="range"
        min={0}
        max={maxPoints}
        step={1}
        value={score}
        onChange={(e) => onScoreChange(parseInt(e.target.value, 10))}
        style={{ background: `linear-gradient(to right, ${a.track} ${pct}%, #3f3f46 ${pct}%)` }}
        className={`w-full h-3 rounded-full appearance-none cursor-pointer touch-none
          [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full
          [&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:mt-[-10px]
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:shadow-lg
          [&::-moz-range-thumb]:w-8 [&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
          [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:shadow-lg ${a.thumbClasses}`}
      />
      <div className="flex justify-between mt-2 px-0.5">
        {ticks.map((t) => (
          <span key={t} className="text-[11px] font-semibold text-zinc-500">{t}</span>
        ))}
      </div>

      <div className="flex items-center justify-center gap-5 mt-5">
        <button
          onClick={() => onStep(-1)}
          aria-label="Decrease score"
          className="w-14 h-14 flex items-center justify-center rounded-2xl bg-zinc-800 text-zinc-200 active:scale-95 transition-all"
        >
          <Minus className="w-5 h-5" />
        </button>
        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Fine Tune</span>
        <button
          onClick={() => onStep(1)}
          aria-label="Increase score"
          className="w-14 h-14 flex items-center justify-center rounded-2xl bg-zinc-800 text-zinc-200 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Single-student-at-a-time scoring screen with auto-advance (explicit tap,
// not timed). Always dark themed. Route-guarded by ExaminerProtectedRoute.
const technicalMax = SCORING_CATEGORIES.find((c) => c.id === "technical")?.maxPoints ?? 50;
const athleticMax = SCORING_CATEGORIES.find((c) => c.id === "athletic")?.maxPoints ?? 50;

export default function ExaminerScoring() {
  const navigate = useNavigate();

  const [queue] = useState<string[]>(readQueue);
  const [sessionIndex, setSessionIndex] = useState<number>(readIndex);

  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterMap, setRosterMap] = useState<Record<string, ExaminerStudent>>({});
  const [passPercentage, setPassPercentage] = useState<number>(60);

  const defaults = buildDefaultScores();
  const [scores, setScores] = useState<{ [key: string]: number }>(defaults.scores);
  const [lessonNumbers, setLessonNumbers] = useState<{ [key: string]: number | "" }>(defaults.lessonNumbers);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult>(null);

  const loadRoster = useCallback(async () => {
    setLoadingRoster(true);
    setRosterError(null);
    try {
      const { status, data } = await getExaminerStudents();
      if (status === 401) {
        navigate("/examiner", { replace: true });
        return;
      }
      if (!data.success) {
        setRosterError(data.message || "Failed to load students.");
        return;
      }
      const map: Record<string, ExaminerStudent> = {};
      (data.students || []).forEach((s) => {
        map[s.id] = s;
      });
      setRosterMap(map);

      if (data.batch) {
        try {
          const settings = await firebaseAdminSettingsService.get(data.batch.programType);
          setPassPercentage((settings as any)?.minimumPassingPercentage || 60);
        } catch {
          setPassPercentage(60);
        }
      }
    } catch (e: any) {
      setRosterError(e?.message || "Could not reach the server. Check your connection and try again.");
    } finally {
      setLoadingRoster(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (queue.length === 0) {
      navigate("/examiner/batch", { replace: true });
      return;
    }
    loadRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    const next = buildDefaultScores();
    setScores(next.scores);
    setLessonNumbers(next.lessonNumbers);
    setSubmitError(null);
  };

  const handleNext = () => {
    const nextIndex = sessionIndex + 1;
    localStorage.setItem("examinerSessionIndex", String(nextIndex));
    setSessionIndex(nextIndex);
    setSubmissionResult(null);
    resetForm();
  };

  const handleExit = () => {
    clearExaminerSession();
    navigate("/examiner");
  };

  const handleSelectMore = () => {
    localStorage.removeItem("examinerSessionQueue");
    localStorage.removeItem("examinerSessionIndex");
    navigate("/examiner/batch");
  };

  const handleScoreChange = (parameterId: string, value: number, maxPoints: number) => {
    setScores((prev) => ({ ...prev, [parameterId]: Math.min(Math.max(0, value), maxPoints) }));
  };

  // Fine-tune +/-1 — reads the latest score from the updater, not from a
  // render's closed-over prop, so a quick run of taps always adds up
  // correctly instead of collapsing into a single step.
  const handleScoreStep = (parameterId: string, delta: number, maxPoints: number) => {
    setScores((prev) => ({ ...prev, [parameterId]: Math.min(Math.max(0, (prev[parameterId] ?? 0) + delta), maxPoints) }));
  };

  const handleLessonChange = (parameterId: string, value: number | "") => {
    setLessonNumbers((prev) => ({ ...prev, [parameterId]: value === "" ? "" : Math.max(1, value) }));
  };

  const isComplete = sessionIndex >= queue.length;
  const currentStudentId = !isComplete ? queue[sessionIndex] : undefined;
  const currentStudent = currentStudentId ? rosterMap[currentStudentId] : undefined;

  const handleSubmit = async () => {
    if (!currentStudent) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const techScore = scores["technical"] ?? 0;
      const athScore = (scores as any)["athletic"] ?? (scores as any)["athletics"] ?? 0;
      const totalScore = techScore + athScore;
      const maxScore = SCORING_CATEGORIES.reduce((sum, p) => sum + p.maxPoints, 0);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const passed = percentage >= passPercentage;

      const subCategoryResults = calculateSubScores(techScore, athScore, currentStudent.programType);
      const scoringResultsPayload = buildScoringResults(techScore, athScore, lessonNumbers as any);

      const { status, data } = await submitExaminerScore({
        studentId: currentStudent.id,
        technicalScore: techScore,
        athleticScore: athScore,
        scoringResults: scoringResultsPayload,
        subCategoryResults,
        percentage,
        result: passed ? "passed" : "failed",
        lessonNumbers,
      });

      if (status === 401) {
        clearExaminerSession();
        navigate("/examiner", { replace: true });
        return;
      }

      if (status === 409) {
        setSubmissionResult({ type: "duplicate" });
        return;
      }

      if (!data.success) {
        setSubmitError(data.message || "Failed to submit score. Please try again.");
        return;
      }

      setSubmissionResult({
        type: "success",
        percentage: data.student?.percentage ?? percentage,
        result: ((data.student?.result as "passed" | "failed") || (passed ? "passed" : "failed")),
      });
    } catch (e: any) {
      setSubmitError(e?.message || "Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Session complete ─────────────────────────────────────────────────────
  if (isComplete) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-sm">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-zinc-50 mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            SESSION COMPLETE
          </h2>
          <p className="text-sm text-zinc-400 mb-8">
            You've scored all {queue.length} student{queue.length === 1 ? "" : "s"} in this sitting.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSelectMore}
              className="w-full px-5 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-bold active:scale-95 transition-all"
            >
              Select More Students
            </button>
            <button
              onClick={handleExit}
              className="w-full px-5 py-4 bg-zinc-800 text-zinc-300 rounded-2xl font-bold active:scale-95 transition-all"
            >
              Exit Batch
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingRoster) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 font-bold text-sm uppercase tracking-wider">Loading Students...</p>
        </div>
      </div>
    );
  }

  if (rosterError) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="font-bold text-zinc-50 mb-2">Couldn't Load Students</p>
          <p className="text-sm text-zinc-400 mb-6">{rosterError}</p>
          <div className="flex flex-col gap-3">
            <button onClick={loadRoster} className="w-full px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-all">
              Try Again
            </button>
            <button onClick={handleExit} className="w-full px-5 py-3 bg-zinc-800 text-zinc-300 rounded-xl font-bold active:scale-95 transition-all">
              Exit Batch
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Defensive: a queued student ID that no longer appears in the roster.
  if (!currentStudent) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="font-bold text-zinc-50 mb-2">Student Not Found</p>
          <p className="text-sm text-zinc-400 mb-6">
            This student could not be found in the batch roster. Skipping to the next one.
          </p>
          <button onClick={handleNext} className="w-full px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-all">
            Skip Student
          </button>
        </div>
      </div>
    );
  }

  // ── Post-submit confirmation ─────────────────────────────────────────────
  if (submissionResult) {
    const isDuplicate = submissionResult.type === "duplicate";
    const passed = !isDuplicate && submissionResult.result === "passed";

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-sm">
          {isDuplicate ? (
            <>
              <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-zinc-50 mb-2">Already Scored</h2>
              <p className="text-sm text-zinc-400 mb-8">
                This student has already been scored. Moving on to the next one.
              </p>
            </>
          ) : (
            <>
              {passed ? (
                <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
              ) : (
                <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
              )}
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">{currentStudent.name}</p>
              <h2 className={`text-3xl font-bold mb-1 ${passed ? "text-green-500" : "text-red-500"}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                {passed ? "PASSED" : "FAILED"}
              </h2>
              <p className="text-lg font-bold text-zinc-300 mb-8">
                {submissionResult.percentage}% &middot; Grade {getGrade(submissionResult.percentage)}
              </p>
            </>
          )}
          <button
            onClick={handleNext}
            className="w-full px-5 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-bold text-lg active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Next Student
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Scoring form ──────────────────────────────────────────────────────────
  const belt = currentStudent.beltLevel || (currentStudent.stageLevel != null ? `Stage ${currentStudent.stageLevel}` : "—");

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="bg-zinc-950 text-white p-4 border-b-4 border-blue-500 sticky top-0 z-10">
        <div className="container mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button onClick={handleExit} className="flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-sm transition-colors">
              <LogOut className="w-4 h-4" />
              Exit Batch
            </button>
          </div>
          <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">
            Student {sessionIndex + 1} of {queue.length}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            {currentStudent.name}
          </h1>
          <p className="text-sm font-medium text-zinc-400 mt-1">
            {currentStudent.school} &bull; {belt}
          </p>
          <div className="flex items-center gap-5 mt-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Pass</span>
              <span className="text-sm font-bold text-emerald-400">{passPercentage}%</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Grade</span>
              <span className="text-sm font-bold text-blue-400">{getGrade(passPercentage)}</span>
            </div>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 mt-4 overflow-hidden">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${queue.length > 0 ? (sessionIndex / queue.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-6 space-y-5 pb-10">
        {submitError && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-400">{submitError}</p>
          </div>
        )}

        <ScoreCard
          title="Technical"
          icon={BookOpen}
          accent="blue"
          maxPoints={technicalMax}
          score={scores["technical"] ?? 0}
          onScoreChange={(v) => handleScoreChange("technical", v, technicalMax)}
          onStep={(d) => handleScoreStep("technical", d, technicalMax)}
          lessonNumber={lessonNumbers["technical"]}
          onLessonChange={(v) => handleLessonChange("technical", v)}
        />

        <ScoreCard
          title="Athletic"
          icon={Dumbbell}
          accent="orange"
          maxPoints={athleticMax}
          score={scores["athletic"] ?? 0}
          onScoreChange={(v) => handleScoreChange("athletic", v, athleticMax)}
          onStep={(d) => handleScoreStep("athletic", d, athleticMax)}
          lessonNumber={lessonNumbers["athletic"]}
          onLessonChange={(v) => handleLessonChange("athletic", v)}
        />

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full px-6 py-5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 sticky bottom-4"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Score"
          )}
        </button>
      </div>
    </div>
  );
}
