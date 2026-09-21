import { useState, useEffect, useMemo } from "react";
import {
  Users, Search, Filter,
  ChevronDown, Check, XCircle,
  Phone, RefreshCw, Edit2, Trash2, School as SchoolIcon, DollarSign, X, Calendar,
} from "lucide-react";
import { Link } from "react-router-dom";
import { firebaseSecretaryService, firebaseSecretarySchoolService } from "../../services/firebaseData";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { formatSafeDate } from "../../utils/batchFormatters";
import { Secretary } from "../../types/admin";
import { useProgram } from "../../contexts/ProgramContext";
import AdminLayout from "./AdminLayout";

type SecretarySummary = Awaited<ReturnType<typeof firebaseSecretarySchoolService.getSecretarySummary>>;

const EMPTY_SUMMARY: SecretarySummary = {
  schools: [], totalSchools: 0, totalStudents: 0, pendingStudents: 0, confirmedStudents: 0,
  totalFee: 0, feeApproved: 0, feePending: 0, feeRejected: 0,
};

export default function SecretaryManagement() {
  const { showToast } = useToast();
  const { showConfirm } = useDialog();
  const { currentProgram, program } = useProgram();

  const [secretaries, setSecretaries] = useState<Secretary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  // Set by clicking the Pending/Confirmed Students stat card — narrows the list
  // to secretaries who actually have students in that state.
  const [activityFilter, setActivityFilter] = useState<"all" | "pending" | "confirmed">("all");

  const [editSecretary, setEditSecretary] = useState<Secretary | null>(null);
  const [editForm, setEditForm] = useState<Partial<Secretary>>({});
  const [saving, setSaving] = useState(false);

  // Per-secretary school/student/fee aggregates, keyed by uid
  const [summaries, setSummaries] = useState<Record<string, SecretarySummary>>({});
  const [summariesLoading, setSummariesLoading] = useState(false);

  // Schools drill-down
  const [viewingSchoolsFor, setViewingSchoolsFor] = useState<Secretary | null>(null);
  const [viewingFeeDetailsFor, setViewingFeeDetailsFor] = useState<SecretarySummary["schools"][number] | null>(null);

  useEffect(() => {
    fetchData();
  }, [currentProgram]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Secretary accounts are shared across both programs (a Secretary can manage
      // Karate schools and Silambam schools alike) — fetch every secretary regardless
      // of which program tab is active; only the schools/students summary below is
      // scoped per program.
      const data = await firebaseSecretaryService.getAll();
      setSecretaries(data);
      loadSummaries(data);
    } catch (err) {
      console.error("Error fetching secretaries data:", err);
      showToast("Failed to load secretary data", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadSummaries = async (list: Secretary[]) => {
    setSummariesLoading(true);
    try {
      const entries = await Promise.all(
        list.map(async (sec) => [sec.uid, await firebaseSecretarySchoolService.getSecretarySummary(sec.uid, currentProgram)] as const),
      );
      setSummaries(Object.fromEntries(entries));
    } catch (err) {
      console.error("Failed to load secretary summaries:", err);
    } finally {
      setSummariesLoading(false);
    }
  };

  const handleToggleActive = async (secretary: Secretary) => {
    const actionStr = secretary.active ? "disable" : "enable";
    const confirmed = await showConfirm({
      title: `${actionStr.charAt(0).toUpperCase() + actionStr.slice(1)} Secretary?`,
      message: `Are you sure you want to ${actionStr} access for ${secretary.fullName}?`,
      confirmText: `Yes, ${actionStr}`,
      variant: secretary.active ? "warning" : "success",
    });

    if (!confirmed) return;

    try {
      await firebaseSecretaryService.toggleActive(secretary.uid, !secretary.active);
      showToast(`Secretary account ${actionStr}d`, "success");
      fetchData();
    } catch (err) {
      console.error("Error toggling secretary status:", err);
      showToast("Failed to update status", "error");
    }
  };

  const handleEdit = (sec: Secretary) => {
    setEditSecretary(sec);
    setEditForm({
      fullName: sec.fullName,
      phone: sec.phone,
      academy: sec.academy,
      district: sec.district,
      state: sec.state,
      address: sec.address,
    });
  };

  const saveEdit = async () => {
    if (!editSecretary) return;
    setSaving(true);
    try {
      await firebaseSecretaryService.update(editSecretary.uid, editForm);
      showToast("Secretary updated successfully", "success");
      setEditSecretary(null);
      fetchData();
    } catch (err) {
      console.error("Error updating secretary:", err);
      showToast("Failed to update secretary", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sec: Secretary) => {
    const confirmed = await showConfirm({
      title: "Delete Secretary?",
      message: `Are you sure you want to permanently delete ${sec.fullName}? This cannot be undone.`,
      confirmText: "Yes, Delete",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      await firebaseSecretaryService.delete(sec.uid);
      showToast("Secretary deleted successfully", "success");
      fetchData();
    } catch (err) {
      console.error("Error deleting secretary:", err);
      showToast("Failed to delete secretary", "error");
    }
  };

  // Rolled-up totals across every secretary (all schools, all students)
  const overallStats = useMemo(() => {
    return Object.values(summaries).reduce(
      (acc, s) => {
        acc.pendingStudents += s.pendingStudents;
        acc.confirmedStudents += s.confirmedStudents;
        acc.totalFee += s.totalFee;
        return acc;
      },
      { pendingStudents: 0, confirmedStudents: 0, totalFee: 0 },
    );
  }, [summaries]);

  const filteredSecretaries = secretaries.filter(sec => {
    const matchesSearch = (sec.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
           (sec.email || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
           (sec.academy || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === "active" && !sec.active) return false;
    if (statusFilter === "disabled" && sec.active) return false;

    if (activityFilter === "pending" && !((summaries[sec.uid]?.pendingStudents ?? 0) > 0)) return false;
    if (activityFilter === "confirmed" && !((summaries[sec.uid]?.confirmedStudents ?? 0) > 0)) return false;

    return matchesSearch;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h2
                  className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  SECRETARY MANAGEMENT
                </h2>
                <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Manage academy secretaries and the schools they run</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchData()}
                disabled={loading}
                className="flex items-center justify-center p-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-zinc-700 dark:text-zinc-300 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                title="Refresh Secretaries"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">{secretaries.length}</p>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Total Secretaries</p>
            </div>
            <button
              type="button"
              onClick={() => setActivityFilter(prev => prev === "pending" ? "all" : "pending")}
              className={`bg-zinc-50 dark:bg-zinc-900 border rounded-2xl p-5 text-center transition-colors ${
                activityFilter === "pending"
                  ? "border-blue-500 ring-2 ring-blue-500/30"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800"
              }`}
              title="Show only secretaries with pending students"
            >
              <p className="text-3xl font-bold text-blue-500 tracking-tight">
                {summariesLoading ? "…" : overallStats.pendingStudents}
              </p>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Pending Students</p>
            </button>
            <button
              type="button"
              onClick={() => setActivityFilter(prev => prev === "confirmed" ? "all" : "confirmed")}
              className={`bg-zinc-50 dark:bg-zinc-900 border rounded-2xl p-5 text-center transition-colors ${
                activityFilter === "confirmed"
                  ? "border-emerald-500 ring-2 ring-emerald-500/30"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-emerald-800"
              }`}
              title="Show only secretaries with confirmed students"
            >
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
                {summariesLoading ? "…" : overallStats.confirmedStudents}
              </p>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Confirmed Students</p>
            </button>
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                ₹{(summariesLoading ? 0 : overallStats.totalFee).toLocaleString()}
              </p>
              <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mt-1">Total Amount</p>
            </div>
          </div>
        </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or academy..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-900 dark:text-white"
          />
        </div>
        
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-10 pr-8 py-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-gray-900 dark:text-white cursor-pointer"
            >
              <option value="all">All Accounts</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>

          {activityFilter !== "all" && (
            <button
              type="button"
              onClick={() => setActivityFilter("all")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                activityFilter === "pending"
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20"
                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
              }`}
            >
              {activityFilter === "pending" ? "Has pending students" : "Has confirmed students"}
              <X className="w-3.5 h-3.5" />
            </button>
          )}
      </div>

      {/* Cards Container */}
      <div className="bg-transparent">
        {loading ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-12 text-center text-gray-500 dark:text-zinc-400">Loading...</div>
        ) : filteredSecretaries.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-12 text-center text-gray-500 dark:text-zinc-400">
            No secretaries found matching your criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSecretaries.map(sec => (
              <div
                key={sec.uid}
                className={`relative bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 p-5 group flex flex-col h-full ${!sec.active ? 'opacity-75 grayscale-[20%]' : ''}`}
              >
                {/* Top Section */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold shadow-sm ${sec.active ? 'bg-gradient-to-br from-blue-400 to-blue-500 text-blue-950' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                      {(sec.fullName || "?").charAt(0).toUpperCase()}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[16px] text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                        {sec.fullName}
                      </h3>
                      <p className="text-[13px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                        {sec.email}
                      </p>
                    </div>
                  </div>

                  {/* Only surface the exceptional state — disabled accounts */}
                  {!sec.active && (
                    <span className="flex-shrink-0 ml-3 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      Disabled
                    </span>
                  )}
                </div>

                {/* Contact & Meta */}
                <div className="flex flex-col gap-2.5 mt-1 mb-4 text-[13px] text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="font-medium">{sec.phone}</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] text-zinc-500">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Login Created</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatSafeDate(sec.createdAt?.toDate?.() || sec.createdAt)}</span>
                  </div>
                </div>

                {/* Schools/Students/Fee Summary */}
                <div className="grid grid-cols-3 gap-2 mb-4 flex-grow content-start">
                  <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{summariesLoading ? "…" : summaries[sec.uid]?.totalSchools ?? 0}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Schools</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{summariesLoading ? "…" : summaries[sec.uid]?.totalStudents ?? 0}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Students</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-blue-500">{summariesLoading ? "…" : summaries[sec.uid]?.pendingStudents ?? 0}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Pending</p>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{summariesLoading ? "…" : summaries[sec.uid]?.confirmedStudents ?? 0}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Confirmed</p>
                  </div>
                  <div className="col-span-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">₹{(summariesLoading ? 0 : summaries[sec.uid]?.totalFee ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Fee</p>
                  </div>
                </div>

                {!summariesLoading && (summaries[sec.uid]?.totalSchools ?? 0) > 0 && (
                  <div className="mb-4 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-zinc-400" />
                    Fee Requests: {summaries[sec.uid]?.feeApproved ?? 0} Approved / {summaries[sec.uid]?.feePending ?? 0} Pending
                    {(summaries[sec.uid]?.feeRejected ?? 0) > 0 ? ` / ${summaries[sec.uid]?.feeRejected} Rejected` : ""}
                  </div>
                )}

                {/* View Schools */}
                <button
                  onClick={() => setViewingSchoolsFor(sec)}
                  className="w-full mb-3 py-2.5 flex items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-zinc-950 font-bold text-sm transition-colors"
                >
                  <SchoolIcon className="w-4 h-4" />
                  View Schools
                </button>

                {/* Action Bar */}
                <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 mt-auto">
                  <button
                    onClick={() => handleToggleActive(sec)}
                    title={sec.active ? "Disable Account" : "Enable Account"}
                    className={`p-2 rounded-lg transition-colors ${sec.active ? 'text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-950/30'}`}
                  >
                    {sec.active ? <XCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(sec)}
                    title="Edit Secretary"
                    className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-500 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(sec)}
                    title="Delete Secretary"
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* Edit Secretary Modal */}
      {editSecretary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-950 rounded-t-2xl z-10">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-500" />
                Edit Secretary
              </h2>
              <button
                onClick={() => setEditSecretary(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={editForm.fullName || ''}
                  onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone || ''}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Academy/School Name</label>
                <input
                  type="text"
                  value={editForm.academy || ''}
                  onChange={e => setEditForm({ ...editForm, academy: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">District</label>
                  <input
                    type="text"
                    value={editForm.district || ''}
                    onChange={e => setEditForm({ ...editForm, district: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">State</label>
                  <input
                    type="text"
                    value={editForm.state || ''}
                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Full Address</label>
                <textarea
                  rows={3}
                  value={editForm.address || ''}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-2xl flex gap-3 sticky bottom-0">
              <button
                onClick={() => setEditSecretary(null)}
                className="flex-1 px-4 py-2.5 text-sm font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-white dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schools Managed Modal */}
      {viewingSchoolsFor && (() => {
        const summary = summaries[viewingSchoolsFor.uid] || EMPTY_SUMMARY;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-3xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-950 rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <SchoolIcon className="w-5 h-5 text-blue-500" />
                  Schools Managed
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">by {viewingSchoolsFor.fullName}</p>
              </div>
              <button
                onClick={() => setViewingSchoolsFor(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Bar */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 grid grid-cols-3 sm:grid-cols-6 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{summary.totalSchools}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Schools</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{summary.totalStudents}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Students</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-500">{summary.pendingStudents}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{summary.confirmedStudents}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Confirmed</p>
              </div>
              <div className="text-center col-span-2 sm:col-span-1">
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-50">₹{summary.totalFee.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Fee</p>
              </div>
              <div className="text-center col-span-3 sm:col-span-1">
                <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{summary.feeApproved}A / {summary.feePending}P{summary.feeRejected ? ` / ${summary.feeRejected}R` : ""}</p>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Fee Requests</p>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {summariesLoading ? (
                <div className="py-12 flex justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : summary.schools.length === 0 ? (
                <div className="py-12 text-center text-zinc-400">This secretary is not managing any schools yet.</div>
              ) : (
                <>
                {/* Desktop/tablet table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">
                        <th className="py-2 pr-3">School</th>
                        <th className="py-2 px-3">Students</th>
                        <th className="py-2 px-3">Pending</th>
                        <th className="py-2 px-3">Confirmed</th>
                        <th className="py-2 px-3">Total Fee</th>
                        <th className="py-2 px-3">Fee Request</th>
                        <th className="py-2 pl-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {summary.schools.map(school => (
                        <tr key={school.id}>
                          <td className="py-3 pr-3">
                            <div className="font-bold text-zinc-900 dark:text-white">{school.name}</div>
                            {school.branch && <div className="text-xs text-zinc-500">{school.branch}</div>}
                          </td>
                          <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300">
                            <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-zinc-400" /> {school.studentCount}</span>
                          </td>
                          <td className="py-3 px-3 text-blue-600 dark:text-blue-400 font-semibold">{school.pendingCount}</td>
                          <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-semibold">{school.confirmedCount}</td>
                          <td className="py-3 px-3 text-zinc-700 dark:text-zinc-300">₹{school.totalAmount.toLocaleString()}</td>
                          <td className="py-3 px-3">
                            {school.feeStatus ? (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                school.feeStatus === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                school.feeStatus === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                                "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400"
                              }`}>
                                {school.feeStatus}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400">No request</span>
                            )}
                          </td>
                          <td className="py-3 pl-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {school.feeStatus && (
                                <button
                                  onClick={() => setViewingFeeDetailsFor(school)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  Details
                                </button>
                              )}
                              <Link
                                to={`/admin/${program}/secretaries/${viewingSchoolsFor.uid}/schools/${school.id}`}
                                onClick={() => setViewingSchoolsFor(null)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-lg transition-colors"
                              >
                                View
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden space-y-3">
                  {summary.schools.map(school => (
                    <div key={school.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-zinc-900 dark:text-white truncate">{school.name}</div>
                          {school.branch && <div className="text-xs text-zinc-500">{school.branch}</div>}
                        </div>
                        {school.feeStatus ? (
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            school.feeStatus === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                            school.feeStatus === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                            "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400"
                          }`}>
                            {school.feeStatus}
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs text-zinc-400">No request</span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2">
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{school.studentCount}</p>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Students</p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2">
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{school.pendingCount}</p>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Pending</p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-2">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{school.confirmedCount}</p>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Confirmed</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>Total Fee</span>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">₹{school.totalAmount.toLocaleString()}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        {school.feeStatus && (
                          <button
                            onClick={() => setViewingFeeDetailsFor(school)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                          >
                            Details
                          </button>
                        )}
                        <Link
                          to={`/admin/${program}/secretaries/${viewingSchoolsFor.uid}/schools/${school.id}`}
                          onClick={() => setViewingSchoolsFor(null)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-lg transition-colors"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Fee Request Details Modal */}
      {viewingFeeDetailsFor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                  Fee Request Details
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">{viewingFeeDetailsFor.name}{viewingFeeDetailsFor.feeProgramType ? ` · ${viewingFeeDetailsFor.feeProgramType}` : ""}</p>
              </div>
              <button
                onClick={() => setViewingFeeDetailsFor(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Status</span>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  viewingFeeDetailsFor.feeStatus === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                  viewingFeeDetailsFor.feeStatus === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                  "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400"
                }`}>
                  {viewingFeeDetailsFor.feeStatus}
                </span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider block mb-2">Requested Fee Structure</span>
                {viewingFeeDetailsFor.requestedFees.length === 0 ? (
                  <p className="text-sm text-zinc-400">No fee breakdown available.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {viewingFeeDetailsFor.requestedFees.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200/60 dark:border-zinc-800 text-xs">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">{item.name}</span>
                        <span className="font-bold text-blue-500 ml-2">₹{item.fee}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {viewingFeeDetailsFor.feeAdminMessage && (
                <div>
                  <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">Admin Note</span>
                  <p className="text-sm bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded-lg text-zinc-700 dark:text-zinc-300">{viewingFeeDetailsFor.feeAdminMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
