import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, LogOut, ArrowRight, Loader2, AlertCircle, ClipboardList } from "lucide-react";
import { getExaminerStudents, ExaminerBatch, ExaminerStudent } from "../../services/examinerApi";
import { formatBatchName } from "../../utils/batchFormatters";
import { ThemeToggle } from "../ui/ThemeToggle";

const PRESET_COUNTS = [5, 10, 20, 50];

// Batch-scoped roster + "how many should I examine this sitting" picker.
// Reachable only with a valid examinerToken (see ExaminerProtectedRoute).
export default function ExaminerRoster() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<ExaminerStudent[]>([]);
  const [batch, setBatch] = useState<ExaminerBatch | null>(null);

  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customCount, setCustomCount] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetchRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const { ok, status, data } = await getExaminerStudents();
      if (status === 401) {
        navigate("/examiner", { replace: true });
        return;
      }
      if (!ok || !data.success) {
        setError(data.message || "Failed to load the batch roster.");
        return;
      }
      setStudents(data.students || []);
      if (data.batch) {
        setBatch(data.batch);
        localStorage.setItem("examinerBatch", JSON.stringify(data.batch));
      }
    } catch (e: any) {
      setError(e?.message || "Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const pendingStudents = students.filter((s) => s.testStatus === "pending");

  const handleExit = () => {
    localStorage.removeItem("examinerToken");
    localStorage.removeItem("examinerBatch");
    localStorage.removeItem("examinerSessionQueue");
    localStorage.removeItem("examinerSessionIndex");
    navigate("/examiner");
  };

  const effectiveCount = customMode
    ? Math.max(0, parseInt(customCount, 10) || 0)
    : selectedCount || 0;

  const handleStart = () => {
    if (effectiveCount <= 0 || pendingStudents.length === 0) return;
    setStarting(true);
    const queue = pendingStudents.slice(0, effectiveCount).map((s) => s.id);
    localStorage.setItem("examinerSessionQueue", JSON.stringify(queue));
    localStorage.setItem("examinerSessionIndex", "0");
    navigate("/examiner/score");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400 font-bold text-sm uppercase tracking-wider">
            Loading Roster...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="font-bold text-zinc-900 dark:text-zinc-50 mb-2">Couldn't Load Roster</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={fetchRoster}
              className="w-full px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold active:scale-95 transition-all"
            >
              Try Again
            </button>
            <button
              onClick={handleExit}
              className="w-full px-5 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold active:scale-95 transition-all"
            >
              Exit Batch
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-zinc-950 text-white p-4 border-b-4 border-blue-500">
        <div className="container mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <button
              onClick={handleExit}
              className="flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Exit Batch
            </button>
            <ThemeToggle />
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-2"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {batch ? formatBatchName(batch as any).toUpperCase() : "BATCH ROSTER"}
          </h1>
          {batch && (
            <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-zinc-400">
              <span className="bg-zinc-800 px-3 py-1 rounded-md text-xs font-bold text-zinc-300 uppercase tracking-wider">
                {batch.schoolName}
              </span>
              <span>{batch.beltTestName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Progress summary */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Pending / Total
              </p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {batch ? batch.pendingCount : pendingStudents.length} / {batch ? batch.totalStudents : students.length}
              </p>
            </div>
          </div>
          <ClipboardList className="w-8 h-8 text-zinc-200 dark:text-zinc-700" />
        </div>

        {pendingStudents.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center shadow-sm">
            <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <p className="font-bold text-zinc-700 dark:text-zinc-300 text-lg mb-1">All Caught Up</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Every student in this batch has already been scored.
            </p>
            <button
              onClick={handleExit}
              className="px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold active:scale-95 transition-all"
            >
              Exit Batch
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 mb-1">
                How many students will you examine now?
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {pendingStudents.length} student{pendingStudents.length === 1 ? "" : "s"} still pending.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRESET_COUNTS.map((count) => {
                const isSelected = !customMode && selectedCount === count;
                const disabled = pendingStudents.length === 0;
                return (
                  <button
                    key={count}
                    disabled={disabled}
                    onClick={() => {
                      setCustomMode(false);
                      setSelectedCount(count);
                    }}
                    className={`px-4 py-5 rounded-2xl font-bold text-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                        : "bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-blue-300"
                    }`}
                  >
                    {count}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setCustomMode(true);
                setSelectedCount(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 transition-all ${
                customMode
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-blue-300"
              }`}
            >
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 flex-shrink-0">Custom:</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Enter a number"
                value={customCount}
                onFocus={() => {
                  setCustomMode(true);
                  setSelectedCount(null);
                }}
                onChange={(e) => setCustomCount(e.target.value.replace(/[^0-9]/g, ""))}
                className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </button>

            <button
              onClick={handleStart}
              disabled={starting || effectiveCount <= 0}
              className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              Start Scoring{effectiveCount > 0 ? ` (${Math.min(effectiveCount, pendingStudents.length)})` : ""}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
