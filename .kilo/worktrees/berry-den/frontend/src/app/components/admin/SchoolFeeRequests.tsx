import { useState, useEffect, useMemo } from "react";
import { CheckCircle, XCircle, RefreshCw, MessageSquare, Trash2, School, User, SlidersHorizontal, Users, DollarSign } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { firebaseSchoolFeeRequestService, firebaseStudentService } from "../../services/firebaseData";
import { useProgram } from "../../contexts/ProgramContext";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";

export default function SchoolFeeRequests() {
  const { currentProgram } = useProgram();
  const [requests, setRequests] = useState<any[]>([]);
  const [studentTotals, setStudentTotals] = useState<Record<string, { count: number; amount: number }>>({});
  const [loading, setLoading] = useState(true);
  const [adminMessages, setAdminMessages] = useState<{ [key: string]: string }>({});
  const [filter, setFilter] = useState<string>("all");
  const [schoolFilter, setSchoolFilter] = useState<string>("all");
  const [secretaryFilter, setSecretaryFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const { showToast } = useToast();
  const { showConfirm } = useDialog();

  useEffect(() => {
    fetchRequests();
  }, [currentProgram]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const [list, allStudents] = await Promise.all([
        firebaseSchoolFeeRequestService.getAll(currentProgram),
        firebaseStudentService.getAll(),
      ]);
      setRequests(list);
      const msgs: any = {};
      list.forEach((r: any) => {
        if (r.adminMessage) msgs[r.id] = r.adminMessage;
      });
      setAdminMessages(msgs);

      const totals: Record<string, { count: number; amount: number }> = {};
      allStudents.forEach((s: any) => {
        const key = `${s.schoolId}|${s.secretaryId}`;
        if (!totals[key]) totals[key] = { count: 0, amount: 0 };
        totals[key].count += 1;
        totals[key].amount += s.paymentDetails?.amount || 0;
      });
      setStudentTotals(totals);
    } catch (err) {
      console.error("Error loading requests:", err);
      showToast("Failed to fetch school fee requests", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: "approved" | "rejected") => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await firebaseSchoolFeeRequestService.updateStatus(id, status, adminMessages[id] || "");
      showToast(`Request ${status} successfully!`, "success");
      await fetchRequests();
    } catch (err) {
      console.error("Error updating status:", err);
      showToast("Error updating request status", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id: string, schoolName: string) => {
    const confirmed = await showConfirm({
      title: "Delete Fee Request",
      message: `Are you sure you want to permanently delete the fee request for "${schoolName}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
    });
    if (!confirmed) return;

    setActionLoading(prev => ({ ...prev, [`del_${id}`]: true }));
    try {
      await firebaseSchoolFeeRequestService.delete(id);
      showToast("Fee request deleted.", "success");
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error("Error deleting request:", err);
      showToast("Failed to delete fee request", "error");
    } finally {
      setActionLoading(prev => ({ ...prev, [`del_${id}`]: false }));
    }
  };

  // Derive unique schools and secretaries from the loaded requests
  const uniqueSchools = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach(r => { if (r.schoolId && r.schoolName) map.set(r.schoolId, r.schoolName); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const uniqueSecretaries = useMemo(() => {
    const map = new Map<string, string>();
    requests.forEach(r => { if (r.secretaryId) map.set(r.secretaryId, r.secretaryEmail || r.secretaryId); });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [requests]);

  const filteredRequests = requests.filter(r => {
    const matchStatus = filter === "all" || r.status === filter;
    const matchSchool = schoolFilter === "all" || r.schoolId === schoolFilter;
    const matchSecretary = secretaryFilter === "all" || r.secretaryId === secretaryFilter;
    return matchStatus && matchSchool && matchSecretary;
  });

  const activeFilterCount = [filter !== "all", schoolFilter !== "all", secretaryFilter !== "all"].filter(Boolean).length;

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-950 dark:text-white uppercase tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              School Fee Structure Requests
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Review and approve fee modifications submitted by Secretaries for {currentProgram}.
            </p>
          </div>
          <button
            onClick={fetchRequests}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl font-semibold text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <SlidersHorizontal className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-auto text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">{activeFilterCount} active</span>
            )}
          </div>

          {/* Row 1: Status tabs */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-semibold text-zinc-400 self-center mr-1">Status:</span>
            {["all", "pending", "approved", "rejected"].map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  filter === st
                    ? "bg-blue-500 text-zinc-950 shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Row 2: School + Secretary dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* School filter */}
            <div className="flex-1 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
              <School className="w-4 h-4 text-zinc-400 shrink-0" />
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value)}
                className="flex-1 bg-transparent text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
              >
                <option value="all">All Schools</option>
                {uniqueSchools.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>

            {/* Secretary filter */}
            <div className="flex-1 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2">
              <User className="w-4 h-4 text-zinc-400 shrink-0" />
              <select
                value={secretaryFilter}
                onChange={(e) => setSecretaryFilter(e.target.value)}
                className="flex-1 bg-transparent text-xs font-semibold text-zinc-900 dark:text-zinc-100 outline-none cursor-pointer"
              >
                <option value="all">All Secretaries</option>
                {uniqueSecretaries.map(([id, email]) => (
                  <option key={id} value={id}>{email}</option>
                ))}
              </select>
            </div>

            {/* Clear all filters */}
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setFilter("all"); setSchoolFilter("all"); setSecretaryFilter("all"); }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 transition-all whitespace-nowrap"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {loading && requests.length === 0 ? (
          <div className="py-20 flex justify-center items-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-zinc-400">
            No fee structure requests match the selected filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRequests.map(r => {
              const isLoading = actionLoading[r.id];
              const isDeleting = actionLoading[`del_${r.id}`];
              const isApproved = r.status === "approved";
              const isRejected = r.status === "rejected";
              const isPending = r.status === "pending";

              return (
                <div key={r.id} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-white leading-snug truncate">{r.schoolName || "Unknown School"}</h2>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">By Secretary: {r.secretaryEmail || r.secretaryId}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        isApproved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                        isRejected ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                        "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400"
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    {/* Student Totals */}
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        <Users className="w-3.5 h-3.5 text-zinc-400" />
                        {studentTotals[`${r.schoolId}|${r.secretaryId}`]?.count ?? 0} Students
                      </span>
                      <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                        <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                        ₹{(studentTotals[`${r.schoolId}|${r.secretaryId}`]?.amount ?? 0).toLocaleString()} Total
                      </span>
                    </div>

                    {/* Fees Grid */}
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/50 space-y-2">
                      <span className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider">Requested Fees</span>
                      <div className="grid grid-cols-2 gap-2">
                        {r.requestedFees?.map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200/60 dark:border-zinc-800 text-xs">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{item.name}</span>
                            <span className="font-bold text-blue-500 ml-2">₹{item.fee}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Admin Feedback — only show for pending */}
                    {isPending && (
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Admin Feedback Note
                        </label>
                        <input
                          type="text"
                          placeholder="Add an optional comment for Secretary..."
                          value={adminMessages[r.id] || ""}
                          onChange={(e) => setAdminMessages(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="w-full text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 outline-none text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    )}

                    {/* Show admin message for decided requests */}
                    {!isPending && r.adminMessage && (
                      <p className="text-xs bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded-lg text-zinc-700 dark:text-zinc-300">
                        <strong>Admin Note:</strong> {r.adminMessage}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900 space-y-2">
                    {/* Approve / Reject row */}
                    <div className="flex gap-3">
                      {/* APPROVED state: show only green confirmed Approve button */}
                      {isApproved && (
                        <button
                          disabled
                          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 opacity-90 cursor-default"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approved
                        </button>
                      )}

                      {/* REJECTED state: show only red confirmed Reject button */}
                      {isRejected && (
                        <button
                          disabled
                          className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 opacity-90 cursor-default"
                        >
                          <XCircle className="w-4 h-4" />
                          Rejected
                        </button>
                      )}

                      {/* PENDING state: show both Reject and Approve buttons */}
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(r.id, "rejected")}
                            disabled={isLoading}
                            className="flex-1 py-2.5 px-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs hover:bg-red-100 dark:hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                            Reject
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(r.id, "approved")}
                            disabled={isLoading}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-zinc-950 font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/10"
                          >
                            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Approve
                          </button>
                        </>
                      )}
                    </div>

                    {/* Delete button — always available */}
                    <button
                      onClick={() => handleDelete(r.id, r.schoolName || "this school")}
                      disabled={isDeleting}
                      className="w-full py-2 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-bold text-xs hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900/40 transition-all flex items-center justify-center gap-1.5"
                    >
                      {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      Delete Request
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
