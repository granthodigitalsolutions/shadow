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
  VOLUME_COUNT,
  lessonToVolume,
  lessonWithinVolume,
  volumeAndLessonToNumber,
} from "../../constants/scoring";
import { ThemeToggle } from "../ui/ThemeToggle";

type SubmissionResult =
  | { type: "success"; percentage: number; result: "passed" | "failed" }
  | { type: "duplicate" }
  | null;

type LessonNumbers = { technical: number; athletic: number };

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

// Every student starts fresh at Volume 1 / Lesson 1 in each category — the
// examiner picks the volume/lesson being tested for THIS student, never the
// previous one's.
const DEFAULT_LESSON_NUMBERS: LessonNumbers = { technical: 1, athletic: 1 };

const clearExaminerSession = () => {
  localStorage.removeItem("examinerToken");
  localStorage.removeItem("examinerBatch");
  localStorage.removeItem("examinerSessionQueue");
  localStorage.removeItem("examinerSessionIndex");
};

// ── Volume/Lesson picker — identical component for Technical and Athletic ────
// Pure navigation over the existing single "lesson number" field (1–30); see
// constants/scoring.ts. No score of any kind is collected here.
function VolumeLessonCard({
  title,
  icon: Icon,
  accent,
  lessonNumber,
  onVolumeChange,
  onLessonStep,
}: {
  title: string;
  icon: typeof BookOpen;
  accent: "blue" | "orange";
  lessonNumber: number;
  onVolumeChange: (volume: number) => void;
  onLessonStep: (delta: number) => void;
}) {
  const volume = lessonToVolume(lessonNumber);
  const lessonInVolume = lessonWithinVolume(lessonNumber);
  const accentClasses = accent === "blue"
    ? { bar: "bg-blue-500", icon: "bg-blue-50 dark:bg-blue-900/20 text-blue-600", chipActive: "bg-blue-500 text-white" }
    : { bar: "bg-orange-500", icon: "bg-orange-50 dark:bg-orange-900/20 text-orange-600", chipActive: "bg-orange-500 text-white" };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-5 sm:p-6 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full ${accentClasses.bar}`} />
      <div className="flex items-center gap-3 mb-5 pl-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accentClasses.icon}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        <h3 className="text-base font-bold tracking-wide text-zinc-900 dark:text-zinc-50 uppercase">{title}</h3>
      </div>

      <div className="pl-2 space-y-5">
        {/* Volume */}
        <div>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Volume</p>
          <div className="flex gap-2">
            {Array.from({ length: VOLUME_COUNT }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                onClick={() => onVolumeChange(v)}
                className={`flex-1 py-3.5 rounded-xl font-bold text-lg transition-all active:scale-95 ${
                  v === volume
                    ? `${accentClasses.chipActive} shadow-sm`
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Lesson */}
        <div>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5">Lesson</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onLessonStep(-1)}
              aria-label="Previous lesson"
              className="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 active:scale-95 transition-all"
            >
              <Minus className="w-5 h-5" />
            </button>
            <div className="flex-1 h-14 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
              <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{String(lessonInVolume).padStart(2, "0")}</span>
            </div>
            <button
              onClick={() => onLessonStep(1)}
              aria-label="Next lesson"
              className="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 active:scale-95 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Single-student-at-a-time screen with auto-advance (explicit tap, not
// timed). Route-guarded by ExaminerProtectedRoute.
//
// The examiner no longer enters a score here — Technical/Athletic score
// entry has been removed from this screen entirely. Tapping "Next Student"
// records full marks (100%, pass) using the existing scoring pipeline
// (SCORING_CATEGORIES / calculateSubScores / buildScoringResults), so every
// other part of the app (results, PDFs, WhatsApp, rankings) keeps working
// unchanged. The Volume/Lesson pickers below only record which lesson was
// covered, via the existing per-category lesson number field.
export default function ExaminerScoring() {
  const navigate = useNavigate();

  const [queue] = useState<string[]>(readQueue);
  const [sessionIndex, setSessionIndex] = useState<number>(readIndex);

  const [loadingRoster, setLoadingRoster] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterMap, setRosterMap] = useState<Record<string, ExaminerStudent>>({});
  const [passPercentage, setPassPercentage] = useState<number>(60);

  const [lessonNumbers, setLessonNumbers] = useState<LessonNumbers>(DEFAULT_LESSON_NUMBERS);

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
    setLessonNumbers(DEFAULT_LESSON_NUMBERS);
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

  const handleVolumeChange = (category: keyof LessonNumbers, volume: number) => {
    setLessonNumbers((prev) => ({ ...prev, [category]: volumeAndLessonToNumber(volume, lessonWithinVolume(prev[category])) }));
  };

  const handleLessonStep = (category: keyof LessonNumbers, delta: number) => {
    setLessonNumbers((prev) => {
      const volume = lessonToVolume(prev[category]);
      const nextLesson = lessonWithinVolume(prev[category]) + delta;
      const clamped = Math.min(10, Math.max(1, nextLesson));
      return { ...prev, [category]: volumeAndLessonToNumber(volume, clamped) };
    });
  };

  const isComplete = sessionIndex >= queue.length;
  const currentStudentId = !isComplete ? queue[sessionIndex] : undefined;
  const currentStudent = currentStudentId ? rosterMap[currentStudentId] : undefined;

  const handleSubmit = async () => {
    if (!currentStudent) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Full marks in both categories — see the file-level comment above.
      const techScore = SCORING_CATEGORIES.find((c) => c.id === "technical")?.maxPoints ?? 0;
      const athScore = SCORING_CATEGORIES.find((c) => c.id === "athletic")?.maxPoints ?? 0;
      const totalScore = techScore + athScore;
      const maxScore = SCORING_CATEGORIES.reduce((sum, p) => sum + p.maxPoints, 0);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const passed = percentage >= passPercentage;

      const subCategoryResults = calculateSubScores(techScore, athScore, currentStudent.programType);
      const scoringResultsPayload = buildScoringResults(techScore, athScore, lessonNumbers);

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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            SESSION COMPLETE
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
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
              className="w-full px-5 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold active:scale-95 transition-all"
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm uppercase tracking-wider">Loading Students...</p>
        </div>
      </div>
    );
  }

  if (rosterError) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">Couldn't Load Students</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{rosterError}</p>
          <div className="flex flex-col gap-3">
            <button onClick={loadRoster} className="w-full px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-all">
              Try Again
            </button>
            <button onClick={handleExit} className="w-full px-5 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold active:scale-95 transition-all">
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">Student Not Found</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          {isDuplicate ? (
            <>
              <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Already Scored</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
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
              <h2 className={`text-3xl font-bold mb-1 ${passed ? "text-green-600" : "text-red-500"}`} style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                {passed ? "PASSED" : "FAILED"}
              </h2>
              <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300 mb-8">
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

  // ── Main screen — student info + Volume/Lesson pickers only ──────────────
  const belt = currentStudent.beltLevel || (currentStudent.stageLevel != null ? `Stage ${currentStudent.stageLevel}` : "—");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="bg-zinc-950 text-white p-4 border-b-4 border-blue-500 sticky top-0 z-10">
        <div className="container mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button onClick={handleExit} className="flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-sm transition-colors">
              <LogOut className="w-4 h-4" />
              Exit Batch
            </button>
            <ThemeToggle />
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
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">{submitError}</p>
          </div>
        )}

        <VolumeLessonCard
          title="Technical"
          icon={BookOpen}
          accent="blue"
          lessonNumber={lessonNumbers.technical}
          onVolumeChange={(v) => handleVolumeChange("technical", v)}
          onLessonStep={(d) => handleLessonStep("technical", d)}
        />

        <VolumeLessonCard
          title="Athletic"
          icon={Dumbbell}
          accent="orange"
          lessonNumber={lessonNumbers.athletic}
          onVolumeChange={(v) => handleVolumeChange("athletic", v)}
          onLessonStep={(d) => handleLessonStep("athletic", d)}
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
            <>
              Next Student
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
