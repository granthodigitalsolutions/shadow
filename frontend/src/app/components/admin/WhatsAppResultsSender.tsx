import { useState, useEffect, useMemo, useCallback } from "react";
import { 
 MessageCircle, CheckCircle, Clock, ChevronRight, AlertCircle, 
 Send, FileText, Check, Loader2, Search, ArrowLeft, RefreshCw,
 Database, HardDrive, AlertTriangle, Activity, Lock, PauseCircle
} from "lucide-react";
import { 
 firebaseStudentService, 
 firebaseBatchService, 
 firebaseSchoolService,
 firebaseBeltTestService 
} from "../../services/firebaseData";
import { BeltTest } from "../../types/admin";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useProgram } from "../../contexts/ProgramContext";
import { useDialog } from "../../contexts/DialogContext";
import { Batch, StudentRecord, School } from "../../types/admin";
import { formatBatchName } from "../../utils/batchFormatters";
import { generateFeedbackForms } from "../../utils/feedbackFormGenerator";
import { uploadResultPDF, deleteOldResultPDF } from "../../services/storageService";
import { firebaseAnalyticsService } from "../../services/analyticsService";
import { fetchJson } from "../../utils/apiFetch";
import { onSnapshot, doc, getDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";

import { db } from "../../config/firebase";
import { DeliveryCampaign } from "../../types/admin";

function StatCard({ icon: Icon, label, value, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "bg-red-50 text-red-600 border-red-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    amber: "bg-blue-50 text-blue-600 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  };

  return (
    <div className={`bg-white dark:bg-zinc-950 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between h-full`}>
      <div className={`w-8 h-8 rounded-xl ${colorMap[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{value}</p>
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

 export default function WhatsAppResultsSender() {
 const { showToast } = useToast();
 const { showConfirm } = useDialog();
 const { currentProgram } = useProgram();
 const [batches, setBatches] = useState<Batch[]>([]);
 const [students, setStudents] = useState<StudentRecord[]>([]);
 const [schools, setSchools] = useState<School[]>([]);
 const [tests, setTests] = useState<BeltTest[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedBatchId, setSelectedBatchId] = useState<string>("");
 // Chunked processing (Phase 5) — combined PDF-generate + WhatsApp-queue
 // pipeline, replacing the old separate "Generate PDFs"/"Send WhatsApp" flow.
 const [isProcessingChunk, setIsProcessingChunk] = useState(false);
 const [isRetryingFailed, setIsRetryingFailed] = useState(false);
 const [chunkProgress, setChunkProgress] = useState<{ total: number; completed: number; failed: number } | null>(null);
 const [analytics, setAnalytics] = useState<any>(null);
 const [searchTerm, setSearchTerm] = useState("");
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [campaigns, setCampaigns] = useState<DeliveryCampaign[]>([]);
 // Batch-list filters
 const [schoolFilterId, setSchoolFilterId] = useState<string>("");
 // Student-grid filter (within the selected batch)
 const [beltFilter, setBeltFilter] = useState<string>("");
 // Manual per-student / selected-group PDF regeneration — separate from the
 // bulk "Generate Batch PDFs" flow, which intentionally skips students who
 // already have an up-to-date PDF.
 const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
 const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
 const [isRegeneratingSelected, setIsRegeneratingSelected] = useState(false);
 const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

 useEffect(() => {
 fetchData();
 }, [currentProgram]);

 const fetchData = async () => {
 setLoading(true);
 try {
 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
 
 const [allBatches, allStudents, allSchools, allTests] = await Promise.all([
 firebaseBatchService.getAll(programFilter),
 firebaseStudentService.getAll(programFilter),
 firebaseSchoolService.getAll(programFilter),
 firebaseBeltTestService.getAll(programFilter)
 ]);

 // Only completed batches should appear on this page
 const completedBatches = allBatches.filter(b => b.status === "completed");
 
 // Sort batches: unsent first, then by completedAt descending
 completedBatches.sort((a, b) => {
 if (a.resultsSent !== b.resultsSent) {
 return a.resultsSent ? 1 : -1;
 }
 const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
 const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
 return dateB - dateA;
 });

 setBatches(completedBatches);
 setStudents(allStudents);
 setSchools(allSchools);
 setTests(allTests);

 // Auto-select the first batch if none selected and batches exist
 if (completedBatches.length > 0 && !selectedBatchId) {
 setSelectedBatchId(completedBatches[0].id);
 }
 } catch (error) {
 console.error("Error fetching data for WhatsApp sender:", error);
 showToast("Failed to load completed batches", "error");
 } finally {
 setLoading(false);
 }
 };



  // Realtime Listeners for Batch, Students, and Campaigns
  useEffect(() => {
    if (!selectedBatchId) return;

    // Listen to Batch
    const unsubscribeBatch = onSnapshot(doc(db, "batches", selectedBatchId), (snapshot) => {
      if (snapshot.exists()) {
        const batchData = { id: snapshot.id, ...snapshot.data() } as Batch;
        setBatches(prev => prev.map(b => b.id === selectedBatchId ? batchData : b));
      }
    });

    // Listen to Students
    const qStudents = query(collection(db, "students"), where("batchId", "==", selectedBatchId));
    const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
      const updatedStudents = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentRecord));
      setStudents(prev => {
        const otherStudents = prev.filter(s => s.batchId !== selectedBatchId);
        return [...otherStudents, ...updatedStudents];
      });
    });

    // Listen to Campaigns
    const qCampaigns = query(
      collection(db, "batches", selectedBatchId, "campaigns"),
      orderBy("startedAt", "desc")
    );
    const unsubscribeCampaigns = onSnapshot(qCampaigns, (snapshot) => {
      const camps = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryCampaign));
      setCampaigns(camps);
    });

    return () => {
      unsubscribeBatch();
      unsubscribeStudents();
      unsubscribeCampaigns();
    };
  }, [selectedBatchId]);

  // whatsappStatus is already kept live by the onSnapshot listeners above —
  // this is a manual one-off re-read from Firestore for an admin who wants
  // an immediate refresh, not a backend call (no such endpoint exists).
  const handleRefreshBatchStatus = async (batchId: string) => {
    try {
      setIsRefreshing(true);
      const batchSnap = await getDoc(doc(db, "batches", batchId));
      if (batchSnap.exists()) {
        const batchData = { id: batchSnap.id, ...batchSnap.data() } as Batch;
        setBatches(prev => prev.map(b => b.id === batchId ? batchData : b));
      }
      const studentsSnap = await getDocs(query(collection(db, "students"), where("batchId", "==", batchId)));
      const refreshedStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentRecord));
      setStudents(prev => {
        const otherStudents = prev.filter(s => s.batchId !== batchId);
        return [...otherStudents, ...refreshedStudents];
      });
      showToast("Batch status refreshed", "success");
    } catch (e) {
      console.error("Manual refresh failed", e);
      showToast("Failed to refresh batch status", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const selectedBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId) || null;
  }, [batches, selectedBatchId]);

  const batchStudents = useMemo(() => {
    if (!selectedBatchId) return [];
    return students.filter(s => s.batchId === selectedBatchId);
  }, [students, selectedBatchId]);

 // Filtered batch list based on search term
 const filteredBatches = useMemo(() => {
 const q = searchTerm.toLowerCase().trim();
 return batches.filter(b => {
 if (schoolFilterId && b.schoolId !== schoolFilterId) return false;
 if (!q) return true;
 const name = formatBatchName(b).toLowerCase();
 const school = schools.find(s => s.id === b.schoolId)?.name.toLowerCase() || "";
 return name.includes(q) || (school || '').includes(q);
 });
 }, [batches, schools, searchTerm, schoolFilterId]);

 // Unique belt/stage values present among the selected batch's students,
 // used to populate the belt filter dropdown for that batch only.
 const availableBelts = useMemo(() => {
 const values = new Set<string>();
 batchStudents.forEach(s => {
 const belt = s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : null);
 if (belt) values.add(belt);
 });
 return Array.from(values).sort();
 }, [batchStudents]);

 // Students shown in the grid below — narrowed by the belt filter without
 // changing what the bulk Generate/Send actions operate on (those still
 // target every student in the batch).
 const displayedBatchStudents = useMemo(() => {
 if (!beltFilter) return batchStudents;
 return batchStudents.filter(s => {
 const belt = s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : null);
 return belt === beltFilter;
 });
 }, [batchStudents, beltFilter]);

 // Get school name for a batch
 const getSchoolName = (schoolId: string) => {
 if (schoolId === "individual") return "Individual Session";
 return schools.find(s => s.id === schoolId)?.name || "Unknown School";
 };

 // Same bodyParams shape the bulk sender queues via Cloud Tasks — kept in
 // sync so single-send and bulk-send messages read identically.
 const buildResultBodyParams = (student: StudentRecord) => {
 const programName = student.programType === "SELAMBAM" ? "Selambam Championship" : "Karate Belt Test";
 const isPassed = student.testStatus === "passed" || student.testStatus === "pass";
 const statusText = isPassed ? "PASSED" : "COMPLETED";
 return [
 student.name || "Student",
 programName,
 `${statusText} (Score: ${student.score || 0})`
 ];
 };

 // WhatsApp statuses that mean a student's result message is already in
 // flight or done — mirrors the backend's DONE_STATUSES in
 // send-bulk-results.js (duplicated intentionally, separate runtimes).
 const WHATSAPP_DONE_STATUSES = new Set(['queued', 'sending', 'sent', 'delivered', 'read']);

 const parseTimestamp = (ts: any) => {
 if (!ts) return 0;
 if (typeof ts.toMillis === 'function') return ts.toMillis();
 if (typeof ts.toDate === 'function') return ts.toDate().getTime();
 if (ts.seconds) return ts.seconds * 1000;
 const parsed = new Date(ts).getTime();
 return isNaN(parsed) ? 0 : parsed;
 };

 // A PDF needs (re)generating if none exists yet, or the score was updated
 // after the last PDF upload. Single source of truth, reused by
 // generateForStudent itself and by the chunk-slice "is this student done"
 // check, so the two can never drift apart.
 const pdfNeedsRegeneration = (student: StudentRecord): boolean => {
 const lastScoreAt = parseTimestamp((student as any).lastScoreUpdatedAt);
 const uploadedAt = parseTimestamp((student as any).uploadedAt);
 return !student.resultPdfUrl || (lastScoreAt > 0 && lastScoreAt > uploadedAt);
 };

 // A student is fully processed for this batch's chunk pipeline once their
 // PDF is current AND their WhatsApp message has reached a terminal state.
 const isStudentFullyProcessed = (student: StudentRecord): boolean => {
 return !!student.resultPdfUrl && !pdfNeedsRegeneration(student) && WHATSAPP_DONE_STATUSES.has((student as any).whatsappStatus);
 };

 // The exam-date fallback chain used by both the chunk pipeline and the
 // failed-retry action when building the WhatsApp send payload.
 const resolveExamDate = (batch: Batch | null) => {
 return (batch as any)?.examDate ||
 (batch as any)?.testDate ||
 (batch as any)?.date ||
 batch?.startedAt ||
 batch?.completedAt ||
 batch?.batchGeneratedAt;
 };

  // Helper to act as PDF Generator for a single student.
  // `force` bypasses the "already generated" check — used by the manual
  // per-student / selected-group Regenerate actions, which must always
  // produce a fresh PDF even if nothing changed since the last one.
  const generateForStudent = async (student: StudentRecord, force: boolean = false): Promise<boolean> => {
    let pdfUrl = student.resultPdfUrl;
    let storageFolder = "";
    let newlyUploaded = false;

    // We only generate if no PDF exists OR the score was updated AFTER the last PDF upload —
    // unless the caller explicitly forces a fresh regeneration.
    const needsRegeneration = force || pdfNeedsRegeneration(student);

    if (needsRegeneration) {
      const perfStart = performance.now();
      
      try {
        const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
        const { db } = await import("../../config/firebase");
        
        await updateDoc(doc(db, "students", student.id), { pdfUploadStatus: "uploading", pdfUploadError: null });

        // Delete old PDF first if it exists
        if ((student as any).resultPdfPath) {
          await deleteOldResultPDF((student as any).resultPdfPath);
        }

        const genStart = performance.now();
        const test = tests.find(t => t.id === student.beltTestId);
        const studentWithTest = { ...student, beltTestDate: test?.date || student.testDate };
        const pdfDoc = await generateFeedbackForms([studentWithTest as StudentRecord]);
        const pdfBlob = pdfDoc.output('blob');
        
        const upStart = performance.now();
        const uploadResult = await uploadResultPDF(student.id, pdfBlob, student.programType);
        
        pdfUrl = uploadResult.downloadURL;
        storageFolder = uploadResult.folder;
        newlyUploaded = true;

        const currentVersion = (student as any).pdfVersion || 0;

        const updatePayload: any = {
          resultPdfUrl: pdfUrl,
          resultPdfPath: uploadResult.fullPath,
          pdfUploaded: true,
          uploadedAt: serverTimestamp(),
          storageFolder: storageFolder,
          pdfVersion: currentVersion + 1,
          pdfUploadStatus: "uploaded",
          pdfUploadError: null,
          resultLocked: true
        };

        await updateDoc(doc(db, "students", student.id), updatePayload);
        
        showToast(`PDF uploaded for ${student.name}.`, "success");
        await firebaseAnalyticsService.trackUploadSuccess(pdfBlob.size, performance.now() - upStart);
        return true;
      } catch (error: any) {
        await firebaseAnalyticsService.trackUploadFailure();
        console.error("[Firestore] Failed to save PDF URL:", error);
        showToast(`Failed to generate PDF for ${student.name}.`, "error");
        const errorPayload = {
          pdfUploadError: error.message || "Unknown error",
          pdfUploaded: false
        };
        await firebaseStudentService.update(student.id, errorPayload);
        setStudents(prev => prev.map(s => s.id === student.id ? { ...s, ...errorPayload } : s));
        return false;
      }
    }

    return true;
  };

 const toggleStudentSelection = (id: string) => {
   setSelectedStudentIds(prev => {
     const next = new Set(prev);
     if (next.has(id)) next.delete(id); else next.add(id);
     return next;
   });
 };

 // Force-regenerate a single student's PDF, bypassing the "already
 // generated" skip — for when the admin wants to redo one specific result.
 const regenerateSingleStudent = async (student: StudentRecord) => {
   setRegeneratingIds(prev => new Set(prev).add(student.id));
   try {
     showToast(`Regenerating PDF for ${student.name}...`, "info");
     const ok = await generateForStudent(student, true);
     if (ok) showToast(`PDF regenerated for ${student.name}.`, "success");
   } catch (e) {
     console.error(e);
     showToast(`Failed to regenerate PDF for ${student.name}`, "error");
   } finally {
     setRegeneratingIds(prev => {
       const next = new Set(prev);
       next.delete(student.id);
       return next;
     });
   }
 };

 // Force-regenerate PDFs for a manually-selected group of students only.
 const regenerateSelectedStudents = async () => {
   const targets = batchStudents.filter(s => selectedStudentIds.has(s.id));
   if (targets.length === 0) return;

   setIsRegeneratingSelected(true);
   try {
     showToast(`Regenerating PDFs for ${targets.length} selected student${targets.length === 1 ? '' : 's'}...`, "info");
     let completed = 0;
     for (const student of targets) {
       setRegeneratingIds(prev => new Set(prev).add(student.id));
       try {
         const ok = await generateForStudent(student, true);
         if (ok) completed++;
       } catch (e) {
         console.error(e);
       } finally {
         setRegeneratingIds(prev => {
           const next = new Set(prev);
           next.delete(student.id);
           return next;
         });
       }
       await new Promise(resolve => setTimeout(resolve, 300));
     }
     showToast(`Regenerated ${completed}/${targets.length} selected PDFs.`, completed === targets.length ? "success" : "warning");
     setSelectedStudentIds(new Set());
   } finally {
     setIsRegeneratingSelected(false);
   }
 };

 // Open single WhatsApp tab and mark that student as sent
 const sendSingleMessage = async (student: StudentRecord) => {
 if (!student.whatsapp) {
 showToast(`No WhatsApp number for ${student.name}`, "warning");
 return;
 }

 setSendingIds(prev => new Set(prev).add(student.id));
 try {
 showToast(`Sending message for ${student.name}...`, "info");

 // Make sure a PDF exists before sending, then re-read the student doc —
 // generateForStudent doesn't return the URL it just uploaded.
 await generateForStudent(student);
 const freshStudent = await firebaseStudentService.getById(student.id);
 const pdfUrl = freshStudent?.resultPdfUrl || student.resultPdfUrl;

 if (!pdfUrl) {
 showToast(`No PDF available for ${student.name}. Generate one first.`, "error");
 return;
 }

 const backendUrl = import.meta.env.VITE_API_BASE_URL;
 const { ok, data } = await fetchJson(`${backendUrl}/api/whatsapp/send-single`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 phone: student.whatsapp,
 templateName: 'shadow_kai_result',
 pdfUrl,
 pdfFilename: 'Results.pdf',
 bodyParams: buildResultBodyParams(student),
 }),
 });

 if (!ok || !data.success) {
 throw new Error(data.message || 'WhatsApp API rejected the message');
 }

 await firebaseStudentService.update(student.id, {
 whatsappStatus: 'sent',
 lastAttemptAt: new Date().toISOString(),
 } as any);
 showToast(`Message sent to ${student.name}.`, "success");
 } catch (e: any) {
 console.error(e);
 showToast(`Failed to send to ${student.name}: ${e.message || 'Unknown error'}`, "error");
 await firebaseStudentService.update(student.id, {
 whatsappStatus: 'failed',
 failureReason: e.message || 'Unknown error',
 lastAttemptAt: new Date().toISOString(),
 } as any).catch(() => {});
 } finally {
 setSendingIds(prev => {
 const next = new Set(prev);
 next.delete(student.id);
 return next;
 });
 }
 };

  const MAX_STUDENTS_PER_RUN = 50;

  // Students in this batch, in the batch's own stable studentIds order
  // (immutable once a batch is generated), that still need PDF generation
  // and/or a WhatsApp send, and that have actually been scored. This is the
  // single filter that makes "Generate next N%" resumable and idempotent —
  // no separate checkpoint/index is stored anywhere.
  const getUnprocessedStudentsInOrder = useCallback((): StudentRecord[] => {
    if (!selectedBatch) return [];
    const byId = new Map(batchStudents.map(s => [s.id, s]));
    const orderedIds = (selectedBatch.studentIds && selectedBatch.studentIds.length > 0)
      ? selectedBatch.studentIds
      : batchStudents.map(s => s.id);
    const ordered: StudentRecord[] = [];
    orderedIds.forEach(id => {
      const s = byId.get(id);
      if (s) ordered.push(s);
    });
    return ordered.filter(s => {
      if (!s.testStatus || s.testStatus === 'pending') return false; // not graded yet
      return !isStudentFullyProcessed(s);
    });
  }, [selectedBatch, batchStudents]);

  const computeNextSlice = useCallback((pct: number): StudentRecord[] => {
    const unprocessed = getUnprocessedStudentsInOrder();
    const total = selectedBatch?.studentIds?.length || batchStudents.length;
    const sliceSize = pct >= 100 ? unprocessed.length : Math.max(1, Math.ceil(total * pct / 100));
    return unprocessed.slice(0, Math.min(sliceSize, MAX_STUDENTS_PER_RUN));
  }, [getUnprocessedStudentsInOrder, selectedBatch, batchStudents]);

  // Per-student combined step: generate/upload the PDF, then decide whether
  // this student still needs a WhatsApp send. Uses generateForStudent's
  // boolean return value (not student.resultPdfUrl, which may still be
  // stale locally — its success path only patches Firestore, not React
  // state) to make that decision.
  const processStudentChunkStep = async (student: StudentRecord): Promise<{ pdfOk: boolean; needsWhatsapp: boolean }> => {
    let pdfOk = false;
    try {
      pdfOk = await generateForStudent(student, false);
    } catch (e) {
      console.error(`[Chunk] Unexpected error generating PDF for ${student.name}:`, e);
      pdfOk = false;
    }
    const needsWhatsapp = pdfOk && !WHATSAPP_DONE_STATUSES.has((student as any).whatsappStatus);
    return { pdfOk, needsWhatsapp };
  };

  // Processes the next unprocessed slice of this size (%) for the selected
  // batch: generate+upload each student's PDF (sequentially — the capture
  // step shares one off-screen DOM container and can't run in parallel),
  // then queue WhatsApp for everyone who's now ready, in one backend call.
  const processChunk = async (pct: number) => {
    if (!selectedBatch || isProcessingChunk || isRetryingFailed) return;

    const slice = computeNextSlice(pct);
    if (slice.length === 0) {
      const stillUngraded = batchStudents.some(s => !s.testStatus || s.testStatus === 'pending');
      showToast(
        stillUngraded
          ? "All graded students are already processed. Some students in this batch aren't scored yet."
          : "All students in this batch are already processed.",
        "info"
      );
      return;
    }

    setIsProcessingChunk(true);
    setChunkProgress({ total: slice.length, completed: 0, failed: 0 });

    let completed = 0;
    let failed = 0;
    const toEnqueue: string[] = [];

    try {
      for (const student of slice) {
        const { pdfOk, needsWhatsapp } = await processStudentChunkStep(student);
        if (pdfOk) completed++; else failed++;
        if (needsWhatsapp) toEnqueue.push(student.id);

        setChunkProgress({ total: slice.length, completed, failed });
        await firebaseBatchService.update(selectedBatch.id, {
          batchGenerationProgress: { total: slice.length, completed, failed, skipped: 0 }
        });
      }

      let queuedMessage = "";
      if (toEnqueue.length > 0) {
        const { ok, data } = await fetchJson(`${import.meta.env.VITE_API_BASE_URL}/api/whatsapp/send-bulk-results`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batchId: selectedBatch.id, examDate: resolveExamDate(selectedBatch), studentIds: toEnqueue })
        });
        queuedMessage = (ok && data.success)
          ? ` ${data.enqueued ?? toEnqueue.length} queued for WhatsApp.`
          : ` WhatsApp queueing failed: ${data?.message || 'unknown error'}.`;
      }

      showToast(`${completed} PDF(s) processed, ${failed} failed.${queuedMessage}`, failed > 0 ? "warning" : "success");
    } catch (err) {
      console.error("[Chunk] Processing failed:", err);
      showToast("An error occurred while processing this chunk.", "error");
    } finally {
      setIsProcessingChunk(false);
      setChunkProgress(null);
    }
  };

  // Retries BOTH failure phases in one action: students whose PDF failed to
  // generate, and students whose WhatsApp send failed — using the backend's
  // force:true path so a stale/terminal status never blocks the retry.
  const handleRetryFailed = async () => {
    if (!selectedBatch) return;

    const pdfFailedStudents = batchStudents.filter(s => (s as any).pdfUploadError && !s.resultPdfUrl);
    const whatsappFailedStudents = batchStudents.filter(s => (s as any).whatsappStatus === 'failed');

    if (pdfFailedStudents.length === 0 && whatsappFailedStudents.length === 0) {
      showToast("No failed students found to retry.", "info");
      return;
    }

    const confirmed = await showConfirm({
      title: "🔄 Retry Failed",
      message: `Retry ${pdfFailedStudents.length} failed PDF generation(s) and ${whatsappFailedStudents.length} failed WhatsApp message(s)?`,
      confirmText: "Yes, Retry",
      variant: "info"
    });
    if (!confirmed) return;

    setIsRetryingFailed(true);
    try {
      let pdfRetried = 0;
      const idsToRequeue = new Set(whatsappFailedStudents.map(s => s.id));

      for (const student of pdfFailedStudents) {
        try {
          const ok = await generateForStudent(student, false);
          if (ok) {
            pdfRetried++;
            if (!WHATSAPP_DONE_STATUSES.has((student as any).whatsappStatus)) {
              idsToRequeue.add(student.id);
            }
          }
        } catch (e) {
          console.error(`[Retry] Failed to regenerate PDF for ${student.name}:`, e);
        }
      }

      let queuedMessage = "";
      if (idsToRequeue.size > 0) {
        const { ok, data } = await fetchJson(`${import.meta.env.VITE_API_BASE_URL}/api/whatsapp/send-bulk-results`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batchId: selectedBatch.id,
            examDate: resolveExamDate(selectedBatch),
            studentIds: Array.from(idsToRequeue),
            force: true
          })
        });
        queuedMessage = (ok && data.success)
          ? ` ${data.enqueued ?? idsToRequeue.size} re-queued for WhatsApp.`
          : ` WhatsApp retry failed: ${data?.message || 'unknown error'}.`;
      }

      showToast(`${pdfRetried}/${pdfFailedStudents.length} PDF(s) retried.${queuedMessage}`, "success");
    } catch (err: any) {
      showToast(err.message || "An error occurred during retry.", "error");
    } finally {
      setIsRetryingFailed(false);
    }
  };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[70vh]">
 <div className="text-center">
 <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
 <p className="text-zinc-600 dark:text-zinc-400 font-medium">Loading completed batches...</p>
 </div>
 </div>
 </AdminLayout>
 );
 }

 return (
 <AdminLayout>
 <div className="max-w-[1600px] mx-auto space-y-6">
 
 {/* Header Banner */}
 <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-950 text-white rounded-3xl p-6 md:p-8 shadow-xl border border-zinc-800 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
 <div>
 <div className="flex items-center gap-3">
 <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold uppercase tracking-widest rounded-full border border-green-500/30">
 Automated Dispatch
 </span>
 <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest rounded-full border border-blue-500/30">
 WhatsApp Web
 </span>
 </div>
 <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 Batch Result Generator
 </h1>
 <p className="text-zinc-400 text-sm mt-1 max-w-xl">
 Select completed batches, generate PDF certificates efficiently, and track upload status.
 </p>
 </div>
 <button 
 onClick={fetchData} 
 className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-sm shadow-md transition-all border border-zinc-700"
 >
 <RefreshCw className="w-4 h-4" /> Sync Data
 </button>
 </div>
 </div>

        {analytics && (
          <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-500" />
              Generation Storage Analytics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={FileText} label="Total PDFs" value={analytics.totalGenerated} color="blue" />
              <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(analytics.storageUsedBytes)} color="amber" />
              <StatCard icon={AlertTriangle} label="Failed Uploads" value={analytics.failedUploads} color="red" />
              <StatCard icon={RefreshCw} label="Skips" value={analytics.regenerationSkips} color="emerald" />
              <StatCard icon={Activity} label="Avg Upload" value={`${Math.round(analytics.averageUploadTime)}ms`} color="purple" />
              <StatCard icon={Lock} label="Result Locks" value={analytics.resultLockCount} color="indigo" />
            </div>
          </div>
        )}

        {batches.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 rounded-3xl p-12 text-center border border-zinc-100 dark:border-zinc-800 shadow-sm max-w-md mx-auto mt-12">
 <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
 <AlertCircle className="w-8 h-8 text-blue-500" />
 </div>
 <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">No Completed Batches Yet</h3>
 <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2">
 Only batches marked as completed will be visible here for sending results.
 </p>
 </div>
 ) : (
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
 
 {/* Sidebar: Batch List */}
 <div className="lg:col-span-4 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-150 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
 <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
 <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-base">Completed Batches</h3>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{batches.length} batches available</p>
 <div className="relative mt-3">
 <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search by school or batch..."
 className="w-full pl-10 pr-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-xl focus:border-zinc-200 dark:border-zinc-800 focus:bg-white dark:bg-zinc-900 focus:ring-0 outline-none text-sm placeholder-zinc-400 dark:placeholder-zinc-500 bg-transparent dark:text-zinc-50"
 />
 </div>
 <select
 value={schoolFilterId}
 onChange={(e) => setSchoolFilterId(e.target.value)}
 className="w-full mt-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-xl focus:border-zinc-200 dark:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:ring-0 outline-none text-sm text-zinc-700 dark:text-zinc-200 cursor-pointer"
 >
 <option value="">All Schools</option>
 {schools.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
 </select>
 </div>

 <div className="overflow-y-auto flex-1 p-3 space-y-1 bg-zinc-50 dark:bg-zinc-900/20">
 {filteredBatches.map((b) => {
 const isSelected = b.id === selectedBatchId;
 const bStudents = students.filter(s => s.batchId === b.id);
 const studentCount = bStudents.length;
 
 const isActuallyCompleted = bStudents.length > 0 && bStudents.every(s => 
   s.whatsappStatus === 'sent' || s.whatsappStatus === 'delivered' || s.whatsappStatus === 'read' || s.whatsappStatus === 'failed'
 );
 const effectiveStatus = (isActuallyCompleted && b.whatsappStatus === 'sending') ? 'completed' : b.whatsappStatus;
 
 return (
 <button
 key={b.id}
 onClick={() => { setSelectedBatchId(b.id); setBeltFilter(""); setSelectedStudentIds(new Set()); }}
 className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
 isSelected
 ? "bg-blue-500 border-blue-600 text-zinc-950 shadow-md shadow-blue-500/10"
 : "bg-white dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-250 hover:bg-zinc-50 dark:hover:bg-zinc-900"
 }`}
 >
 <div className="min-w-0">
 <p className={`font-bold text-sm truncate ${isSelected ? "text-zinc-950" : "text-zinc-900 dark:text-zinc-50"}`}>
 {formatBatchName(b)}
 </p>
 <p className={`text-xs truncate mt-0.5 ${isSelected ? "text-zinc-800" : "text-zinc-500 dark:text-zinc-400"}`}>
 {getSchoolName(b.schoolId)}
 </p>
 <div className="flex items-center gap-2 mt-2">
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
  isSelected ? 'bg-zinc-950/15 text-zinc-950' : 'bg-green-100 text-green-700'
  }`}>
  Completed
  </span>
  {effectiveStatus && effectiveStatus !== 'pending' && (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 ${
  isSelected ? 'bg-zinc-950 text-blue-500' : 
  (effectiveStatus === 'completed' ? 'bg-blue-50 text-blue-600' : 'bg-blue-50 text-blue-600')
  }`}>
  {effectiveStatus === 'completed' ? <Check className="w-2.5 h-2.5" /> : (effectiveStatus === 'sending' ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : null)}
  {effectiveStatus.toUpperCase()}
  </span>
  )}
 </div>
 </div>
 <div className="text-right flex-shrink-0">
 <span className={`text-xs font-bold ${isSelected ? "text-zinc-900" : "text-zinc-500 dark:text-zinc-400"}`}>
 {studentCount} Students
 </span>
 <ChevronRight className={`w-4 h-4 ml-auto mt-2 transition-transform ${
 isSelected ? "text-zinc-950 translate-x-1" : "text-zinc-400"
 }`} />
 </div>
 </button>
 );
 })}
 {filteredBatches.length === 0 && (
 <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-8">No matching batches found.</p>
 )}
 </div>
 </div>

 {/* Main Area: Selected Batch Students & Send Action */}
 <div className="lg:col-span-8 space-y-6">
 {selectedBatch ? (
 <>
 {/* Dispatch Card banner */}
 <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-150 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
 <div>
 <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
 {formatBatchName(selectedBatch)}
 </h2>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
 School: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{getSchoolName(selectedBatch.schoolId)}</span>
 </p>
 
 <div className="flex items-center gap-3 mt-3">
 <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-lg text-xs font-bold">
 Completed
 </span>
 {(() => {
   const isBatchActuallyCompleted = batchStudents.length > 0 && batchStudents.every(s => 
     s.whatsappStatus === 'sent' || s.whatsappStatus === 'delivered' || s.whatsappStatus === 'read' || s.whatsappStatus === 'failed'
   );
   const effectiveBatchStatus = isBatchActuallyCompleted && selectedBatch.whatsappStatus === 'sending' 
     ? 'completed' 
     : selectedBatch.whatsappStatus;
     
   if (effectiveBatchStatus === 'completed') {
     return (
       <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-bold flex items-center gap-1">
       <CheckCircle className="w-3.5 h-3.5" /> Finished Sending
       </span>
     );
   } else if (effectiveBatchStatus === 'sending') {
     return (
       <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-bold flex items-center gap-1">
       <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending In Progress
       </span>
     );
   } else {
     return (
       <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold">
       Unsent
       </span>
     );
   }
 })()}
 <button
 onClick={() => handleRefreshBatchStatus(selectedBatch.id)}
 disabled={isRefreshing}
 title="Refresh status from Firestore"
 className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
 >
 <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
 </button>
 </div>
 </div>

 <div className="w-full md:w-auto flex flex-wrap items-center gap-3">
   {[10, 25, 50, 100].map(pct => {
     const count = computeNextSlice(pct).length;
     return (
       <button
         key={pct}
         onClick={() => processChunk(pct)}
         disabled={isProcessingChunk || isRetryingFailed || count === 0}
         className={`px-5 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all ${
           isProcessingChunk || isRetryingFailed || count === 0
             ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-800"
             : "bg-zinc-800 hover:bg-zinc-700 text-white shadow-md border border-zinc-700"
         }`}
       >
         {isProcessingChunk ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
         Generate {pct}% ({count})
       </button>
     );
   })}
  {(batchStudents.some(s => (s as any).whatsappStatus === 'failed') || batchStudents.some(s => (s as any).pdfUploadError && !s.resultPdfUrl)) && (
    <button
      onClick={handleRetryFailed}
      disabled={isProcessingChunk || isRetryingFailed}
      className={`px-6 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all ${
        isProcessingChunk || isRetryingFailed
          ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-800"
          : "bg-red-500 hover:bg-red-600 text-white shadow-md border border-red-600"
      }`}
    >
      {isRetryingFailed ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      Retry Failed
    </button>
  )}
 </div>
 </div>

 {/* Progress — derived live from batchStudents so a refresh mid-processing
     never resets to zero; batchGenerationProgress (written after each
     student) backs only the small "last run" line below it. */}
 {(() => {
   const pdfTotal = batchStudents.length;
   const pdfGenerated = batchStudents.filter(s => !!s.resultPdfUrl && !pdfNeedsRegeneration(s)).length;
   const pdfFailed = batchStudents.filter(s => (s as any).pdfUploadError && !s.resultPdfUrl).length;
   const pdfNotScored = batchStudents.filter(s => !s.testStatus || s.testStatus === 'pending').length;
   const pdfPending = Math.max(0, pdfTotal - pdfGenerated - pdfFailed - pdfNotScored);
   const overallDone = batchStudents.filter(isStudentFullyProcessed).length;
   const overallPct = pdfTotal > 0 ? Math.round((overallDone / pdfTotal) * 100) : 0;
   if (pdfTotal === 0) return null;
   return (
     <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-150 dark:border-zinc-800 shadow-sm p-6">
       <div className="flex items-center justify-between mb-2">
         <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Processing Progress</h3>
         <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">{overallDone} / {pdfTotal} ({overallPct}%)</span>
       </div>
       <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-4">
         <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${overallPct}%` }} />
       </div>
       <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
         <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 flex flex-col items-center">
           <span className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{pdfGenerated}</span>
           <span className="text-[10px] font-bold text-zinc-500 uppercase">PDF Generated</span>
         </div>
         <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 flex flex-col items-center">
           <span className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{pdfPending}</span>
           <span className="text-[10px] font-bold text-zinc-500 uppercase">Remaining</span>
         </div>
         <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-3 flex flex-col items-center">
           <span className="text-lg font-bold text-red-600">{pdfFailed}</span>
           <span className="text-[10px] font-bold text-red-600/70 uppercase">PDF Failed</span>
         </div>
         <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 flex flex-col items-center">
           <span className="text-lg font-bold text-zinc-500 dark:text-zinc-400">{pdfNotScored}</span>
           <span className="text-[10px] font-bold text-zinc-500 uppercase">Not Scored</span>
         </div>
         <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-3 flex flex-col items-center">
           <span className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{pdfTotal}</span>
           <span className="text-[10px] font-bold text-zinc-500 uppercase">Total</span>
         </div>
       </div>
       {isProcessingChunk && chunkProgress && (
         <p className="text-xs font-semibold text-blue-600 mt-4 flex items-center gap-2">
           <Loader2 className="w-3.5 h-3.5 animate-spin" />
           Generating PDF {chunkProgress.completed + chunkProgress.failed + 1 <= chunkProgress.total ? chunkProgress.completed + chunkProgress.failed + 1 : chunkProgress.total} / {chunkProgress.total} in this run...
         </p>
       )}
       {selectedBatch.batchGenerationProgress && !isProcessingChunk && (
         <p className="text-[11px] text-zinc-400 mt-4">
           Last run: {selectedBatch.batchGenerationProgress.completed} completed, {selectedBatch.batchGenerationProgress.failed} failed (of {selectedBatch.batchGenerationProgress.total}).
         </p>
       )}
     </div>
   );
 })()}

 {/* Summary Metrics */}
 {(selectedBatch.whatsappStatus && selectedBatch.whatsappStatus !== 'pending') && (() => {
    const hasStudents = batchStudents.length > 0;
    const dynTotal = hasStudents ? batchStudents.length : Math.max(0, selectedBatch.totalStudents ?? selectedBatch.summaryCache?.totalStudents ?? 0);
    const dynInProgress = hasStudents ? batchStudents.filter(s => s.whatsappStatus === 'queued' || s.whatsappStatus === 'sending').length : Math.max(0, (selectedBatch.queuedCount || 0) + (selectedBatch.sendingCount || 0) || selectedBatch.summaryCache?.whatsapp?.pending || 0);
    const dynSent = hasStudents ? batchStudents.filter(s => s.whatsappStatus === 'sent' || s.whatsappStatus === 'delivered' || s.whatsappStatus === 'read').length : Math.max(0, selectedBatch.sentCount ?? selectedBatch.summaryCache?.whatsapp?.sent ?? 0);
    const dynDelivered = hasStudents ? batchStudents.filter(s => s.whatsappStatus === 'delivered' || s.whatsappStatus === 'read').length : Math.max(0, selectedBatch.deliveredCount ?? selectedBatch.summaryCache?.whatsapp?.delivered ?? 0);
    const dynRead = hasStudents ? batchStudents.filter(s => s.whatsappStatus === 'read').length : Math.max(0, selectedBatch.readCount ?? selectedBatch.summaryCache?.whatsapp?.read ?? 0);
    const dynFailed = hasStudents ? batchStudents.filter(s => s.whatsappStatus === 'failed').length : Math.max(0, selectedBatch.failedCount ?? selectedBatch.summaryCache?.whatsapp?.failed ?? 0);
    
    return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex flex-col items-center">
        <span className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{dynTotal}</span>
        <span className="text-[10px] font-bold text-zinc-500 uppercase">Total</span>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 flex flex-col items-center">
        <span className="text-xl font-bold text-blue-600 dark:text-blue-500">{dynInProgress}</span>
        <span className="text-[10px] font-bold text-blue-600/70 uppercase">In Progress</span>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 flex flex-col items-center">
        <span className="text-xl font-bold text-blue-600 dark:text-blue-500">{dynSent}</span>
        <span className="text-[10px] font-bold text-blue-600/70 uppercase">Sent</span>
      </div>
      <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 flex flex-col items-center">
        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-500">{dynDelivered}</span>
        <span className="text-[10px] font-bold text-emerald-600/70 uppercase">Delivered</span>
      </div>
      <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl p-3 flex flex-col items-center">
        <span className="text-xl font-bold text-purple-600 dark:text-purple-500">{dynRead}</span>
        <span className="text-[10px] font-bold text-purple-600/70 uppercase">Read</span>
      </div>
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 flex flex-col items-center relative group cursor-help">
        <span className="text-xl font-bold text-red-600 dark:text-red-500">{dynFailed}</span>
        <span className="text-[10px] font-bold text-red-600/70 uppercase flex items-center gap-1">Failed <AlertCircle className="w-3 h-3" /></span>
        {dynFailed > 0 && (
          <div className="absolute top-full mt-2 w-48 bg-zinc-900 text-white text-[10px] p-2 rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Review the failed students below. You can click 'Retry Failed' to re-queue them.
          </div>
        )}
      </div>
    </div>
    );
 })()}

 {/* Campaign History Dashboard */}
 {campaigns.length > 0 && (
   <div className="mt-6 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
     <h3 className="font-bold text-zinc-800 dark:text-zinc-200 text-base mb-4 flex items-center gap-2">
       <Activity className="w-4 h-4 text-blue-500" />
       Campaign History
     </h3>
     <div className="overflow-x-auto">
       <table className="w-full text-left text-sm whitespace-nowrap">
         <thead className="text-[10px] uppercase text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50">
           <tr>
             <th className="px-4 py-3 font-bold rounded-l-xl">Campaign ID</th>
             <th className="px-4 py-3 font-bold">Status</th>
             <th className="px-4 py-3 font-bold">Started</th>
             <th className="px-4 py-3 font-bold">Duration</th>
             <th className="px-4 py-3 font-bold text-center">Jobs</th>
             <th className="px-4 py-3 font-bold text-center text-blue-600">Sent</th>
             <th className="px-4 py-3 font-bold text-center text-emerald-600">Delivered</th>
             <th className="px-4 py-3 font-bold text-center text-purple-600">Read</th>
             <th className="px-4 py-3 font-bold text-center text-red-600 rounded-r-xl">Failed</th>
           </tr>
         </thead>
         <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 text-zinc-700 dark:text-zinc-300">
           {campaigns.map(c => {
             const startDate = c.startedAt?.toDate ? c.startedAt.toDate() : new Date(c.startedAt);
             const duration = c.durationMs ? `${(c.durationMs / 1000).toFixed(1)}s` : '—';
             return (
               <tr key={c.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                 <td className="px-4 py-3 font-mono text-xs">{c.id}</td>
                 <td className="px-4 py-3">
                   <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                     c.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                     c.status === 'failed' ? 'bg-red-100 text-red-700' :
                     'bg-blue-100 text-blue-700'
                   }`}>
                     {c.status.toUpperCase()}
                   </span>
                 </td>
                 <td className="px-4 py-3 text-xs">{startDate.toLocaleTimeString()}</td>
                 <td className="px-4 py-3 text-xs font-mono">{duration}</td>
                 <td className="px-4 py-3 text-center font-bold">{c.totalJobs}</td>
                 <td className="px-4 py-3 text-center font-bold text-blue-600">{c.sentJobs || 0}</td>
                 <td className="px-4 py-3 text-center font-bold text-emerald-600">{c.deliveredJobs || 0}</td>
                 <td className="px-4 py-3 text-center font-bold text-purple-600">{c.readJobs || 0}</td>
                 <td className="px-4 py-3 text-center font-bold text-red-600">{c.failedJobs || 0}</td>
               </tr>
             );
           })}
         </tbody>
       </table>
     </div>
   </div>
 )}

 {/* Browser Popups Warning (Removed since we use API now) */}

 {/* Students Grid */}
 <div className="space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex flex-wrap items-center gap-3">
 <h3 className="font-bold text-zinc-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 text-base">
 Students Graded ({displayedBatchStudents.length}{beltFilter ? ` of ${batchStudents.length}` : ''})
 </h3>
 {availableBelts.length > 0 && (
 <select
 value={beltFilter}
 onChange={(e) => setBeltFilter(e.target.value)}
 className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-transparent rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 outline-none cursor-pointer"
 >
 <option value="">All Belts</option>
 {availableBelts.map(b => <option key={b} value={b}>{b}</option>)}
 </select>
 )}
 </div>
 {selectedStudentIds.size > 0 && (
 <div className="flex items-center gap-2">
 <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{selectedStudentIds.size} selected</span>
 <button
 onClick={() => setSelectedStudentIds(new Set())}
 className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
 >
 Clear
 </button>
 <button
 onClick={regenerateSelectedStudents}
 disabled={isRegeneratingSelected}
 className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
 isRegeneratingSelected
 ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
 : "bg-purple-500 hover:bg-purple-600 text-white"
 }`}
 >
 {isRegeneratingSelected ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
 Regenerate Selected ({selectedStudentIds.size})
 </button>
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {displayedBatchStudents.map((s) => {
 const hasStartedSending = selectedBatch?.whatsappStatus && selectedBatch.whatsappStatus !== 'pending';
 const hasPdf = !!s.resultPdfUrl;
 const showWhatsAppStatus = hasStartedSending && (s.whatsappStatus || s.deliveryStatus);
 
 const isSent = showWhatsAppStatus && (s.whatsappStatus === 'sent' || s.whatsappStatus === 'delivered' || s.whatsappStatus === 'read');
 const isFailed = showWhatsAppStatus && (s.whatsappStatus === 'failed');
 const isPending = showWhatsAppStatus && (s.whatsappStatus === 'queued' || s.whatsappStatus === 'sending');
 
 return (
 <div 
 key={s.id}
 className={`bg-white dark:bg-zinc-950 rounded-3xl p-5 border shadow-sm transition-all ${
 isFailed
 ? "border-red-300 bg-red-50/20"
 : isPending
 ? "border-blue-300 bg-blue-50/10 animate-pulse"
 : isSent 
 ? "border-emerald-200 bg-emerald-50/10" 
 : "border-zinc-150 hover:border-zinc-200 dark:border-zinc-800"
 }`}
 >
 <div className="flex justify-between items-start gap-3">
 <div className="flex items-start gap-2.5 min-w-0">
 <input
 type="checkbox"
 checked={selectedStudentIds.has(s.id)}
 onChange={() => toggleStudentSelection(s.id)}
 className="mt-1 w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-purple-500 focus:ring-purple-500 cursor-pointer flex-shrink-0"
 title="Select for group regeneration"
 />
 <div className="min-w-0">
 <h4 className="font-bold text-zinc-950 text-base truncate">{s.name}</h4>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-semibold uppercase tracking-wider mt-0.5">
 ID: {(s.id || '').slice(-8)}
 </p>
 </div>
 </div>
 <div className="flex flex-col items-end gap-1.5">
 <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 ${(s.testStatus === "passed" || s.testStatus === "pass")
 ? "bg-green-50 text-green-700 border border-green-100"
 : (s.testStatus === "failed" || s.testStatus === "fail")
 ? "bg-red-50 text-red-700 border border-red-100"
 : "bg-blue-50 text-blue-700 border border-blue-100"
 }`}>
 {(s.testStatus === "passed" || s.testStatus === "pass") ? "Passed" : (s.testStatus === "failed" || s.testStatus === "fail") ? "Failed" : "Pending"}
 </span>
  {showWhatsAppStatus ? (
  <div className="flex flex-col items-end gap-1">
    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
    (s.whatsappStatus || s.deliveryStatus) === 'read' ? 'bg-purple-100 text-purple-700' :
    (s.whatsappStatus || s.deliveryStatus) === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
    (s.whatsappStatus || s.deliveryStatus) === 'sent' ? 'bg-blue-100 text-blue-700' :
    (s.whatsappStatus || s.deliveryStatus) === 'failed' ? 'bg-red-100 text-red-700' :
    (s.whatsappStatus || s.deliveryStatus) === 'queued' || (s.whatsappStatus || s.deliveryStatus) === 'sending' ? 'bg-blue-100 text-blue-700' :
    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
    }`}>
    {(s.whatsappStatus || s.deliveryStatus)?.toUpperCase()}
    </span>
    {s.retryCount !== undefined && s.retryCount > 0 && (
      <span className="text-[9px] font-bold text-zinc-400">Retries: {s.retryCount}</span>
    )}
  </div>
  ) : (
    hasPdf && (
      <div className="flex flex-col items-end gap-1">
        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700">
          PDF READY
        </span>
        <span className="text-[9px] font-bold text-zinc-400">Waiting to Send</span>
      </div>
    )
  )}
 </div>
 </div>

 {isFailed && s.failureReason && (
   <div className="mt-3 p-2 rounded-lg bg-red-50 text-red-700 border border-red-100 text-xs font-medium">
     <AlertCircle className="w-3 h-3 inline mr-1" />
     {s.failureReason}
   </div>
 )}

 {/* Details Grid */}
 <div className="grid grid-cols-2 gap-y-3 gap-x-4 mt-4 py-3 border-t border-b border-zinc-100 dark:border-zinc-800">
 <div>
 <p className="text-[10px] text-zinc-400 font-bold uppercase">Parent Phone</p>
 <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5 truncate">
 {s.whatsapp || "Not Provided"}
 </p>
 </div>
 <div>
 <p className="text-[10px] text-zinc-400 font-bold uppercase">Score / Percent</p>
 <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5 truncate">
 {s.score != null ? `${s.score} pts (${s.percentage || 0}%)` : "—"}
 </p>
 </div>
 {s.lastAttemptAt && (
   <div className="col-span-2">
     <p className="text-[10px] text-zinc-400 font-bold uppercase">Last Delivery Update</p>
     <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 mt-0.5">
       {s.lastAttemptAt.toDate ? s.lastAttemptAt.toDate().toLocaleString() : new Date(s.lastAttemptAt).toLocaleString()}
     </p>
   </div>
 )}
 </div>

 {/* Actions bar inside student card */}
 <div className="flex flex-wrap items-center justify-between gap-3 gap-3 mt-4 pt-1">
 {hasPdf ? (
 <a 
 href={s.resultPdfUrl} 
 target="_blank" 
 rel="noopener noreferrer" 
 className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
 >
 <FileText className="w-4 h-4" /> View PDF
 </a>
 ) : (
 <span className="text-xs text-zinc-400 italic">No PDF Generated</span>
 )}

 <div className="flex items-center gap-2">
 <button
 onClick={() => regenerateSingleStudent(s)}
 disabled={regeneratingIds.has(s.id)}
 title="Force-regenerate this student's PDF"
 className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
 regeneratingIds.has(s.id)
 ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
 : "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
 }`}
 >
 <RefreshCw className={`w-3.5 h-3.5 ${regeneratingIds.has(s.id) ? 'animate-spin' : ''}`} />
 Regenerate
 </button>
 <button
 onClick={() => sendSingleMessage(s)}
 disabled={!s.whatsapp || sendingIds.has(s.id)}
 className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
 sendingIds.has(s.id)
 ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
 : isSent
 ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
 : "bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"
 }`}
 >
 {sendingIds.has(s.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSent ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
 {sendingIds.has(s.id) ? "Sending..." : isSent ? "Resend via WA" : "Send via WA"}
 </button>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </>
 ) : (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-3xl p-12 text-center border border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 min-h-[400px] flex flex-col justify-center items-center">
 <MessageCircle className="w-12 h-12 text-zinc-300 mb-4 animate-bounce" />
 <h3 className="text-lg font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">Select a Batch</h3>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-sm mt-1 max-w-sm">
 Choose one of the completed batches from the left sidebar to preview results and dispatch notifications.
 </p>
 </div>
 )}
 </div>

 </div>
 )}

 </div>
 </AdminLayout>
 );
}
