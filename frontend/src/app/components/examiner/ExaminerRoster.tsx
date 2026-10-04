import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Users, LogOut, ArrowRight, Loader2, AlertCircle, ClipboardList, Camera, CheckCircle2, X, QrCode, UserPlus, Trash2 } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { getExaminerStudents, scanExaminerStudent, allocateExaminerSlots, removeExaminerStudent, startExaminerExam, recoverExaminerSession, getExaminerCapacity, loadRecoveryHint, saveRecoveryHint, ExaminerBatch, ExaminerStudent, ExaminerCapacity } from "../../services/examinerApi";
import { formatBatchName } from "../../utils/batchFormatters";
import { ThemeToggle } from "../ui/ThemeToggle";
import { subscribeExaminerCapacity, examinerIdFromSession } from "../../services/examinerLive";
import { playSuccessBeep, unlockScanBeep } from "../../utils/scanBeep";

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

  // -- Slot allocation (server is the source of truth; restored on every load) --
  const [capacityInfo, setCapacityInfo] = useState<ExaminerCapacity | null>(null);
  const [allocQty, setAllocQty] = useState("");
  const [allocName, setAllocName] = useState("");
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverName, setRecoverName] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [allocBusy, setAllocBusy] = useState(false);
  const [allocFeedback, setAllocFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // One id per user action, reused if the same action is retried after a
  // network failure so the server applies it at most once.
  const allocRequestRef = useRef<{ qty: number; id: string } | null>(null);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  // Remove flow: inline confirmation, then one request at a time.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

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

  const fetchRoster = async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (data.capacity) setCapacityInfo(data.capacity);
      if (data.batch) {
        setBatch(data.batch);
        localStorage.setItem("examinerBatch", JSON.stringify(data.batch));
        // Slots reserved before recovery existed (or after a cleared browser):
        // have the server issue a key once so later visits restore them.
        if (data.capacity && data.capacity.mine.quantity > 0 && !loadRecoveryHint(data.batch)) {
          recoverExaminerSession({})
            .then(({ data: rec }) => {
              if (rec.result === "recovered" && rec.recoveryKey && rec.allocationId) {
                saveRecoveryHint(data.batch!, rec.allocationId, rec.recoveryKey);
              }
            })
            .catch(() => {});
        }
      }
    } catch (e: any) {
      setError(e?.message || "Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Keep "available" live: other examiners on this batch take slots at the same time.
  // Examiners aren't Firebase-signed-in (they use a batch session token), so a Firestore
  // listener isn't possible; a light server read every few seconds gives the same effect.
  const busyForPoll = allocBusy || recoverBusy;

  // Real-time: Firestore onSnapshot on this batch's counters and this examiner's allocation.
  const [liveOn, setLiveOn] = useState(false);
  useEffect(() => {
    if (loading || error || !batch?.id) return;
    const fbToken = localStorage.getItem("examinerFbToken");
    const examinerId = examinerIdFromSession(localStorage.getItem("examinerToken"));
    if (!fbToken || !examinerId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    subscribeExaminerCapacity({
      batchId: batch.id,
      examinerId,
      firebaseToken: fbToken,
      onData: (capacity, status) => {
        if (cancelled) return;
        setLiveOn(true);
        setCapacityInfo(capacity);
        if (status) setBatch((prev) => (prev ? { ...prev, status } : prev));
      },
      onError: () => { if (!cancelled) setLiveOn(false); }, // fall back to polling
    })
      .then((u) => { if (cancelled) u(); else unsubscribe = u; })
      .catch(() => { if (!cancelled) setLiveOn(false); });
    return () => { cancelled = true; setLiveOn(false); unsubscribe?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, batch?.id]);

  // Fallback only: poll when the live listener is not running.
  useEffect(() => {
    if (loading || error || liveOn) return;
    let stopped = false;
    const refresh = async () => {
      if (stopped || document.visibilityState !== "visible" || busyForPoll) return;
      try {
        const { status, data } = await getExaminerCapacity();
        if (stopped) return;
        if (status === 401) { navigate("/examiner", { replace: true }); return; }
        if (data.success && data.capacity) {
          setCapacityInfo(data.capacity);
          if (data.batchStatus) setBatch((prev) => (prev ? { ...prev, status: data.batchStatus } : prev));
        }
      } catch { /* a missed poll is harmless - the next one corrects it */ }
    };
    const timer = window.setInterval(refresh, 5000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, busyForPoll, liveOn]);

  const pendingStudents = students.filter((s) => s.testStatus === "pending");
  const capacity = batch?.maxSize ?? students.length;
  // Students can only be added into this examiner's own reserved slots.
  const slotsFull = !capacityInfo || capacityInfo.mine.remaining <= 0;

  // Found an earlier allocation by the name used when reserving (e.g. after
  // the browser's saved data was cleared). The backend re-binds this session.
  const handleRecoverByName = async () => {
    const name = recoverName.trim();
    if (recoverBusy || name.length < 2) return;
    setRecoverBusy(true);
    setAllocFeedback(null);
    try {
      const { status, data } = await recoverExaminerSession({ examinerName: name });
      if (status === 401) {
        navigate("/examiner", { replace: true });
        return;
      }
      if (!data.success) {
        setAllocFeedback({ type: "error", message: data.message || "Could not check for earlier slots. Please try again." });
        return;
      }
      if (data.result === "recovered" && data.token) {
        localStorage.setItem("examinerToken", data.token);
        if (data.firebaseToken) localStorage.setItem("examinerFbToken", data.firebaseToken);
        if (batch && data.allocationId && data.recoveryKey) saveRecoveryHint(batch, data.allocationId, data.recoveryKey);
        setRecoverOpen(false);
        setRecoverName("");
        await fetchRoster(true);
        setAllocFeedback({ type: "success", message: "Your earlier slots and students are restored." });
      } else {
        setAllocFeedback({ type: "error", message: "No earlier slots were found under that name for this batch." });
      }
    } catch (e: any) {
      setAllocFeedback({ type: "error", message: e?.message || "Could not reach the server. Check your connection and try again." });
    } finally {
      setRecoverBusy(false);
    }
  };

  const handleAllocate = async () => {
    if (allocBusy || !capacityInfo) return;
    const raw = allocQty.trim();
    if (!/^\d+$/.test(raw) || Number(raw) < 1) {
      setAllocFeedback({ type: "error", message: "Enter a whole number greater than zero." });
      return;
    }
    const qty = Number(raw);
    if (qty > capacityInfo.available) {
      setAllocFeedback({
        type: "error",
        message: capacityInfo.available === 0
          ? "No slots are available in this batch."
          : `Only ${capacityInfo.available} slot${capacityInfo.available === 1 ? " is" : "s are"} available - you asked for ${qty}.`,
      });
      return;
    }
    const needsName = capacityInfo.mine.quantity === 0;
    const name = allocName.trim().replace(/\s+/g, " ");
    if (needsName && name.length < 2) {
      setAllocFeedback({ type: "error", message: "Enter your name first - it lets you recover your slots if you come back later." });
      return;
    }
    if (!allocRequestRef.current || allocRequestRef.current.qty !== qty) {
      allocRequestRef.current = { qty, id: crypto.randomUUID() };
    }
    setAllocBusy(true);
    setAllocFeedback(null);
    try {
      const { status, data } = await allocateExaminerSlots(qty, allocRequestRef.current.id, needsName ? name : undefined);
      if (status === 401) {
        navigate("/examiner", { replace: true });
        return;
      }
      // Any definitive server answer ends this action; a thrown network error
      // (caught below) keeps the id so a retry cannot double-allocate.
      allocRequestRef.current = null;
      if (!data.success || !data.capacity) {
        setAllocFeedback({ type: "error", message: data.message || "Could not allocate slots. Please try again." });
        // The number may be stale - pull the real figures.
        fetchRoster(true);
        return;
      }
      setCapacityInfo(data.capacity);
      if (data.recovery && batch) saveRecoveryHint(batch, data.recovery.allocationId, data.recovery.recoveryKey);
      setAllocQty("");
      setAllocFeedback({
        type: "success",
        message: `${qty} slot${qty === 1 ? "" : "s"} allocated to you. ${data.capacity.available} left in the batch.`,
      });
    } catch (e: any) {
      setAllocFeedback({ type: "error", message: (e?.message || "Could not reach the server.") + " Tap Allocate again to retry safely." });
    } finally {
      setAllocBusy(false);
    }
  };

  const handleExit = () => {
    localStorage.removeItem("examinerToken");
    localStorage.removeItem("examinerFbToken");
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
      setCapacityInfo((prev) =>
        prev ? { ...prev, mine: { ...prev.mine, assigned: prev.mine.assigned + 1, remaining: Math.max(0, prev.mine.remaining - 1), studentIds: [...prev.mine.studentIds, data.student!.id] } } : prev,
      );
      // Only reached after the server confirmed the addition (errors and
      // duplicates return success:false above), so exactly one beep per student.
      playSuccessBeep();
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
    unlockScanBeep();
    handleAddStudent(manualId.trim());
  };

  // ── Start scoring (unchanged) ────────────────────────────────────────────

  // The examiner's own assigned students are the source of truth: scoring
  // runs over every one of them that is still pending - no second count prompt.
  const handleStart = async () => {
    if (pendingStudents.length === 0 || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      // Lock the session server-side first: from here removal is refused.
      const { status, data } = await startExaminerExam();
      if (status === 401) {
        navigate("/examiner", { replace: true });
        return;
      }
      if (!data.success) {
        setStartError(data.message || "Could not start the examination. Please try again.");
        setStarting(false);
        return;
      }
      if (data.capacity) setCapacityInfo(data.capacity);
      const queue = pendingStudents.map((s) => s.id);
      localStorage.setItem("examinerSessionQueue", JSON.stringify(queue));
      localStorage.setItem("examinerSessionIndex", "0");
      navigate("/examiner/score");
    } catch (e: any) {
      setStartError(e?.message || "Could not reach the server. Check your connection and try again.");
      setStarting(false);
    }
  };

  const handleRemove = async (studentId: string) => {
    if (removingId) return;
    setRemovingId(studentId);
    setScanFeedback(null);
    try {
      const { status, data } = await removeExaminerStudent(studentId);
      if (status === 401) {
        navigate("/examiner", { replace: true });
        return;
      }
      if (!data.success || !data.capacity) {
        setScanFeedback({ type: "error", message: data.message || "Could not remove this student. Please try again." });
        fetchRoster(true);
        return;
      }
      const removed = students.find((s) => s.id === studentId);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setBatch((prev) =>
        prev ? { ...prev, totalStudents: Math.max(0, prev.totalStudents - 1), pendingCount: Math.max(0, prev.pendingCount - 1) } : prev,
      );
      setCapacityInfo(data.capacity);
      setScanFeedback({ type: "success", message: `${removed?.name || "Student"} removed from your session.` });
    } catch (e: any) {
      setScanFeedback({ type: "error", message: e?.message || "Could not reach the server. Check your connection and try again." });
    } finally {
      setConfirmRemoveId(null);
      setRemovingId(null);
    }
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
              onClick={() => fetchRoster()}
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
        {batch?.status === "completed" && (
          <div role="status" className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50">
            <p className="font-bold text-emerald-700 dark:text-emerald-400">Batch Completed Successfully</p>
            <p className="text-sm text-emerald-700/90 dark:text-emerald-300/90 mt-1">All assigned students have completed their assessments. Thank you!</p>
          </div>
        )}

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
                {capacityInfo
                  ? `${capacityInfo.mine.assigned} of ${capacityInfo.mine.quantity} allocated slot${capacityInfo.mine.quantity === 1 ? "" : "s"} filled`
                  : `${students.length} of ${capacity} badge slot${capacity === 1 ? "" : "s"} assigned`}
              </p>
            </div>
          </div>
          <ClipboardList className="w-8 h-8 text-zinc-200 dark:text-zinc-700" />
        </div>

        {/* Slot allocation */}
        {capacityInfo && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-6 space-y-4">
            <div>
              <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 mb-1 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                Allocate Your Slots
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Choose how many of this batch's open slots you will take. Other examiners share the same pool.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Total", value: capacityInfo.total },
                { label: "Available", value: capacityInfo.available },
                { label: "Yours", value: capacityInfo.mine.quantity },
              ].map((c) => (
                <div key={c.label} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3">
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{c.value}</p>
                  <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{c.label}</p>
                </div>
              ))}
            </div>

            {allocFeedback && (
              <div
                role="status"
                className={`flex items-start gap-2.5 p-3.5 rounded-xl text-sm font-semibold ${
                  allocFeedback.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"
                }`}
              >
                {allocFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{allocFeedback.message}</span>
              </div>
            )}

            {capacityInfo.mine.quantity === 0 && (
              <div>
                <label htmlFor="alloc-name" className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Your name
                </label>
                <input
                  id="alloc-name"
                  type="text"
                  maxLength={60}
                  autoComplete="name"
                  value={allocName}
                  disabled={allocBusy}
                  onChange={(e) => {
                    setAllocName(e.target.value);
                    setAllocFeedback(null);
                  }}
                  placeholder="Used to recover your slots later"
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 caret-blue-500 border-2 border-zinc-300 dark:border-zinc-600 rounded-xl text-base font-semibold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
                />
              </div>
            )}

            <div>
              <label htmlFor="alloc-qty" className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-2">
                Number of students you will take
              </label>
              <div className="flex gap-2">
                <input
                  id="alloc-qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={capacityInfo.available}
                  step={1}
                  value={allocQty}
                  disabled={allocBusy || capacityInfo.available === 0}
                  onChange={(e) => {
                    setAllocQty(e.target.value);
                    setAllocFeedback(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleAllocate()}
                  placeholder={capacityInfo.available === 0 ? "No slots left" : `1 - ${capacityInfo.available}`}
                  className="flex-1 min-w-0 px-4 py-3 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 caret-blue-500 border-2 border-zinc-300 dark:border-zinc-600 rounded-xl text-lg font-bold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:disabled:bg-zinc-800"
                />
                <button
                  onClick={handleAllocate}
                  disabled={allocBusy || capacityInfo.available === 0 || !allocQty.trim()}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold active:scale-95 transition-all"
                >
                  {allocBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Allocate
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recover earlier slots (only before this session has any) */}
        {capacityInfo && capacityInfo.mine.quantity === 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-5 space-y-3">
            <button
              type="button"
              onClick={() => setRecoverOpen((o) => !o)}
              className="w-full text-left text-sm font-bold text-blue-600 dark:text-blue-400"
            >
              {capacityInfo.available === 0 ? "No slots left - already reserved some? " : "Already reserved slots earlier? "}
              {recoverOpen ? "Hide" : "Recover my slots"}
            </button>
            {recoverOpen && (
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={60}
                  value={recoverName}
                  disabled={recoverBusy}
                  onChange={(e) => setRecoverName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRecoverByName()}
                  placeholder="Name you used when reserving"
                  className="flex-1 min-w-0 px-4 py-3 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 border-2 border-zinc-300 dark:border-zinc-600 rounded-xl text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50"
                />
                <button
                  onClick={handleRecoverByName}
                  disabled={recoverBusy || recoverName.trim().length < 2}
                  className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
                >
                  {recoverBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Recover
                </button>
              </div>
            )}
          </div>
        )}

        {/* Scan-to-assign */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 mb-1 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-500" />
              Add Students
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {slotsFull
                ? capacityInfo && capacityInfo.mine.quantity > 0
                  ? "All your allocated slots have a student. Allocate more slots above to add another."
                  : "Allocate your slots above first, then add students."
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
                  unlockScanBeep(); // user gesture: lets mobile browsers play the beep later
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
                  className="flex-1 min-w-0 px-4 py-3 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 border border-zinc-300 dark:border-zinc-600 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
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
              {pendingStudents.length > 0 && (
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="w-full mb-3 px-6 py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {starting && <Loader2 className="w-5 h-5 animate-spin" />}
                  {capacityInfo?.mine.started ? "Continue Examination" : "Start Examination"} ({pendingStudents.length})
                  <ArrowRight className="w-5 h-5" />
                </button>
              )}
              {startError && (
                <p className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">{startError}</p>
              )}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {students.map((s) => {
                  const belt = s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "—");
                  const done = s.testStatus !== "pending";
                  // Only before the exam starts, and only students not yet examined.
                  const canRemove = !done && !capacityInfo?.mine.started;
                  const confirming = confirmRemoveId === s.id;
                  const removing = removingId === s.id;
                  if (confirming) {
                    return (
                      <div
                        key={s.id}
                        className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl space-y-2.5"
                      >
                        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                          Remove {s.name} from your examination session?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmRemoveId(null)}
                            disabled={removing}
                            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-bold disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRemove(s.id)}
                            disabled={removing}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-60"
                          >
                            {removing && <Loader2 className="w-4 h-4 animate-spin" />}
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50 truncate">{s.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{belt}</p>
                      </div>
                      {canRemove && (
                        <button
                          onClick={() => setConfirmRemoveId(s.id)}
                          disabled={removingId !== null}
                          aria-label={`Remove ${s.name}`}
                          className="ml-auto flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-xs font-bold disabled:opacity-40 active:scale-95 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      )}
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

        {pendingStudents.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center shadow-sm">
            <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <p className="font-bold text-zinc-700 dark:text-zinc-300 text-lg mb-1">No Students Ready Yet</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              {students.length === 0
                ? "Scan or add a student above to get started."
                : "Every student added so far has already been scored."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
