import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, School as SchoolIcon, User, DollarSign, Users, CheckCircle2,
  RefreshCw, CheckSquare, Square, XCircle, Clock,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import {
  firebaseSchoolService,
  firebaseStudentService,
  firebaseSchoolFeeRequestService,
  firebaseSecretaryAuthService,
} from "../../services/firebaseData";
import { auth } from "../../config/firebase";
import { School, StudentRecord } from "../../types/admin";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";

export default function AdminSchoolDetail() {
  const { secretaryId, schoolId, program } = useParams<{ secretaryId: string; schoolId: string; program: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { showConfirm } = useDialog();

  const [school, setSchool] = useState<School | null>(null);
  const [secretary, setSecretary] = useState<any | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [latestFeeRequest, setLatestFeeRequest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [statusTab, setStatusTab] = useState<"all" | "pending" | "confirmed">("all");

  // Secretary accounts and schools are shared across programs, but this page is
  // opened from a specific program tab — only show that program's students here.
  const programUpper = program === "silambam" ? "SELAMBAM" : "KARATE";

  const loadData = async () => {
    if (!secretaryId || !schoolId) return;
    setLoading(true);
    try {
      const [schoolData, secretaryData, allSecretaryStudents, feeRequests] = await Promise.all([
        firebaseSchoolService.getById(schoolId),
        firebaseSecretaryAuthService.getSecretaryByUid(secretaryId),
        firebaseStudentService.getBySecretary(secretaryId),
        firebaseSchoolFeeRequestService.getBySchoolAndSecretary(schoolId, secretaryId),
      ]);
      setSchool(schoolData);
      setSecretary(secretaryData);
      setStudents(
        allSecretaryStudents.filter(
          (s: any) => s.schoolId === schoolId && (s.programType || "").toUpperCase() === programUpper,
        ),
      );
      setLatestFeeRequest(feeRequests[0] || null);
    } catch (err) {
      console.error("Failed to load school detail:", err);
      showToast("Failed to load school details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secretaryId, schoolId]);

  const pendingStudents = useMemo(() => students.filter(s => s.paymentStatus !== "verified"), [students]);
  const confirmedCount = students.length - pendingStudents.length;

  const displayedStudents = useMemo(() => {
    if (statusTab === "pending") return students.filter(s => s.paymentStatus !== "verified");
    if (statusTab === "confirmed") return students.filter(s => s.paymentStatus === "verified");
    return students;
  }, [students, statusTab]);

  const feePerStudent = useMemo(() => {
    if (!latestFeeRequest?.requestedFees?.length) return null;
    const total = latestFeeRequest.requestedFees.reduce((sum: number, f: any) => sum + (Number(f.fee) || 0), 0);
    return Math.round(total / latestFeeRequest.requestedFees.length);
  }, [latestFeeRequest]);

  const totalAmount = useMemo(() => {
    return students.reduce((sum, s) => sum + (s.paymentDetails?.amount || 0), 0);
  }, [students]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingStudents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingStudents.map(s => s.id!)));
    }
  };

  const confirmStudents = async (ids: string[]) => {
    const adminUid = auth.currentUser?.uid;
    if (!adminUid || ids.length === 0) return;
    try {
      await Promise.all(
        ids.map(id =>
          firebaseStudentService.update(id, {
            paymentStatus: "verified",
            confirmedBy: adminUid,
            confirmedAt: new Date(),
          } as any),
        ),
      );
      setStudents(prev => prev.map(s => (ids.includes(s.id!) ? { ...s, paymentStatus: "verified" } : s)));
      setSelectedIds(new Set());
      showToast(`${ids.length} student${ids.length > 1 ? "s" : ""} confirmed`, "success");
    } catch (err) {
      console.error("Failed to confirm students:", err);
      showToast("Failed to confirm students", "error");
    }
  };

  const handleConfirmOne = async (id: string) => {
    setBusyIds(prev => new Set(prev).add(id));
    await confirmStudents([id]);
    setBusyIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = await showConfirm({
      title: "Confirm Selected Students?",
      message: `This will mark ${selectedIds.size} student(s) as Confirmed and eligible for batch assignment.`,
      confirmText: "Confirm All",
      variant: "success",
    });
    if (!confirmed) return;
    setBulkBusy(true);
    await confirmStudents(Array.from(selectedIds));
    setBulkBusy(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-24 flex justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <button
          onClick={() => navigate(`/admin/${program}/secretaries`)}
          className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Secretaries
        </button>

        {/* Header */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <SchoolIcon className="w-7 h-7 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {school?.name || "Unknown School"}
                </h1>
                {school?.branch && <p className="text-sm text-zinc-500">{school.branch}</p>}
                <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                  <User className="w-3.5 h-3.5" /> Managed by {secretary?.fullName || secretary?.email || "Secretary"}
                </p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="p-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-900">
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Total Students</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{students.length}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Confirmed</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{confirmedCount}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pending</p>
              <p className="text-2xl font-bold text-blue-500 mt-1">{pendingStudents.length}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Total Amount</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">₹{totalAmount.toLocaleString()}</p>
            </div>
          </div>

          {latestFeeRequest && (
            <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                latestFeeRequest.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                latestFeeRequest.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400"
              }`}>
                Fee Request: {latestFeeRequest.status}
              </span>
              {feePerStudent !== null && (
                <span className="text-xs text-zinc-500">Fee Per Student: <strong className="text-zinc-800 dark:text-zinc-200">₹{feePerStudent}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* Students Table */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 overflow-x-auto max-w-full">
              {([
                { key: "all", label: "All", count: students.length },
                { key: "pending", label: "Pending", count: pendingStudents.length },
                { key: "confirmed", label: "Confirmed", count: confirmedCount },
              ] as const).map(tab => (
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
            {pendingStudents.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap"
                >
                  {selectedIds.size === pendingStudents.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  Select All Pending
                </button>
                <button
                  onClick={handleBulkConfirm}
                  disabled={selectedIds.size === 0 || bulkBusy}
                  className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-zinc-950 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {bulkBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm Selected ({selectedIds.size})
                </button>
              </div>
            )}
          </div>

          {students.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">No students registered under this school yet.</div>
          ) : displayedStudents.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">No {statusTab} students to show.</div>
          ) : (
            <>
              {/* Desktop/tablet table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Student</th>
                      <th className="p-3">Program</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {displayedStudents.map(student => {
                      const isVerified = student.paymentStatus === "verified";
                      const isBusy = busyIds.has(student.id!);
                      return (
                        <tr key={student.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                          <td className="p-3">
                            {!isVerified && (
                              <button onClick={() => toggleSelect(student.id!)} className="text-zinc-400 hover:text-blue-500">
                                {selectedIds.has(student.id!) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                              </button>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-zinc-900 dark:text-white">{student.name}</div>
                            <div className="text-xs text-zinc-500">{student.standard}</div>
                          </td>
                          <td className="p-3 text-zinc-600 dark:text-zinc-400">
                            {student.programType} — {student.beltLevel || student.stageLevel || "N/A"}
                          </td>
                          <td className="p-3 font-semibold text-zinc-800 dark:text-zinc-200">
                            {student.paymentDetails?.amount ? `₹${student.paymentDetails.amount.toLocaleString()}` : "—"}
                          </td>
                          <td className="p-3">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                              </span>
                            ) : student.paymentStatus === "rejected" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-500/20">
                                <XCircle className="w-3.5 h-3.5" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-500/20">
                                <Clock className="w-3.5 h-3.5" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {!isVerified && (
                              <button
                                onClick={() => handleConfirmOne(student.id!)}
                                disabled={isBusy}
                                className="px-3 py-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                              >
                                {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirm
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {displayedStudents.map(student => {
                  const isVerified = student.paymentStatus === "verified";
                  const isBusy = busyIds.has(student.id!);
                  return (
                    <div key={student.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {!isVerified && (
                            <button onClick={() => toggleSelect(student.id!)} className="text-zinc-400 hover:text-blue-500 mt-0.5 shrink-0">
                              {selectedIds.has(student.id!) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-zinc-900 dark:text-white truncate">{student.name}</div>
                            <div className="text-xs text-zinc-500">{student.standard}</div>
                          </div>
                        </div>
                        {isVerified ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed
                          </span>
                        ) : student.paymentStatus === "rejected" ? (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-xs font-bold border border-red-200 dark:border-red-500/20">
                            <XCircle className="w-3.5 h-3.5" /> Rejected
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-500/20">
                            <Clock className="w-3.5 h-3.5" /> Pending
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-sm pl-0">
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {student.programType} — {student.beltLevel || student.stageLevel || "N/A"}
                        </span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {student.paymentDetails?.amount ? `₹${student.paymentDetails.amount.toLocaleString()}` : "—"}
                        </span>
                      </div>

                      {!isVerified && (
                        <button
                          onClick={() => handleConfirmOne(student.id!)}
                          disabled={isBusy}
                          className="w-full px-3 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                        >
                          {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Confirm
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
