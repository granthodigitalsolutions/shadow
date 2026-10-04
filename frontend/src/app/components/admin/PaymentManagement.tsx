import { Fragment, useState, useEffect, useMemo } from "react";
import {
  CreditCard, Search, ChevronDown, ChevronRight, CheckCircle2, Clock, XCircle,
  CheckSquare, Square, RefreshCw, Users, FileText, FileSpreadsheet, AlertCircle, X, ArrowUpDown,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { firebaseStudentService, firebaseCoachService } from "../../services/firebaseData";
import { reviewAdminPayments, ReviewAction, ReviewOutcome } from "../../services/adminPaymentsApi";
import PaymentGroupModal from "./PaymentGroupModal";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";
import { useExamTransitions } from "../../hooks/useExamTransitions";
import { transitionFilterOptions } from "../../utils/examTransitions";
import {
  PaymentRow, ReportFilters, DEFAULT_FILTERS, NO_COACH, PayStatus,
  buildRows, filterRows, totalsOf, coachSummary, schoolSummary, transitionBreakdown, buildGroups,
  formatINR, statusLabel,
} from "../../utils/paymentReport";
import type { StudentRecord } from "../../types/admin";

const PAGE_SIZES = [25, 50, 100];
type SortKey = "name" | "fee" | "status" | "date";

const formatDate = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
};

function StatusBadge({ status }: { status: PayStatus }) {
  if (status === "verified") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-500/20">
        <XCircle className="w-3.5 h-3.5" /> Rejected
      </span>
    );
  }
  return (
    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-500/20">
      <Clock className="w-3.5 h-3.5" /> Pending
    </span>
  );
}

const selectCls =
  "w-full px-3 py-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white cursor-pointer";

function Card({ label, value, tone, note }: { label: string; value: string | number; tone?: string; note?: string }) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-center">
      <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${tone || "text-zinc-900 dark:text-zinc-50"}`}>{value}</p>
      <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">{label}</p>
      {note && <p className="text-[10px] text-zinc-400 mt-0.5">{note}</p>}
    </div>
  );
}

export default function PaymentManagement() {
  const { showToast } = useToast();
  const { showConfirm } = useDialog();
  const { currentProgram } = useProgram();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [coachNames, setCoachNames] = useState<Record<string, string>>({});
  const { karate: karateTransitions, silambam: silambamTransitions } = useExamTransitions();
  type Tab = "all" | "recent" | "pending" | "verified" | "rejected";
  const [tab, setTab] = useState<Tab>("all");
  const [recentDays, setRecentDays] = useState<"7" | "14" | "30" | "all">("14");
  const [groupPage, setGroupPage] = useState(0);
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [rawFilters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  // Inside the Karate or Silambam admin area, only that program is ever shown.
  const lockedProgram = currentProgram === "KARATE" || currentProgram === "SELAMBAM" ? currentProgram : null;
  const filters = useMemo<ReportFilters>(
    () => ({ ...rawFilters, program: lockedProgram ?? rawFilters.program }),
    [rawFilters, lockedProgram],
  );
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState<null | "pdf" | "xlsx">(null);

  const setFilter = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // Live student feed - a coach registering a student (or another admin
  // approving one) shows up here without a manual refresh. One listener,
  // cleaned up on unmount / program change.
  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    setSelectedIds(new Set());
    const unsubscribe = firebaseStudentService.listenAll(
      (list) => {
        setStudents(list);
        setLoading(false);
      },
      currentProgram === "ALL" ? undefined : (currentProgram as any),
      (err) => {
        console.error("Payments listener failed:", err);
        setLoadError(
          /permission/i.test(err?.message || "")
            ? "You don't have permission to view payment records."
            : "Couldn't load payment records. Check your connection and try again.",
        );
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [currentProgram, reloadKey]);

  useEffect(() => {
    firebaseCoachService
      .getAll()
      .then((coaches) =>
        setCoachNames(Object.fromEntries(coaches.map((c: any) => [c.uid || c.id, c.fullName || c.email || "Coach"]))),
      )
      .catch((err) => console.error("Failed to load coaches:", err));
  }, []);

  const allRows = useMemo(
    () => buildRows(students, coachNames, karateTransitions, silambamTransitions),
    [students, coachNames, karateTransitions, silambamTransitions],
  );

  // Dropdown options come from the data / configuration.
  const schoolOptions = useMemo(() => {
    const m = new Map<string, string>();
    allRows.forEach((r) => m.set(r.schoolKey, r.school));
    return [...m.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows]);

  const coachOptions = useMemo(() => {
    const m = new Map<string, string>();
    allRows.forEach((r) => {
      if (r.coachId && (filters.school === "all" || r.schoolKey === filters.school)) m.set(r.coachId, r.coach);
    });
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows, filters.school]);

  // Complete "from -> to" transitions from the Admin fee configuration.
  const transitionOptions = useMemo(
    () => transitionFilterOptions(filters.program, karateTransitions, silambamTransitions),
    [karateTransitions, silambamTransitions, filters.program],
  );

  // One filtered dataset drives the cards, tables, breakdowns and exports.
  const filtered = useMemo(() => filterRows(allRows, filters), [allRows, filters]);

  // "Recent" shows coach registration groups registered within the chosen window;
  // every figure on the page (cards, summaries, exports) then follows that same set.
  const recentGroups = useMemo(() => {
    const groups = buildGroups(filtered);
    if (recentDays === "all") return groups;
    const cutoff = Date.now() - Number(recentDays) * 86400000;
    return groups.filter((g) => Date.parse(g.registeredAt) >= cutoff);
  }, [filtered, recentDays]);
  const scopedRows = useMemo(
    () => (tab === "recent" ? recentGroups.flatMap((g) => g.rows) : filtered),
    [tab, recentGroups, filtered],
  );
  const totals = useMemo(() => totalsOf(scopedRows), [scopedRows]);
  const coachRows = useMemo(() => coachSummary(scopedRows), [scopedRows]);
  const schoolRows = useMemo(() => schoolSummary(scopedRows), [scopedRows]);
  const breakdown = useMemo(() => transitionBreakdown(scopedRows), [scopedRows]);
  const GROUP_PAGE = 8;
  const groupPageCount = Math.max(1, Math.ceil(recentGroups.length / GROUP_PAGE));
  const visibleGroups = recentGroups.slice(groupPage * GROUP_PAGE, (groupPage + 1) * GROUP_PAGE);
  const openGroup = openGroupKey ? recentGroups.find((g) => g.key === openGroupKey) || null : null;
  const statusCounts = useMemo(() => {
    const base = filterRows(allRows, { ...filters, status: "all" });
    return {
      all: base.length,
      pending: base.filter((r) => r.status === "pending").length,
      verified: base.filter((r) => r.status === "verified").length,
      rejected: base.filter((r) => r.status === "rejected").length,
    };
  }, [allRows, filters]);

  const isFiltered = JSON.stringify(filters) !== JSON.stringify({ ...DEFAULT_FILTERS, program: lockedProgram ?? "all" }) || tab === "recent";

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: PaymentRow): string | number =>
      sortKey === "name" ? r.name.toLowerCase() : sortKey === "fee" ? r.fee ?? -1 : sortKey === "status" ? r.status : r.paymentDate;
    return [...scopedRows].sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * dir);
  }, [scopedRows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => { setPage(0); setSelectedIds(new Set()); setGroupPage(0); }, [filters, pageSize, tab, recentDays]);
  useEffect(() => { if (page > pageCount - 1) setPage(pageCount - 1); }, [page, pageCount]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  const pendingInView = useMemo(() => scopedRows.filter((r) => r.status === "pending"), [scopedRows]);
  const allPendingSelected = pendingInView.length > 0 && pendingInView.every((r) => selectedIds.has(r.id));
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(allPendingSelected ? new Set() : new Set(pendingInView.map((r) => r.id)));

  // Backend review: verifies the caller is an admin, re-checks each student's
  // payment state in a transaction, writes an audit entry and reports every
  // student's outcome. The live listener then refreshes all totals from the
  // saved records - nothing is updated optimistically on screen.
  const reviewViaBackend = async (action: ReviewAction, ids: string[], requestId: string, reason?: string): Promise<ReviewOutcome> => {
    setBusyIds((prev) => new Set([...prev, ...ids]));
    try {
      const outcome = await reviewAdminPayments(action, ids, requestId, reason);
      const verb = action === "confirm" ? "confirmed" : "rejected";
      if (outcome.counts.updated > 0) showToast(`${outcome.counts.updated} payment${outcome.counts.updated > 1 ? "s" : ""} ${verb}`, "success");
      if (outcome.counts.failed > 0) showToast(`${outcome.counts.failed} payment${outcome.counts.failed > 1 ? "s" : ""} could not be updated`, "error");
      return outcome;
    } finally {
      setBusyIds((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
      setSelectedIds((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
    }
  };

  const approvePayments = async (ids: string[]): Promise<boolean> => {
    if (ids.length === 0) return true;
    try {
      const outcome = await reviewViaBackend("confirm", ids, crypto.randomUUID());
      return outcome.counts.failed === 0;
    } catch (e: any) {
      showToast(e?.message || "Could not approve the payment", "error");
      return false;
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    const ok = await showConfirm({
      title: "Confirm Selected Students?",
      message: `This will mark ${selectedIds.size} student(s) as Confirmed and eligible for batch assignment.`,
      confirmText: "Confirm All",
      variant: "success",
    });
    if (!ok) return;
    setBulkBusy(true);
    await approvePayments(Array.from(selectedIds));
    setBulkBusy(false);
  };

  // -- Export (exactly the filtered rows on screen) ---------------------------
  const exportContext = () => {
    const school = filters.school !== "all" ? schoolOptions.find((s) => s.key === filters.school)?.name : undefined;
    const coach = filters.coach === NO_COACH ? "Individual" : filters.coach !== "all" ? coachNames[filters.coach] || "Coach" : undefined;
    const trans = filters.transition !== "all" ? transitionOptions.find((t) => t.key === filters.transition)?.label : undefined;
    const lines = [
      school && `School: ${school}`,
      coach && `Coach: ${coach}`,
      filters.program !== "all" && `Exam: ${filters.program === "KARATE" ? "Karate" : "Silambam"}`,
      trans && `Belt/Stage: ${trans}`,
      filters.status !== "all" && `Payment status: ${statusLabel(filters.status)}`,
      tab === "recent" && `Recent registration groups: ${recentDays === "all" ? "all" : `last ${recentDays} days`}`,
      (filters.dateFrom || filters.dateTo) && `Registered: ${filters.dateFrom || "…"} to ${filters.dateTo || "…"}`,
      filters.search.trim() && `Search: "${filters.search.trim()}"`,
    ].filter(Boolean) as string[];
    const dateRange = filters.dateFrom || filters.dateTo ? `${filters.dateFrom || "any"} to ${filters.dateTo || "any"}` : "All";
    const filterItems: [string, string][] = [
      ["School", school || "All"],
      ["Coach", coach || "All"],
      ["Exam Type", filters.program === "all" ? "Karate & Silambam" : filters.program === "KARATE" ? "Karate" : "Silambam"],
      ["Belt / Stage Transition", trans || "All"],
      ["Payment Status", filters.status === "all" ? "All" : statusLabel(filters.status)],
      ["Registration Date", dateRange],
    ];
    const transitionOrder = [...karateTransitions, ...silambamTransitions].map((t) => t.id);
    return { rows: sorted, filters, filterLines: lines, filterItems, transitionOrder, schoolName: school, coachName: coach };
  };

  const runExport = async (kind: "pdf" | "xlsx") => {
    if (exporting || sorted.length === 0) return;
    setExporting(kind);
    try {
      const mod = await import("../../utils/paymentReportExport");
      const name = kind === "pdf" ? await mod.exportPaymentPdf(exportContext()) : await mod.exportPaymentExcel(exportContext());
      showToast(`${name} downloaded`, "success");
    } catch (err) {
      console.error(`Payment ${kind} export failed:`, err);
      showToast(`Couldn't generate the ${kind === "pdf" ? "PDF" : "Excel"} report. Please try again.`, "error");
    } finally {
      setExporting(null);
    }
  };

  const renderApproveButton = (row: PaymentRow, full?: boolean) => {
    const busy = busyIds.has(row.id);
    return (
      <button
        onClick={() => approvePayments([row.id])}
        disabled={busy}
        className={`${full ? "w-full justify-center px-3 py-2.5" : "px-3 py-1.5"} text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap`}
      >
        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        Approve
      </button>
    );
  };

  const SortTh = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`p-3 ${className}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wider font-semibold hover:text-zinc-800 dark:hover:text-zinc-200">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortKey === k ? "text-blue-500" : "opacity-40"}`} />
      </button>
    </th>
  );

  const showBreakdown = filters.coach !== "all" || filters.school !== "all";
  const feeCell = (r: PaymentRow) => (r.fee === null ? <span className="text-amber-600" title="No fee stored for this registration">N/A</span> : formatINR(r.fee));

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header + summary cards (all figures follow the active filters) */}
        <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  PAYMENT MANAGEMENT
                </h2>
                <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">
                  {isFiltered ? "Showing filtered records" : "All registrations"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => runExport("pdf")}
                disabled={!!exporting || loading || sorted.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {exporting === "pdf" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Export PDF
              </button>
              <button
                onClick={() => runExport("xlsx")}
                disabled={!!exporting || loading || sorted.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {exporting === "xlsx" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Export Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Card label="Registered Students" value={loading ? "…" : totals.students} />
            <Card label="Total Amount" value={loading ? "…" : formatINR(totals.totalAmount)} />
            <Card label="Paid Amount" value={loading ? "…" : formatINR(totals.paidAmount)} tone="text-emerald-600 dark:text-emerald-400" note="confirmed payments" />
            <Card label="Pending Amount" value={loading ? "…" : formatINR(totals.pendingAmount)} tone="text-blue-500" note={totals.rejectedAmount ? `incl. ${formatINR(totals.rejectedAmount)} rejected` : "unpaid balance"} />
            <Card label="Confirmed Payments" value={loading ? "…" : totals.confirmedCount} tone="text-emerald-600 dark:text-emerald-400" />
            <Card label="Pending Payments" value={loading ? "…" : totals.pendingCount} tone="text-blue-500" note={totals.rejectedCount ? `${totals.rejectedCount} rejected` : undefined} />
          </div>
          {!loading && totals.missingFee > 0 && (
            <p className="mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {totals.missingFee} registration{totals.missingFee > 1 ? "s have" : " has"} no stored fee - counted as students but not in any amount.
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 overflow-x-auto max-w-full">
              {([
                { key: "all", label: "All", count: statusCounts.all },
                { key: "recent", label: "Recent", count: recentGroups.length, unit: "groups" },
                { key: "pending", label: "Pending", count: statusCounts.pending },
                { key: "verified", label: "Confirmed / Paid", count: statusCounts.verified },
                { key: "rejected", label: "Rejected", count: statusCounts.rejected },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); setFilter("status", t.key === "all" || t.key === "recent" ? "all" : t.key); }}
                  className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    tab === t.key
                      ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-[220px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search student name, registration ID or reference..."
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-900 dark:text-white placeholder-zinc-400"
              />
            </div>

            {isFiltered && (
              <button
                onClick={() => { setFilters(DEFAULT_FILTERS); setTab("all"); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select value={filters.school} onChange={(e) => setFilters((f) => ({ ...f, school: e.target.value, coach: "all" }))} className={selectCls} aria-label="School">
              <option value="all">All Schools</option>
              {schoolOptions.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
            <select value={filters.coach} onChange={(e) => setFilter("coach", e.target.value)} className={selectCls} aria-label="Coach">
              <option value="all">All Coaches</option>
              {coachOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NO_COACH}>No coach (individual)</option>
            </select>
            {!lockedProgram && (
            <select value={filters.program} onChange={(e) => setFilters((f) => ({ ...f, program: e.target.value as any, transition: "all" }))} className={selectCls} aria-label="Exam type">
              <option value="all">Karate &amp; Silambam</option>
              <option value="KARATE">Karate</option>
              <option value="SELAMBAM">Silambam</option>
            </select>
            )}
            <select value={filters.transition} onChange={(e) => setFilter("transition", e.target.value)} className={selectCls} aria-label="Belt or stage transition">
              <option value="all">All Belt / Stage Transitions</option>
              {transitionOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Registered from
              <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(e) => setFilter("dateFrom", e.target.value)} className={selectCls} />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              to
              <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setFilter("dateTo", e.target.value)} className={selectCls} />
            </label>
            {tab === "recent" && (
              <select value={recentDays} onChange={(e) => setRecentDays(e.target.value as any)} className={selectCls} aria-label="Recent window">
                <option value="7">Registered in the last 7 days</option>
                <option value="14">Registered in the last 14 days</option>
                <option value="30">Registered in the last 30 days</option>
                <option value="all">All registration groups</option>
              </select>
            )}
          </div>
        </div>

        {loadError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{loadError}</p>
            <button onClick={() => setReloadKey((k) => k + 1)} className="px-3 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg">Retry</button>
          </div>
        )}

        {/* Selected coach / school breakdown */}
        {showBreakdown && !loading && filtered.length > 0 && (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 space-y-3">
            <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
              {filters.coach !== "all" && filters.coach !== NO_COACH ? coachNames[filters.coach] || "Coach" : filters.school !== "all" ? schoolOptions.find((s) => s.key === filters.school)?.name : "Selection"} — breakdown
            </h3>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">Karate: {totals.karate}</span>
              <span className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">Silambam: {totals.silambam}</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Confirmed: {totals.confirmedCount}</span>
              <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400">Pending: {totals.pendingCount}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr><th className="py-2 pr-3">Belt / Stage</th><th className="py-2 pr-3 text-right">Students</th><th className="py-2 pr-3 text-right">Fees</th><th className="py-2 pr-3 text-right">Paid</th><th className="py-2 text-right">Pending</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {breakdown.map((b) => (
                    <tr key={b.key} className="text-zinc-800 dark:text-zinc-200">
                      <td className="py-1.5 pr-3">{b.label}</td>
                      <td className="py-1.5 pr-3 text-right">{b.count}</td>
                      <td className="py-1.5 pr-3 text-right">{formatINR(b.fee)}</td>
                      <td className="py-1.5 pr-3 text-right">{formatINR(b.paid)}</td>
                      <td className="py-1.5 text-right">{formatINR(b.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Coach-wise and school-wise summaries */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
              <h3 className="p-4 font-bold text-zinc-900 dark:text-zinc-50 border-b border-zinc-100 dark:border-zinc-800">Coach-wise Summary</h3>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sticky top-0">
                    <tr><th className="p-3">Coach</th><th className="p-3">School</th><th className="p-3 text-right">Students</th><th className="p-3 text-right">Fees</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Pending</th><th className="p-3"></th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {coachRows.map((c) => (
                      <tr key={`${c.coachId}|${c.schoolKey}`}>
                        <td className="p-3 font-semibold whitespace-nowrap">{c.coach}</td>
                        <td className="p-3">{c.school}</td>
                        <td className="p-3 text-right">{c.students}</td>
                        <td className="p-3 text-right whitespace-nowrap">{formatINR(c.totalAmount)}</td>
                        <td className="p-3 text-right whitespace-nowrap">{formatINR(c.paidAmount)}</td>
                        <td className="p-3 text-right whitespace-nowrap">{formatINR(c.pendingAmount)}</td>
                        <td className="p-3 text-right">
                          {c.coachId && (
                            <button
                              onClick={() => { setFilters((f) => ({ ...f, school: c.schoolKey, coach: c.coachId, status: "all" })); setTab("recent"); setRecentDays("all"); }}
                              className="px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg whitespace-nowrap"
                            >
                              Registration groups
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold bg-zinc-50 dark:bg-zinc-900/50">
                      <td className="p-3" colSpan={2}>Total</td>
                      <td className="p-3 text-right">{totals.students}</td>
                      <td className="p-3 text-right whitespace-nowrap">{formatINR(totals.totalAmount)}</td>
                      <td className="p-3 text-right whitespace-nowrap">{formatINR(totals.paidAmount)}</td>
                      <td className="p-3 text-right whitespace-nowrap">{formatINR(totals.pendingAmount)}</td>
                      <td className="p-3"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
              <h3 className="p-4 font-bold text-zinc-900 dark:text-zinc-50 border-b border-zinc-100 dark:border-zinc-800">School-wise Summary</h3>
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sticky top-0">
                    <tr><th className="p-3">School</th><th className="p-3 text-right">Coaches</th><th className="p-3 text-right">Students</th><th className="p-3 text-right">Fees</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Pending</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {schoolRows.map((s) => {
                      const open = expandedSchools.has(s.schoolKey);
                      return (
                        <Fragment key={s.schoolKey}>
                          <tr className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40" onClick={() => setExpandedSchools((p) => { const n = new Set(p); n.has(s.schoolKey) ? n.delete(s.schoolKey) : n.add(s.schoolKey); return n; })}>
                            <td className="p-3 font-semibold"><span className="inline-flex items-center gap-1">{open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{s.school}</span></td>
                            <td className="p-3 text-right">{s.coaches}</td>
                            <td className="p-3 text-right">{s.students}</td>
                            <td className="p-3 text-right whitespace-nowrap">{formatINR(s.totalAmount)}</td>
                            <td className="p-3 text-right whitespace-nowrap">{formatINR(s.paidAmount)}</td>
                            <td className="p-3 text-right whitespace-nowrap">{formatINR(s.pendingAmount)}</td>
                          </tr>
                          {open && s.coachRows.map((c) => (
                            <tr key={`${s.schoolKey}-${c.coachId}`} className="bg-zinc-50/70 dark:bg-zinc-900/30 text-xs">
                              <td className="p-2 pl-9">{c.coach}</td>
                              <td className="p-2"></td>
                              <td className="p-2 text-right">{c.students}</td>
                              <td className="p-2 text-right whitespace-nowrap">{formatINR(c.totalAmount)}</td>
                              <td className="p-2 text-right whitespace-nowrap">{formatINR(c.paidAmount)}</td>
                              <td className="p-2 text-right whitespace-nowrap">{formatINR(c.pendingAmount)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Recent: one card per coach registration group */}
        {tab === "recent" && (
          <div className="space-y-4">
            {loading ? (
              <div className="py-16 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : recentGroups.length === 0 ? (
              <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-zinc-400">
                No coach registration groups match the current filters{recentDays !== "all" ? ` in the last ${recentDays} days` : ""}.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {visibleGroups.map((g) => (
                    <article key={g.key} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
                      <header>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{g.coach} — {g.school}</h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          Registered {formatDate(g.registeredAt)}
                          {g.groupId ? ` · Group ${g.groupId.slice(0, 8)}` : " · grouped by registration time (older record)"}
                        </p>
                      </header>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        {[
                          ["Students", g.students, "text-zinc-900 dark:text-white"],
                          ["Pending", g.pendingCount, "text-blue-600 dark:text-blue-400"],
                          ["Confirmed", g.confirmedCount, "text-emerald-600 dark:text-emerald-400"],
                          ["Rejected", g.rejectedCount, "text-red-600 dark:text-red-400"],
                        ].map(([label, v, tone]) => (
                          <div key={label as string} className="rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-2.5">
                            <p className={`text-2xl font-bold ${tone}`}>{v}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
                          </div>
                        ))}
                      </div>
                      <dl className="grid grid-cols-3 gap-2 text-sm">
                        <div><dt className="text-[11px] uppercase tracking-wider text-zinc-500">Total fees</dt><dd className="font-bold text-zinc-900 dark:text-white">{formatINR(g.totalAmount)}</dd></div>
                        <div><dt className="text-[11px] uppercase tracking-wider text-zinc-500">Paid</dt><dd className="font-bold text-emerald-600 dark:text-emerald-400">{formatINR(g.paidAmount)}</dd></div>
                        <div><dt className="text-[11px] uppercase tracking-wider text-zinc-500">Pending</dt><dd className="font-bold text-blue-600 dark:text-blue-400">{formatINR(g.pendingAmount)}</dd></div>
                      </dl>
                      <button
                        onClick={() => setOpenGroupKey(g.key)}
                        className="self-start inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                      >
                        <Users className="w-4 h-4" /> View Students{g.eligibleIds.length ? ` (${g.eligibleIds.length} to confirm)` : ""}
                      </button>
                    </article>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  <span>{recentGroups.length} group{recentGroups.length === 1 ? "" : "s"}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setGroupPage((p) => Math.max(0, p - 1))} disabled={groupPage === 0} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg disabled:opacity-40">Prev</button>
                    <span>Page {groupPage + 1} / {groupPageCount}</span>
                    <button onClick={() => setGroupPage((p) => Math.min(groupPageCount - 1, p + 1))} disabled={groupPage >= groupPageCount - 1} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg disabled:opacity-40">Next</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {openGroup && (
          <PaymentGroupModal group={openGroup} onReview={reviewViaBackend} onClose={() => setOpenGroupKey(null)} />
        )}

        {/* Payment details */}
        {tab !== "recent" && (
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          {pendingInView.length > 0 && (
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                {allPendingSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Select All Pending ({pendingInView.length})
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={selectedIds.size === 0 || bulkBusy}
                className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-zinc-950 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {bulkBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approve Selected ({selectedIds.size})
              </button>
            </div>
          )}

          {loading ? (
            <div className="py-16 flex justify-center"><RefreshCw className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : sorted.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              {allRows.length === 0 ? "No registrations yet." : "No registrations match your filters."}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                      <th className="p-3 w-10"></th>
                      <SortTh k="name">Student</SortTh>
                      <th className="p-3 uppercase tracking-wider font-semibold">School / Coach</th>
                      <th className="p-3 uppercase tracking-wider font-semibold">Exam / Belt</th>
                      <SortTh k="fee" className="text-right">Fee</SortTh>
                      <th className="p-3 uppercase tracking-wider font-semibold text-right">Paid</th>
                      <th className="p-3 uppercase tracking-wider font-semibold text-right">Balance</th>
                      <SortTh k="status">Status</SortTh>
                      <SortTh k="date">Paid On / Ref</SortTh>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {visible.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors text-zinc-800 dark:text-zinc-200">
                        <td className="p-3">
                          {r.status === "pending" && (
                            <button onClick={() => toggleSelect(r.id)} className="text-zinc-400 hover:text-blue-500">
                              {selectedIds.has(r.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-zinc-900 dark:text-white">{r.name}</div>
                          <div className="text-xs text-zinc-500 font-mono">{r.id}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold">{r.school}</div>
                          <div className="text-xs text-zinc-500">{r.coach}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold">{r.program === "KARATE" ? "Karate" : "Silambam"} · {r.transitionLabel}</div>
                          <div className="text-xs text-zinc-500">Current: {r.currentLevel}</div>
                        </td>
                        <td className="p-3 text-right whitespace-nowrap">{feeCell(r)}</td>
                        <td className="p-3 text-right whitespace-nowrap">{formatINR(r.paid)}</td>
                        <td className="p-3 text-right whitespace-nowrap">{formatINR(r.balance)}</td>
                        <td className="p-3"><StatusBadge status={r.status} /></td>
                        <td className="p-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          <div>{formatDate(r.paymentDate)}</div>
                          {(r.method || r.reference) && <div className="text-xs text-zinc-500">{[r.method, r.reference].filter(Boolean).join(" · ")}</div>}
                        </td>
                        <td className="p-3 text-right">{r.status === "pending" && renderApproveButton(r)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {visible.map((r) => (
                  <div key={r.id} className="p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {r.status === "pending" && (
                          <button onClick={() => toggleSelect(r.id)} className="text-zinc-400 hover:text-blue-500 mt-0.5 shrink-0">
                            {selectedIds.has(r.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                          </button>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900 dark:text-white truncate">{r.name}</div>
                          <div className="text-xs text-zinc-500 font-mono truncate">{r.id}</div>
                        </div>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="text-sm space-y-1.5 text-zinc-700 dark:text-zinc-300">
                      <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400"><Users className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{r.coach} · {r.school}</span></div>
                      <div>{r.program === "KARATE" ? "Karate" : "Silambam"} · {r.transitionLabel}</div>
                      <div className="flex justify-between"><span>Fee</span><span className="font-semibold">{feeCell(r)}</span></div>
                      <div className="flex justify-between"><span>Paid</span><span className="font-semibold">{formatINR(r.paid)}</span></div>
                      <div className="flex justify-between"><span>Balance</span><span className="font-semibold">{formatINR(r.balance)}</span></div>
                      <div className="text-xs text-zinc-500">{formatDate(r.paymentDate)}{(r.method || r.reference) && ` · ${[r.method, r.reference].filter(Boolean).join(" · ")}`}</div>
                    </div>
                    {r.status === "pending" && renderApproveButton(r, true)}
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                <span>
                  {page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length}
                </span>
                <div className="flex items-center gap-2">
                  <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg" aria-label="Rows per page">
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
        )}
      </div>
    </AdminLayout>
  );
}
