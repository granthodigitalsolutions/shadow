import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Users, LogOut, ArrowRight, Loader2, AlertCircle, ClipboardList, Camera, CheckCircle2, X, QrCode, UserPlus } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { getExaminerStudents, scanExaminerStudent, ExaminerBatch, ExaminerStudent } from "../../services/examinerApi";
import { formatBatchName } from "../../utils/batchFormatters";
import { ThemeToggle } from "../ui/ThemeToggle";

const PRESET_COUNTS = [5, 10, 20, 50];
// Ignore an identical re-decode of a QR still sitting in frame — the scan
// itself is already duplicate-safe server-side, this just avoids spamming
// the network with the same value every ~100ms while it's in view.
const RESCAN_COOLDOWN_MS = 2500;

// Batch-scoped roster + "how many should I examine this sitting" picker.
// Reachable only with a valid examinerToken (see ExaminerProtectedRoute).
//
// Dynamic Student Assignment: a Generate Batch batch now starts with empty
// badge slots. The section at the top of this screen is how those slots get
// filled — the examiner scans (or types) each present student's own existing
// QR/ID, one at a time, as they physically show up. Everything below that
// (the "how many to score now" picker + Start Scoring) is unchanged — it
// simply now operates over whichever students have actually been scanned in
// so far, instead of a list the batch was pre-filled with at generation time.
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

  // ── Scan-to-assign state ──────────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerStarted = useRef(false);
  const lastScan = useRef<{ value: string; at: number } | null>(null);
  // The camera callback is registered once per scanning session, so it would
  // see a stale `scanBusy` — this ref is the reliable in-flight guard.
  const busyRef = useRef(false);

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
  const capacity = batch?.maxSize ?? students.length;
  const slotsFull = capacity > 0 && students.length >= capacity;

  const handleExit = () => {
    localStorage.removeItem("examinerToken");
    localStorage.removeItem("examinerBatch");
    localStorage.removeItem("examinerSessionQueue");
    localStorage.removeItem("examinerSessionIndex");
    navigate("/examiner");
  };

  // ── Scan-to-assign ───────────────────────────────────────────────────────

  const handleAddStudent = async (rawValue: string, fromCamera = false) => {
    const value = rawValue.trim();
    if (!value || busyRef.current) return;

    // Only the live camera re-decodes the same QR many times a second while
    // it sits in frame — a manual Add is a deliberate action and must always
    // reach the server (so a repeat still gets its "already added" message).
    if (fromCamera) {
      const now = Date.now();
      if (lastScan.current && lastScan.current.value === value && now - lastScan.current.at < RESCAN_COOLDOWN_MS) {
        return;
      }
      lastScan.current = { value, at: now };
    }

    busyRef.current = true;
    setScanBusy(true);
    setScanFeedback(null);
    try {
      const { status, data } = await scanExaminerStudent(value);
      if (status === 401) {
        navigate("/examiner", { replace: true });
        return;
      }
      if (!data.success || !data.student) {
        setScanFeedback({ type: "error", message: data.message || "Could not add this student. Please try again." });
        return;
      }
      // Reflect the new student immediately — no full re-fetch needed.
      setStudents((prev) => (prev.some((s) => s.id === data.student!.id) ? prev : [...prev, data.student!]));
      setBatch((prev) => (prev ? { ...prev, totalStudents: prev.totalStudents + 1, pendingCount: prev.pendingCount + 1 } : prev));
      setScanFeedback({ type: "success", message: `${data.student.name || "Student"} added — Ready.` });
      setManualId("");
    } catch (e: any) {
      setScanFeedback({ type: "error", message: e?.message || "Could not reach the server. Check your connection and try again." });
    } finally {
      busyRef.current = false;
      setScanBusy(false);
    }
  };

  // Live camera scanning — identical lifecycle pattern to ExaminerEntry.tsx's
  // QR scanner, just feeding decoded values into handleAddStudent() instead
  // of the batch-code verifier, and staying open so several students in a
  // row can be scanned without re-opening the camera each time.
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;

    const startCamera = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (cancelled || !document.getElementById("roster-qr-reader")) return;

      setCameraError(null);

      try {
        const html5Qrcode = new Html5Qrcode("roster-qr-reader");
        scannerRef.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleAddStudent(decodedText, true);
          },
          () => {
            // Suppress per-frame decode errors
          },
        );
        scannerStarted.current = true;
      } catch (error: any) {
        if (cancelled) return;
        const name = error?.name || "";
        const msg = error?.message || "";
        if (name === "NotAllowedError" || msg.includes("NotAllowedError")) {
          setCameraError("Camera permission denied. Please allow camera access and try again.");
        } else if (name === "NotFoundError" || msg.includes("NotFoundError")) {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError("Unable to start camera. Please check your browser settings and try again.");
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      if (scannerRef.current && scannerStarted.current) {
        scannerRef.current.stop().catch(() => {});
        scannerStarted.current = false;
      }
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const handleStopScanning = async () => {
    if (scannerRef.current && scannerStarted.current) {
      try {
        await scannerRef.current.stop();
      } catch (_) {}
      scannerStarted.current = false;
    }
    scannerRef.current = null;
    setScanning(false);
    setCameraError(null);
  };

  const handleManualAdd = () => {
    if (!manualId.trim()) return;
    handleAddStudent(manualId.trim());
  };

  // ── Start scoring (unchanged) ────────────────────────────────────────────

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
              {batch.belt && (
                <span className="bg-zinc-800 px-3 py-1 rounded-md text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  {batch.belt}
                </span>
              )}
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
              <p className="text-xs font-semibold text-zinc-400 mt-0.5">
                {students.length} of {capacity} badge slot{capacity === 1 ? "" : "s"} assigned
              </p>
            </div>
          </div>
          <ClipboardList className="w-8 h-8 text-zinc-200 dark:text-zinc-700" />
        </div>

        {/* Scan-to-assign */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 mb-1 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-500" />
              Add Students
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {slotsFull
                ? "Every badge slot for this batch has a student assigned."
                : "Scan each present student's own QR code as they arrive — they're added here right away."}
            </p>
          </div>

          {scanFeedback && (
            <div
              className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-semibold ${
                scanFeedback.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"
              }`}
            >
              {scanFeedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span>{scanFeedback.message}</span>
            </div>
          )}

          {scanning ? (
            <div>
              <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3 flex items-center justify-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                </span>
                <p className="text-xs font-bold text-blue-900 dark:text-blue-300">
                  {scanBusy ? "Adding student…" : "Scanning — point at the next student's QR"}
                </p>
              </div>
              <div
                id="roster-qr-reader"
                className="mb-3 rounded-2xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-800 bg-black min-h-[220px]"
              />
              {cameraError && (
                <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">{cameraError}</p>
                </div>
              )}
              <button
                onClick={handleStopScanning}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
                Done Scanning
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => {
                  setScanFeedback(null);
                  setScanning(true);
                }}
                disabled={slotsFull}
                className="w-full flex items-center justify-center gap-2 px-5 py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-base active:scale-[0.98] transition-all"
              >
                <Camera className="w-5 h-5" />
                Scan Student QR
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Or</span>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualId}
                  disabled={slotsFull || scanBusy}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
                  placeholder="Enter Student ID"
                  className="flex-1 min-w-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                />
                <button
                  onClick={handleManualAdd}
                  disabled={slotsFull || scanBusy || !manualId.trim()}
                  className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
                >
                  {scanBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Add
                </button>
              </div>
            </>
          )}

          {students.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Added This Session ({students.length})
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {students.map((s) => {
                  const belt = s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "—");
                  const done = s.testStatus !== "pending";
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50 truncate">{s.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{belt}</p>
                      </div>
                      <span
                        className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          done
                            ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                            : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {done ? s.testStatus : "Ready"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {pendingStudents.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center shadow-sm">
            <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <p className="font-bold text-zinc-700 dark:text-zinc-300 text-lg mb-1">No Students Ready Yet</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {students.length === 0
                ? "Scan or add a student above to get started."
                : "Every student added so far has already been scored."}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 mb-1">
                How many students will you examine now?
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {pendingStudents.length} student{pendingStudents.length === 1 ? "" : "s"} ready and waiting.
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
