import React, { useState, useEffect } from "react";
import { DollarSign, Clock, Send, RefreshCw, Lock, CheckCircle, XCircle, AlertCircle, School as SchoolIcon } from "lucide-react";
import SecretaryLayout from "./SecretaryLayout";
import { firebaseFeeStructureService, firebaseSilambanFeeService, firebaseSchoolFeeRequestService } from "../../services/firebaseData";
import { firebaseAuthService } from "../../services/firebaseAuth";
import { useSecretarySchool } from "../../contexts/SecretarySchoolContext";
import { useToast } from "../../hooks/useToast";

export default function SecretaryFeeRequest() {
  const { selectedSchool, mySchools, setSelectedSchoolId } = useSecretarySchool();
  const selectedSchoolId = selectedSchool?.id || "";
  const [selectedProgramType, setSelectedProgramType] = useState<"KARATE" | "SELAMBAM">("KARATE");
  const programType = selectedProgramType;

  // Filter schools by the chosen program type
  const filteredSchools = mySchools.filter(s => {
    const pType = (s as any).programType?.toUpperCase();
    return pType === selectedProgramType || (selectedProgramType === 'SELAMBAM' && pType === 'SILAMBAM');
  });
  const [defaultFees, setDefaultFees] = useState<any[]>([]);
  const [requestedFees, setRequestedFees] = useState<{ [key: string]: number }>({});
  const [requests, setRequests] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any | null>(null); // active pending for selected school+program
  const { showToast } = useToast();
  const user = firebaseAuthService.getCurrentUser();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadFeesForProgram(programType);
  }, [programType]);

  // Whenever school or program changes, check if there's an active pending request
  useEffect(() => {
    if (!selectedSchoolId) {
      setPendingRequest(null);
      return;
    }
    checkPendingRequest(selectedSchoolId, programType);
  }, [selectedSchoolId, programType, requests]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      if (user) {
        const reqList = await firebaseSchoolFeeRequestService.getBySecretary(user.uid);
        setRequests(reqList);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      showToast("Failed to load school data", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadFeesForProgram = async (prog: "KARATE" | "SELAMBAM") => {
    try {
      if (prog === "KARATE") {
        const data = await firebaseFeeStructureService.getAll();
        setDefaultFees(data);
        const map: any = {};
        data.forEach((f: any) => { map[f.beltColor || f.id] = f.fee || 800; });
        setRequestedFees(map);
      } else {
        const data = await firebaseSilambanFeeService.getAll();
        setDefaultFees(data);
        const map: any = {};
        data.forEach((f: any) => { map[`Stage ${f.stageNumber || f.order}`] = f.fee || 800; });
        setRequestedFees(map);
      }
    } catch (err) {
      console.error("Error loading fees:", err);
    }
  };

  const checkPendingRequest = (schoolId: string, prog: string) => {
    // Find the latest request for this school + program
    const match = requests
      .filter((r: any) => {
        const sameSchool = r.schoolId === schoolId;
        const sameProg =
          prog === "SELAMBAM"
            ? r.programType === "SELAMBAM" || r.programType === "SILAMBAM"
            : r.programType === prog;
        return sameSchool && sameProg;
      })
      .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0];

    if (match && match.status === "pending") {
      setPendingRequest(match);
    } else {
      setPendingRequest(null);
      // If approved, pre-fill the form with the approved fees so they can tweak and resubmit
      if (match && match.status === "approved" && match.requestedFees?.length > 0) {
        const approvedMap: any = {};
        match.requestedFees.forEach((item: any) => {
          approvedMap[item.name] = item.fee;
        });
        setRequestedFees(prev => ({ ...prev, ...approvedMap }));
      }
    }
  };

  const handleFeeChange = (key: string, value: string) => {
    const num = parseInt(value) || 0;
    setRequestedFees(prev => ({ ...prev, [key]: num }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId || !selectedSchool || !user || pendingRequest) return;
    setSubmitting(true);
    try {
      const payloadFees = Object.keys(requestedFees).map(key => ({
        name: key,
        fee: requestedFees[key]
      }));
      await firebaseSchoolFeeRequestService.create({
        schoolId: selectedSchoolId,
        schoolName: selectedSchool.name,
        secretaryId: user.uid,
        secretaryEmail: user.email || "unknown@secretary.com",
        programType,
        requestedFees: payloadFees
      });
      showToast("Fee request submitted successfully!", "success");
      const updatedReqs = await firebaseSchoolFeeRequestService.getBySecretary(user.uid);
      setRequests(updatedReqs);
    } catch (err) {
      console.error("Failed to submit request:", err);
      showToast("Error submitting fee request", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isFormLocked = !!pendingRequest;

  return (
    <SecretaryLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-950 dark:text-white uppercase tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            Fee Structure Requests
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Submit customized school fee structures to Admin for approval.
          </p>
        </div>

        {/* Program Type Selector */}
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Program:</label>
          <div className="flex gap-2">
            {(["KARATE", "SELAMBAM"] as const).map(pt => (
              <button
                key={pt}
                type="button"
                onClick={() => {
                  setSelectedProgramType(pt);
                  setSelectedSchoolId(""); // reset school when switching program
                }}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all ${
                  selectedProgramType === pt
                    ? "bg-blue-500 text-zinc-950 border-blue-500 shadow-md shadow-blue-500/20"
                    : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                }`}
              >
                {pt === "SELAMBAM" ? "Silambam" : "Karate"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Request Form */}
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-500" />
              New Fee Request
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* School Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">School</label>
                <div className="w-full flex items-center justify-between gap-2 bg-zinc-100 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <SchoolIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    <select
                      value={selectedSchool?.id || ""}
                      onChange={(e) => setSelectedSchoolId(e.target.value)}
                      className="w-full font-medium text-zinc-900 dark:text-zinc-100 bg-transparent outline-none border-none p-0 focus:ring-0 cursor-pointer"
                    >
                      <option value="" disabled>Select a school...</option>
                      {filteredSchools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0">{programType}</span>
                </div>
              </div>

              {/* Pending Lock Banner */}
              {isFormLocked && (
                <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl px-4 py-3">
                  <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-blue-800 dark:text-blue-400">Request Pending Approval</p>
                    <p className="text-xs text-blue-700 dark:text-blue-500 mt-0.5">
                      A fee request for this school is already submitted and waiting for admin approval. You cannot submit another request until the current one is reviewed.
                    </p>
                  </div>
                </div>
              )}

              {/* Fee Inputs */}
              <div className={`pt-4 border-t border-zinc-200 dark:border-zinc-800 ${isFormLocked ? "opacity-50 pointer-events-none select-none" : ""}`}>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-3">
                  {isFormLocked ? "Submitted Fees (Locked)" : "Adjust Requested Fees (₹)"}
                </label>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {Object.keys(requestedFees).map((key) => (
                    <div key={key} className="flex items-center justify-between gap-4 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800/50">
                      <span className="font-semibold text-sm text-zinc-800 dark:text-zinc-200">{key}</span>
                      <div className="flex items-center gap-1 w-32">
                        <span className="text-zinc-400 font-medium">₹</span>
                        <input
                          type="number"
                          value={requestedFees[key]}
                          onChange={(e) => handleFeeChange(key, e.target.value)}
                          disabled={isFormLocked}
                          className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-right font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !selectedSchool || isFormLocked}
                className="w-full py-4 mt-6 bg-blue-500 hover:bg-blue-600 text-zinc-950 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
              >
                {submitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : isFormLocked ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {isFormLocked ? "Pending Admin Approval" : "Submit Request to Admin"}
              </button>
            </form>
          </div>

          {/* Past Requests History */}
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Request History
            </h2>
            {requests.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">No previous fee structure requests found.</div>
            ) : (
              <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                {requests.map(r => {
                  const statusMeta =
                    r.status === "approved"
                      ? { icon: <CheckCircle className="w-3.5 h-3.5" />, cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" }
                      : r.status === "rejected"
                      ? { icon: <XCircle className="w-3.5 h-3.5" />, cls: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" }
                      : { icon: <AlertCircle className="w-3.5 h-3.5" />, cls: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400" };

                  return (
                    <div key={r.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{r.schoolName || "School"}</span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${statusMeta.cls}`}>
                          {statusMeta.icon}
                          {r.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-500 uppercase">{r.programType}</p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {r.requestedFees?.map((item: any, i: number) => (
                          <span key={i} className="px-2 py-1 bg-white dark:bg-zinc-950 rounded-lg text-xs font-medium border border-zinc-200/60 dark:border-zinc-800">
                            {item.name}: <strong>₹{item.fee}</strong>
                          </span>
                        ))}
                      </div>
                      {r.adminMessage && (
                        <p className="text-xs bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded-lg text-zinc-700 dark:text-zinc-300 mt-2">
                          <strong>Admin Feedback:</strong> {r.adminMessage}
                        </p>
                      )}
                      {r.status === "pending" && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 mt-1">
                          <Lock className="w-3 h-3" /> Locked — waiting for admin review
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </SecretaryLayout>
  );
}
