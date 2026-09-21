import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Layers, Plus, Users, ArrowLeft, Trash2, UserCheck, Clock, CheckCircle, PlayCircle, X, UserCircle, School as SchoolIcon, ChevronDown, ChevronUp, AlertCircle, Info, RotateCcw } from "lucide-react";
import { firebaseBatchService, firebaseBeltTestService, firebaseSchoolService, firebaseRefereeService, firebaseStudentService, firebaseAdminSettingsService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { Batch, BeltTest, School, Referee, StudentRecord } from "../../types/admin";
import { useProgram } from "../../contexts/ProgramContext";
import { formatBatchName } from "../../utils/batchFormatters";

const STATUS_CONFIG: Record<string, { label: string; bg: string; icon: typeof Clock }> = {
 waiting: { label: "Waiting", bg: "bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400", icon: Clock },
 filling: { label: "Filling", bg: "bg-blue-100 text-blue-700", icon: Layers },
 ongoing: { label: "Ongoing", bg: "bg-blue-100 text-blue-700", icon: PlayCircle },
 completed: { label: "Completed", bg: "bg-green-100 text-green-700", icon: CheckCircle },
};

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
 const [referees, setReferees] = useState<Referee[]>([]);
 const [batchStudents, setBatchStudents] = useState<Record<string, StudentRecord[]>>({});
 const [unassignedStudents, setUnassignedStudents] = useState<StudentRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [showUnassigned, setShowUnassigned] = useState(false);
 const [maxReferees, setMaxReferees] = useState(1);

 const [selectedBeltTest, setSelectedBeltTest] = useState<string>("all");
 const [showCreateModal, setShowCreateModal] = useState(false);
 const [createForm, setCreateForm] = useState({ beltTestId: "", numberOfBatches: 1, maxSize: 10, customName: "" });
 const [creating, setCreating] = useState(false);

 const [assignModal, setAssignModal] = useState<{ open: boolean; batch: Batch | null; refereeIds: string[]; assigning: boolean }>({
 open: false,
 batch: null,
 refereeIds: [],
 assigning: false,
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
        const [testsData, refereesData, settingsData, allStudents] = await Promise.all([
          firebaseBeltTestService.getAll(programFilter),
          firebaseRefereeService.getActive(),
          firebaseAdminSettingsService.get(programFilter).catch(() => null),
          firebaseStudentService.getAll(programFilter)
        ]);

        if (settingsData?.maxRefereesPerBatch) {
          setMaxReferees(settingsData.maxRefereesPerBatch);
        }

        setBeltTests(testsData);
        setReferees(refereesData);

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

 const handleCreateBatches = async () => {
 if (!createForm.beltTestId || !targetSchoolId) {
 showToast("Please select a belt test", "error");
 return;
 }
 if (createForm.numberOfBatches < 1 || createForm.numberOfBatches > 20) {
 showToast("Number of batches must be between 1 and 20", "error");
 return;
 }
 setCreating(true);
 try {
 const existingBatches = batches.filter((b) => b.beltTestId === createForm.beltTestId);
 const maxBatchNumber = existingBatches.reduce((max, b) => Math.max(max, b.batchNumber || 0), 0);
 const selectedTest = beltTests.find((t) => t.id === createForm.beltTestId);
 
 const newBatches: Batch[] = [];

 for (let i = 0; i < createForm.numberOfBatches; i++) {
 let batchCustomName: string | undefined = undefined;
 if ((createForm.customName || "").trim()) {
 batchCustomName = createForm.numberOfBatches === 1 ? createForm.customName.trim() : `${createForm.customName.trim()} ${i + 1}`;
 }
 const newBatch = await firebaseBatchService.create({
 beltTestId: createForm.beltTestId,
 schoolId: targetSchoolId,
 batchNumber: maxBatchNumber + i + 1,
 customName: batchCustomName,
 refereeIds: [],
 studentIds: [],
 maxSize: createForm.maxSize,
 status: "waiting",
 programType: selectedTest?.programType ?? (currentProgram === "SELAMBAM" ? "SELAMBAM" : "KARATE"),
 });
 newBatches.push(newBatch);
 }
 
 showToast(`${createForm.numberOfBatches} batch(es) created!`, "success");
 setShowCreateModal(false);
 setCreateForm({ beltTestId: "", numberOfBatches: 1, maxSize: 10, customName: "" });
 } catch (error) {
 console.error("Error creating batches:", error);
 showToast("Error creating batches", "error");
 } finally {
 setCreating(false);
 }
 };

 const handleAssignReferee = async () => {
 const { batch, refereeIds } = assignModal;
 if (!batch) return;
 setAssignModal((p) => ({ ...p, assigning: true }));
 try {
 // Use the optimized single batch write
 await firebaseBatchService.assignRefereesToBatch(batch, refereeIds);

 // Using single batch write, UI will update via onSnapshot listener automatically

 showToast("Referees assigned!", "success");
 setAssignModal({ open: false, batch: null, refereeIds: [], assigning: false });
  } catch (error) {
  console.error("Assign referee error:", error);
  showToast("Error assigning referees", "error");
  } finally {
 setAssignModal((p) => ({ ...p, assigning: false }));
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

 const filteredBatches = batches.filter((b) => selectedBeltTest === "all" || b.beltTestId === selectedBeltTest);
  const getBeltTestName = (batch: Batch) => {
    const test = beltTests.find((t) => t.id === batch.beltTestId);
    if (test) return test.name;
    const activeTest = beltTests.find(t => t.isActive && t.programType === batch.programType);
    return activeTest ? activeTest.name : "Unknown Test";
  };
 const getRefereeName = (id: string) => referees.find((r) => r.id === id)?.name || "Unknown";

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
 <button onClick={() => setShowCreateModal(true)} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-zinc-950 font-bold rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 transition-all active:scale-95">
 <Plus className="w-5 h-5" /> Create Batches
 </button>
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
 <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-1 mb-6">There are no batches created for this view yet.</p>
 <button onClick={() => setShowCreateModal(true)} className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-xl font-semibold text-sm transition-colors">Create Your First Batch</button>
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
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">{getBeltTestName(batch)}</p>
 </div>
 <button onClick={() => handleDeleteBatch(batch.id)} className="p-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-4 right-4 z-10"><Trash2 className="w-4 h-4"/></button>
 </div>
 <div className="space-y-3 mb-5">
 <div className="flex items-center gap-2">
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusCfg.bg}`}>
 <StatusIcon className="w-3.5 h-3.5"/> {statusCfg.label}
 </span>
 </div>
 <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <div className="flex items-center gap-2 min-w-0">
 <div className="w-8 h-8 bg-zinc-200 rounded-full flex items-center justify-center flex-shrink-0"><UserCheck className="w-4 h-4 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"/></div>
 <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 truncate">
 {batch.refereeIds && batch.refereeIds.length > 0 ? batch.refereeIds.map(getRefereeName).join(", ") : <span className="text-blue-600">No Referee</span>}
 </p>
 </div>
 <button onClick={() => setAssignModal({ open: true, batch, refereeIds: batch.refereeIds || [], assigning: false })} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg whitespace-nowrap">{batch.refereeIds && batch.refereeIds.length > 0 ? 'Change' : 'Assign'}</button>
 </div>
 </div>
 
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

 {/* Referee Progress */}
 {batch.refereeIds && batch.refereeIds.length > 0 && (
 <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 space-y-2">
 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Referee Progress</p>
 <div className="grid grid-cols-1 gap-2">
 {batch.refereeIds.map(refId => {
 const refName = getRefereeName(refId);
 const refStudents = students.filter(s => s.refereeId === refId);
 const refTotal = batch.maxSize > 0 
 ? Math.ceil(batch.maxSize / batch.refereeIds.length)
 : refStudents.length;
 const refCompleted = refStudents.filter(s => s.testStatus === "passed" || s.testStatus === "failed").length;
 const refPct = refTotal > 0 ? Math.round((refCompleted / refTotal) * 100) : 0;
 return (
 <div key={refId} className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <div className="flex justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 mb-1">
 <span className="truncate">{refName}</span>
 <span>{refCompleted} / {refTotal} Scored</span>
 </div>
 <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
 <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${refPct}%` }}></div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}
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
 );
 })}
 </div>
 )}
 </div>

 {/* Create Modal */}
 {showCreateModal && (
 <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">Create Batches</h3>
 <button onClick={() => setShowCreateModal(false)} className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-full p-1 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"><X className="w-4 h-4"/></button>
 </div>
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Belt / Stage Test *</label>
 <select value={createForm.beltTestId} onChange={e => setCreateForm(p => ({...p, beltTestId: e.target.value}))} className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="">Select Test...</option>
 {beltTests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
 </select>
 </div>
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Custom Batch Name (Optional)</label>
 <input type="text" placeholder="e.g. Evening Batch" value={createForm.customName} onChange={e => setCreateForm(p => ({...p, customName: e.target.value}))} className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"/>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Batches Count</label>
 <input type="number" value={1} disabled readOnly className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none text-sm font-medium text-center text-zinc-500 dark:text-zinc-400 cursor-not-allowed"/>
 </div>
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Max Students</label>
 <input type="number" value={10} disabled readOnly className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none text-sm font-medium text-center text-zinc-500 dark:text-zinc-400 cursor-not-allowed"/>
 </div>
 </div>
 </div>
 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end gap-3">
 <button onClick={() => setShowCreateModal(false)} disabled={creating} className="px-5 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50 transition-colors">Cancel</button>
 <button onClick={handleCreateBatches} disabled={creating} className="px-5 py-2.5 text-sm font-bold bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 transition-colors flex items-center gap-2">
 {creating ? <span className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin"/> : <Plus className="w-4 h-4"/>}
 Create
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Assign Modal */}
 {assignModal.open && assignModal.batch && (() => {
 const MAX = 2;
 const selected = assignModal.refereeIds;
 const toggle = (id: string) => {
 if ((selected || []).includes(id)) {
 setAssignModal(p => ({ ...p, refereeIds: selected.filter(r => r !== id) }));
 } else {
 if (selected.length >= MAX) {
 showToast(`Maximum ${MAX} referees can be assigned to one batch`, "error");
 return;
 }
 setAssignModal(p => ({ ...p, refereeIds: [...selected, id] }));
 }
 };
 return (
 <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
 <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 flex-shrink-0">
 <div>
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">Assign Referees</h3>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-0.5">
 {formatBatchName(assignModal.batch)} &mdash; select up to {MAX} referees
 </p>
 </div>
 <button onClick={() => setAssignModal({open: false, batch: null, refereeIds: [], assigning: false})} className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-full p-1 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"><X className="w-4 h-4"/></button>
 </div>

 <div className="px-6 pt-4 pb-2 flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
 <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Referees</span>
 <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${selected.length >= MAX ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'}`}>
 {selected.length} / {MAX} selected
 </span>
 </div>

 <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-2">
 {referees.length === 0 ? (
 <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-center py-8">No active referees found.</p>
 ) : (
 referees.map(r => {
 const isChecked = (selected || []).includes(r.id);
 const isDisabled = !isChecked && selected.length >= MAX;
 return (
 <label
 key={r.id}
 className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
 isChecked
 ? 'bg-indigo-50 border-indigo-300'
 : isDisabled
 ? 'bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 opacity-50 cursor-not-allowed'
 : 'bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 hover:bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950'
 }`}
 >
 <input
 type="checkbox"
 checked={isChecked}
 disabled={isDisabled || assignModal.assigning}
 onChange={() => toggle(r.id)}
 className="w-4 h-4 accent-indigo-600 flex-shrink-0 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 truncate">{r.name}</p>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 truncate">{r.email}</p>
 </div>
 {isChecked && (
 <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
 <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
 </span>
 )}
 </label>
 );
 })
 )}
 </div>

 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end gap-3 flex-shrink-0">
 <button onClick={() => setAssignModal({open: false, batch: null, refereeIds: [], assigning: false})} disabled={assignModal.assigning} className="px-5 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50 transition-colors">Cancel</button>
 <button onClick={handleAssignReferee} disabled={assignModal.assigning || selected.length === 0} className="px-5 py-2.5 text-sm font-bold bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-50">
 {assignModal.assigning ? <span className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin"/> : <UserCheck className="w-4 h-4"/>}
 Assign {selected.length > 0 && `(${selected.length})`}
 </button>
 </div>
 </div>
 </div>
 );
 })()}
 </AdminLayout>
 );
}
