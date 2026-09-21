import { useState, useEffect } from "react";
import { School as SchoolIcon, Plus, RefreshCw, Users, DollarSign, CheckCircle2, X } from "lucide-react";
import SecretaryLayout from "./SecretaryLayout";
import { useSecretarySchool } from "../../contexts/SecretarySchoolContext";
import {
  firebaseSchoolService,
  firebaseSecretarySchoolService,
  firebaseStudentService,
  firebaseSchoolFeeRequestService,
} from "../../services/firebaseData";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { School } from "../../types/admin";
import { useToast } from "../../hooks/useToast";
import { useNavigate } from "react-router-dom";

export default function SecretaryMySchools() {
  const { mySchools, selectedSchoolId, setSelectedSchoolId, refreshMySchools, loading } = useSecretarySchool();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<Record<string, { students: number; feeStatus: string | null }>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [availableSchools, setAvailableSchools] = useState<School[]>([]);
  const [linkSchoolId, setLinkSchoolId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      const user = firebaseAuthService.getCurrentUser();
      if (!user || mySchools.length === 0) return;
      setStatsLoading(true);
      try {
        const allMyStudents = await firebaseStudentService.getBySecretary(user.uid);
        const result: Record<string, { students: number; feeStatus: string | null }> = {};
        for (const school of mySchools) {
          const count = allMyStudents.filter((s: any) => s.schoolId === school.id).length;
          const requests = await firebaseSchoolFeeRequestService.getBySchoolAndSecretary(school.id, user.uid);
          result[school.id] = { students: count, feeStatus: requests[0]?.status || null };
        }
        setStats(result);
      } catch (err) {
        console.error("Failed to load school stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, [mySchools]);

  const openAddModal = async () => {
    setShowAddModal(true);
    setLinkSchoolId("");
    try {
      const all = await firebaseSchoolService.getAll();
      const linkedIds = new Set(mySchools.map((s) => s.id));
      setAvailableSchools(all.filter((s) => !linkedIds.has(s.id)));
    } catch (err) {
      console.error("Failed to load schools:", err);
    }
  };

  const handleLinkExisting = async () => {
    const user = firebaseAuthService.getCurrentUser();
    if (!user || !linkSchoolId) return;
    const school = availableSchools.find((s) => s.id === linkSchoolId);
    if (!school) return;
    setSaving(true);
    try {
      await firebaseSecretarySchoolService.linkSchool(user.uid, school.id, school.name);
      showToast(`${school.name} added to your schools`, "success");
      setShowAddModal(false);
      await refreshMySchools();
    } catch (err) {
      console.error("Failed to link school:", err);
      showToast("Failed to add school", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectSchool = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    showToast("School selected", "success");
    navigate("/secretary/dashboard");
  };

  return (
    <SecretaryLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-950 dark:text-white uppercase tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              My Schools
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Select a school to manage its students and fee requests, or link another one.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshMySchools()}
              disabled={loading}
              className="p-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-zinc-600 dark:text-zinc-300 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add School
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : mySchools.length === 0 ? (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
            <SchoolIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">You are not managing any schools yet.</p>
            <button
              onClick={openAddModal}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-sm rounded-xl transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Your First School
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mySchools.map((school) => {
              const isSelected = school.id === selectedSchoolId;
              const s = stats[school.id];
              return (
                <div
                  key={school.id}
                  className={`bg-white dark:bg-zinc-950 border rounded-2xl p-6 shadow-sm flex flex-col gap-4 transition-all cursor-pointer ${
                    isSelected ? "border-amber-500 ring-2 ring-amber-500/20" : "border-zinc-200 dark:border-zinc-800 hover:border-amber-300"
                  }`}
                  onClick={() => handleSelectSchool(school.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-lg text-zinc-900 dark:text-white truncate">{school.name}</h3>
                      {school.branch && <p className="text-xs text-zinc-500 truncate">{school.branch}</p>}
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />}
                  </div>

                  <span className="self-start px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800">
                    {school.programType}
                  </span>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-900">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {statsLoading ? "…" : s?.students ?? 0} students
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-zinc-400" />
                      <span className="text-zinc-600 dark:text-zinc-400 capitalize">
                        {statsLoading ? "…" : s?.feeStatus || "No request"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSchool(school.id);
                    }}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
                      isSelected
                        ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {isSelected ? "Currently Selected" : "Select School"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add School Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Link a School</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Select School
              </label>
              <select
                value={linkSchoolId}
                onChange={(e) => setLinkSchoolId(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white"
              >
                <option value="">-- Select a school --</option>
                {availableSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.branch ? `- ${s.branch}` : ""} ({s.programType})
                  </option>
                ))}
              </select>
              {availableSchools.length === 0 && (
                <p className="text-xs text-zinc-500 mt-2">No unlinked schools available. Contact Admin to add your school first.</p>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-white dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkExisting}
                disabled={saving || !linkSchoolId}
                className="flex-1 px-4 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? "Saving..." : "Add School"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SecretaryLayout>
  );
}
