import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
 Search, Eye, TrendingUp, Download, FileSpreadsheet,
 ChevronDown, ChevronRight, BarChart2, School, Layers,
 UserCircle, Users, CheckCircle, XCircle, Clock,
 ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Award,
 SlidersHorizontal, X, Building2, Hash, Percent, Trophy,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import {
 firebaseStudentService,
 firebaseSchoolService,
 firebaseBatchService,
 firebaseBeltTestService,
} from "../../services/firebaseData";
import { useToast } from "../../hooks/useToast";
import { useProgram } from "../../contexts/ProgramContext";
import { StudentRecord, School as SchoolType, Batch, BeltTest } from "../../types/admin";
import * as XLSX from "xlsx";
import { formatBatchName } from "../../utils/batchFormatters";
import { DocumentSnapshot } from "firebase/firestore";
import { computeRankings } from "../../constants/scoring";
import { generateFeedbackForms } from "../../utils/feedbackFormGenerator";

// ── Types ──────────────────────────────────────────────────────────────────────

type ViewTab = "overview" | "schools" | "batches" | "individual";
type StatusFilter = "all" | "pending" | "passed" | "failed" | "evaluated";
type SortField = "name" | "score" | "percentage" | "school" | "belt" | "date";
type SortDir = "asc" | "desc";
type GroupBy = "none" | "school" | "batch" | "belt" | "status" | "gender";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getGrade(pct?: number) {
 if (pct == null) return "—";
 if (pct >= 90) return "A+";
 if (pct >= 80) return "A";
 if (pct >= 70) return "B";
 if (pct >= 60) return "C";
 return "F";
}

function passRate(students: StudentRecord[]) {
 const ev = students.filter((s) => s.testStatus === "passed" || s.testStatus === "pass" || s.testStatus === "failed" || s.testStatus === "fail");
 if (ev.length === 0) return 0;
 return Math.round((ev.filter((s) => s.testStatus === "passed" || s.testStatus === "pass").length / ev.length) * 100);
}

function groupStudents(students: StudentRecord[], groupBy: GroupBy, schools: SchoolType[], batches: Batch[], tests: BeltTest[]) {
 if (groupBy === "none") return { "All Students": students };
 const groups: Record<string, StudentRecord[]> = {};
 students.forEach((s) => {
 let key = "";
 if (groupBy === "school") key = s.school || "Unknown School";
 if (groupBy === "batch") { const b = batches.find(b => b.id === s.batchId); key = b ? `${formatBatchName(b)} – ${tests.find(t=>t.id===b.beltTestId)?.name||""}` : "Unassigned"; }
 if (groupBy === "belt") key = s.beltLevel || s.stageLevel != null ? (s.beltLevel || `Stage ${s.stageLevel}`) : "Unknown";
 if (groupBy === "status") key = (s.testStatus === "passed" || s.testStatus === "pass") ? "Passed" : (s.testStatus === "failed" || s.testStatus === "fail") ? "Failed" : "Pending";
 if (groupBy === "gender") key = s.gender || "Unknown";
 if (!groups[key]) groups[key] = [];
 groups[key].push(s);
 });
 return groups;
}

function sortStudents(students: StudentRecord[], field: SortField, dir: SortDir) {
 return [...students].sort((a, b) => {
 let va: any, vb: any;
 if (field === "name") { va = a.name; vb = b.name; }
 else if (field === "score") { va = a.score ?? -1; vb = b.score ?? -1; }
 else if (field === "percentage") { va = a.percentage ?? -1; vb = b.percentage ?? -1; }
 else if (field === "school") { va = a.school; vb = b.school; }
 else if (field === "belt") { va = a.beltLevel || a.stageLevel || ""; vb = b.beltLevel || b.stageLevel || ""; }
 else if (field === "date") { va = a.registeredAt; vb = b.registeredAt; }
 if (va < vb) return dir === "asc" ? -1 : 1;
 if (va > vb) return dir === "asc" ? 1 : -1;
 return 0;
 });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
 const normalizedStatus = 
 status === "pass" ? "passed" :
 status === "fail" ? "failed" :
 status;

 const cfg: Record<string, { bg: string; icon: any; label: string }> = {
 passed: { bg: "bg-green-100 text-green-700", icon: CheckCircle, label: "Passed" },
 failed: { bg: "bg-red-100 text-red-700", icon: XCircle, label: "Failed" },
 pending: { bg: "bg-blue-100 text-blue-700", icon: Clock, label: "Pending" },
 };
 const c = cfg[normalizedStatus] ?? cfg.pending;
 const Icon = c.icon;
 return (
 <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg}`}>
 <Icon className="w-3 h-3" /> {c.label}
 </span>
 );
}

function MiniBar({ value, color = "bg-green-500" }: { value: number; color?: string }) {
 return (
 <div className="flex items-center gap-2">
 <div className="flex-1 h-1.5 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full overflow-hidden">
 <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
 </div>
 <span className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 w-8 text-right">{value}%</span>
 </div>
 );
}

function StatCard({ label, value, sub, color }: { label: string; value: any; sub?: string; color: string }) {
 const cs: Record<string, string> = {
 blue: "bg-blue-50 text-blue-600 border-blue-100",
 green: "bg-green-50 text-green-600 border-green-100",
 red: "bg-red-50 text-red-600 border-red-100",
 amber: "bg-blue-50 text-blue-600 border-blue-100",
 purple: "bg-purple-50 text-purple-600 border-purple-100",
 indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
 };
 return (
 <div className={`${cs[color]} border rounded-xl p-4 flex flex-col gap-1`}>
 <p className={`text-2xl font-bold`}>{value}</p>
 <p className="text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{label}</p>
 {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
 </div>
 );
}

function SortButton({ field, current, dir, onClick }: { field: SortField; current: SortField; dir: SortDir; onClick: () => void }) {
 const active = field === current;
 return (
 <button onClick={onClick} className="inline-flex items-center gap-0.5 hover:text-blue-600 transition-colors">
 {active ? (dir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 text-gray-300" />}
 </button>
 );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ResultManagement() {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const { currentProgram } = useProgram();
 const lastFetchedProgram = useRef<string | null>(null);

 // data
 const [students, setStudents] = useState<StudentRecord[]>([]);
 const [schools, setSchools] = useState<SchoolType[]>([]);
 const [batches, setBatches] = useState<Batch[]>([]);
 const [tests, setTests] = useState<BeltTest[]>([]);

 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);

 // ui state
 const [activeTab, setActiveTab] = useState<ViewTab>("overview");
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
 const [sortField, setSortField] = useState<SortField>("name");
 const [sortDir, setSortDir] = useState<SortDir>("asc");
 const [groupBy, setGroupBy] = useState<GroupBy>("none");
 const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
 const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());
 const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
 const [showFilters, setShowFilters] = useState(false);

 // ── fetch ────────────────────────────────────────────────────────────────────

 const fetchData = async (silent = false, forceRefresh = false) => {
 if (!silent) setLoading(true); else setRefreshing(true);
 try {
 const programFilter = currentProgram === "ALL" ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
 const [studentResult, schs, bts, tsts] = await Promise.all([
 firebaseStudentService.getAll(programFilter),
 firebaseSchoolService.getAll(programFilter),
 firebaseBatchService.getAll(programFilter),
 firebaseBeltTestService.getAll(programFilter),
 ]);
 setStudents(studentResult);
 setSchools(schs);
 setBatches(bts);
 setTests(tsts);
 } catch (err) {
 console.error(err);
 showToast("Failed to load results", "error");
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 };


  useEffect(() => {
  if (lastFetchedProgram.current === currentProgram) return;
  lastFetchedProgram.current = currentProgram;
  
  fetchData();
  }, [currentProgram]);

 // ── derived ──────────────────────────────────────────────────────────────────

 const schoolStudents = useMemo(
 () => students.filter((s) => s.registrationType === "school"),
 [students]
 );
 const individualStudents = useMemo(
 () => students.filter((s) => s.registrationType === "individual"),
 [students]
 );
 const individualBatches = useMemo(
 () => batches.filter((b) => b.schoolId === "individual"),
 [batches]
 );

 const applyFilters = (list: StudentRecord[]) => {
 let res = list;
 if (search) {
 const q = search.toLowerCase();
 res = res.filter(
 (s) =>
 (s.name || "").toLowerCase().includes(q) ||
 (s.id || "").toLowerCase().includes(q) ||
 (s.school || "").toLowerCase().includes(q) ||
 (s.beltLevel || "").toLowerCase().includes(q)
 );
 }
 if (statusFilter !== "all") {
 if (statusFilter === "evaluated") {
 res = res.filter((s) => s.testStatus === "passed" || s.testStatus === "pass" || s.testStatus === "failed" || s.testStatus === "fail");
 } else if (statusFilter === "passed") {
 res = res.filter((s) => s.testStatus === "passed" || s.testStatus === "pass");
 } else if (statusFilter === "failed") {
 res = res.filter((s) => s.testStatus === "failed" || s.testStatus === "fail");
 } else {
 res = res.filter((s) => s.testStatus === "pending" || (!s.testStatus && s.score != null));
 }
 }
 return sortStudents(res, sortField, sortDir);
 };

 const toggleSort = (field: SortField) => {
 if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
 else { setSortField(field); setSortDir("asc"); }
 };

 const toggleGroup = (key: string) =>
 setExpandedGroups((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

 // ── stats (global) ────────────────────────────────────────────────────────────

 const allFiltered = applyFilters(students);
 const evaluated = allFiltered.filter((s) => s.testStatus === "passed" || s.testStatus === "pass" || s.testStatus === "failed" || s.testStatus === "fail");
 const passed = allFiltered.filter((s) => s.testStatus === "passed" || s.testStatus === "pass");
 const failed = allFiltered.filter((s) => s.testStatus === "failed" || s.testStatus === "fail");
 const pending = allFiltered.filter((s) => s.testStatus !== "passed" && s.testStatus !== "pass" && s.testStatus !== "failed" && s.testStatus !== "fail");
 const overallPR = passRate(allFiltered);
 const avgScore = evaluated.length
 ? Math.round(evaluated.reduce((a, s) => a + (s.score ?? 0), 0) / evaluated.length)
 : 0;

 // ── export ────────────────────────────────────────────────────────────────────

 const exportToExcel = (list: StudentRecord[], filename = "Results") => {
 const rows = list.map((s) => ({
 "Student ID": s.id,
 "Name": (s.name || "").trim() ? s.name : `Unnamed (${s.id})`,
 "Gender": s.gender || "-",
 "School": s.school || "Individual",
 "Type": s.registrationType,
 "Standard": s.standard,
 "Belt/Stage": s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "-"),
 "Payment": s.paymentStatus,
 "Test Status": (s.testStatus === "passed" || s.testStatus === "pass") ? "PASSED" : (s.testStatus === "failed" || s.testStatus === "fail") ? "FAILED" : "PENDING",
 "Score": s.score ?? "-",
 "Percentage": s.percentage != null ? `${s.percentage}%` : "-",
 "Grade": getGrade(s.percentage),
 "Rank": s.ranking != null ? `#${s.ranking}` : "-",
 "Result": (s.testStatus === "passed" || s.testStatus === "pass") ? "PASS" : (s.testStatus === "failed" || s.testStatus === "fail") ? "FAIL" : "PENDING",
 }));
 const ws = XLSX.utils.json_to_sheet(rows);
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, "Results");
 XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`);
 };

 // Compute rankings for all evaluated students (by score desc)
 const rankMap = useMemo(() => {
 const evaluated = students.filter(s => s.score != null);
 return computeRankings(evaluated);
 }, [students]);

 // ── render helpers ────────────────────────────────────────────────────────────

 const ThSort = ({ label, field }: { label: string; field: SortField }) => (
 <th
 className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300"
 onClick={() => toggleSort(field)}
 >
 <span className="flex items-center gap-1">
 {label}
 <SortButton field={field} current={sortField} dir={sortDir} onClick={() => toggleSort(field)} />
 </span>
 </th>
 );

  const handleDownloadPDF = async (s: StudentRecord) => {
    try {
      const test = tests.find(t => t.id === s.beltTestId);
      const studentWithTest = { ...s, beltTestDate: test?.date || s.testDate };
      const doc = await generateFeedbackForms([studentWithTest as StudentRecord]);
      doc.save(`${s.name?.replace(/\s+/g, '_')}_Feedback_Form.pdf`);
      showToast("PDF generated successfully", "success");
    } catch(err) {
      console.error(err);
      showToast("Failed to generate PDF", "error");
    }
  };

 const StudentRow = ({ s, idx }: { s: StudentRecord; idx: number }) => {
 const rank = s.ranking ?? rankMap[s.id];
 const rankLabel = rank != null ? (
 rank <= 3 ? (
 <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs font-bold ${
 rank === 1 ? "bg-blue-100 text-blue-700" :
 rank === 2 ? "bg-zinc-200 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300" :
 "bg-orange-100 text-orange-700"
 }`}>
 <Trophy className="w-3 h-3" />#{rank}
 </span>
 ) : (
 <span className="text-xs font-bold text-zinc-400">#{rank}</span>
 )
 ) : <span className="text-zinc-200">—</span>;

 return (
 <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors border-b border-gray-50 last:border-0">
 <td className="px-3 py-3 text-gray-400 text-xs w-8">{idx + 1}</td>
 <td className="px-3 py-3">
 <div>
 <p className="font-medium text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 text-sm">{(s.name || "").trim() ? s.name : <span className="text-gray-400 italic">Unnamed</span>}</p>
 <p className="text-xs text-gray-400">{s.id}</p>
 </div>
 </td>
 <td className="px-3 py-3">
 <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.gender === "Male" ? "bg-blue-100 text-blue-700" : s.gender === "Female" ? "bg-pink-100 text-pink-700" : "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"}`}>
 {s.gender || "—"}
 </span>
 </td>
 <td className="px-3 py-3 text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 max-w-[120px] truncate">{s.school || <span className="italic text-gray-400">Individual</span>}</td>
 <td className="px-3 py-3 text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Std {s.standard}</td>
 <td className="px-3 py-3">
 {s.beltLevel ? (
 <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">{s.beltLevel}</span>
 ) : s.stageLevel != null ? (
 <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Stage {s.stageLevel}</span>
 ) : <span className="text-gray-400">—</span>}
 </td>
 <td className="px-3 py-3"><StatusBadge status={s.testStatus} /></td>
 <td className="px-3 py-3 text-center">
 {s.score != null ? (
 <span className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 text-sm">{s.score}</span>
 ) : <span className="text-gray-300">—</span>}
 </td>
 <td className="px-3 py-3 text-center">
 {s.percentage != null ? (
 <div className="flex flex-col items-center gap-0.5">
 <span className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 text-sm">{s.percentage}%</span>
 <span className="text-xs text-gray-400">{getGrade(s.percentage)}</span>
 </div>
 ) : <span className="text-gray-300">—</span>}
 </td>
 <td className="px-3 py-3 text-center">{rankLabel}</td>
 <td className="px-3 py-3 text-center">
 {s.score != null && (
 <button
 onClick={(e) => { e.stopPropagation(); handleDownloadPDF(s); }}
 className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
 title="Download Official Result PDF"
 >
 <Download className="w-4 h-4" />
 </button>
 )}
 </td>
 </tr>
 );
 };

 const StudentTable = ({ list }: { list: StudentRecord[] }) => (
 <div className="overflow-x-auto">
 <table className="w-full text-sm min-w-[900px]">
 <thead className="bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <tr>
 <th className="px-3 py-3 text-xs font-semibold text-gray-400 w-8">#</th>
 <ThSort label="Student" field="name" />
 <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-left uppercase tracking-wider">Gender</th>
 <ThSort label="School" field="school" />
 <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-left uppercase tracking-wider">Std</th>
 <ThSort label="Belt/Stage" field="belt" />
 <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-left uppercase tracking-wider">Status</th>
 <ThSort label="Score" field="score" />
 <ThSort label="% / Grade" field="percentage" />
 <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-center uppercase tracking-wider">Rank</th>
 <th className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-center uppercase tracking-wider">Action</th>
 </tr>
 </thead>
 <tbody>
 {list.length === 0 ? (
 <tr><td colSpan={11} className="py-12 text-center text-gray-400 text-sm">No students found</td></tr>
 ) : (
 list.map((s, i) => <StudentRow key={s.id} s={s} idx={i} />)
 )}
 </tbody>
 </table>
 </div>
 );

 // ── loading ───────────────────────────────────────────────────────────────────

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
 <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
 <p className="text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-sm">Loading results…</p>
 </div>
 </AdminLayout>
 );
 }

 // ── render ────────────────────────────────────────────────────────────────────

 return (
 <AdminLayout>
 <div className="space-y-5">

 {/* ── Page Header ── */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 flex items-center gap-2">
 <BarChart2 className="w-6 h-6 text-blue-600" />
 Result Management
 </h1>
 <p className="text-sm text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-0.5">
 {students.length} students · {passed.length} passed · {failed.length} failed · {pending.length} pending
 </p>
 </div>
 <div className="flex gap-2 flex-wrap">
 <button
 onClick={() => fetchData(true, true)}
 disabled={refreshing}
 className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 disabled:opacity-50"
 >
 <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
 Refresh
 </button>
 <button
 onClick={() => exportToExcel(allFiltered, "Results")}
 className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium"
 >
 <FileSpreadsheet className="w-4 h-4" />
 Export Excel
 </button>
 </div>
 </div>

 {/* ── Global Stats ── */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
 <StatCard label="Total Students" value={students.length} color="blue" />
 <StatCard label="School Students" value={schoolStudents.length} color="indigo" />
 <StatCard label="Individual" value={individualStudents.length} color="purple" />
 <StatCard label="Passed" value={passed.length} color="green" />
 <StatCard label="Failed" value={failed.length} color="red" />
 <StatCard label="Pass Rate" value={`${overallPR}%`} color="amber" sub={`Avg score: ${avgScore}`} />
 </div>

 {/* ── Tabs ── */}
 <div className="flex gap-1 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 p-1 rounded-xl w-fit">
 {([
 { id: "overview", label: "Overview", icon: BarChart2 },
 { id: "schools", label: "By School", icon: School },
 { id: "batches", label: "By Batch", icon: Layers },
 { id: "individual", label: "Individual", icon: UserCircle },
 ] as { id: ViewTab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
 <button
 key={id}
 onClick={() => setActiveTab(id)}
 className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
 activeTab === id
 ? "bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 shadow text-blue-700"
 : "text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300"
 }`}
 >
 <Icon className="w-4 h-4" />
 {label}
 </button>
 ))}
 </div>

 {/* ── Filters Bar ── */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-4 space-y-3">
 <div className="flex flex-col sm:flex-row gap-3">
 {/* Search */}
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
 <input
 type="text"
 placeholder="Search name, ID, school, belt…"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 {search && (
 <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 <X className="w-3.5 h-3.5" />
 </button>
 )}
 </div>

 {/* Status filter */}
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
 className="px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="all">All Status</option>
 <option value="pending">Pending</option>
 <option value="evaluated">Evaluated (all)</option>
 <option value="passed">Passed</option>
 <option value="failed">Failed</option>
 </select>

 {/* Toggle advanced */}
 <button
 onClick={() => setShowFilters((p) => !p)}
 className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showFilters ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900"}`}
 >
 <SlidersHorizontal className="w-4 h-4" />
 Sort & Group
 </button>
 </div>

 {/* Advanced filters panel */}
 {showFilters && (
 <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 {/* Sort by */}
 <div className="flex items-center gap-2">
 <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide">Sort by</label>
 <select
 value={sortField}
 onChange={(e) => setSortField(e.target.value as SortField)}
 className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="name">Name</option>
 <option value="score">Score</option>
 <option value="percentage">Percentage</option>
 <option value="school">School</option>
 <option value="belt">Belt / Stage</option>
 <option value="date">Registration Date</option>
 </select>
 <button
 onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
 className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900"
 >
 {sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
 {sortDir === "asc" ? "Asc" : "Desc"}
 </button>
 </div>

 {/* Group by (only in overview / individual tab) */}
 {(activeTab === "overview" || activeTab === "individual") && (
 <div className="flex items-center gap-2">
 <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide">Group by</label>
 <select
 value={groupBy}
 onChange={(e) => setGroupBy(e.target.value as GroupBy)}
 className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="none">None</option>
 <option value="school">School</option>
 <option value="batch">Batch</option>
 <option value="belt">Belt / Stage</option>
 <option value="status">Test Status</option>
 <option value="gender">Gender</option>
 </select>
 </div>
 )}
 </div>
 )}

 <p className="text-xs text-gray-400">
 Showing {allFiltered.length} of {students.length} students
 </p>
 </div>

 {/* ════════════════════════════════════════════════════════════════════ */}
 {/* ── OVERVIEW TAB ── */}
 {/* ════════════════════════════════════════════════════════════════════ */}
 {activeTab === "overview" && (
 <div className="space-y-4">
 {groupBy === "none" ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <StudentTable list={allFiltered} />
 </div>
 ) : (
 (() => {
 const groups = groupStudents(allFiltered, groupBy, schools, batches, tests);
 return Object.entries(groups)
 .sort(([a], [b]) => a.localeCompare(b))
 .map(([key, list]) => {
 const open = expandedGroups.has(key);
 const pr = passRate(list);
 return (
 <div key={key} className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <button
 onClick={() => toggleGroup(key)}
 className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors"
 >
 <div className="flex items-center gap-3 min-w-0">
 {open ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
 <div className="text-left min-w-0">
 <p className="font-semibold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 truncate">{key}</p>
 <p className="text-xs text-gray-400">
 {list.length} students · {list.filter(s=>s.testStatus==="passed").length} passed · {list.filter(s=>s.testStatus==="failed").length} failed · {list.filter(s=>s.testStatus==="pending").length} pending
 </p>
 </div>
 </div>
 <div className="flex items-center gap-4 flex-shrink-0 ml-4">
 <div className="hidden sm:block w-28">
 <MiniBar value={pr} color={pr >= 80 ? "bg-green-500" : pr >= 50 ? "bg-blue-500" : "bg-red-500"} />
 </div>
 <span className="text-xs font-bold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 w-10 text-right">{list.length}</span>
 </div>
 </button>
 {open && <div className="border-t border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"><StudentTable list={list} /></div>}
 </div>
 );
 });
 })()
 )}
 </div>
 )}

 {/* ════════════════════════════════════════════════════════════════════ */}
 {/* ── BY SCHOOL TAB ── */}
 {/* ════════════════════════════════════════════════════════════════════ */}
 {activeTab === "schools" && (
 <div className="space-y-3">
 {schools.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-12 text-center">
 <School className="w-12 h-12 text-gray-300 mx-auto mb-3" />
 <p className="text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">No schools found</p>
 </div>
 ) : (
 (() => {
 const grouped: Record<string, StudentRecord[]> = {};
 schools.forEach((sc) => { grouped[sc.id] = []; });
 applyFilters(schoolStudents).forEach((s) => {
 if (s.schoolId && grouped[s.schoolId]) grouped[s.schoolId].push(s);
 else if (!s.schoolId) {
 // fallback: match by name
 const match = schools.find(sc => sc.name === s.school);
 if (match) grouped[match.id]?.push(s);
 }
 });
 return schools
 .sort((a, b) => a.name.localeCompare(b.name))
 .map((sc) => {
 const list = grouped[sc.id] || [];
 const open = expandedSchools.has(sc.id);
 const pr = passRate(list);
 const ev = list.filter(s => s.testStatus !== "pending").length;
 if (statusFilter !== "all" && list.length === 0) return null;
 return (
 <div key={sc.id} className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <button
 onClick={() => setExpandedSchools((prev) => { const s = new Set(prev); s.has(sc.id) ? s.delete(sc.id) : s.add(sc.id); return s; })}
 className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors"
 >
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
 <Building2 className="w-5 h-5 text-blue-600" />
 </div>
 <div className="text-left min-w-0">
 <p className="font-semibold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 truncate">{sc.name}</p>
 <p className="text-xs text-gray-400">
 {sc.branch && <span className="mr-2">{sc.branch}</span>}
 {list.length} students · {list.filter(s=>s.testStatus==="passed").length} passed · {list.filter(s=>s.testStatus==="failed").length} failed · {list.filter(s=>s.testStatus==="pending").length} pending
 </p>
 </div>
 </div>
 <div className="flex items-center gap-4 flex-shrink-0 ml-4">
 {ev > 0 && (
 <div className="hidden sm:block w-28">
 <MiniBar value={pr} color={pr >= 80 ? "bg-green-500" : pr >= 50 ? "bg-blue-500" : "bg-red-500"} />
 </div>
 )}
 <div className="flex gap-2 text-xs">
 <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 rounded-full font-medium">{list.length} total</span>
 {ev > 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">{pr}% pass</span>}
 </div>
 {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
 </div>
 </button>
 {open && (
 <div className="border-t border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 {list.length === 0 ? (
 <p className="py-6 text-center text-sm text-gray-400">No students match the current filters</p>
 ) : (
 <>
 <div className="flex justify-end px-4 py-2 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <button
 onClick={() => exportToExcel(list, `School_${sc.name}`)}
 className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium"
 >
 <FileSpreadsheet className="w-3.5 h-3.5" /> Export
 </button>
 </div>
 <StudentTable list={list} />
 </>
 )}
 </div>
 )}
 </div>
 );
 });
 })()
 )}
 </div>
 )}

 {/* ════════════════════════════════════════════════════════════════════ */}
 {/* ── BY BATCH TAB ── */}
 {/* ════════════════════════════════════════════════════════════════════ */}
 {activeTab === "batches" && (
 <div className="space-y-3">
 {tests.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-12 text-center">
 <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
 <p className="text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">No belt tests found</p>
 </div>
 ) : (
 tests.map((test) => {
 const testBatches = batches.filter((b) => b.beltTestId === test.id);
 if (testBatches.length === 0) return null;
 return (
 <div key={test.id} className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 {/* Test header */}
 <div className="px-5 py-3 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex items-center gap-2">
 <Award className="w-4 h-4 text-blue-600" />
 <p className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 text-sm">{test.name}</p>
 <span className="text-xs text-gray-400">{test.date}</span>
 <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${test.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"}`}>
 {test.isActive ? "Active" : "Inactive"}
 </span>
 </div>

 {/* Batches inside test */}
 <div className="divide-y divide-gray-50">
 {testBatches
 .sort((a, b) => a.batchNumber - b.batchNumber)
 .map((batch) => {
 const batchStudentIds = batch.studentIds || [];
 const batchStuds = applyFilters(
 students.filter((s) => (batchStudentIds || []).includes(s.id))
 );
 const open = expandedBatches.has(batch.id);
 const pr = passRate(batchStuds);
 const isIndividual = batch.schoolId === "individual";
 const school = schools.find((sc) => sc.id === batch.schoolId);

 return (
 <div key={batch.id}>
 <button
 onClick={() => setExpandedBatches((prev) => { const s = new Set(prev); s.has(batch.id) ? s.delete(batch.id) : s.add(batch.id); return s; })}
 className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors text-left"
 >
 <div className="flex items-center gap-3 min-w-0">
 <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isIndividual ? "bg-indigo-100" : "bg-blue-100"}`}>
 {isIndividual ? <UserCircle className="w-4 h-4 text-indigo-600" /> : <Layers className="w-4 h-4 text-blue-600" />}
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-semibold text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 text-sm">{formatBatchName(batch)}</span>
 {!isIndividual && (
 <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full truncate max-w-[120px]">{school?.name || "Unknown School"}</span>
 )}
 <span className={`text-xs px-1.5 py-0.5 rounded-full ${
 batch.status === "completed" ? "bg-green-100 text-green-700" :
 batch.status === "ongoing" ? "bg-blue-100 text-blue-700" :
 "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"
 }`}>{batch.status}</span>
 </div>
 <p className="text-xs text-gray-400">
 {batchStuds.length} students · {batchStuds.filter(s=>s.testStatus==="passed").length} passed · {batchStuds.filter(s=>s.testStatus==="pending").length} pending
 </p>
 </div>
 </div>
 <div className="flex items-center gap-4 flex-shrink-0 ml-4">
 {batchStuds.filter(s=>s.testStatus!=="pending").length > 0 && (
 <div className="hidden sm:block w-24">
 <MiniBar value={pr} color={pr >= 80 ? "bg-green-500" : pr >= 50 ? "bg-blue-500" : "bg-red-500"} />
 </div>
 )}
 {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
 </div>
 </button>
 {open && (
 <div className="border-t border-gray-50 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900/50">
 {batchStuds.length === 0 ? (
 <p className="py-5 text-center text-sm text-gray-400">No students match the current filters</p>
 ) : (
 <>
 <div className="flex justify-end px-4 py-2 border-b border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <button
 onClick={() => exportToExcel(batchStuds, formatBatchName(batch).replace(/[^a-zA-Z0-9-_]/g, '_'))}
 className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium"
 >
 <FileSpreadsheet className="w-3.5 h-3.5" /> Export
 </button>
 </div>
 <StudentTable list={batchStuds} />
 </>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 );
 })
 )}
 </div>
 )}

 {/* ════════════════════════════════════════════════════════════════════ */}
 {/* ── INDIVIDUAL TAB ── */}
 {/* ════════════════════════════════════════════════════════════════════ */}
 {activeTab === "individual" && (
 <div className="space-y-4">
 {/* Individual stats */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <StatCard label="Total Individual" value={individualStudents.length} color="indigo" />
 <StatCard label="Passed" value={individualStudents.filter(s=>s.testStatus==="passed").length} color="green" />
 <StatCard label="Failed" value={individualStudents.filter(s=>s.testStatus==="failed").length} color="red" />
 <StatCard label="Pending" value={individualStudents.filter(s=>s.testStatus==="pending").length} color="amber" />
 </div>

 {/* Individual Batches summary */}
 {individualBatches.length > 0 && (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
 <UserCircle className="w-4 h-4 text-indigo-600" />
 <p className="font-bold text-indigo-800 text-sm">Individual Batches ({individualBatches.length})</p>
 </div>
 <div className="divide-y divide-gray-50">
 {individualBatches
 .sort((a, b) => a.batchNumber - b.batchNumber)
 .map((batch) => {
 const bstudents = applyFilters(
 students.filter((s) => (batch.studentIds || []).includes(s.id))
 );
 const open = expandedBatches.has(`indiv-${batch.id}`);
 const pr = passRate(bstudents);
 return (
 <div key={batch.id}>
 <button
 onClick={() => setExpandedBatches((prev) => { const s = new Set(prev); const k = `indiv-${batch.id}`; s.has(k) ? s.delete(k) : s.add(k); return s; })}
 className="w-full flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors"
 >
 <div className="flex items-center gap-2">
 <span className="font-semibold text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">{formatBatchName(batch)}</span>
 <span className={`text-xs px-1.5 py-0.5 rounded-full ${batch.status === "completed" ? "bg-green-100 text-green-700" : "bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"}`}>{batch.status}</span>
 </div>
 <div className="flex items-center gap-3 flex-shrink-0">
 <span className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{bstudents.length} students</span>
 {bstudents.filter(s=>s.testStatus!=="pending").length > 0 && (
 <div className="hidden sm:block w-20">
 <MiniBar value={pr} color={pr >= 80 ? "bg-green-500" : "bg-blue-500"} />
 </div>
 )}
 {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
 </div>
 </button>
 {open && (
 <div className="border-t border-gray-50">
 {bstudents.length === 0 ? (
 <p className="py-5 text-center text-sm text-gray-400">No students match filters</p>
 ) : (
 <StudentTable list={bstudents} />
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* All individual students flat table */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <p className="font-semibold text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 text-sm flex items-center gap-2">
 <Users className="w-4 h-4 text-indigo-500" />
 All Individual Students
 {groupBy !== "none" && <span className="text-xs text-gray-400 font-normal">grouped by {groupBy}</span>}
 </p>
 <button
 onClick={() => exportToExcel(applyFilters(individualStudents), "Individual_Results")}
 className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium"
 >
 <FileSpreadsheet className="w-3.5 h-3.5" /> Export
 </button>
 </div>

 {groupBy === "none" ? (
 <StudentTable list={applyFilters(individualStudents)} />
 ) : (
 (() => {
 const groups = groupStudents(applyFilters(individualStudents), groupBy, schools, batches, tests);
 return Object.entries(groups)
 .sort(([a], [b]) => a.localeCompare(b))
 .map(([key, list]) => {
 const gkey = `indiv-group-${key}`;
 const open = expandedGroups.has(gkey);
 return (
 <div key={key} className="border-b border-gray-50 last:border-0">
 <button
 onClick={() => toggleGroup(gkey)}
 className="w-full flex items-center gap-2 px-5 py-2.5 bg-indigo-50/60 hover:bg-indigo-50 transition-colors"
 >
 {open ? <ChevronDown className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />}
 <span className="font-semibold text-indigo-800 text-sm">{key}</span>
 <span className="ml-auto text-xs text-indigo-500">{list.length} students</span>
 </button>
 {open && <StudentTable list={list} />}
 </div>
 );
 });
 })()
 )}
 </div>
 </div>
 )}



 </div>
 </AdminLayout>
 );
}
