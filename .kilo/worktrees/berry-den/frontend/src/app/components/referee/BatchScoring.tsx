import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Award, CheckCircle, Save, AlertTriangle } from "lucide-react";
import {
 firebaseBatchService,
 firebaseStudentService,
 firebaseBeltTestService,
 firebaseRefereeService,
 firebaseAdminSettingsService,
} from "../../services/firebaseData";
import { auth } from "../../config/firebase";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { Batch, StudentRecord, BeltTest, Referee } from "../../types/admin";
import { formatBatchName } from "../../utils/batchFormatters";
import {
 SCORING_CATEGORIES,
 calculateSubScores,
 buildScoringResults,
 computeRankings,
 getGrade,
} from "../../constants/scoring";

interface StudentScore {
 studentId: string;
 scores: { [parameterId: string]: number };
 lessonNumbers: { [parameterId: string]: any };
 totalScore: number;
 percentage: number;
 result: "passed" | "failed";
 examinerRemarks?: string;
}

export default function BatchScoring() {
 const navigate = useNavigate();
 const { batchId } = useParams();
 const { showToast } = useToast();
 const { showConfirm } = useDialog();

 const [batch, setBatch] = useState<Batch | null>(null);
 const [referee, setReferee] = useState<Referee | null>(null);
 const [beltTest, setBeltTest] = useState<BeltTest | null>(null);
 const [students, setStudents] = useState<StudentRecord[]>([]);
 const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
 const [studentScores, setStudentScores] = useState<{ [studentId: string]: StudentScore }>({});
 const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [passPercentage, setPassPercentage] = useState<number>(60);

 useEffect(() => {
 fetchData();
 }, [batchId]);

 const fetchData = async () => {
 if (!batchId) return;

 try {
 const user = auth.currentUser;
 if (!user) {
 navigate("/referee/login");
 return;
 }

 const refereeData = await firebaseRefereeService.getByUid(user.uid);
 if (!refereeData) {
 showToast("Referee not found", "error");
 await auth.signOut();
 navigate("/referee/login");
 return;
 }
 setReferee(refereeData);

 // Fetch batch first
 const batchData = await firebaseBatchService.getById(batchId);

 if (!batchData) {
 showToast("Batch not found", "error");
 navigate("/referee/dashboard");
 return;
 }

 if (!batchData.refereeIds?.includes(refereeData.id)) {
 showToast("You are not assigned to this batch", "error");
 navigate("/referee/dashboard");
 return;
 }

 // Fetch the belt test for this batch
 const testData = await firebaseBeltTestService.getById(batchData.beltTestId);

 if (!testData) {
  console.warn("Belt test not found or deleted, but proceeding with batch scoring.");
 }

 setBatch(batchData);
 setBeltTest(testData);

 const adminSettings = await firebaseAdminSettingsService.get(batchData.programType);
 setPassPercentage(adminSettings?.minimumPassingPercentage || 60);

 const allStudentsData = await firebaseStudentService.getAll();
 const studentsData = (batchData.studentIds || []).map(id => allStudentsData.find(s => s.id === id));
 const batchStudents = studentsData.filter((s) => s !== undefined) as StudentRecord[];
 setAllStudents(batchStudents);

 const isOnlyReferee = batchData.refereeIds?.length === 1 && batchData.refereeIds[0] === refereeData.id;
 const refereeStudents = batchStudents.filter((s) => 
 (isOnlyReferee || s.refereeId === refereeData.id || !s.refereeId) && (!s.testStatus || s.testStatus === "pending")
 );
 setStudents(refereeStudents);

 // --- DEBUG LOGS ---
//  console.log("Current referee UID:", user.uid);
//  console.log("Current referee Doc ID:", refereeData.id);
//  console.log("Batch ID:", batchId);
//  console.log("Batch refereeIds:", batchData.refereeIds);
//  console.log("Batch studentIds:", batchData.studentIds);
//  console.log("Total students fetched from DB:", batchStudents.length);
//  console.log("All students raw data:", batchStudents.map(s => ({ id: s.id, name: s.name, refereeId: s.refereeId })));
//  console.log("Allocated students count:", refereeStudents.length);
//  console.log("Is only referee on batch?", isOnlyReferee);
 // ------------------

 // Initialize student scores
 const initialScores: { [studentId: string]: StudentScore } = {};
 refereeStudents.forEach((student) => {
 const scores: { [parameterId: string]: number } = {};
 const lessonNumbers: { [parameterId: string]: number } = {};
 SCORING_CATEGORIES.forEach((param) => {
 scores[param.id] = 0;
 lessonNumbers[param.id] = 1;
 });
 initialScores[student.id] = {
 studentId: student.id,
 scores,
 lessonNumbers,
 totalScore: 0,
 percentage: 0,
 result: "failed",
 examinerRemarks: "",
 };
 });
 setStudentScores(initialScores);
 } catch (error) {
 console.error("Error fetching data:", error);
 showToast("Error loading batch", "error");
 } finally {
 setLoading(false);
 }
 };

 const handleScoreChange = (studentId: string, parameterId: string, score: number) => {
 const updatedScores = { ...studentScores };
 updatedScores[studentId].scores[parameterId] = score;

 // Calculate total
 const totalScore = Object.values(updatedScores[studentId].scores).reduce(
 (sum, s) => sum + s,
 0
 );
 const maxScore = SCORING_CATEGORIES.reduce((sum, p) => sum + p.maxPoints, 0);
 const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

 updatedScores[studentId].totalScore = totalScore;
 updatedScores[studentId].percentage = percentage;
 updatedScores[studentId].result = percentage >= passPercentage ? "passed" : "failed";

 setStudentScores(updatedScores);
 };

 const handleLessonNumberChange = (studentId: string, parameterId: string, lessonNumber: any) => {
 const updatedScores = { ...studentScores };
 updatedScores[studentId].lessonNumbers[parameterId] = lessonNumber;
 setStudentScores(updatedScores);
 };

 const handleRemarksChange = (studentId: string, remarks: string) => {
 const updatedScores = { ...studentScores };
 updatedScores[studentId].examinerRemarks = remarks;
 setStudentScores(updatedScores);
 };

 const handleNextStudent = () => {
 if (currentStudentIndex < students.length - 1) {
 setCurrentStudentIndex(currentStudentIndex + 1);
 }
 };

 const handlePreviousStudent = () => {
 if (currentStudentIndex > 0) {
 setCurrentStudentIndex(currentStudentIndex - 1);
 }
 };

 const handleSubmitAllScores = async () => {
 if (!batch) return;

 // Check if all students have been scored
 const allScored = students.every((student) => {
 const studentScore = studentScores[student.id];
 return studentScore ? studentScore.totalScore > 0 : false;
 });

 if (!allScored) {
 const ok = await showConfirm({
 title: "Zero Scores Detected",
 message: "Some students have a zero score. Are you sure you want to submit?",
 confirmText: "Submit Anyway",
 variant: "warning",
 });
 if (!ok) return;
 }

 setSubmitting(true);

 try {
 // Compute rankings across this batch
 const rankInput = students
 .filter((s) => studentScores[s.id] !== undefined)
 .map((s) => ({
 id: s.id,
 score: studentScores[s.id].totalScore,
 }));
 const rankMap = computeRankings(rankInput);

 // Update all student scores
 for (const student of students) {
 const studentScore = studentScores[student.id];
 if (!studentScore) continue;
 const techScore = studentScore.scores['technical'] ?? 0;
 const athScore = studentScore.scores['athletic'] ?? studentScore.scores['athletics'] ?? 0;

 // Auto-calculate sub-categories
 const subCategoryResults = calculateSubScores(techScore, athScore, student.programType);

 // Build top-level scoring results with lesson numbers
 const scoringResults = buildScoringResults(
 techScore,
 athScore,
 studentScore.lessonNumbers,
 );

 await firebaseStudentService.update(student.id, {
 score: studentScore.totalScore,
 percentage: studentScore.percentage,
 result: studentScore.result,
 testStatus: studentScore.result,
 scoringResults,
 subCategoryResults,
 ranking: rankMap[student.id] ?? null,
 scoredAt: new Date().toISOString(),
 examinerRemarks: studentScore.examinerRemarks,
 });
 }

 // Fetch latest state of all students in the batch
 const allStudentPromises = batch.studentIds.map((id) =>
 firebaseStudentService.getById(id, "students_all", false)
 );
 const allStudentsData = await Promise.all(allStudentPromises);
 const allBatchStudents = allStudentsData.filter((s) => s !== null) as StudentRecord[];

 // Check if all students are completed AND the batch is fully filled
 const allCompleted = allBatchStudents.length === batch.maxSize && allBatchStudents.every(
 (s) => s.testStatus && s.testStatus !== "pending"
 );

 if (allCompleted) {
 await firebaseBatchService.updateStatus(batch.id, "completed");
 const passedCount = allBatchStudents.filter((s) => s.testStatus === "passed").length;
 const failedCount = allBatchStudents.length - passedCount;

 showToast(
 `Batch completed! ${passedCount} passed, ${failedCount} failed`,
 "success"
 );
 } else {
 showToast(
 `Scores submitted successfully! Waiting for other referee to score.`,
 "success"
 );
 }

 navigate("/referee/dashboard");
 } catch (error) {
 console.error("Error submitting scores:", error);
 showToast("Error submitting scores", "error");
 } finally {
 setSubmitting(false);
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="text-center">
 <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-bold text-sm uppercase tracking-wider">Loading scoring...</p>
 </div>
 </div>
 );
 }

 if (!batch) {
 return (
 <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white">
 <div className="text-center p-8 bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md">
 <p className="text-xl font-bold text-blue-500 mb-4">Batch Not Found</p>
 <button onClick={() => navigate("/referee/dashboard")} className="px-6 py-3 bg-blue-500 text-zinc-950 font-bold rounded-xl hover:bg-blue-400">
 Go to Dashboard
 </button>
 </div>
 </div>
 );
 }

 if (students.length === 0) {
 return (
 <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="text-center p-8 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-xl rounded-3xl max-w-lg mx-4">
 <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
 <CheckCircle className="w-8 h-8 text-blue-500" />
 </div>
 <h2 className="text-3xl font-bold text-zinc-950 mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 ALL CAUGHT UP!
 </h2>
 <p className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-8 max-w-md mx-auto leading-relaxed">
 There are no pending students waiting to be scored in your allocation for this batch. 
 </p>
 <div className="flex flex-col sm:flex-row gap-4 justify-center">
 <button
 onClick={() => navigate(`/referee/batch/${batch.id}/scan`)}
 className="px-6 py-3 bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 Scan More
 </button>
 <button
 onClick={() => navigate("/referee/dashboard")}
 className="px-6 py-3 bg-blue-500 text-zinc-950 font-bold rounded-xl hover:bg-blue-400 transition-colors shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 Back to Dashboard
 </button>
 </div>
 </div>
 </div>
 );
 }

 const currentStudent = students[currentStudentIndex];
 if (!currentStudent) {
 return (
 <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="text-center">
 <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-bold text-sm uppercase tracking-wider">Loading Student...</p>
 </div>
 </div>
 );
 }

 const currentScore = studentScores[currentStudent.id];
 if (!currentScore) {
 return (
 <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="text-center">
 <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-bold text-sm uppercase tracking-wider">Initializing score...</p>
 </div>
 </div>
 );
 }

 const maxScore = SCORING_CATEGORIES.reduce((sum, p) => sum + p.maxPoints, 0);

 const refereeScoredCount = students.filter((s) => studentScores[s.id]?.totalScore > 0).length;
 const otherRefereesScoredCount = allStudents.filter(
 (s) => s.refereeId !== referee?.id && s.testStatus && s.testStatus !== "pending"
 ).length;
 const overallScoredCount = refereeScoredCount + otherRefereesScoredCount;
 
 const refereeCapacity = batch.maxSize > 0 && batch.refereeIds && batch.refereeIds.length > 0 
 ? Math.ceil(batch.maxSize / batch.refereeIds.length) 
 : students.length;

 return (
 <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 {/* Header */}
 <div className="bg-zinc-950 text-white p-4 border-b-4 border-blue-500">
 <div className="container mx-auto max-w-5xl">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
 <button
 onClick={() => navigate("/referee/dashboard")}
 className="flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-sm transition-colors"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Dashboard
 </button>
 <ThemeToggle />
 </div>
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div>
 <h1
 className="text-4xl font-bold tracking-tight text-white mb-2"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 {formatBatchName(batch).toUpperCase()}
 <span className="text-blue-500 ml-3">SCORING</span>
 </h1>
 <p className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
 Student {currentStudentIndex + 1} of {students.length}
 </p>
 </div>
 <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-right flex gap-4">
 <div>
 <div className="flex items-baseline gap-1 justify-end">
 <span className="text-2xl font-bold text-blue-500">{refereeScoredCount}</span>
 <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">/{refereeCapacity}</span>
 </div>
 <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">My Allocation</div>
 </div>
 <div className="border-l border-zinc-800 pl-4">
 <div className="flex items-baseline gap-1 justify-end">
 <span className="text-2xl font-bold text-indigo-400">{overallScoredCount}</span>
 <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">/{batch.maxSize}</span>
 </div>
 <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Overall Batch</div>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Progress Bar */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <div className="container mx-auto max-w-5xl px-4 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
 <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">My Allocation Progress</span>
 <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
 {refereeCapacity > 0 ? Math.round((refereeScoredCount / refereeCapacity) * 100) : 0}%
 </span>
 </div>
 <div className="w-full bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
 <div
 className="bg-blue-500 h-2 rounded-full transition-all duration-500"
 style={{ width: `${refereeCapacity > 0 ? (refereeScoredCount / refereeCapacity) * 100 : 0}%` }}
 />
 </div>
 </div>
 <div>
 <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
 <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Overall Batch Progress</span>
 <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
 {batch.maxSize > 0 ? Math.round((overallScoredCount / batch.maxSize) * 100) : 0}%
 </span>
 </div>
 <div className="w-full bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
 <div
 className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
 style={{ width: `${batch.maxSize > 0 ? (overallScoredCount / batch.maxSize) * 100 : 0}%` }}
 />
 </div>
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="container mx-auto max-w-5xl px-4 py-8">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Scoring Section */}
 <div className="lg:col-span-2 space-y-6">
 {/* Student Info */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6">
 <div className="flex items-center gap-5 mb-6">
 <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center border border-zinc-800">
 <span className="text-2xl font-bold text-blue-500">
 {currentStudentIndex + 1}
 </span>
 </div>
 <div>
 <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 tracking-tight">
 {currentStudent.name}
 </h2>
 <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">
 {currentStudent.school} • {currentStudent.beltLevel}
 </p>
 </div>
 </div>

 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
 {[{
 label: "Total Score",
 value: `${currentScore.totalScore}/${maxScore}`,
 color: "text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50"
 }, {
 label: "Percentage",
 value: `${currentScore.percentage}%`,
 color: "text-blue-600"
 }, {
 label: "Grade",
 value: getGrade(currentScore.percentage),
 color: "text-purple-600"
 }, {
 label: "Result",
 value: currentScore.result.toUpperCase(),
 color: currentScore.result === "pass" ? "text-green-600" : "text-red-500"
 }, {
 label: "Pass Mark",
 value: `${passPercentage}%`,
 color: "text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"
 }].map(item => (
 <div key={item.label} className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl p-4 text-center flex flex-col">
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-2 min-h-[2rem] flex items-center justify-center leading-tight">{item.label}</p>
 <p className={`text-xl font-bold ${item.color} mt-auto whitespace-nowrap`}>{item.value}</p>
 </div>
 ))}
 </div>
 </div>

 {/* Scoring Parameters */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6">
 <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">
 <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-center">
 <Award className="w-4 h-4 text-blue-600" />
 </div>
 Scoring Parameters
 </h3>

 <div className="space-y-6">
 {SCORING_CATEGORIES.map((param) => (
 <div key={param.id} className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
 <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl"></div>
 <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5 pl-2">
 <div>
 <h4 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 mb-3">{param.name}</h4>
 <div className="flex items-center gap-3">
 <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Lesson No.</label>
 <input
 type="text"
 inputMode="numeric"
 pattern="[0-9]*"
 value={currentScore.lessonNumbers[param.id] === "" ? "" : (currentScore.lessonNumbers[param.id] || "")}
 onFocus={(e) => e.target.select()}
 onBlur={(e) => {
 if (e.target.value === "") {
 handleLessonNumberChange(currentStudent.id, param.id, 1);
 }
 }}
 onChange={(e) => {
 const val = e.target.value.replace(/[^0-9]/g, '');
 handleLessonNumberChange(currentStudent.id, param.id, val === "" ? "" : parseInt(val));
 }}
 className="w-24 px-3 py-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl text-sm font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-center shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>
 </div>
 <div className="flex flex-col items-end gap-1">
 <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Score</span>
 <div className="flex items-center gap-3">
 <input
 type="number"
 value={currentScore.scores[param.id]}
 onChange={(e) => handleScoreChange(currentStudent.id, param.id, Math.min(param.maxPoints, Math.max(0, parseInt(e.target.value) || 0)))}
 className="w-24 px-3 py-3 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-2 border-blue-200 rounded-xl text-2xl font-bold text-blue-600 text-center focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 min="0"
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
 min="0"
 max={param.maxPoints}
 value={currentScore.scores[param.id]}
 onChange={(e) => handleScoreChange(currentStudent.id, param.id, parseInt(e.target.value))}
 className="flex-1 h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500"
 />
 <span className="text-xs font-bold text-zinc-400 w-8 text-right">{param.maxPoints}</span>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Navigation Buttons */}
 <div className="flex gap-4">
 <button
 onClick={handlePreviousStudent}
 disabled={currentStudentIndex === 0}
 className="flex-1 px-6 py-4 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 font-bold shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
 >
 <span className="inline-flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Previous</span>
 </button>
 <button
 onClick={handleNextStudent}
 disabled={currentStudentIndex === students.length - 1}
 className="flex-1 px-6 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 font-bold shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
 >
 <span className="inline-flex items-center justify-center gap-2">Next <ArrowRight className="w-4 h-4" /></span>
 </button>
 </div>
 </div>

 {/* Students List Sidebar */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 flex flex-col sticky top-6 max-h-[calc(100vh-6rem)]">
 <h3 className="text-lg font-bold mb-5 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 pb-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">All Students</h3>

 <div className="flex-1 overflow-y-auto space-y-2 pr-1">
 {students.map((student, index) => {
 const score = studentScores[student.id];
 const isScored = score ? score.totalScore > 0 : false;

 return (
 <button
 key={student.id}
 onClick={() => setCurrentStudentIndex(index)}
 className={`w-full text-left p-3 rounded-xl border transition-all ${
 index === currentStudentIndex
 ? "border-blue-400 bg-blue-50 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 : "border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900"
 }`}
 >
 <div className="flex items-center gap-3">
 <div
 className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
 isScored
 ? "bg-green-100 text-green-700 border border-green-200"
 : index === currentStudentIndex
 ? "bg-blue-100 text-blue-700 border border-blue-200"
 : "bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"
 }`}
 >
 {index + 1}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 truncate">
 {student.name}
 </p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 truncate">
 {isScored && score ? `${getGrade(score.percentage)} ${score.result.toUpperCase()}` : "Not scored yet"}
 </p>
 </div>
 {isScored && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
 </div>
 </button>
 );
 })}
 </div>

 <div className="pt-5 mt-2 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 {refereeScoredCount < students.length && (
 <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-semibold mb-3 flex items-center justify-center gap-1.5">
 <AlertTriangle className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Score all assigned students before submitting ({refereeScoredCount}/{students.length} done)
 </p>
 )}
 <button
 onClick={handleSubmitAllScores}
 disabled={submitting || refereeScoredCount < students.length}
 className="w-full px-6 py-4 bg-blue-500 text-zinc-950 rounded-2xl hover:bg-blue-400 font-bold text-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 {submitting ? (
 <span className="flex items-center justify-center gap-2">
 <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
 Submitting...
 </span>
 ) : (
 <span className="flex items-center justify-center gap-2">
 <Save className="w-5 h-5" />
 Submit All Scores
 </span>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
