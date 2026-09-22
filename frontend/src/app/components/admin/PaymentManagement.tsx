import { useState, useEffect, useMemo } from "react";
import {
  CreditCard, Search, Filter, ChevronDown, CheckCircle2, Clock, XCircle,
  CheckSquare, Square, RefreshCw, Users,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import { firebaseStudentService, firebaseCoachService } from "../../services/firebaseData";
import { auth } from "../../config/firebase";
import { StudentRecord } from "../../types/admin";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";

type StatusTab = "pending" | "confirmed" | "all";

const NO_COACH = "__none__";
const PAGE_SIZE = 50;

const isConfirmed = (s: StudentRecord) => s.paymentStatus === "verified";

const formatAmount = (amount?: number) =>
  amount ? `₹${amount.toLocaleString()}` : "—";

const formatDateTime = (value: any): string => {
  if (!value) return "—";
  const d = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const beltLabel = (s: StudentRecord) =>
  `${s.programType} — ${s.beltLevel || s.stageLevel || "N/A"}`;

function StatusBadge({ student }: { student: StudentRecord }) {
  if (isConfirmed(student)) {
    return (
      <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
      </span>
    );
  }
  if (student.paymentStatus === "rejected") {
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

export default function PaymentManagement() {
  const { showToast } = useToast();
  const { showConfirm } = useDialog();
  const { currentProgram } = useProgram();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [coachNames, setCoachNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [statusTab, setStatusTab] = useState<StatusTab>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [coachFilter, setCoachFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Live student feed — a coach registering a student (or another admin
  // approving one) shows up here without a manual refresh.
  useEffect(() => {
    setLoading(true);
    setSelectedIds(new Set());
    const unsubscribe = firebaseStudentService.listenAll((list) => {
      setStudents(list);
      setLoading(false);
    }, currentProgram);
    return () => unsubscribe();
  }, [currentProgram]);

  useEffect(() => {
    firebaseCoachService
      .getAll()
      .then((coaches) => {
        setCoachNames(
          Object.fromEntries(coaches.map((c: any) => [c.uid || c.id, c.fullName || c.email || "Coach"])),
        );
      })
      .catch((err) => console.error("Failed to load coaches:", err));
  }, []);

  // A "payment request" is anything an admin still has to approve, plus the
  // coach-registered students already approved (so Confirmed shows history).
  const requests = useMemo(
    () => students.filter((s) => !isConfirmed(s) || !!s.secretaryId),
    [students],
  );

  const coachOptions = useMemo(() => {
    const ids = new Set<string>();
    requests.forEach((s) => s.secretaryId && ids.add(s.secretaryId));
    return Array.from(ids)
      .map((id) => ({ id, name: coachNames[id] || "Unknown Coach" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [requests, coachNames]);

  const coachOf = (s: StudentRecord) => (s.secretaryId ? coachNames[s.secretaryId] || "Unknown Coach" : "");

  const pending = useMemo(() => requests.filter((s) => !isConfirmed(s)), [requests]);
  const confirmed = useMemo(() => requests.filter(isConfirmed), [requests]);
  const sumAmount = (list: StudentRecord[]) => list.reduce((sum, s) => sum + (s.paymentDetails?.amount || 0), 0);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = statusTab === "pending" ? pending : statusTab === "confirmed" ? confirmed : requests;
    return base.filter((s) => {
      if (coachFilter === NO_COACH && s.secretaryId) return false;
      if (coachFilter !== "all" && coachFilter !== NO_COACH && s.secretaryId !== coachFilter) return false;
      if (!q) return true;
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.id || "").toLowerCase().includes(q) ||
        (s.school || "").toLowerCase().includes(q) ||
        coachOf(s).toLowerCase().includes(q) ||
        (s.paymentDetails?.transactionId || "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTab, pending, confirmed, requests, searchQuery, coachFilter, coachNames]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setSelectedIds(new Set());
  }, [statusTab, searchQuery, coachFilter]);

  const visible = filtered.slice(0, visibleCount);
  const filteredPending = useMemo(() => filtered.filter((s) => !isConfirmed(s)), [filtered]);
  const allPendingSelected = filteredPending.length > 0 && filteredPending.every((s) => selectedIds.has(s.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allPendingSelected ? new Set() : new Set(filteredPending.map((s) => s.id)));
  };

  // Same write the coach-detail screen (AdminSchoolDetail) performs to confirm
  // a student — paymentStatus flips to "verified" and who/when is stamped.
  // The row updates optimistically and rolls back if the write fails.
  const approvePayments = async (ids: string[]): Promise<boolean> => {
    const adminUid = auth.currentUser?.uid;
    if (!adminUid) {
      showToast("You must be signed in as an admin to approve payments", "error");
      return false;
    }
    if (ids.length === 0) return true;

    const idSet = new Set(ids);
    const previous = new Map(students.filter((s) => idSet.has(s.id)).map((s) => [s.id, s.paymentStatus]));

    setBusyIds((prev) => new Set([...prev, ...ids]));
    setStudents((prev) => prev.map((s) => (idSet.has(s.id) ? { ...s, paymentStatus: "verified" } : s)));

    const confirmedAt = new Date();
    const results = await Promise.allSettled(
      ids.map((id) =>
        firebaseStudentService.update(id, {
          paymentStatus: "verified",
          confirmedBy: adminUid,
          confirmedAt,
        } as any),
      ),
    );

    const failedIds = ids.filter((_, i) => results[i].status === "rejected");
    if (failedIds.length > 0) {
      results.forEach((r, i) => r.status === "rejected" && console.error(`Failed to approve ${ids[i]}:`, r.reason));
      const failedSet = new Set(failedIds);
      setStudents((prev) =>
        prev.map((s) => (failedSet.has(s.id) ? { ...s, paymentStatus: previous.get(s.id) ?? "pending" } : s)),
      );
    }

    setBusyIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

    const okCount = ids.length - failedIds.length;
    if (okCount > 0) {
      showToast(
        ids.length === 1
          ? `Payment approved for ${students.find((s) => s.id === ids[0])?.name || "student"}`
          : `${okCount} payment${okCount > 1 ? "s" : ""} approved`,
        "success",
      );
    }
    if (failedIds.length > 0) {
      showToast(`Failed to approve ${failedIds.length} payment${failedIds.length > 1 ? "s" : ""}`, "error");
    }
    return failedIds.length === 0;
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    const confirmedByAdmin = await showConfirm({
      title: "Confirm Selected Students?",
      message: `This will mark ${selectedIds.size} student(s) as Confirmed and eligible for batch assignment.`,
      confirmText: "Confirm All",
      variant: "success",
    });
    if (!confirmedByAdmin) return;
    setBulkBusy(true);
    await approvePayments(Array.from(selectedIds));
    setBulkBusy(false);
  };

  const renderApproveButton = (student: StudentRecord, full?: boolean) => {
    const busy = busyIds.has(student.id);
    return (
      <button
        onClick={() => approvePayments([student.id])}
        disabled={busy}
        className={`${full ? "w-full justify-center px-3 py-2.5" : "px-3.5 py-2"} text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap`}
      >
        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
        Approve Payment
      </button>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header + stats */}
        <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                PAYMENT MANAGEMENT
              </h2>
              <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Review and approve student payment requests</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-blue-500 tracking-tight">{loading ? "…" : pending.length}</p>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Pending Requests</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{loading ? "…" : `₹${sumAmount(pending).toLocaleString()}`}</p>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Pending Amount</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{loading ? "…" : confirmed.length}</p>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Confirmed</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{loading ? "…" : `₹${sumAmount(confirmed).toLocaleString()}`}</p>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Confirmed Amount</p>
            </div>
          </div>
        </div>

        {/* Filters & search */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 overflow-x-auto max-w-full">
            {([
              { key: "pending", label: "Pending", count: pending.length },
              { key: "confirmed", label: "Confirmed", count: confirmed.length },
              { key: "all", label: "All", count: requests.length },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  statusTab === tab.key
                    ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-[220px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search student, ID, school or coach..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-900 dark:text-white"
            />
          </div>

          <div className="relative">
            <select
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-gray-900 dark:text-white cursor-pointer max-w-[240px]"
            >
              <option value="all">All Coaches</option>
              {coachOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NO_COACH}>No coach (individual)</option>
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Payment requests */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          {filteredPending.length > 0 && (
            <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
              <button
                onClick={toggleSelectAll}
                className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
              >
                {allPendingSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Select All Pending ({filteredPending.length})
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
            <div className="py-16 flex justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              {statusTab === "pending" && requests.length === 0 && !searchQuery && coachFilter === "all"
                ? "No payment requests yet."
                : statusTab === "pending" && !searchQuery && coachFilter === "all"
                ? "All caught up — no pending payments."
                : `No ${statusTab === "all" ? "" : statusTab + " "}payments match your filters.`}
            </div>
          ) : (
            <>
              {/* Desktop/tablet table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Student</th>
                      <th className="p-3">Coach / School</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Requested</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {visible.map((student) => {
                      const done = isConfirmed(student);
                      const pd = student.paymentDetails;
                      return (
                        <tr key={student.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                          <td className="p-3">
                            {!done && (
                              <button onClick={() => toggleSelect(student.id)} className="text-zinc-400 hover:text-blue-500">
                                {selectedIds.has(student.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-zinc-900 dark:text-white">{(student.name || "").trim() || "Unnamed"}</div>
                            <div className="text-xs text-zinc-500 font-mono">{student.id}</div>
                            <div className="text-xs text-zinc-500">{beltLabel(student)}{student.standard ? ` · Std ${student.standard}` : ""}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">{coachOf(student) || "Individual"}</div>
                            <div className="text-xs text-zinc-500">{student.school || "—"}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">{formatAmount(pd?.amount)}</div>
                            {(pd?.method || pd?.transactionId) && (
                              <div className="text-xs text-zinc-500">{[pd?.method, pd?.transactionId].filter(Boolean).join(" · ")}</div>
                            )}
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                            <div>{formatDateTime(pd?.paymentDate || student.registeredAt)}</div>
                            {pd?.testDate && <div className="text-xs text-zinc-500">Test: {pd.testDate}{pd.testTime ? ` ${pd.testTime}` : ""}</div>}
                          </td>
                          <td className="p-3"><StatusBadge student={student} /></td>
                          <td className="p-3 text-right">{!done && renderApproveButton(student)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {visible.map((student) => {
                  const done = isConfirmed(student);
                  const pd = student.paymentDetails;
                  return (
                    <div key={student.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {!done && (
                            <button onClick={() => toggleSelect(student.id)} className="text-zinc-400 hover:text-blue-500 mt-0.5 shrink-0">
                              {selectedIds.has(student.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-900 dark:text-white truncate">{(student.name || "").trim() || "Unnamed"}</div>
                            <div className="text-xs text-zinc-500 font-mono truncate">{student.id}</div>
                          </div>
                        </div>
                        <StatusBadge student={student} />
                      </div>

                      <div className="text-sm space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 min-w-0"><Users className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{coachOf(student) || "Individual"} · {student.school || "—"}</span></span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-zinc-500 dark:text-zinc-400">{beltLabel(student)}</span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatAmount(pd?.amount)}</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatDateTime(pd?.paymentDate || student.registeredAt)}
                          {(pd?.method || pd?.transactionId) && ` · ${[pd?.method, pd?.transactionId].filter(Boolean).join(" · ")}`}
                        </div>
                      </div>

                      {!done && renderApproveButton(student, true)}
                    </div>
                  );
                })}
              </div>

              {filtered.length > visibleCount && (
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-center">
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="px-4 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Show more ({filtered.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
