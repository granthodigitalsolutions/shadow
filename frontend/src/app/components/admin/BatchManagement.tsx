import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Layers, Users, ArrowLeft, Trash2, Clock, CheckCircle, PlayCircle, X, UserCircle, School as SchoolIcon, ChevronDown, ChevronUp, AlertCircle, Info, RotateCcw, Wand2, Copy, Sparkles, KeyRound, FileDown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { firebaseBatchService, firebaseBeltTestService, firebaseSchoolService, firebaseStudentService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { Batch, BeltTest, School, StudentRecord } from "../../types/admin";
import { useProgram } from "../../contexts/ProgramContext";
import { formatBatchName } from "../../utils/batchFormatters";
import { filterEligibleStudents } from "../../utils/batchEligibility";

const STATUS_CONFIG: Record<string, { label: string; bg: string; icon: typeof Clock }> = {
 waiting: { label: "Waiting", bg: "bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400", icon: Clock },
 filling: { label: "Filling", bg: "bg-blue-100 text-blue-700", icon: Layers },
 ongoing: { label: "Ongoing", bg: "bg-blue-100 text-blue-700", icon: PlayCircle },
 completed: { label: "Completed", bg: "bg-green-100 text-green-700", icon: CheckCircle },
};

// Static belt/stage lists for the Generate Batch modal — matches
// StickerPrinting.tsx exactly (BeltTest.belts is never actually populated).
const KARATE_BELTS = ['White', 'Yellow', 'Orange', 'Blue', 'Green', 'II Brown', 'I Brown', 'Black Belt'];
const SILAMBAM_BELTS = Array.from({ length: 8 }, (_, i) => `Stage ${i + 1}`);

export default function BatchManagement() {
 const { schoolId } = useParams();
 const location = useLocation();
 const isIndividual = !schoolId && (location.pathname || '').includes("individual-batches");
 const targetSchoolId = isIndividual ? "individual" : schoolId;

 const { programNavigate } = useProgram();
 const { showToast } = useToast();
 const { showConfirm } = useDialog();
 const { currentProgram } = useProgram();

 const prevSig = useRef<string>("");

 const [school, setSchool] = useState<School | null>(null);
 const [batches, setBatches] = useState<Batch[]>([]);
 const [beltTests, setBeltTests] = useState<BeltTest[]>([]);
 const [batchStudents, setBatchStudents] = useState<Record<string, StudentRecord[]>>({});
 const [unassignedStudents, setUnassignedStudents] = useState<StudentRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [showUnassigned, setShowUnassigned] = useState(false);

 const [selectedBeltTest, setSelectedBeltTest] = useState<string>("all");

 // --- Generate Batch (Phase 3) — the only way batches get created now that
 // the old manual Create Batches flow (Half B, Phase 4) is gone ---
 const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
 const [showGenerateModal, setShowGenerateModal] = useState(false);
 const [generateForm, setGenerateForm] = useState({ beltTestId: "", belt: "" });
 const [generating, setGenerating] = useState(false);
 const [generatedResult, setGeneratedResult] = useState<Batch | null>(null);
 // Two entry points share the one modal: "all" (Generate All Batches — one batch
 // per Belt/Stage that has eligible students) and "selective" (the original
 // manual Belt/Stage picker).
 const [generateMode, setGenerateMode] = useState<"all" | "selective">("selective");
 const [generatedAllResult, setGeneratedAllResult] = useState<{
 created: { belt: string; batch: Batch }[];
 skipped: string[];
 failed: { belt: string; message: string }[];
 } | null>(null);
 const [generateProgress, setGenerateProgress] = useState<{ done: number; total: number } | null>(null);

 // --- Generate Code (Phase 4) — lets Admin retrofit a Phase-3-less legacy
 // batch (no `code`) with a code so its remaining pending students become
 // reachable by the new Examiner flow, without touching studentIds/scores.
 const [generateCodeModal, setGenerateCodeModal] = useState<{ open: boolean; batch: Batch | null; generating: boolean; code: string | null }>({
 open: false,
 batch: null,
 generating: false,
 code: null,
 });

  useEffect(() => {
    let unsubscribeBatches: (() => void) | undefined;
    const sig = `${targetSchoolId}_${currentProgram}`;
    if (prevSig.current === sig) return;
    prevSig.current = sig;

    const initializeData = async () => {
      if (!targetSchoolId) return;
      setLoading(true);
      try {
        const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
        const [testsData, allStudents] = await Promise.all([
          firebaseBeltTestService.getAll(programFilter),
          firebaseStudentService.getAll(programFilter)
        ]);

        setBeltTests(testsData);
        setAllStudents(allStudents);

        if (targetSchoolId && targetSchoolId !== "individual") {
          const schoolData = await firebaseSchoolService.getById(targetSchoolId);
          if (!schoolData) {
            showToast("School not found", "error");
            programNavigate("schools");
            return;
          }
          setSchool(schoolData);
        }

        unsubscribeBatches = firebaseBatchService.listenAll((allBatches) => {
          const relevantBatches = allBatches.filter((b) => b.schoolId === targetSchoolId);
          setBatches(relevantBatches);

          if (isIndividual) {
            // Only Admin-confirmed (paymentStatus === 'verified') students can be batched.
            const allIndividuals = allStudents.filter(s => s.registrationType === 'individual' && s.paymentStatus === 'verified');
            const assignedIds = new Set(relevantBatches.flatMap((b) => b.studentIds || []));
            setUnassignedStudents(allIndividuals.filter((s) => !assignedIds.has(s.id)));
          }

          const studentsMap: Record<string, StudentRecord[]> = {};
          for (const batch of relevantBatches) {
            if (batch.studentIds && batch.studentIds.length > 0) {
              studentsMap[batch.id] = batch.studentIds
                .map(id => allStudents.find(s => s.id === id))
                .filter(Boolean) as StudentRecord[];
            } else {
              studentsMap[batch.id] = [];
            }
          }
          setBatchStudents(studentsMap);
          setLoading(false);
        }, programFilter);

      } catch (error) {
        console.error("Error fetching data:", error);
        showToast("Error loading data", "error");
        setLoading(false);
      }
    };

    initializeData();

    return () => {
      if (unsubscribeBatches) unsubscribeBatches();
      prevSig.current = ""; // allow re-fetch if we navigate back
    };
  }, [targetSchoolId, currentProgram, programNavigate, isIndividual]);

 // --- Generate Code (Phase 4) ---
 const handleGenerateCode = async (batch: Batch) => {
 setGenerateCodeModal({ open: true, batch, generating: true, code: null });
 try {
 const code = await firebaseBatchService.generateUniqueBatchCode();
 await firebaseBatchService.update(batch.id, { code, isAutoGenerated: true });
 setGenerateCodeModal({ open: true, batch, generating: false, code });
 showToast("Batch code generated!", "success");
 } catch (error: any) {
 console.error("Error generating batch code:", error);
 showToast(error?.message || "Error generating batch code", "error");
 setGenerateCodeModal({ open: false, batch: null, generating: false, code: null });
 }
 };

 const closeGenerateCodeModal = () => {
 setGenerateCodeModal({ open: false, batch: null, generating: false, code: null });
 };

 // --- Generate Batch (Phase 3) ---
 const generateSelectedTest = beltTests.find((t) => t.id === generateForm.beltTestId);
 const generateBeltOptions = generateSelectedTest?.programType === "SELAMBAM" ? SILAMBAM_BELTS : KARATE_BELTS;

 const eligibleStudentsForGenerate = useMemo(() => {
 if (!targetSchoolId || !generateForm.beltTestId || !generateForm.belt) return [];
 return filterEligibleStudents(allStudents, {
 targetSchoolId,
 isIndividual,
 beltTestId: generateForm.beltTestId,
 belt: generateForm.belt,
 });
 }, [allStudents, targetSchoolId, isIndividual, generateForm.beltTestId, generateForm.belt]);

 // Eligible students per Belt/Stage for the selected test, using the same
 // belt/stage list and the same filterEligibleStudents() as Selective Generate.
 // Students already in a batch are never eligible, which is what stops a second
 // "Generate All" from duplicating batches.
 const allModeGroups = useMemo(() => {
 if (!targetSchoolId || !generateForm.beltTestId) return [];
 return generateBeltOptions.map((belt) => ({
 belt,
 count: filterEligibleStudents(allStudents, {
 targetSchoolId,
 isIndividual,
 beltTestId: generateForm.beltTestId,
 belt,
 }).length,
 }));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [allStudents, targetSchoolId, isIndividual, generateForm.beltTestId, generateSelectedTest?.programType]);
 const allModeEligible = allModeGroups.filter((g) => g.count > 0);
 const allModeTotal = allModeEligible.reduce((sum, g) => sum + g.count, 0);

 const closeGenerateModal = () => {
 setShowGenerateModal(false);
 setGenerateForm({ beltTestId: "", belt: "" });
 setGeneratedResult(null);
 setGeneratedAllResult(null);
 setGenerateProgress(null);
 };

 // generateBatch() marks students as batched in Firestore but this page's
 // student cache is loaded once — re-read it so eligibility counts are current.
 const refreshStudents = async () => {
 try {
 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
 setAllStudents(await firebaseStudentService.getAll(programFilter));
 } catch (error) {
 console.error("Error refreshing students:", error);
 }
 };

 const openGenerateModal = (mode: "all" | "selective") => {
 setGenerateMode(mode);
 setShowGenerateModal(true);
 refreshStudents();
 };

 // Generate All Batches: one batch per Belt/Stage that currently has eligible
 // students, created one after another through the existing generateBatch()
 // (so codes, numbering and student assignment are unchanged — and each call
 // re-reads fresh data, so batch numbers increment correctly). Belts with no
 // eligible students are skipped; one belt failing doesn't stop the rest.
 const handleGenerateAll = async () => {
 if (!targetSchoolId || !generateForm.beltTestId) {
 showToast("Please select a belt test", "error");
 return;
 }
 if (generating) return;
 setGenerating(true);
 try {
 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
 const freshStudents = await firebaseStudentService.getAll(programFilter);
 setAllStudents(freshStudents);

 const groups = generateBeltOptions.map((belt) => ({
 belt,
 count: filterEligibleStudents(freshStudents, {
 targetSchoolId,
 isIndividual,
 beltTestId: generateForm.beltTestId,
 belt,
 }).length,
 }));
 const toGenerate = groups.filter((g) => g.count > 0);
 const skipped = groups.filter((g) => g.count === 0).map((g) => g.belt);
 if (toGenerate.length === 0) {
 showToast("No eligible students found", "error");
 return;
 }

 const programType = generateSelectedTest?.programType ?? (currentProgram === "SELAMBAM" ? "SELAMBAM" : "KARATE");
 const created: { belt: string; batch: Batch }[] = [];
 const failed: { belt: string; message: string }[] = [];
 setGenerateProgress({ done: 0, total: toGenerate.length });
 for (const group of toGenerate) {
 try {
 const batch = await firebaseBatchService.generateBatch({
 schoolId: targetSchoolId,
 isIndividual,
 beltTestId: generateForm.beltTestId,
 belt: group.belt,
 programType,
 });
 created.push({ belt: group.belt, batch });
 } catch (error: any) {
 console.error(`Error generating batch for ${group.belt}:`, error);
 failed.push({ belt: group.belt, message: error?.message || "Error generating batch" });
 }
 setGenerateProgress({ done: created.length + failed.length, total: toGenerate.length });
 }

 setGeneratedAllResult({ created, skipped, failed });
 if (created.length === 0) {
 showToast("No batches could be generated", "error");
 } else {
 showToast(
 `${created.length} batch${created.length === 1 ? "" : "es"} generated${failed.length ? `, ${failed.length} failed` : ""}`,
 failed.length ? "info" : "success",
 );
 }
 await refreshStudents();
 } catch (error: any) {
 console.error("Error generating all batches:", error);
 showToast(error?.message || "Error generating batches", "error");
 } finally {
 setGenerating(false);
 setGenerateProgress(null);
 }
 };

 const handleGenerateBatch = async () => {
 if (!targetSchoolId || !generateForm.beltTestId || !generateForm.belt) {
 showToast("Please select a belt test and belt", "error");
 return;
 }
 if (eligibleStudentsForGenerate.length === 0) {
 showToast("No eligible students found", "error");
 return;
 }
 setGenerating(true);
 try {
 const newBatch = await firebaseBatchService.generateBatch({
 schoolId: targetSchoolId,
 isIndividual,
 beltTestId: generateForm.beltTestId,
 belt: generateForm.belt,
 programType: generateSelectedTest?.programType ?? (currentProgram === "SELAMBAM" ? "SELAMBAM" : "KARATE"),
 });
 setGeneratedResult(newBatch);
 showToast("Batch generated!", "success");
 refreshStudents();
 } catch (error: any) {
 console.error("Error generating batch:", error);
 showToast(error?.message || "Error generating batch", "error");
 } finally {
 setGenerating(false);
 }
 };

 const handleCopyBatchCode = (code?: string) => {
 if (!code) return;
 navigator.clipboard.writeText(code);
 showToast("Batch code copied!", "success");
 };

 // One-page printable QR sheet (branding + QR + batch code). jsPDF and the QR
 // rasteriser are loaded on demand so they stay out of the page's initial bundle.
 const [pdfDownloadingId, setPdfDownloadingId] = useState<string | null>(null);
 const handleDownloadBatchPdf = async (batch: Batch) => {
 if (!batch.code || pdfDownloadingId) return;
 setPdfDownloadingId(batch.id);
 try {
 const { downloadBatchQrPdf } = await import("../../utils/batchQrPdf");
 await downloadBatchQrPdf({
 code: batch.code,
 batchName: formatBatchName(batch),
 schoolName: isIndividual ? "Individual Students" : school ? [school.name, school.branch].filter(Boolean).join(" - ") : undefined,
 testName: getBeltTestName(batch),
 studentCount: batch.studentIds?.length || 0,
 });
 showToast("Batch QR PDF downloaded", "success");
 } catch (error) {
 console.error("Error generating batch QR PDF:", error);
 showToast("Failed to generate batch QR PDF", "error");
 } finally {
 setPdfDownloadingId(null);
 }
 };

 const handleForceComplete = async (batch: Batch) => {
 const studentCount = batch.studentIds?.length || 0;
 const ok = await showConfirm({
 title: "Complete Batch",
 message: `Only ${studentCount} student${studentCount === 1 ? '' : 's'} available. Do you want to complete this batch?`,
 confirmText: "Complete",
 variant: "warning",
 });
 if (!ok) return;

 try {
 await firebaseBatchService.updateStatus(batch.id, "completed");
 // Surgical UI state update — no fetchData()
 setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: "completed" } : b));
 showToast("Batch completed successfully!", "success");
 } catch (error) {
 console.error("Error completing batch:", error);
 showToast("Failed to complete batch", "error");
 }
 };

 // Only a batch that was force-completed under capacity can be reopened — a
 // full batch that finished scoring naturally is final.
 const handleReopenBatch = async (batch: Batch) => {
 const ok = await showConfirm({
 title: "Reopen Batch",
 message: "This batch was completed before it was full. Reopen it to resume scanning or scoring?",
 confirmText: "Reopen",
 variant: "warning",
 });
 if (!ok) return;

 try {
 await firebaseBatchService.reopenBatch(batch.id);
 setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: "ongoing", completedAt: undefined } : b));
 showToast("Batch reopened", "success");
 } catch (error) {
 console.error("Error reopening batch:", error);
 showToast("Failed to reopen batch", "error");
 }
 };

 const handleDeleteBatch = async (batchId: string) => {
 const batch = batches.find((b) => b.id === batchId);
 if (!batch) return;
 const ok = await showConfirm({ title: "Delete Batch", message: "Delete this batch? This cannot be undone.", confirmText: "Delete", variant: "danger" });
 if (!ok) return;
 try {
 await firebaseBatchService.delete(batchId);
 // Surgical UI state update — no fetchData()
 setBatches(prev => prev.filter(b => b.id !== batchId));
 showToast("Batch deleted", "success");
 } catch (error: any) {
 console.error("Batch delete error:", error);
 showToast(`Error deleting batch: ${error.message || 'Unknown error'}`, "error");
 }
 };

 // Belt/Stage of a batch, read off its enrolled students (batches don't store it).
 const getBatchBeltLabel = (batchId: string) => {
 const labels = new Set<string>();
 (batchStudents[batchId] || []).forEach((s) => {
 const label = s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "");
 if (label) labels.add(label);
 });
 return Array.from(labels).join(", ");
 };

 const filteredBatches = batches.filter((b) => selectedBeltTest === "all" || b.beltTestId === selectedBeltTest);
  const getBeltTestName = (batch: Batch) => {
    const test = beltTests.find((t) => t.id === batch.beltTestId);
    if (test) return test.name;
    const activeTest = beltTests.find(t => t.isActive && t.programType === batch.programType);
    return activeTest ? activeTest.name : "Unknown Test";
  };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
 </div>
 </AdminLayout>
 );
 }

 return (
 <AdminLayout>
 <div className="max-w-7xl mx-auto space-y-6">
 
 {/* Header */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">
 {!isIndividual && (
 <button onClick={() => programNavigate("schools")} className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50 font-semibold mb-4 text-sm transition-colors w-fit">
 <ArrowLeft className="w-4 h-4" /> Back to Schools
 </button>
 )}

 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
 {isIndividual ? <UserCircle className="w-6 h-6 text-indigo-500" /> : <SchoolIcon className="w-6 h-6 text-indigo-500" />}
 </div>
 <div>
 <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {isIndividual ? "INDIVIDUAL BATCHES" : `${school?.name?.toUpperCase()}`}
 </h1>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">
 {isIndividual ? "Manage batches exclusively for independent students." : `Manage test batches for ${school?.branch}`}
 </p>
 </div>
 </div>
 <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
 <button onClick={() => openGenerateModal("all")} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 transition-all active:scale-95">
 <Layers className="w-5 h-5" /> Generate All Batches
 </button>
 <button onClick={() => openGenerateModal("selective")} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-zinc-950 hover:bg-indigo-50 dark:hover:bg-zinc-900 text-indigo-600 font-bold rounded-xl border border-indigo-200 dark:border-zinc-800 shadow-sm dark:shadow-none transition-all active:scale-95">
 <Wand2 className="w-5 h-5" /> Selective Generate
 </button>
 </div>
 </div>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 text-center">
 <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{batches.length}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Total</p>
 </div>
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 text-center">
 <p className="text-3xl font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{batches.filter(b => b.status === "waiting").length}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Waiting</p>
 </div>
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 text-center">
 <p className="text-3xl font-bold text-blue-600">{batches.filter(b => b.status === "filling" || b.status === "ongoing").length}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Active</p>
 </div>
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 text-center">
 <p className="text-3xl font-bold text-green-600">{batches.filter(b => b.status === "completed").length}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Completed</p>
 </div>
 </div>

 {/* Individual Students Notice & Collapsible */}
 {isIndividual && (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <div className="p-4 bg-indigo-50/50 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex items-start gap-3">
 <Info className="w-5 h-5 text-indigo-500 flex-shrink-0" />
 <p className="text-sm font-medium text-indigo-900">
 These batches are exclusively for individual students. School students cannot be added here.
 </p>
 </div>
 <button onClick={() => setShowUnassigned(p => !p)} className="w-full flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors text-left">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><AlertCircle className="w-5 h-5 text-blue-500"/></div>
 <div>
 <p className="font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">Unassigned Individual Students</p>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">{unassignedStudents.length} students need a batch assignment.</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {unassignedStudents.length > 0 && <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg">{unassignedStudents.length}</span>}
 {showUnassigned ? <ChevronUp className="w-5 h-5 text-zinc-400"/> : <ChevronDown className="w-5 h-5 text-zinc-400"/>}
 </div>
 </button>
 {showUnassigned && (
 <div className="border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
 {unassignedStudents.length === 0 ? (
 <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">All students assigned!</div>
 ) : (
 unassignedStudents.map(s => (
 <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900/50">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center"><UserCircle className="w-4 h-4 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"/></div>
 <div><p className="font-bold text-sm text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{s.name}</p><p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{s.id}</p></div>
 </div>
 <div className="text-right">
 <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${s.paymentStatus === 'verified' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{s.paymentStatus}</span>
 </div>
 </div>
 ))
 )}
 </div>
 )}
 </div>
 )}

 {/* Filter */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-4 flex items-center gap-4">
 <label className="text-sm font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Filter Tests:</label>
 <select value={selectedBeltTest} onChange={e => setSelectedBeltTest(e.target.value)} className="w-full md:w-auto flex-1 md:flex-none px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl font-medium text-sm text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="all">All Belt Tests</option>
 {beltTests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
 </select>
 </div>

 {/* Grid */}
 {filteredBatches.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-12 text-center shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800">
 <Layers className="w-12 h-12 text-zinc-300 mx-auto mb-4"/>
 <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">No Batches Found</p>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-1">There are no batches created for this view yet. Use Generate All Batches or Selective Generate above to create them.</p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredBatches.map(batch => {
 const statusCfg = STATUS_CONFIG[batch.status] ?? STATUS_CONFIG.waiting;
 const StatusIcon = statusCfg.icon;
 const students = batchStudents[batch.id] || [];
 const fillPct = batch.maxSize > 0 ? Math.round(((batch.studentIds?.length || 0) / batch.maxSize) * 100) : 0;

 const completedCount = students.filter(s => s.testStatus === "passed" || s.testStatus === "failed").length;
 const totalEnrolled = students.length;

 return (
 <div key={batch.id} className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden flex flex-col group relative">
 <div className="p-5 flex-1 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <div className="flex justify-between items-start mb-4">
 <div>
 <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{formatBatchName(batch).toUpperCase()}</h3>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">{getBeltTestName(batch)}{getBatchBeltLabel(batch.id) ? ` · ${getBatchBeltLabel(batch.id)}` : ""}</p>
 </div>
 <button onClick={() => handleDeleteBatch(batch.id)} className="p-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-4 right-4 z-10"><Trash2 className="w-4 h-4"/></button>
 </div>
 <div className="space-y-3 mb-5">
 <div className="flex items-center gap-2">
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg}`}>
 <StatusIcon className="w-3.5 h-3.5"/> {statusCfg.label}
 </span>
 {batch.isAutoGenerated && (
 <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700">
 <Sparkles className="w-3.5 h-3.5"/> Generated
 </span>
 )}
 </div>
 {batch.code ? (
 <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 space-y-3">
 <div className="flex items-center gap-3">
 <div className="bg-white p-1.5 rounded-lg border border-indigo-100 flex-shrink-0">
 <QRCodeSVG value={batch.code} size={48} style={{ width: '48px', height: '48px' }} level="M" includeMargin={false} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Batch Code</p>
 <p className="text-lg font-bold text-indigo-900 tracking-widest">{batch.code}</p>
 </div>
 <button onClick={() => handleCopyBatchCode(batch.code)} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-white rounded-lg border border-indigo-200 whitespace-nowrap">
 <Copy className="w-3.5 h-3.5" /> Copy
 </button>
 </div>
 <button
 onClick={() => handleDownloadBatchPdf(batch)}
 disabled={pdfDownloadingId !== null}
 className="w-full flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-2 bg-white rounded-lg border border-indigo-200 transition-colors disabled:opacity-50"
 >
 {pdfDownloadingId === batch.id ? (
 <span className="w-3.5 h-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
 ) : (
 <FileDown className="w-3.5 h-3.5" />
 )}
 Download PDF
 </button>
 </div>
 ) : (
 <button
 onClick={() => handleGenerateCode(batch)}
 disabled={generateCodeModal.generating && generateCodeModal.batch?.id === batch.id}
 className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-100 font-bold text-xs transition-colors disabled:opacity-50"
 >
 {generateCodeModal.generating && generateCodeModal.batch?.id === batch.id ? (
 <span className="w-3.5 h-3.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
 ) : (
 <KeyRound className="w-3.5 h-3.5" />
 )}
 Generate Code
 </button>
 )}

 {/* Capacity Progress */}
 <div className="mb-4">
 <div className="flex justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-2">
 <span>Capacity</span><span>{batch.studentIds?.length || 0} / {batch.maxSize}</span>
 </div>
 <div className="h-2 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full overflow-hidden">
 <div className={`h-full transition-all duration-500 ${fillPct >= 100 ? 'bg-green-500' : fillPct >= 80 ? 'bg-blue-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(fillPct, 100)}%` }}></div>
 </div>
 </div>

 {/* Batch Progress */}
 <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 space-y-2">
 <div className="flex justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">
 <span>Batch Scoring Progress</span>
 <span>{completedCount} / {totalEnrolled} Scored ({batch.maxSize} Max)</span>
 </div>
 <div className="h-2 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full overflow-hidden">
 <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${totalEnrolled > 0 ? Math.round((completedCount / totalEnrolled) * 100) : 0}%` }}></div>
 </div>
 </div>

 </div>
 {students.length > 0 && (
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 p-4 max-h-[140px] overflow-y-auto custom-scrollbar border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Enrolled Students</p>
 <div className="space-y-2">
 {students.map((s, idx) => (
 <div key={`${s.id}-${idx}`} className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">
 <span className="w-5 h-5 bg-zinc-200 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 rounded-full flex items-center justify-center flex-shrink-0">{idx + 1}</span>
 <span className="truncate flex-1">{(s.name || "").trim() ? s.name : `Unnamed (${s.id})`}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 {batch.status !== "completed" ? (
 <div className="p-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end">
 <button onClick={() => handleForceComplete(batch)} className="w-full text-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold text-xs transition-colors">Complete Batch</button>
 </div>
 ) : (batch.studentIds?.length || 0) < batch.maxSize && (
 <div className="p-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end">
 <button
 onClick={() => handleReopenBatch(batch)}
 className="w-full flex items-center justify-center gap-2 text-center px-4 py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-xl font-bold text-xs transition-colors"
 >
 <RotateCcw className="w-3.5 h-3.5" />
 Reopen Batch (Under Capacity)
 </button>
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Generate Batch Modal */}
 {showGenerateModal && (
 <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 flex items-center gap-2">{generateMode === "all" ? <Layers className="w-5 h-5 text-indigo-500" /> : <Wand2 className="w-5 h-5 text-indigo-500" />} {generateMode === "all" ? "Generate All Batches" : "Generate Batch"}</h3>
 <button onClick={closeGenerateModal} disabled={generating} className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-full p-1 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"><X className="w-4 h-4"/></button>
 </div>

 {!generatedResult && !generatedAllResult ? (
 <>
 <div className="p-6 space-y-4">
 <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
 {generateMode === "all"
 ? "Creates one batch for every Belt / Stage that currently has eligible students in the selected Belt Test - each with its own batch code and QR code. Belts / Stages with no eligible students are skipped."
 : "Instantly creates one new batch pre-populated with every currently-eligible student for the selected Belt Test and Belt, along with a unique batch code and QR code."}
 </p>
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Belt / Stage Test *</label>
 <select value={generateForm.beltTestId} onChange={e => setGenerateForm(p => ({ ...p, beltTestId: e.target.value, belt: "" }))} className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="">Select Test...</option>
 {beltTests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
 </select>
 </div>
 {generateMode === "selective" && (
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Belt / Stage *</label>
 <select value={generateForm.belt} onChange={e => setGenerateForm(p => ({ ...p, belt: e.target.value }))} disabled={!generateForm.beltTestId} className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed">
 <option value="">Select Belt...</option>
 {generateBeltOptions.map(b => <option key={b} value={b}>{b}</option>)}
 </select>
 </div>
 )}
 {generateMode === "selective" ? (
 <div className="flex items-center justify-between gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
 <span className="text-sm font-bold text-indigo-900">Eligible Students</span>
 <span className="px-3 py-1 bg-white rounded-lg text-indigo-700 font-bold text-sm border border-indigo-200">
 {generateForm.beltTestId && generateForm.belt ? `${eligibleStudentsForGenerate.length} students eligible` : '—'}
 </span>
 </div>
 ) : (
 <div className="bg-indigo-50 rounded-xl border border-indigo-100 overflow-hidden">
 <div className="flex items-center justify-between gap-3 p-4">
 <span className="text-sm font-bold text-indigo-900">Eligible Students</span>
 <span className="px-3 py-1 bg-white rounded-lg text-indigo-700 font-bold text-sm border border-indigo-200">
 {generateForm.beltTestId
 ? `${allModeTotal} students in ${allModeEligible.length} batch${allModeEligible.length === 1 ? '' : 'es'}`
 : '—'}
 </span>
 </div>
 {generateForm.beltTestId && allModeEligible.length > 0 && (
 <ul className="border-t border-indigo-100 divide-y divide-indigo-100 bg-white/60 max-h-[220px] overflow-y-auto">
 {allModeEligible.map(g => (
 <li key={g.belt} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
 <span className="font-semibold text-indigo-900">{g.belt}</span>
 <span className="font-bold text-indigo-700">{g.count} student{g.count === 1 ? '' : 's'}</span>
 </li>
 ))}
 </ul>
 )}
 {generateForm.beltTestId && allModeEligible.length === 0 && (
 <p className="px-4 pb-4 text-xs font-semibold text-indigo-500">No Belt / Stage has eligible students for this test.</p>
 )}
 {generateForm.beltTestId && allModeEligible.length > 0 && allModeGroups.length > allModeEligible.length && (
 <p className="px-4 py-2 border-t border-indigo-100 text-[11px] font-semibold text-indigo-500">
 {allModeGroups.length - allModeEligible.length} Belt / Stage level{allModeGroups.length - allModeEligible.length === 1 ? '' : 's'} with no eligible students will be skipped.
 </p>
 )}
 {generating && generateProgress && (
 <p className="px-4 py-2 border-t border-indigo-100 text-xs font-bold text-indigo-700">
 Generating batch {Math.min(generateProgress.done + 1, generateProgress.total)} of {generateProgress.total}...
 </p>
 )}
 </div>
 )}
 </div>
 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end gap-3">
 <button onClick={closeGenerateModal} disabled={generating} className="px-5 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50 transition-colors">Cancel</button>
 {generateMode === "all" ? (
 <button onClick={handleGenerateAll} disabled={generating || !generateForm.beltTestId || allModeEligible.length === 0} className="px-5 py-2.5 text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50">
 {generating ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Layers className="w-4 h-4"/>}
 Generate All Batches
 </button>
 ) : (
 <button onClick={handleGenerateBatch} disabled={generating || !generateForm.beltTestId || !generateForm.belt || eligibleStudentsForGenerate.length === 0} className="px-5 py-2.5 text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50">
 {generating ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Wand2 className="w-4 h-4"/>}
 Generate Batch
 </button>
 )}
 </div>
 </>
 ) : generatedAllResult ? (
 <>
 <div className="p-6 space-y-4">
 <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 text-center">
 {generatedAllResult.created.length} batch{generatedAllResult.created.length === 1 ? '' : 'es'} generated
 </p>
 <div className="space-y-2 max-h-[320px] overflow-y-auto">
 {generatedAllResult.created.map(({ belt, batch }) => (
 <div key={batch.id} className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
 <div className="bg-white p-1.5 rounded-lg border border-indigo-100 flex-shrink-0">
 <QRCodeSVG value={batch.code || ""} size={48} style={{ width: '48px', height: '48px' }} level="M" includeMargin={false} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider truncate">{belt} &middot; {batch.studentIds.length} student{batch.studentIds.length === 1 ? '' : 's'}</p>
 <p className="text-lg font-bold text-indigo-900 tracking-widest">{batch.code}</p>
 </div>
 <button onClick={() => handleCopyBatchCode(batch.code)} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-white rounded-lg border border-indigo-200 whitespace-nowrap">
 <Copy className="w-3.5 h-3.5" /> Copy
 </button>
 </div>
 ))}
 </div>
 {generatedAllResult.failed.length > 0 && (
 <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-medium text-red-700 space-y-1">
 {generatedAllResult.failed.map(f => (
 <p key={f.belt}><span className="font-bold">{f.belt}:</span> {f.message}</p>
 ))}
 </div>
 )}
 {generatedAllResult.skipped.length > 0 && (
 <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
 Skipped (no eligible students): {generatedAllResult.skipped.join(', ')}
 </p>
 )}
 </div>
 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
 <button onClick={closeGenerateModal} className="px-5 py-2.5 text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 transition-colors">
 Done
 </button>
 </div>
 </>
 ) : generatedResult ? (
 <>
 <div className="p-6 space-y-4 text-center">
 <div className="flex flex-col items-center gap-3">
 <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm inline-block">
 <QRCodeSVG value={generatedResult.code || ""} size={140} style={{ width: '140px', height: '140px' }} level="M" includeMargin={false} />
 </div>
 <div>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Batch Code</p>
 <p className="text-3xl font-bold text-indigo-700 tracking-[0.2em]">{generatedResult.code}</p>
 </div>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
 {generatedResult.studentIds.length} student{generatedResult.studentIds.length === 1 ? '' : 's'} enrolled in this batch.
 </p>
 <div className="flex flex-wrap items-center justify-center gap-2">
 <button onClick={() => handleCopyBatchCode(generatedResult.code)} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
 <Copy className="w-4 h-4" /> Copy Code
 </button>
 <button onClick={() => handleDownloadBatchPdf(generatedResult)} disabled={pdfDownloadingId !== null} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-200 disabled:opacity-50">
 {pdfDownloadingId === generatedResult.id ? <span className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
 </button>
 </div>
 </div>
 </div>
 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end gap-3">
 <button onClick={closeGenerateModal} className="px-5 py-2.5 text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 transition-colors">
 Done
 </button>
 </div>
 </>
 ) : null}
 </div>
 </div>
 )}

 {/* Generate Code Modal (Phase 4) */}
 {generateCodeModal.open && generateCodeModal.batch && (
 <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-zinc-50 dark:bg-zinc-900">
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 flex items-center gap-2"><KeyRound className="w-5 h-5 text-indigo-500" /> Generate Code</h3>
 {!generateCodeModal.generating && (
 <button onClick={closeGenerateCodeModal} className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950 rounded-full p-1 shadow-sm border border-zinc-200 dark:border-zinc-800"><X className="w-4 h-4"/></button>
 )}
 </div>

 <div className="p-6 space-y-4 text-center">
 {generateCodeModal.generating ? (
 <div className="py-8 flex flex-col items-center gap-3">
 <span className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
 <p className="text-sm text-zinc-500 dark:text-zinc-400">Generating a unique batch code...</p>
 </div>
 ) : generateCodeModal.code ? (
 <div className="flex flex-col items-center gap-3">
 <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm inline-block">
 <QRCodeSVG value={generateCodeModal.code} size={140} style={{ width: '140px', height: '140px' }} level="M" includeMargin={false} />
 </div>
 <div>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Batch Code</p>
 <p className="text-3xl font-bold text-indigo-700 tracking-[0.2em]">{generateCodeModal.code}</p>
 </div>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
 This batch is now reachable by the Examiner code flow. Its enrolled students and any already-recorded scores are unchanged.
 </p>
 <div className="flex flex-wrap items-center justify-center gap-2">
 <button onClick={() => handleCopyBatchCode(generateCodeModal.code || undefined)} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
 <Copy className="w-4 h-4" /> Copy Code
 </button>
 {generateCodeModal.batch && (
 <button onClick={() => handleDownloadBatchPdf({ ...generateCodeModal.batch!, code: generateCodeModal.code! })} disabled={pdfDownloadingId !== null} className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-200 disabled:opacity-50">
 {pdfDownloadingId === generateCodeModal.batch.id ? <span className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
 </button>
 )}
 </div>
 </div>
 ) : null}
 </div>

 {!generateCodeModal.generating && (
 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
 <button onClick={closeGenerateCodeModal} className="px-5 py-2.5 text-sm font-bold bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-sm transition-colors">
 Done
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </AdminLayout>
 );
}
