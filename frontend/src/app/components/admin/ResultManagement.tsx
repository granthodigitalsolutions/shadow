import { useState, useEffect, useMemo, useRef } from "react";
import {
 Search, Download, FileSpreadsheet, FileText,
 CheckCircle, XCircle, Clock,
 ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Trophy,
 BarChart2, Filter, RotateCcw, X,
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
import { computeRankings } from "../../constants/scoring";
import { generateFeedbackForms } from "../../utils/feedbackFormGenerator";

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "passed" | "failed" | "pending";
type SortField = "name" | "score" | "percentage" | "school" | "belt" | "date";
type SortDir = "asc" | "desc";

const ALL = "all";

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

 // ui state — search + sort (kept from the previous tab-based page)
 const [search, setSearch] = useState("");
 const [sortField, setSortField] = useState<SortField>("name");
 const [sortDir, setSortDir] = useState<SortDir>("asc");

 // multi-filter state — replaces the old Overview / By School / By Batch / Individual tabs
 const [schoolFilter, setSchoolFilter] = useState<string>(ALL); // schoolId
 const [batchFilter, setBatchFilter] = useState<string>(ALL); // batchId
 const [eventFilter, setEventFilter] = useState<string>(ALL); // registrationType
 const [genderFilter, setGenderFilter] = useState<string>(ALL);
 const [beltFilter, setBeltFilter] = useState<string>(ALL);
 const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL);

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

 // ── filter option lists (derived from the loaded result dataset — nothing hard-coded) ──

 // Legacy students may only have a `school` name and no `schoolId` — fall back
 // to matching by name against the loaded schools, same as the old By School tab did.
 const schoolNameToId = useMemo(() => {
 const map = new Map<string, string>();
 schools.forEach((sc) => map.set(sc.name, sc.id));
 return map;
 }, [schools]);

 const getStudentSchoolId = (s: StudentRecord): string | undefined =>
 s.schoolId || (s.school ? schoolNameToId.get(s.school) : undefined);

 const schoolOptions = useMemo(() => {
 const map = new Map<string, string>();
 students.forEach((s) => {
 if (s.registrationType !== "school") return;
 const id = getStudentSchoolId(s);
 if (!id) return;
 map.set(id, schools.find((sc) => sc.id === id)?.name || s.school || "Unknown School");
 });
 return Array.from(map.entries())
 .map(([id, name]) => ({ id, name }))
 .sort((a, b) => a.name.localeCompare(b.name));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [students, schools, schoolNameToId]);

 // Batch dropdown is context-aware: when a School is selected, only that
 // school's batches are shown (individual-session batches are excluded then,
 // since they don't belong to any school).
 const batchOptions = useMemo(() => {
 const relevant = schoolFilter === ALL ? batches : batches.filter((b) => b.schoolId === schoolFilter);
 return relevant
 .map((b) => {
 const testName = tests.find((t) => t.id === b.beltTestId)?.name;
 return { id: b.id, label: `${formatBatchName(b)}${testName ? ` – ${testName}` : ""}` };
 })
 .sort((a, b) => a.label.localeCompare(b.label));
 }, [batches, tests, schoolFilter]);

 // If the school filter changes and the previously-selected batch no longer
 // belongs to it, fall back to "All Batches" instead of showing a stale filter.
 useEffect(() => {
 if (batchFilter !== ALL && !batchOptions.some((b) => b.id === batchFilter)) {
 setBatchFilter(ALL);
 }
 }, [batchOptions, batchFilter]);

 const eventOptions = useMemo(
 () => Array.from(new Set(students.map((s) => s.registrationType).filter(Boolean))).sort() as string[],
 [students],
 );
 const genderOptions = useMemo(
 () => Array.from(new Set(students.map((s) => s.gender).filter(Boolean))).sort() as string[],
 [students],
 );
 const beltOptions = useMemo(() => {
 const set = new Set<string>();
 students.forEach((s) => {
 const belt = s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "");
 if (belt) set.add(belt);
 });
 return Array.from(set).sort();
 }, [students]);

 // ── ONE filtered dataset — feeds the table, the stats, and both exports ──────

 const filteredResults = useMemo(() => {
 let res = students;

 if (schoolFilter !== ALL) res = res.filter((s) => getStudentSchoolId(s) === schoolFilter);
 if (batchFilter !== ALL) res = res.filter((s) => s.batchId === batchFilter);
 if (eventFilter !== ALL) res = res.filter((s) => s.registrationType === eventFilter);
 if (genderFilter !== ALL) res = res.filter((s) => s.gender === genderFilter);
 if (beltFilter !== ALL) {
 res = res.filter((s) => (s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "")) === beltFilter);
 }
 if (statusFilter !== ALL) {
 if (statusFilter === "passed") res = res.filter((s) => s.testStatus === "passed" || s.testStatus === "pass");
 else if (statusFilter === "failed") res = res.filter((s) => s.testStatus === "failed" || s.testStatus === "fail");
 else res = res.filter((s) => s.testStatus !== "passed" && s.testStatus !== "pass" && s.testStatus !== "failed" && s.testStatus !== "fail");
 }
 if (search.trim()) {
 const q = search.trim().toLowerCase();
 res = res.filter(
 (s) =>
 (s.name || "").toLowerCase().includes(q) ||
 (s.id || "").toLowerCase().includes(q) ||
 (s.school || "").toLowerCase().includes(q) ||
 (s.beltLevel || "").toLowerCase().includes(q),
 );
 }

 return sortStudents(res, sortField, sortDir);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [students, schools, schoolNameToId, schoolFilter, batchFilter, eventFilter, genderFilter, beltFilter, statusFilter, search, sortField, sortDir]);

 const toggleSort = (field: SortField) => {
 if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
 else { setSortField(field); setSortDir("asc"); }
 };

 const filtersActive =
 schoolFilter !== ALL || batchFilter !== ALL || eventFilter !== ALL ||
 genderFilter !== ALL || beltFilter !== ALL || statusFilter !== ALL || search.trim() !== "";

 const clearFilters = () => {
 setSchoolFilter(ALL);
 setBatchFilter(ALL);
 setEventFilter(ALL);
 setGenderFilter(ALL);
 setBeltFilter(ALL);
 setStatusFilter(ALL);
 setSearch("");
 };

 // ── stats — computed from filteredResults, so they always match what's on screen ──

 const evaluated = filteredResults.filter((s) => s.testStatus === "passed" || s.testStatus === "pass" || s.testStatus === "failed" || s.testStatus === "fail");
 const passed = filteredResults.filter((s) => s.testStatus === "passed" || s.testStatus === "pass");
 const failed = filteredResults.filter((s) => s.testStatus === "failed" || s.testStatus === "fail");
 const pendingResults = filteredResults.filter((s) => s.testStatus !== "passed" && s.testStatus !== "pass" && s.testStatus !== "failed" && s.testStatus !== "fail");
 const schoolResultsCount = filteredResults.filter((s) => s.registrationType === "school").length;
 const individualResultsCount = filteredResults.filter((s) => s.registrationType === "individual").length;
 const overallPR = passRate(filteredResults);
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

 // Compute rankings for all evaluated students (by score desc) — global, over
 // the full unfiltered dataset, since a student's rank is a property of the
 // whole belt test cohort and must not shift as filters are applied.
 const rankMap = useMemo(() => {
 const evaluated = students.filter(s => s.score != null);
 return computeRankings(evaluated);
 }, [students]);

 // ── PDF export (Excel export above is untouched) ──────────────────────────────

 const batchById = useMemo(() => new Map(batches.map((b) => [b.id, b])), [batches]);
 const programLabel = currentProgram === "SELAMBAM" ? "Silambam" : "Karate";

 // Human-readable label/value for every filter that isn't "All" — used to
 // build the PDF header so it never lists "All" filters unnecessarily.
 const activeFilterDetails = (): Array<{ label: string; value: string }> => {
 const items: Array<{ label: string; value: string }> = [];
 if (schoolFilter !== ALL) items.push({ label: "School", value: schoolOptions.find((o) => o.id === schoolFilter)?.name || schoolFilter });
 if (batchFilter !== ALL) { const b = batchById.get(batchFilter); items.push({ label: "Batch", value: b ? formatBatchName(b) : batchFilter }); }
 if (eventFilter !== ALL) items.push({ label: "Event", value: eventFilter === "school" ? "School" : "Individual" });
 if (genderFilter !== ALL) items.push({ label: "Gender", value: genderFilter });
 if (beltFilter !== ALL) items.push({ label: "Belt/Stage", value: beltFilter });
 if (statusFilter !== ALL) items.push({ label: "Status", value: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) });
 if (search.trim()) items.push({ label: "Search", value: search.trim() });
 return items;
 };

 const exportToPDF = async (
 list: StudentRecord[],
 cfg: {
 title: string;
 scopeLabel?: string;
 fileName: string;
 details?: Array<{ label: string; value: string }>;
 showSchoolColumn?: boolean;
 showBatchColumn?: boolean;
 },
 ) => {
 if (list.length === 0) {
 showToast("No results to export", "info");
 return;
 }
 try {
 const { buildResultsReportPdf } = await import("../../utils/resultPdf/generateResultsReportPdf");
 const isPass = (s: StudentRecord) => s.testStatus === "passed" || s.testStatus === "pass";
 const isFail = (s: StudentRecord) => s.testStatus === "failed" || s.testStatus === "fail";
 const evaluatedList = list.filter((s) => isPass(s) || isFail(s));
 const passedCount = list.filter(isPass).length;
 const failedCount = list.filter(isFail).length;

 const rows = list.map((s) => {
 const rank = s.ranking ?? rankMap[s.id];
 const batch = s.batchId ? batchById.get(s.batchId) : undefined;
 return {
 studentId: s.id,
 name: (s.name || "").trim() ? s.name : `Unnamed (${s.id})`,
 gender: s.gender || "-",
 school: s.school || "Individual",
 standard: s.standard || "-",
 beltStage: s.beltLevel || (s.stageLevel != null ? `Stage ${s.stageLevel}` : "-"),
 batch: batch ? formatBatchName(batch) : "-",
 status: (isPass(s) ? "PASSED" : isFail(s) ? "FAILED" : "PENDING") as "PASSED" | "FAILED" | "PENDING",
 score: s.score != null ? String(s.score) : "-",
 percentage: s.percentage != null ? `${s.percentage}%` : "-",
 grade: getGrade(s.percentage),
 rank: rank != null ? `#${rank}` : "-",
 };
 });

 const doc = buildResultsReportPdf({
 title: cfg.title,
 scopeLabel: cfg.scopeLabel,
 details: [
 ...(cfg.details ?? []),
 { label: "Program", value: programLabel },
 ],
 summary: {
 total: list.length,
 passed: passedCount,
 failed: failedCount,
 pending: list.length - passedCount - failedCount,
 passRate: passRate(list),
 avgScore: evaluatedList.length
 ? Math.round(evaluatedList.reduce((a, s) => a + (s.score ?? 0), 0) / evaluatedList.length)
 : 0,
 },
 rows,
 showSchoolColumn: cfg.showSchoolColumn,
 showBatchColumn: cfg.showBatchColumn,
 });
 const safeName = cfg.fileName.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_+|_+$/g, "") || "Results";
 doc.save(`${safeName}_${new Date().toISOString().split("T")[0]}.pdf`);
 showToast("PDF exported", "success");
 } catch (err) {
 console.error("Results PDF export failed:", err);
 showToast("Failed to export PDF", "error");
 }
 };

 // Both export buttons at the top of the page read from filteredResults — the
 // same array the table and the stat cards render from (single source of truth).
 const handleExportExcel = () => exportToExcel(filteredResults, "Results");

 const handleExportPDF = () => {
 const filterItems = activeFilterDetails();
 exportToPDF(filteredResults, {
 title: "RESULT REPORT",
 scopeLabel: filterItems.length > 0 ? filterItems.map((f) => `${f.label}: ${f.value}`).join(" • ") : "All Results",
 fileName: filterItems.length > 0 ? `Results_${filterItems.map((f) => f.value).join("_")}` : "Results",
 details: [...filterItems, { label: "Students", value: String(filteredResults.length) }],
 showSchoolColumn: schoolFilter === ALL,
 showBatchColumn: batchFilter === ALL,
 });
 };

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
 {filteredResults.length} students · {passed.length} passed · {failed.length} failed · {pendingResults.length} pending
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
 onClick={handleExportExcel}
 className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 font-medium"
 >
 <FileSpreadsheet className="w-4 h-4" />
 Export Excel
 </button>
 <button
 onClick={handleExportPDF}
 className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 font-medium"
 >
 <FileText className="w-4 h-4" />
 Export PDF
 </button>
 </div>
 </div>

 {/* ── Stats — follow the currently filtered dataset ── */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
 <StatCard label="Total Students" value={filteredResults.length} color="blue" />
 <StatCard label="School Students" value={schoolResultsCount} color="indigo" />
 <StatCard label="Individual" value={individualResultsCount} color="purple" />
 <StatCard label="Passed" value={passed.length} color="green" />
 <StatCard label="Failed" value={failed.length} color="red" />
 <StatCard label="Pass Rate" value={`${overallPR}%`} color="amber" sub={`Avg score: ${avgScore}`} />
 </div>

 {/* ════════════════════════════════════════════════════════════════════ */}
 {/* ── FILTER PANEL — replaces the old Overview/By School/By Batch/Individual tabs ── */}
 {/* ════════════════════════════════════════════════════════════════════ */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-4 space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <h3 className="text-sm font-bold text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 uppercase tracking-wide flex items-center gap-2">
 <Filter className="w-4 h-4 text-blue-600" />
 Filter Results
 </h3>
 <div className="flex items-center gap-2">
 <label className="text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide hidden sm:inline">Sort by</label>
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
 title={sortDir === "asc" ? "Ascending" : "Descending"}
 >
 {sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
 </button>
 </div>
 </div>

 {/* Search */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
 <input
 type="text"
 placeholder="Search name, ID, school, belt…"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 {search && (
 <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 <X className="w-3.5 h-3.5" />
 </button>
 )}
 </div>

 {/* School / Batch / Event / Gender / Belt-Stage / Status — all combine with AND */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
 <div>
 <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-1.5">School</label>
 <select
 value={schoolFilter}
 onChange={(e) => setSchoolFilter(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value={ALL}>All Schools</option>
 {schoolOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
 </select>
 </div>

 <div>
 <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Batch</label>
 <select
 value={batchFilter}
 onChange={(e) => setBatchFilter(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value={ALL}>All Batches</option>
 {batchOptions.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
 </select>
 </div>

 <div>
 <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Event</label>
 <select
 value={eventFilter}
 onChange={(e) => setEventFilter(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value={ALL}>All Events</option>
 {eventOptions.map((v) => <option key={v} value={v}>{v === "school" ? "School" : "Individual"}</option>)}
 </select>
 </div>

 <div>
 <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Gender</label>
 <select
 value={genderFilter}
 onChange={(e) => setGenderFilter(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value={ALL}>All Genders</option>
 {genderOptions.map((g) => <option key={g} value={g}>{g}</option>)}
 </select>
 </div>

 <div>
 <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Belt / Stage</label>
 <select
 value={beltFilter}
 onChange={(e) => setBeltFilter(e.target.value)}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value={ALL}>All Belts / Stages</option>
 {beltOptions.map((b) => <option key={b} value={b}>{b}</option>)}
 </select>
 </div>

 <div>
 <label className="block text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Status</label>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
 className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="all">All Status</option>
 <option value="passed">Passed</option>
 <option value="failed">Failed</option>
 <option value="pending">Pending</option>
 </select>
 </div>
 </div>

 <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <button
 onClick={clearFilters}
 disabled={!filtersActive}
 className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
 >
 <RotateCcw className="w-3.5 h-3.5" />
 Clear Filters
 </button>
 <p className="text-xs text-gray-400">
 Showing {filteredResults.length} of {students.length} students
 </p>
 </div>
 </div>

 {/* ════════════════════════════════════════════════════════════════════ */}
 {/* ── RESULT TABLE — single flat table rendered from filteredResults ── */}
 {/* ════════════════════════════════════════════════════════════════════ */}
 {filteredResults.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-12 text-center">
 <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
 <p className="text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">No students match the selected filters.</p>
 {filtersActive && (
 <button
 onClick={clearFilters}
 className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
 >
 <RotateCcw className="w-3.5 h-3.5" /> Clear Filters
 </button>
 )}
 </div>
 ) : (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <StudentTable list={filteredResults} />
 </div>
 )}

 </div>
 </AdminLayout>
 );
}
