import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, QrCode, Award, Users, Clock, CheckCircle, BarChart2, RotateCcw } from "lucide-react";
import { auth } from "../../config/firebase";
import { ThemeToggle } from "../ui/ThemeToggle";
import {
 firebaseRefereeService,
 firebaseBatchService,
 firebaseBeltTestService,
 firebaseSchoolService,
 firebaseStudentService,
} from "../../services/firebaseData";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { Batch, BeltTest, Referee, StudentRecord, School } from "../../types/admin";
import logo from "../../../assets/shadow-kai-logo.png";
import { formatBatchName, formatSafeDate } from "../../utils/batchFormatters";
import { SearchableDropdown } from "../ui/SearchableDropdown";

export default function RefereeDashboard() {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const { showConfirm } = useDialog();
 const [referee, setReferee] = useState<Referee | null>(null);
 const [batches, setBatches] = useState<Batch[]>([]);
 const [beltTests, setBeltTests] = useState<BeltTest[]>([]);
 const [schools, setSchools] = useState<School[]>([]);
 const [batchStudents, setBatchStudents] = useState<Record<string, StudentRecord[]>>({});
 const [referees, setReferees] = useState<Referee[]>([]);
 const [selectedProgram, setSelectedProgram] = useState<string>(() => sessionStorage.getItem("refereeSelectedProgram") || "ALL");
 const [selectedSchool, setSelectedSchool] = useState<string>(() => sessionStorage.getItem("refereeSelectedSchool") || "ALL");
 const [selectedBatch, setSelectedBatch] = useState<string>(() => sessionStorage.getItem("refereeSelectedBatch") || "ALL");

 useEffect(() => {
   sessionStorage.setItem("refereeSelectedProgram", selectedProgram);
 }, [selectedProgram]);

 useEffect(() => {
   sessionStorage.setItem("refereeSelectedSchool", selectedSchool);
 }, [selectedSchool]);

 useEffect(() => {
   sessionStorage.setItem("refereeSelectedBatch", selectedBatch);
 }, [selectedBatch]);
 const [loading, setLoading] = useState(true);

  useEffect(() => {
  let unsubscribeBatches: (() => void) | undefined;
  let unsubscribeStudents: (() => void) | undefined;

  const initializeDashboard = async () => {
  try {
  const user = auth.currentUser;
  if (!user) {
  navigate("/referee/login");
  return;
  }

  // Get referee data
  const refereeData = await firebaseRefereeService.getByUid(user.uid);
  if (!refereeData) {
  showToast("Referee not found", "error");
  await auth.signOut();
  navigate("/referee/login");
  return;
  }

  setReferee(refereeData);

  // Fetch tests, schools, and all referees statically as they rarely change during a session
  const [testsData, allReferees, schoolsData] = await Promise.all([
  firebaseBeltTestService.getAll(),
  firebaseRefereeService.getAll(),
  firebaseSchoolService.getAll()
  ]);
  setBeltTests(testsData);
  setSchools(schoolsData);

  // Set up real-time listener for batches
  unsubscribeBatches = firebaseBatchService.subscribeToRefereeBatches(refereeData.id, (batchesData) => {
  setBatches(batchesData);

  // Extract unique referee IDs from these batches to fetch only co-referees
  const coRefereeIds = new Set<string>();
  batchesData.forEach(b => {
  if (b.refereeIds) {
  b.refereeIds.forEach(id => coRefereeIds.add(id));
  }
  });
  coRefereeIds.delete(refereeData.id);

  const coReferees = Array.from(coRefereeIds).map(id => allReferees.find(r => r.id === id));
  const refereesData = [refereeData, ...(coReferees.filter(Boolean) as Referee[])];
  setReferees(refereesData);

  // Set up real-time listener for students
  if (unsubscribeStudents) unsubscribeStudents();
  unsubscribeStudents = firebaseStudentService.listenAll((allStudents) => {
  const studentsMap: Record<string, StudentRecord[]> = {};
  for (const batch of batchesData) {
  if (batch.studentIds && batch.studentIds.length > 0) {
  const results = batch.studentIds.map((id) => allStudents.find(s => s.id === id));
  studentsMap[batch.id] = results.filter(Boolean) as StudentRecord[];
  } else {
  studentsMap[batch.id] = [];
  }
  }
  setBatchStudents(studentsMap);
  setLoading(false);
  });
  });

  } catch (error) {
  console.error("Error fetching data:", error);
  showToast("Error loading dashboard", "error");
  setLoading(false);
  }
  };

  initializeDashboard();

  return () => {
  if (unsubscribeBatches) unsubscribeBatches();
  if (unsubscribeStudents) unsubscribeStudents();
  };
  }, [navigate]);

  // Cascading resets are now handled in the onChange events of the dropdowns to avoid reset on mount

  const filteredBatches = useMemo(() => {
    let filtered = batches;
    if (selectedProgram !== "ALL") {
      filtered = filtered.filter(b => b.programType === selectedProgram);
    }
    if (selectedSchool !== "ALL") {
      filtered = filtered.filter(b => b.schoolId === selectedSchool);
    }
    if (selectedBatch !== "ALL") {
      filtered = filtered.filter(b => b.id === selectedBatch);
    }
    return filtered;
  }, [batches, selectedProgram, selectedSchool, selectedBatch]);

  const availableSchools = useMemo(() => {
    const programBatches = selectedProgram === "ALL" 
      ? batches 
      : batches.filter(b => b.programType === selectedProgram);
      
    const schoolIds = new Set(programBatches.map(b => b.schoolId));
    const schoolOptions = schools
      .filter(s => schoolIds.has(s.id))
      .map(s => ({ label: s.name, value: s.id }));
    
    if (schoolIds.has("individual")) {
      schoolOptions.push({ label: "Individual", value: "individual" });
    }
    return schoolOptions;
  }, [batches, schools, selectedProgram]);

  const availableBatches = useMemo(() => {
    let relevantBatches = batches;
    if (selectedProgram !== "ALL") {
      relevantBatches = relevantBatches.filter(b => b.programType === selectedProgram);
    }
    if (selectedSchool !== "ALL") {
      relevantBatches = relevantBatches.filter(b => b.schoolId === selectedSchool);
    }
      
    return relevantBatches.map(b => ({
      label: `Batch ${b.batchNumber}${b.customName ? ` - ${b.customName}` : ''}`,
      value: b.id
    }));
  }, [batches, selectedProgram, selectedSchool]);

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
 showToast("Batch completed successfully!", "success");
 // onSnapshot listeners will automatically handle UI updates
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
 showToast("Batch reopened", "success");
 } catch (error) {
 console.error("Error reopening batch:", error);
 showToast("Failed to reopen batch", "error");
 }
 };

 const handleLogout = async () => {
 await auth.signOut();
 navigate("/referee/login");
 };

  const getBeltTestName = (batch: Batch) => {
    const test = beltTests.find((t) => t.id === batch.beltTestId);
    if (test) return test.name;
    // Fallback to the active belt test for this program if the original was deleted
    const activeTest = beltTests.find((t) => t.isActive && t.programType === batch.programType);
    return activeTest ? activeTest.name : "Unknown Test";
  };

 const getStatusColor = (status: Batch["status"]) => {
 switch (status) {
 case "waiting":
 return "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700";
 case "filling":
 return "bg-blue-100 text-blue-800 border-blue-300";
 case "ongoing":
 return "bg-blue-100 text-blue-800 border-blue-300";
 case "completed":
 return "bg-green-100 text-green-800 border-green-300";
 default:
 return "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700";
 }
 };

 const getStatusIcon = (status: Batch["status"]) => {
 switch (status) {
 case "waiting":
 return <Clock className="w-5 h-5" />;
 case "filling":
 return <QrCode className="w-5 h-5" />;
 case "ongoing":
 return <Award className="w-5 h-5" />;
 case "completed":
 return <CheckCircle className="w-5 h-5" />;
 default:
 return <Clock className="w-5 h-5" />;
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading dashboard...</p>
 </div>
 </div>
 );
 }

 const pendingBatches = filteredBatches.filter(
 (b) => b.status === "waiting" || b.status === "filling" || b.status === "ongoing"
 );
 const completedBatches = filteredBatches.filter((b) => b.status === "completed");

 return (
 <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 {/* Header */}
 <nav className="bg-zinc-950 border-b border-zinc-800 text-white sticky top-0 z-50">
 <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-3">
 <img
 src={logo}
 alt="Shadow Kai Logo"
 className="w-12 h-12 object-cover"
 />
 <div>
 <h1
 className="text-2xl font-bold tracking-tight"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 REFEREE DASHBOARD
 </h1>
 <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">
 Welcome, {referee?.name || "Referee"}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <ThemeToggle />
 <button
 onClick={() => navigate("/referee/results")}
 className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl transition-colors active:scale-95 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 <BarChart2 className="w-4 h-4" />
 <span className="text-sm font-bold hidden sm:inline">My Results</span>
 </button>
 <button
 onClick={handleLogout}
 className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors active:scale-95"
 >
 <LogOut className="w-4 h-4" />
 <span className="text-sm font-bold">Logout</span>
 </button>
 </div>
 </div>
 </nav>

 {/* Main Content */}
 <div className="container mx-auto px-4 py-6">
  {/* Filters */}
  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm mb-6 flex-wrap">
    <div className="flex flex-col gap-1.5 w-full sm:w-auto">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Filter by Program:</label>
      <SearchableDropdown
        options={[
          { label: "All Programs", value: "ALL" },
          { label: "Karate", value: "KARATE" },
          { label: "Silambam", value: "SELAMBAM" }
        ]}
        value={selectedProgram}
        onChange={(val) => {
          setSelectedProgram(val);
          setSelectedSchool("ALL");
          setSelectedBatch("ALL");
        }}
        placeholder="Select a program..."
      />
    </div>

    <div className="flex flex-col gap-1.5 w-full sm:w-auto">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Filter by School:</label>
      <SearchableDropdown
        options={[
          { label: "All Schools", value: "ALL" },
          ...availableSchools
        ]}
        value={selectedSchool}
        onChange={(val) => {
          setSelectedSchool(val);
          setSelectedBatch("ALL");
        }}
        placeholder="Select a school..."
      />
    </div>

    <div className="flex flex-col gap-1.5 w-full sm:w-auto">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Filter by Batch:</label>
      <SearchableDropdown
        options={[
          { label: "All Batches", value: "ALL" },
          ...availableBatches
        ]}
        value={selectedBatch}
        onChange={setSelectedBatch}
        placeholder="Select a batch..."
        disabled={selectedSchool === 'ALL' && selectedProgram === 'ALL'}
        emptyMessage="No batches found."
      />
    </div>
  </div>

 {/* Stats */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 flex flex-col justify-between">
 <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 tracking-tight">{filteredBatches.length}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-2">Total Batches</p>
 </div>
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 flex flex-col justify-between">
 <p className="text-4xl font-bold text-blue-600 tracking-tight">{pendingBatches.length}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-2">Pending</p>
 </div>
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 flex flex-col justify-between">
 <p className="text-4xl font-bold text-green-600 tracking-tight">{completedBatches.length}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-2">Completed</p>
 </div>
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 flex flex-col justify-between">
 <p className="text-4xl font-bold text-indigo-600 tracking-tight">
 {filteredBatches.reduce((sum, b) => sum + (b.studentIds?.length || 0), 0)}
 </p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-2">Total Students</p>
 </div>
 </div>

 {batches.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-12 text-center">
 <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
 <h3 className="text-xl font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-2">No Batches Assigned</h3>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 You don't have any batches assigned yet. Contact the administrator.
 </p>
 </div>
 ) : filteredBatches.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-12 text-center">
 <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
 <h3 className="text-xl font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-2">No Batches Found</h3>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 No batches match your current filters.
 </p>
 </div>
 ) : (
 <div className="space-y-6">
 {/* Pending Batches */}
 {pendingBatches.length > 0 && (
 <div>
 <h2
 className="text-2xl font-bold mb-4"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 ACTIVE BATCHES
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {pendingBatches.map((batch) => (
 <div
 key={batch.id}
 className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 transition-all p-6 group"
 >
 <div className="flex items-start justify-between mb-5">
 <div>
 <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {formatBatchName(batch).toUpperCase()}
 </h3>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">
 {getBeltTestName(batch)}
 </p>
 </div>
 <div
 className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
 batch.status
 )}`}
 >
 {getStatusIcon(batch.status)}
 {(batch.status || '').toUpperCase()}
 </div>
 </div>

 {/* Referee-Specific Progress */}
 {(() => {
 const batchStudentsList = batchStudents[batch.id] || [];
 const myStudents = batchStudentsList.filter(s => s.refereeId === referee?.id);
 
 const refIndex = batch.refereeIds?.indexOf(referee?.id || "") ?? -1;
 const numReferees = batch.refereeIds?.length || 1;
 const baseCap = Math.floor(batch.maxSize / numReferees);
 const extra = batch.maxSize % numReferees;
 const myCapacity = refIndex !== -1 ? (refIndex < extra ? baseCap + 1 : baseCap) : batch.maxSize;
 
 const myAssignedCount = myStudents.length;
 const myCompletedCount = myStudents.filter(s => s.testStatus === "passed" || s.testStatus === "failed").length;
 
 const capacityPct = myCapacity > 0 ? Math.min((myAssignedCount / myCapacity) * 100, 100) : 0;
 const progressPct = myCapacity > 0 ? Math.round((myCompletedCount / myCapacity) * 100) : 0;
 const remainingSlots = Math.max(0, myCapacity - myAssignedCount);

 const canScan = remainingSlots > 0 && (batch.studentIds?.length || 0) < batch.maxSize;
 const unscoredCount = myAssignedCount - myCompletedCount;
 const canScore = unscoredCount > 0;
 const allScored = (batch.studentIds?.length || 0) > 0 && 
                   batchStudentsList.length === (batch.studentIds?.length || 0) && 
                   batchStudentsList.every(s => s.testStatus === "passed" || s.testStatus === "failed");

 return (
 <>
 {/* Capacity Progress */}
 <div className="mb-4">
 <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-2">
 <span>Your Capacity</span>
 <span>{myAssignedCount} / {myCapacity}</span>
 </div>
 <div className="w-full bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
 <div
 className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
 style={{ width: `${capacityPct}%` }}
 />
 </div>
 </div>

 <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 space-y-2">
 <div className="flex justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">
 <span>Score Progress</span>
 <span>{myCompletedCount} / {myCapacity} Scored</span>
 </div>
 <div className="h-2 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full overflow-hidden">
 <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
 </div>
 {remainingSlots > 0 && (
 <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider text-right">
 Remaining Slots: {remainingSlots}
 </p>
 )}
 </div>

 {/* Co-Referee Progress */}
 {batch.refereeIds && batch.refereeIds.length > 1 && (
 <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 space-y-2">
 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Co-Referee Progress</p>
 <div className="grid grid-cols-1 gap-2">
 {batch.refereeIds.filter(id => id !== referee?.id).map(refId => {
 const refObj = referees.find(r => r.id === refId);
 const refName = refObj ? refObj.name : "Unknown";
 const refStudents = batchStudentsList.filter(s => s.refereeId === refId);
 const refTotal = refStudents.length;
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

 <div className="flex flex-col gap-2 mt-5">
 <div className="flex gap-3">
 {canScan && (
 <button
 onClick={() => navigate(`/referee/batch/${batch.id}/scan`)}
 className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 font-bold active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 <QrCode className="w-4 h-4" />
 Scan Students
 </button>
 )}
 {canScore && (
 <button
 onClick={() => navigate(`/referee/batch/${batch.id}/score`)}
 className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-zinc-950 rounded-xl hover:bg-blue-600 font-bold active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 <Award className="w-4 h-4" />
 Score Students
 </button>
 )}
 {!canScan && !canScore && (
 <div className="flex-1 text-center text-sm font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 py-2">
 No actions available
 </div>
 )}
 </div>
 {batch.status !== "completed" && (
 <button
 onClick={() => handleForceComplete(batch)}
 disabled={!allScored}
 className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-sm dark:shadow-none dark:border dark:border-zinc-800 ${
   allScored 
     ? "bg-blue-500 hover:bg-blue-600 text-zinc-950 border border-blue-300 active:scale-95" 
     : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed border-transparent"
 }`}
 >
 Complete Batch
 </button>
 )}
 </div>
 </>
 );
 })()}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Completed Batches */}
 {completedBatches.length > 0 && (
 <div>
 <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
 <h2
 className="text-2xl font-bold"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 COMPLETED BATCHES
 </h2>
 <button
 onClick={() => navigate("/referee/results")}
 className="flex items-center gap-2 px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 rounded-xl font-bold text-sm active:scale-95 transition-colors border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"
 >
 <BarChart2 className="w-4 h-4" />
 View All Results
 </button>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {completedBatches.map((batch) => (
 <div
 key={batch.id}
 className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 opacity-75 hover:opacity-100 transition-opacity"
 >
 <div className="flex items-start justify-between mb-5">
 <div>
 <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 mb-1" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {formatBatchName(batch).toUpperCase()}
 </h3>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">
 {getBeltTestName(batch)}
 </p>
 </div>
 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">
 <CheckCircle className="w-3.5 h-3.5" />
 COMPLETED
 </div>
 </div>

 <div className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-4">
 <p>Students Scored: {batch.studentIds?.length || 0}</p>
 {batch.completedAt && (
 <p className="mt-1">
 Completed:{" "}
 {formatSafeDate(batch.completedAt)}
 </p>
 )}
 </div>

 <div className="flex flex-col gap-2">
 <button
 onClick={() => navigate("/referee/results")}
 className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 rounded-xl hover:bg-zinc-200 font-bold text-sm active:scale-95 transition-transform"
 >
 <BarChart2 className="w-4 h-4" />
 View Results
 </button>
 {(batch.studentIds?.length || 0) < batch.maxSize && (
 <button
 onClick={() => handleReopenBatch(batch)}
 className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/20 font-bold text-xs active:scale-95 transition-colors"
 >
 <RotateCcw className="w-3.5 h-3.5" />
 Reopen Batch (Under Capacity)
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 </div>
 );
}
