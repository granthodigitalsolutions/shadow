import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Award, CheckCircle, XCircle, AlertTriangle, LogOut, ArrowRight, Loader2 } from "lucide-react";
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
import { ThemeToggle } from "../ui/ThemeToggle";

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

// Single-student-at-a-time scoring screen with auto-advance (explicit tap,
// not timed) — the Examiner equivalent of ScoreStudent.tsx's "compute +
// submit immediately" model, NOT BatchScoring.tsx's bulk-submit-at-the-end
// model. Route-guarded by ExaminerProtectedRoute.
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
  const [examinerRemarks, setExaminerRemarks] = useState("");

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
    setExaminerRemarks("");
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
        examinerRemarks: examinerRemarks || undefined,
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

  // ── Scoring form ──────────────────────────────────────────────────────────
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
            {currentStudent.school} &bull; {currentStudent.beltLevel || (currentStudent.stageLevel != null ? `Stage ${currentStudent.stageLevel}` : "—")}
          </p>
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

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-5 sm:p-6">
          <h3 className="text-lg font-bold mb-5 flex items-center gap-3 text-zinc-900 dark:text-zinc-50">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Award className="w-4 h-4 text-blue-600" />
            </div>
            Scoring Parameters
          </h3>

          <div className="space-y-6">
            {SCORING_CATEGORIES.map((param) => (
              <div key={param.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl" />
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 pl-2">
                  <div>
                    <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-3">{param.name}</h4>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Lesson No.</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={lessonNumbers[param.id] === "" ? "" : lessonNumbers[param.id]}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => {
                          if (e.target.value === "") handleLessonChange(param.id, 1);
                        }}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          handleLessonChange(param.id, val === "" ? "" : parseInt(val, 10));
                        }}
                        className="w-20 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-center"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Score</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={scores[param.id]}
                        onChange={(e) => handleScoreChange(param.id, parseInt(e.target.value, 10) || 0, param.maxPoints)}
                        className="w-24 px-3 py-3 bg-white dark:bg-zinc-900 border-2 border-blue-200 dark:border-blue-900/50 rounded-xl text-2xl font-bold text-blue-600 text-center focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                        min={0}
                        max={param.maxPoints}
                      />
                      <span className="text-lg font-bold text-zinc-400">/ {param.maxPoints}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pl-2">
                  <span className="text-xs font-bold text-zinc-400 w-4">0</span>
                  <input
                    type="range"
                    min={0}
                    max={param.maxPoints}
                    value={scores[param.id]}
                    onChange={(e) => handleScoreChange(param.id, parseInt(e.target.value, 10), param.maxPoints)}
                    className="flex-1 h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs font-bold text-zinc-400 w-8 text-right">{param.maxPoints}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-5 sm:p-6">
          <h4 className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">Examiner Remarks (Optional)</h4>
          <textarea
            value={examinerRemarks}
            onChange={(e) => setExaminerRemarks(e.target.value)}
            placeholder="Add any specific feedback, technical corrections, or athletic observations..."
            className="w-full h-28 px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:border-blue-500 focus:outline-none resize-none text-zinc-900 dark:text-zinc-50"
          />
        </div>

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
