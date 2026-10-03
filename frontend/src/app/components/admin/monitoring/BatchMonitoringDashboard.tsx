import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Layers, Users, PlayCircle, CheckCircle, Clock, Search, AlertCircle, Eye, RefreshCw, Calendar,
  ArrowUpDown, X, Hash, ExternalLink,
} from "lucide-react";
import {
  firebaseBatchService, firebaseBeltTestService, firebaseSchoolService, firebaseStudentService,
  firebaseFeeStructureService, firebaseSilambanFeeService,
} from "../../../services/firebaseData";
import { Batch, BeltTest, School, StudentRecord } from "../../../types/admin";
import { useProgram } from "../../../contexts/ProgramContext";
import { formatBatchName } from "../../../utils/batchFormatters";
import { buildKarateTransitions, buildSilambamTransitions } from "../../../utils/examTransitions";
import {
  BatchRow, BatchFilters, DEFAULT_BATCH_FILTERS, deriveBatchRow, totalsOfBatches, filterBatchRows, ExamState,
} from "../../../utils/batchMonitoring";
import { getGrade } from "../../../constants/scoring";
import { useToast } from "../../../hooks/useToast";
import AdminLayout from "../AdminLayout";

const PAGE_SIZES = [10, 25, 50];
type SortKey = "created" | "examDate" | "status";
const STATE_ORDER: Record<ExamState, number> = { in_progress: 0, pending: 1, completed: 2 };

const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

export default function BatchMonitoringDashboard() {
  const { currentProgram } = useProgram();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [tests, setTests] = useState<BeltTest[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [karateFees, setKarateFees] = useState<any[]>([]);
  const [silambamFees, setSilambamFees] = useState<any[]>([]);

  const [filters, setFilters] = useState<BatchFilters>(DEFAULT_BATCH_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<BatchRow | null>(null);

  const programFilter = currentProgram === "ALL" ? undefined : (currentProgram as "KARATE" | "SELAMBAM");

  // Real-time: ONE listener each for batches and students (batch capacity,
  // allocations, assignments and exam results all change these documents).
  // Both are torn down on unmount / program change - no polling.
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    let batchesReady = false;
    let studentsReady = false;
    const ready = () => { if (batchesReady && studentsReady) setLoading(false); };
    const onError = (err: Error) => {
      console.error("Batch monitoring listener failed:", err);
      setLoadError(
        /permission/i.test(err?.message || "")
          ? "You don't have permission to view batch data."
          : "Live updates failed. Check your connection and retry.",
      );
      setLoading(false);
    };
    const unsubBatches = firebaseBatchService.listenAll((list) => { setBatches(list); batchesReady = true; ready(); }, programFilter, onError);
    const unsubStudents = firebaseStudentService.listenAll((list) => { setStudents(list); studentsReady = true; ready(); }, programFilter, onError);
    return () => { unsubBatches(); unsubStudents(); };
  }, [programFilter, reloadKey]);

  // Slow-changing reference data: loaded once (and on manual refresh).
  useEffect(() => {
    Promise.all([
      firebaseBeltTestService.getAll(programFilter),
      firebaseSchoolService.getAll(false, programFilter),
      firebaseFeeStructureService.getAll(),
      firebaseSilambanFeeService.getAll(),
    ])
      .then(([t, s, k, sl]) => { setTests(t); setSchools(s); setKarateFees(k); setSilambamFees(sl); })
      .catch((err) => { console.error("Reference data failed:", err); showToast("Some reference data (schools / tests) failed to load", "error"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programFilter, reloadKey]);

  const allRows = useMemo<BatchRow[]>(() => {
    const studentsById = new Map(students.map((s) => [s.id, s]));
    const testsById = new Map(tests.map((t) => [t.id, t]));
    const schoolsById = new Map(schools.map((s) => [s.id, s]));
    const kT = buildKarateTransitions(karateFees);
    const sT = buildSilambamTransitions(silambamFees);
    return batches.map((b) => deriveBatchRow(b, studentsById, testsById, schoolsById, kT, sT, formatBatchName));
  }, [batches, students, tests, schools, karateFees, silambamFees]);

  const schoolOptions = useMemo(() => {
    const m = new Map<string, string>();
    allRows.forEach((r) => m.set(r.schoolKey, r.schoolName));
    return [...m.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows]);

  const beltOptions = useMemo(() => {
    const m = new Map<string, string>();
    allRows.forEach((r) => {
      if (filters.program === "all" || r.program === filters.program) {
        m.set(r.beltKey, `${r.program === "KARATE" ? "Karate" : "Silambam"}: ${r.beltLabel}`);
      }
    });
    return [...m.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows, filters.program]);

  // Summary cards and table share this one filtered dataset.
  const filtered = useMemo(() => filterBatchRows(allRows, filters), [allRows, filters]);
  const totals = useMemo(() => totalsOfBatches(filtered), [filtered]);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_BATCH_FILTERS);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const key = (r: BatchRow): string | number =>
      sortKey === "created" ? r.createdAt : sortKey === "examDate" ? r.examDate : STATE_ORDER[r.examState];
    return [...filtered].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * dir);
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);
  useEffect(() => { setPage(0); }, [filters, pageSize]);
  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1); }, [page, pageCount]);

  // Keep an open detail modal live as the underlying batch changes.
  const selectedLive = selected ? allRows.find((r) => r.id === selected.id) || null : null;

  const setFilter = <K extends keyof BatchFilters>(k: K, v: BatchFilters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "status" ? "asc" : "desc"); }
  };

  const selectCls = "w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-white cursor-pointer";

  const SortTh = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="px-3 py-3 font-semibold">
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200">
        {children}<ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-blue-500" : "opacity-40"}`} />
      </button>
    </th>
  );

  if (loading && batches.length === 0 && !loadError) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-500 font-medium">Loading batches...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              BATCHES — LIVE MONITORING
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Live slots, assignments and exam progress for every batch. Updates automatically.
            </p>
          </div>
          <button onClick={() => setReloadKey((k) => k + 1)} className="p-2.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="Reconnect / refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {loadError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{loadError}</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg">Retry</button>
          </div>
        )}

        {/* Summary cards - computed from the same filtered rows as the table */}
        <div>
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
            {isFiltered ? "Counts reflect the filters below." : "Counts cover all batches."}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard title="Total Batches" value={totals.batches} icon={<Layers />} tone="text-zinc-800 dark:text-zinc-100" />
            <KpiCard title="Total Slots" value={totals.totalSlots} icon={<Hash />} tone="text-zinc-800 dark:text-zinc-100" note="configured capacity" />
            <KpiCard title="Assigned Students" value={totals.assignedStudents} icon={<Users />} tone="text-blue-600" note="unique students in batches" />
            <KpiCard
              title="Available Slots" value={totals.availablePool} icon={<AlertCircle />} tone="text-orange-600"
              note={`pool not yet reserved · ${totals.unfilledAllocated} reserved, unfilled`}
            />
            <KpiCard title="Pending Batches" value={totals.pending} icon={<Clock />} tone="text-yellow-600" note="exam not started" />
            <KpiCard title="In Progress" value={totals.inProgress} icon={<PlayCircle />} tone="text-indigo-600" />
            <KpiCard title="Completed" value={totals.completed} icon={<CheckCircle />} tone="text-green-600" />
            <KpiCard title="Referee Assigned" value={totals.refereeAssigned} icon={<Users />} tone="text-blue-600" note="overlaps the status cards" />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text" placeholder="Search by batch ID, name or code..." value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            {isFiltered && (
              <button onClick={() => setFilters(DEFAULT_BATCH_FILTERS)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700">
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select aria-label="School" value={filters.school} onChange={(e) => setFilter("school", e.target.value)} className={selectCls}>
              <option value="all">All Schools</option>
              {schoolOptions.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
            <select aria-label="Exam type" value={filters.program} onChange={(e) => setFilters((f) => ({ ...f, program: e.target.value as any, belt: "all" }))} className={selectCls}>
              <option value="all">Karate &amp; Silambam</option>
              <option value="KARATE">Karate</option>
              <option value="SELAMBAM">Silambam</option>
            </select>
            <select aria-label="Belt, stage or transition" value={filters.belt} onChange={(e) => setFilter("belt", e.target.value)} className={selectCls}>
              <option value="all">All Belts / Stages</option>
              {beltOptions.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
            </select>
            <select aria-label="Batch status" value={filters.status} onChange={(e) => setFilter("status", e.target.value as any)} className={selectCls}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned (referee)</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <input aria-label="Examination date" type="date" value={filters.examDate} onChange={(e) => setFilter("examDate", e.target.value)} className={selectCls} />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {sorted.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              {allRows.length === 0 ? "No batches have been created yet." : "No batches match the current filters."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Batch</th>
                      <th className="px-3 py-3 font-semibold">School</th>
                      <th className="px-3 py-3 font-semibold">Exam / Belt</th>
                      <th className="px-3 py-3 font-semibold text-right">Capacity</th>
                      <th className="px-3 py-3 font-semibold text-right">Allocated</th>
                      <th className="px-3 py-3 font-semibold text-right">Assigned</th>
                      <th className="px-3 py-3 font-semibold text-right">Remaining</th>
                      <th className="px-3 py-3 font-semibold text-center">Progress</th>
                      <SortTh k="status">Status</SortTh>
                      <SortTh k="created">Created</SortTh>
                      <SortTh k="examDate">Exam Date</SortTh>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 text-zinc-800 dark:text-zinc-200">
                    {visible.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-3 py-3">
                          <div className="font-bold text-zinc-900 dark:text-white">{r.name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono">{r.id}</div>
                        </td>
                        <td className="px-3 py-3">{r.schoolName}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{r.program === "KARATE" ? "Karate" : "Silambam"}</div>
                          <div className="text-xs text-zinc-500">{r.beltLabel}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">{r.capacity}</td>
                        <td className="px-3 py-3 text-right">{r.allocated}</td>
                        <td className="px-3 py-3 text-right">{r.assigned}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="font-semibold">{r.availablePool}</div>
                          <div className="text-[11px] text-zinc-500">{r.unfilledAllocated} reserved, unfilled</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-bold">{r.scored} / {r.assigned} scored</span>
                          <div className="w-20 h-1.5 mx-auto bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full rounded-full ${r.progressPct === 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${r.progressPct}%` }} />
                          </div>
                        </td>
                        <td className="px-3 py-3"><StateBadge state={r.examState} /></td>
                        <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{fmtDate(r.createdAt)}</td>
                        <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{r.examDate ? fmtDate(r.examDate) : "—"}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <button onClick={() => setSelected(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="View details" aria-label={`View ${r.name}`}>
                              <Eye className="w-4 h-4" />
                            </button>
                            <Link
                              to={`/admin/${r.program === "SELAMBAM" ? "selambam" : "karate"}/${r.batch.schoolId === "individual" ? "individual-batches" : `schools/${r.batch.schoolId}/batches`}`}
                              className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg" title="Manage batch" aria-label={`Manage ${r.name}`}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                <span>{page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length}</span>
                <div className="flex items-center gap-2">
                  <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Rows per page" className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg">
                    {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
                  </select>
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg disabled:opacity-40">Prev</button>
                  <span>Page {page + 1} / {pageCount}</span>
                  <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg disabled:opacity-40">Next</button>
                </div>
              </div>
            </>
          )}
        </div>

        {selectedLive && (
          <BatchDetailModal row={selectedLive} students={students} onClose={() => setSelected(null)} />
        )}
      </div>
    </AdminLayout>
  );
}

// --- Helper Components ---

function KpiCard({ title, value, icon, tone, note }: { title: string; value: number | string; icon: React.ReactElement; tone: string; note?: string }) {
  return (
    <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{title}</span>
        <div className={`${tone} opacity-80`}>{React.cloneElement(icon as React.ReactElement<any>, { className: "w-5 h-5" })}</div>
      </div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      {note && <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{note}</div>}
    </div>
  );
}

function StateBadge({ state }: { state: ExamState }) {
  if (state === "in_progress") return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>In Progress</span>;
  if (state === "completed") return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</span>;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Pending</span>;
}

function BatchDetailModal({ row, students, onClose }: { row: BatchRow; students: StudentRecord[]; onClose: () => void }) {
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const list = row.studentIds.map((id) => byId.get(id)).filter(Boolean) as StudentRecord[];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white uppercase" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "1px" }}>{row.name}</h2>
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{row.program === "KARATE" ? "Karate" : "Silambam"}</span>
              <span>•</span><span>{row.beltLabel}</span><span>•</span><span>{row.schoolName}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StateBadge state={row.examState} />
            <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            {[
              ["Capacity", row.capacity], ["Allocated", row.allocated], ["Assigned", row.assigned],
              ["Unfilled allocated", row.unfilledAllocated], ["Available pool", row.availablePool],
            ].map(([label, v]) => (
              <div key={label as string} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-3">
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{v}</div>
                <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300"><Calendar className="w-4 h-4" /> Exam date: {row.examDate ? fmtDate(row.examDate) : "—"} · Created {fmtDate(row.createdAt)}</div>

          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-3">Candidate Progress ({row.scored} / {row.assigned} scored)</h3>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">Student Name</th>
                    <th className="px-4 py-2 font-semibold text-center">Status</th>
                    <th className="px-4 py-2 font-semibold text-center">Score</th>
                    <th className="px-4 py-2 font-semibold text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50 text-zinc-800 dark:text-zinc-200">
                  {list.map((student, idx) => {
                    const done = student.testStatus && student.testStatus !== "pending";
                    return (
                      <tr key={student.id}>
                        <td className="px-4 py-2.5 text-zinc-500">{(idx + 1).toString().padStart(2, "0")}</td>
                        <td className="px-4 py-2.5 font-medium">{student.name}</td>
                        <td className="px-4 py-2.5 text-center">
                          {done ? <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">Completed</span>
                            : <span className="text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">Pending</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold">{student.percentage !== undefined ? `${student.percentage}%` : "—"}</td>
                        <td className="px-4 py-2.5 text-center">
                          {done && student.percentage !== undefined
                            ? <span className={`font-bold text-sm ${student.testStatus === "failed" ? "text-red-600" : "text-green-600"}`}>{getGrade(student.percentage)}</span>
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-500">No students have been assigned to this batch yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
