import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Award, FileSpreadsheet, Download,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronRight,
  BarChart2, Users, TrendingUp, Eye, Filter, X, Loader2, FileText,
} from "lucide-react";
import { auth } from "../../config/firebase";
import { ThemeToggle } from "../ui/ThemeToggle";
import {
 firebaseRefereeService,
 firebaseBatchService,
 firebaseBeltTestService,
 firebaseStudentService,
} from "../../services/firebaseData";
import { useToast } from "../../hooks/useToast";
import { Batch, BeltTest, Referee, StudentRecord } from "../../types/admin";
import logo from "../../../assets/shadow-kai-logo.png";
import { formatBatchName, formatSafeDate } from "../../utils/batchFormatters";
import { generateFeedbackForms } from "../../utils/feedbackFormGenerator";
import * as XLSX from "xlsx";

type StatusFilter = "all" | "passed" | "failed" | "pending";

export default function RefereeResults() {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const [referee, setReferee] = useState<Referee | null>(null);
 const [batches, setBatches] = useState<Batch[]>([]);
 const [beltTests, setBeltTests] = useState<BeltTest[]>([]);
 const [students, setStudents] = useState<StudentRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
 const [searchTerm, setSearchTerm] = useState("");
 const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
 const [exportingBatchId, setExportingBatchId] = useState<string | null>(null);

 useEffect(() => {
 fetchData();
 }, []);

 const fetchData = async () => {
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

 // Get all batches for this referee
 const batchesData = await firebaseBatchService.getByReferee(refereeData.id);
 const completedBatches = batchesData.filter(b => b.status === "completed");
 setBatches(completedBatches);

 // Get belt tests
 const testsData = await firebaseBeltTestService.getAll();
 setBeltTests(testsData);

 // Get all students from completed batches efficiently
 const allStudentIds = completedBatches.flatMap(b => b.studentIds || []);
 const uniqueStudentIds = new Set(allStudentIds);

 if (uniqueStudentIds.size > 0) {
 const allStudents = await firebaseStudentService.getAll();
 const studentsData = allStudents.filter(s => uniqueStudentIds.has(s.id));
 setStudents(studentsData);
 }
 } catch (error) {
 console.error("Error fetching data:", error);
 showToast("Error loading results", "error");
 } finally {
 setLoading(false);
 }
 };

 const toggleBatch = (batchId: string) => {
 setExpandedBatches(prev => {
 const newSet = new Set(prev);
 if (newSet.has(batchId)) {
 newSet.delete(batchId);
 } else {
 newSet.add(batchId);
 }
 return newSet;
 });
 };

 const getBeltTest = (beltTestId: string) => {
 return beltTests.find(t => t.id === beltTestId);
 };

 const getBatchStudents = (batch: Batch) => {
 const batchStudents = students.filter(s =>
 (batch.studentIds || []).includes(s.id)
 );

 let filtered = batchStudents;

 // Apply search filter
 if (searchTerm) {
 const search = searchTerm.toLowerCase();
 filtered = filtered.filter(s =>
 (s.name || "").toLowerCase().includes(search) ||
 (s.id || "").toLowerCase().includes(search) ||
 (s.school || "").toLowerCase().includes(search)
 );
 }

 // Apply status filter
 if (statusFilter !== "all") {
 filtered = filtered.filter(s => {
 if (statusFilter === "passed") return s.testStatus === "passed" || s.testStatus === "pass";
 if (statusFilter === "failed") return s.testStatus === "failed" || s.testStatus === "fail";
 return s.testStatus === "pending" || (!s.testStatus && s.score != null);
 });
 }

 return filtered;
 };

 const getBatchStats = (batch: Batch) => {
 const batchStudents = students.filter(s =>
 (batch.studentIds || []).includes(s.id)
 );
 const passed = batchStudents.filter(s => s.testStatus === "passed" || s.testStatus === "pass").length;
 const failed = batchStudents.filter(s => s.testStatus === "failed" || s.testStatus === "fail").length;
 const pending = batchStudents.filter(s => s.testStatus !== "passed" && s.testStatus !== "pass" && s.testStatus !== "failed" && s.testStatus !== "fail").length;
 const total = batchStudents.length;
 const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

 return { passed, failed, pending, total, passRate };
 };

 const exportBatchToExcel = (batch: Batch) => {
 const batchStudents = getBatchStudents(batch);
 const test = getBeltTest(batch.beltTestId);

 const exportData = batchStudents.map(student => {
 const row: any = {
 'Student ID': student.id,
 'Name': student.name,
 'Gender': student.gender || '-',
 'School': student.school || 'Individual',
 'Standard': student.standard,
 'Belt/Stage': student.beltLevel || (student.stageLevel != null ? `Stage ${student.stageLevel}` : '-'),
 'Total Score': student.score ?? '-',
 'Percentage': student.percentage != null ? `${student.percentage}%` : '-',
 'Result': (student.testStatus === 'passed' || student.testStatus === 'pass') ? 'PASS' : (student.testStatus === 'failed' || student.testStatus === 'fail') ? 'FAIL' : 'PENDING',
 };

 // Add scoring details
 if (student.scoringResults) {
 student.scoringResults.forEach((result, idx) => {
 row[`Q${idx + 1}: ${result.parameterName}`] = `${result.score}/${result.maxScore || 100} ${result.lessonNumber ? `(L${result.lessonNumber})` : ''}`;
 });
 }

 return row;
 });

 const ws = XLSX.utils.json_to_sheet(exportData);
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, 'Results');
 XLSX.writeFile(wb, `${formatBatchName(batch).replace(/[^a-zA-Z0-9-_]/g, '_')}_Results.xlsx`);
 showToast("Excel exported successfully", "success");
 };

 // Uses the exact same certificate template (ResultCertificateCard) as the
 // admin's per-student "Download PDF" / "Regenerate" flow — one certificate
 // page per student — so a referee's batch export looks identical to every
 // other "result PDF" in the app instead of its own hand-drawn summary table.
 const exportBatchToPDF = async (batch: Batch) => {
 const batchStudents = getBatchStudents(batch);
 const test = getBeltTest(batch.beltTestId);

 if (batchStudents.length === 0) {
 showToast("No students in this batch to export", "warning");
 return;
 }

 setExportingBatchId(batch.id);
 try {
 const studentsWithTestDate = batchStudents.map(s => ({ ...s, beltTestDate: test?.date || s.testDate }));
 const pdfDoc = await generateFeedbackForms(studentsWithTestDate as StudentRecord[]);
 pdfDoc.save(`${formatBatchName(batch).replace(/[^a-zA-Z0-9-_]/g, '_')}_Results.pdf`);
 showToast("PDF exported successfully", "success");
 } catch (error) {
 console.error("Error exporting batch PDF:", error);
 showToast("Failed to export PDF", "error");
 } finally {
 setExportingBatchId(null);
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="text-center">
 <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-bold text-sm uppercase tracking-wider">Loading results...</p>
 </div>
 </div>
 );
 }

 const allStats = batches.reduce(
 (acc, batch) => {
 const stats = getBatchStats(batch);
 return {
 totalStudents: acc.totalStudents + stats.total,
 passed: acc.passed + stats.passed,
 failed: acc.failed + stats.failed,
 pending: acc.pending + stats.pending,
 };
 },
 { totalStudents: 0, passed: 0, failed: 0, pending: 0 }
 );

 const overallPassRate = allStats.totalStudents > 0
 ? Math.round((allStats.passed / allStats.totalStudents) * 100)
 : 0;

 return (
 <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 {/* Header */}
 <nav className="bg-zinc-950 text-white border-b-4 border-blue-500">
 <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
 <div className="flex items-center gap-4">
 <button
 onClick={() => navigate("/referee/dashboard")}
 className="p-2 hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 rounded-xl transition-colors text-zinc-400 hover:text-white"
 >
 <ArrowLeft className="w-5 h-5" />
 </button>
 <img
 src={logo}
 alt="Shadow Kai Logo"
 className="w-10 h-10 rounded-xl border border-zinc-700 object-cover"
 />
 <div>
 <h1
 className="text-2xl font-bold tracking-tight"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 MY RESULTS
 </h1>
 <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
 {referee?.name || "Referee"}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <ThemeToggle />
 </div>
 </div>
 </nav>

 {/* Main Content */}
 <div className="container mx-auto px-4 py-6">
 {/* Overall Stats */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
 {[{label:"Batches",value:batches.length,color:"text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50"},{label:"Students",value:allStats.totalStudents,color:"text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50"},{label:"Passed",value:allStats.passed,color:"text-green-600"},{label:"Failed",value:allStats.failed,color:"text-red-500"},{label:"Pass Rate",value:`${overallPassRate}%`,color:"text-blue-600"}].map(s => (
 <div key={s.label} className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-4 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 text-center">
 <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">{s.label}</p>
 </div>
 ))}
 </div>

 {/* Filters */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-4 mb-6 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800">
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
 <input
 type="text"
 placeholder="Search by name, ID, school..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 {searchTerm && (
 <button
 onClick={() => setSearchTerm("")}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"
 >
 <X className="w-4 h-4" />
 </button>
 )}
 </div>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
 className="px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-bold text-sm text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 appearance-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="all">All Status</option>
 <option value="passed">Passed</option>
 <option value="failed">Failed</option>
 <option value="pending">Pending</option>
 </select>
 </div>
 </div>

 {/* Batches List */}
 {batches.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-12 text-center">
 <Award className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
 <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 mb-2">No Completed Batches</h3>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">You haven't completed any batches yet.</p>
 </div>
 ) : (
 <div className="space-y-4">
 {batches.map((batch) => {
 const test = getBeltTest(batch.beltTestId);
 const stats = getBatchStats(batch);
 const batchStudents = getBatchStudents(batch);
 const isExpanded = expandedBatches.has(batch.id);

 return (
 <div key={batch.id} className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 {/* Batch Header */}
 <button
 onClick={() => toggleBatch(batch.id)}
 className="w-full flex flex-wrap items-center justify-between gap-3 px-6 py-5 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors"
 >
 <div className="flex items-center gap-4 flex-1 min-w-0">
 <div className="w-10 h-10 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center flex-shrink-0">
 <Award className="w-5 h-5 text-blue-500" />
 </div>
 <div className="text-left min-w-0">
 <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 truncate">
 {formatBatchName(batch)}
 </h3>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider truncate">
 {test?.name || 'Unknown Test'}
 {batch.completedAt && (
 <span className="ml-2">
                              · {formatSafeDate(batch.completedAt)}
 </span>
 )}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3 flex-shrink-0">
 <div className="hidden sm:flex gap-2">
 <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-md text-xs font-bold">
 {stats.total} students
 </span>
 <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold">
 {stats.passed} passed
 </span>
 <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold">
 {stats.passRate}%
 </span>
 </div>
 {isExpanded ? (
 <ChevronDown className="w-5 h-5 text-zinc-400" />
 ) : (
 <ChevronRight className="w-5 h-5 text-zinc-400" />
 )}
 </div>
 </button>

 {/* Expanded Content */}
 {isExpanded && (
 <div className="border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 {/* Action Buttons */}
 <div className="flex gap-2 px-6 py-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <button
 onClick={() => exportBatchToExcel(batch)}
 className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 font-bold text-sm active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 <FileSpreadsheet className="w-4 h-4" />
 Excel
 </button>
 <button
 onClick={() => exportBatchToPDF(batch)}
 disabled={exportingBatchId === batch.id}
 className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-zinc-950 rounded-xl hover:bg-blue-400 font-bold text-sm active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
 >
 {exportingBatchId === batch.id ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Download className="w-4 h-4" />
 )}
 {exportingBatchId === batch.id ? "Generating..." : "PDF"}
 </button>
 </div>

 {/* Student Results Table */}
 {batchStudents.length === 0 ? (
 <div className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">
 No students match your filters
 </div>
 ) : (
 <div className="w-full">
 {/* Desktop Table View */}
 <div className="hidden md:block overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">#</th>
 <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Student</th>
 <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">School</th>
 <th className="px-4 py-3 text-left text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Belt/Stage</th>
 <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Score</th>
 <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">%</th>
 <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Result</th>
 <th className="px-4 py-3 text-center text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">Details</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-100">
 {batchStudents.map((student, idx) => (
 <tr key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors">
 <td className="px-4 py-3 text-zinc-400 font-bold text-xs">{idx + 1}</td>
 <td className="px-4 py-3">
 <div>
 <p className="font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{student.name}</p>
 <p className="text-xs font-mono text-zinc-400">{(student.id || '').slice(0,8)}...</p>
 </div>
 </td>
 <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">
 {student.school || <span className="italic text-zinc-400">Individual</span>}
 </td>
 <td className="px-4 py-3">
 {student.beltLevel ? (
 <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-bold">
 {student.beltLevel}
 </span>
 ) : student.stageLevel != null ? (
 <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-md text-xs font-bold">
 Stage {student.stageLevel}
 </span>
 ) : (
 <span className="text-zinc-400">-</span>
 )}
 </td>
 <td className="px-4 py-3 text-center font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">
 {student.score ?? '-'}
 </td>
 <td className="px-4 py-3 text-center">
 {student.percentage != null ? (
 <span className="font-bold text-blue-600">{student.percentage}%</span>
 ) : (
 <span className="text-zinc-400">-</span>
 )}
 </td>
 <td className="px-4 py-3 text-center">
 {(student.testStatus === 'passed' || student.testStatus === 'pass') ? (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold">
 <CheckCircle className="w-3 h-3" />
 PASS
 </span>
 ) : (student.testStatus === 'failed' || student.testStatus === 'fail') ? (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-md text-xs font-bold">
 <XCircle className="w-3 h-3" />
 FAIL
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 rounded-md text-xs font-bold">
 <Clock className="w-3 h-3" />
 PENDING
 </span>
 )}
 </td>
 <td className="px-4 py-3 text-center">
 {student.scoringResults && student.scoringResults.length > 0 && (
 <details className="inline-block">
 <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-bold text-xs flex items-center gap-1 justify-center">
 <Eye className="w-3 h-3" />
 View
 </summary>
 <div className="absolute z-10 mt-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl shadow-xl p-4 min-w-[200px] text-left">
 <p className="font-bold text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-3">Scoring Breakdown</p>
 <div className="space-y-2">
 {student.scoringResults.map((result, idx) => (
 <div key={idx} className="flex flex-wrap justify-between items-center gap-3 text-xs gap-4">
 <span className="text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">
 {result.parameterName}
 {result.lessonNumber && <span className="text-blue-600 font-bold ml-1">(L{result.lessonNumber})</span>}:
 </span>
 <span className="font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">
 {result.score}/{result.maxScore || 100}
 </span>
 </div>
 ))}
 </div>
 </div>
 </details>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>

 {/* Mobile Card View */}
 <div className="grid grid-cols-1 gap-4 md:hidden mt-4">
 {batchStudents.map((student, idx) => (
 <div key={student.id} className="bg-white dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-3">
 <div className="flex justify-between items-start">
 <div>
 <div className="font-bold text-zinc-900 dark:text-white text-lg flex items-center gap-2">
 <span className="text-zinc-400 text-sm">#{idx + 1}</span> {student.name}
 </div>
 <div className="text-xs text-zinc-400 font-mono mt-0.5">{(student.id || '').slice(0,8)}...</div>
 </div>
 <div>
 {(student.testStatus === 'passed' || student.testStatus === 'pass') ? (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold">
 <CheckCircle className="w-3 h-3" /> PASS
 </span>
 ) : (student.testStatus === 'failed' || student.testStatus === 'fail') ? (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 rounded-md text-xs font-bold">
 <XCircle className="w-3 h-3" /> FAIL
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold">
 <Clock className="w-3 h-3" /> PENDING
 </span>
 )}
 </div>
 </div>

 <div className="grid grid-cols-2 gap-y-2 text-sm mt-1">
 <div>
 <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-0.5">School</p>
 <p className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{student.school || 'Individual'}</p>
 </div>
 <div>
 <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Level</p>
 <p className="font-medium text-zinc-800 dark:text-zinc-200">
 {student.beltLevel || (student.stageLevel != null ? `Stage ${student.stageLevel}` : '-')}
 </p>
 </div>
 <div>
 <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Score</p>
 <p className="font-medium text-zinc-900 dark:text-white text-lg">{student.score ?? '-'}</p>
 </div>
 <div>
 <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-0.5">Percentage</p>
 <p className="font-medium text-blue-600 text-lg">{student.percentage != null ? `${student.percentage}%` : '-'}</p>
 </div>
 </div>

 {student.scoringResults && student.scoringResults.length > 0 && (
 <details className="mt-2 w-full col-span-2 group">
 <summary className="w-full py-2.5 flex items-center justify-center gap-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-bold active:scale-95 transition-all cursor-pointer list-none">
 <FileText className="w-4 h-4" /> View Details
 </summary>
 <div className="mt-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-4 text-left">
 <p className="font-bold text-xs text-zinc-500 uppercase tracking-wider mb-3">Scoring Breakdown</p>
 <div className="space-y-2">
 {student.scoringResults.map((result: any, idx: number) => (
 <div key={idx} className="flex flex-wrap justify-between items-center gap-3 text-xs">
 <span className="text-zinc-600 dark:text-zinc-400 font-medium">
 {result.parameterName}
 {result.lessonNumber && <span className="text-blue-600 font-bold ml-1">(L{result.lessonNumber})</span>}:
 </span>
 <span className="font-bold text-zinc-900 dark:text-zinc-50">
 {result.score}/{result.maxScore || 100}
 </span>
 </div>
 ))}
 </div>
 </div>
 </details>
 )}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
}
