import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Users, CheckCircle, X, Download, RefreshCw, School as SchoolIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import SecretaryLayout from './SecretaryLayout';
import ManualBulkEntry from './ManualBulkEntry';
import { firebaseBeltTestService, firebaseFeeStructureService, firebaseSilambanFeeService, firebaseStudentService, firebaseSchoolFeeRequestService, firebaseSchoolService } from '../../services/firebaseData';
import { firebaseAuthService } from '../../services/firebaseAuth';
import { StudentRecord } from '../../types/admin';
import { generateBulkRegistrationReceipt } from '../../utils/receiptGenerator';
import { generateBulkHallTickets, generateSingleHallTicketBlob } from '../../utils/hallTicketGenerator';
import { generateRegistrationFingerprint } from '../../utils/fingerprint';
import { uploadHallTicketPDF } from "../../services/storageService";
import { useToast } from '../../hooks/useToast';
import { fetchJson } from '../../utils/apiFetch';


export default function BulkRegistration() {
  const [students, setStudents] = useState<any[]>([]);
  const [allSchools, setAllSchools] = useState<any[]>([]);

  const [uploadDuplicates, setUploadDuplicates] = useState<any[]>([]);
  const [databaseDuplicates, setDatabaseDuplicates] = useState<any[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [generatedStudents, setGeneratedStudents] = useState<StudentRecord[]>([]);
  const [receiptData, setReceiptData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const [allBeltTests, setAllBeltTests] = useState<any[]>([]);
  const [selectedBeltTestId, setSelectedBeltTestId] = useState<string>('');
  const [existingStudents, setExistingStudents] = useState<StudentRecord[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const tests = await firebaseBeltTestService.getAll();
        const activeTests = tests.filter((t: any) => t.isActive);
        setAllBeltTests(activeTests);
        if (activeTests.length > 0) {
          setSelectedBeltTestId(activeTests[0].id);
        }
      } catch (err) {
        console.error("Failed to load active belt test", err);
      }
    };
    init();
  }, []);

  // Secretaries pick any school at registration time rather than needing to
  // link one first, so pull the full active school list here.
  useEffect(() => {
    firebaseSchoolService.getActive().then(setAllSchools).catch((err) => {
      console.error("Failed to load schools", err);
    });
  }, []);

  const checkDuplicate = (s: any, currentBatch: any[] = [], currentIndex: number = -1): { error: string | false, warning: string | false } => {
    let error: string | false = false;
    let warning: string | false = false;

    // Error check: mobile + standard + program level match
    const exactMatchDB = existingStudents.some(es => 
      (String(es.whatsapp).trim() === String(s.whatsapp).trim()) &&
      (String(es.standard).trim() === String(s.standard).trim()) &&
      (s.programType === 'KARATE' ? String(es.beltLevel).trim() === String(s.beltLevel).trim() : String(es.stageLevel) === String(s.stageLevel))
    );
    if (exactMatchDB) {
      error = "Database";
    }

    if (!error) {
      const exactMatchBatchIndex = currentBatch.findIndex(es => 
        (String(es.whatsapp).trim() === String(s.whatsapp).trim()) &&
        (String(es.standard).trim() === String(s.standard).trim()) &&
        (s.programType === 'KARATE' ? String(es.beltLevel).trim() === String(s.beltLevel).trim() : String(es.stageLevel) === String(s.stageLevel))
      );
      if (exactMatchBatchIndex !== -1) {
        error = currentIndex !== -1 ? `Student #${currentIndex + 1}` : `Student`;
      }
    }

    if (!error) {
      // Warning check: only mobile number matches
      const mobileMatchDB = existingStudents.some(es => String(es.whatsapp).trim() === String(s.whatsapp).trim());
      if (mobileMatchDB) {
        warning = "Same parent mobile exists in Database";
      } else {
        const mobileMatchBatchIndex = currentBatch.findIndex(es => String(es.whatsapp).trim() === String(s.whatsapp).trim());
        if (mobileMatchBatchIndex !== -1) {
          warning = `Same parent mobile as ${currentIndex !== -1 ? `Student #${currentIndex + 1}` : `Student`}`;
        }
      }
    }

    return { error, warning };
  };

  const totalFee = students.reduce((sum, student) => sum + (student.fee || 0), 0);

  const handleRegisterStudents = async () => {
    if (students.length === 0) return;
    
    // In manual mode, we require the global dropdown selection
    if (!selectedBeltTestId) {
      setError("Please select an active belt test / event first.");
      return;
    }

    const user = firebaseAuthService.getCurrentUser();
    if (!user) {
      setError("You are not authenticated.");
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
        showToast("Registering students...", "info");
        const studentsPayload: any[] = [];

        for (const s of students) {
          const { tempId, fee, duplicateStatus, ...rest } = s;

          const testIdToUse = s.beltTestId || selectedBeltTestId;
          const studentTest = allBeltTests.find((t: any) => t.id === testIdToUse);
          if (!studentTest) {
            throw new Error(`No active belt test found for student ${s.name}!`);
          }

          studentsPayload.push({
            ...rest,
            qrUrl: "",
            secretaryId: user.uid,
            paymentStatus: "pending",   // Starts as pending — Admin confirms manually
            batchId: null,
            refereeId: null,
            beltTestId: studentTest.id,
            testStatus: "pending",
            paymentDetails: {
              amount: fee || 0,
              testDate: studentTest.date,
              testTime: studentTest.time,
            },
            registeredAt: new Date().toISOString(),
          });
        }

        // Write directly to Firestore — no backend API needed
        let savedCount = 0;
        let whatsappSentCount = 0;
        const backendUrl = import.meta.env.VITE_API_BASE_URL || "";
        for (const sp of studentsPayload) {
          try {
            const cleanData = JSON.parse(JSON.stringify(sp));
            await firebaseStudentService.add(cleanData);
            savedCount++;
          } catch (err) {
            console.error(`Failed to save student ${sp.name}:`, err);
            continue;
          }

          // Generate + upload the hall ticket and queue the WhatsApp notification,
          // same as the public registration flow does via HallTicketPage. Kept in
          // its own try/catch — a notification failure must not undo the student's
          // registration, only surface as "failed" on the summary screen below.
          try {
            const studentTest = allBeltTests.find((t: any) => t.id === sp.beltTestId);
            const blob = await generateSingleHallTicketBlob({
              id: sp.id,
              name: sp.name,
              gender: sp.gender,
              school: sp.school,
              standard: sp.standard,
              contact: sp.contact,
              whatsapp: sp.whatsapp,
              programType: sp.programType,
              beltLevel: sp.beltLevel,
              stageLevel: sp.stageLevel,
              eventInfo: studentTest ? {
                name: studentTest.name,
                date: studentTest.date,
                time: studentTest.time,
                venue: studentTest.venue,
                locationAddress: studentTest.locationAddress,
                locationLink: studentTest.locationLink,
              } : undefined,
            });
            const { downloadURL } = await uploadHallTicketPDF(sp.id, blob, sp.programType);
            const { data } = await fetchJson(`${backendUrl}/api/whatsapp/send-registration-whatsapp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
              body: JSON.stringify({ studentId: sp.id, pdfUrl: downloadURL }),
            });
            if (data.success) {
              sp.registrationWhatsappStatus = 'queued';
              whatsappSentCount++;
            } else {
              sp.registrationWhatsappStatus = 'failed';
            }
          } catch (waErr) {
            console.error(`Failed to send WhatsApp notification for student ${sp.name}:`, waErr);
            sp.registrationWhatsappStatus = 'failed';
          }
        }

        if (savedCount === 0) throw new Error("No students could be saved. Check Firestore permissions.");

        setGeneratedStudents(studentsPayload);
        setRegistrationSuccess(true);
        setStudents([]);
        setUploadDuplicates([]);
        setDatabaseDuplicates([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        sessionStorage.removeItem('manual_bulk_data');
        sessionStorage.removeItem('manual_bulk_count');
        showToast(
          `${savedCount} students registered! ${whatsappSentCount}/${savedCount} WhatsApp notifications sent. Awaiting Admin confirmation.`,
          "success"
        );
        setIsRegistering(false);
        return;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred.");
      setIsRegistering(false);
    }
  };


  const handleDownloadReceipts = async () => {
    if (!receiptData) return;
    try {
      showToast("Generating receipts, please wait...", "info");
      const user = firebaseAuthService.getCurrentUser();
      const finalReceiptData = {
        ...receiptData,
        secretaryName: user?.displayName || "Secretary"
      };
      const result = await generateBulkRegistrationReceipt(finalReceiptData, false);
      if (result) {
         // handle blob if needed, but it's downloaded by default
      }
    } catch (err: any) {
      console.error(err);
      showToast("Failed to generate receipts.", "error");
    }
  };

  const handleDownloadHallTickets = async () => {
    if (!generatedStudents || generatedStudents.length === 0) return;
    try {
      showToast("Generating hall tickets, please wait...", "info");
      await generateBulkHallTickets(
        generatedStudents.map(s => {
          const test = allBeltTests.find(t => t.id === selectedBeltTestId);
          return {
            id: s.id,
            name: s.name,
            gender: s.gender,
            school: s.school,
            standard: s.standard,
            contact: s.contact,
            whatsapp: s.whatsapp,
            programType: s.programType,
            beltLevel: s.beltLevel,
            stageLevel: s.stageLevel,
            qrData: s.qrUrl || s.qrData || JSON.stringify({id: s.id, name: s.name, belt: s.beltLevel || "Belt Test", school: s.school}),
            eventInfo: test ? {
              name: test.name,
              date: test.date,
              time: test.time,
              venue: test.venue,
              locationAddress: test.locationAddress,
              locationLink: test.locationLink
            } : undefined
          };
        })
      );
    } catch (err: any) {
      console.error(err);
      showToast("Failed to generate hall tickets.", "error");
    }
  };

  const handleRefreshStatuses = async () => {
    if (!generatedStudents || generatedStudents.length === 0) return;
    showToast("Refreshing statuses...", "info");
    try {
      const updatedStudents = await Promise.all(
        generatedStudents.map(async (s) => {
          const freshData = await firebaseStudentService.getById(s.id);
          if (freshData) {
            const actualStatus = freshData.whatsappStatus || freshData.registrationWhatsappStatus || 'pending';
            return { ...s, registrationWhatsappStatus: actualStatus };
          }
          return s;
        })
      );
      setGeneratedStudents(updatedStudents);
      showToast("Statuses updated!", "success");
    } catch (err) {
      console.error("Error refreshing statuses:", err);
      showToast("Failed to refresh statuses", "error");
    }
  };

  const handleRetryWhatsApp = async (studentId: string) => {
    try {
      showToast(`Retrying WhatsApp for ${studentId}...`, "info");
      const backendUrl = import.meta.env.VITE_API_BASE_URL || "";
      const { data } = await fetchJson(`${backendUrl}/api/whatsapp/send-registration-whatsapp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ studentId })
      });
      if (data.success) {
        showToast("WhatsApp queued successfully", "success");
        handleRefreshStatuses(); // Refresh after a short delay or immediately
      } else {
        throw new Error(data.message || "Failed to trigger retry");
      }
    } catch (err: any) {
      console.error("Retry WhatsApp error:", err);
      showToast(err.message || "Retry failed", "error");
    }
  };

  const selectedEvent = allBeltTests.find(t => t.id === selectedBeltTestId);
  const selectedProgram = selectedEvent?.programType?.toUpperCase() === 'SELAMBAM' || selectedEvent?.programType?.toUpperCase() === 'SILAMBAM' ? 'SELAMBAM' : 'KARATE';
  const availableSchools = allSchools.filter(s => {
    const pType = (s as any).programType?.toUpperCase();
    if (!pType) return true; // no programType set → show in all programs
    return pType === selectedProgram || (selectedProgram === 'SELAMBAM' && pType === 'SILAMBAM');
  });

  return (
    <SecretaryLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-950 dark:text-white uppercase tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              Bulk Registration
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Register multiple students via manual entry or Excel/CSV upload.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              {selectedBeltTestId && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-4 py-2 rounded-xl">
                  <p className="text-xs text-blue-700 dark:text-blue-500 font-bold uppercase tracking-wider">Selected Event</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">{allBeltTests.find(t => t.id === selectedBeltTestId)?.name}</p>
                </div>
              )}
            </div>
          </div>
        </div>


        {error && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {!selectedBeltTestId ? (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
            <SchoolIcon className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400 mb-4">Please select an Event / Belt Test to start registering students.</p>
          </div>
        ) : registrationSuccess ? (
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-sm">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Registration Successful!</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md mx-auto">
              {generatedStudents.length} students have been successfully registered.
            </p>
            <div className="flex flex-col gap-6">
              <div className="flex justify-center gap-4 flex-wrap">
                <button
                  onClick={handleDownloadReceipts}
                  className="px-6 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl font-bold transition-colors flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Receipts
                </button>
                <button
                  onClick={handleDownloadHallTickets}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl font-bold transition-colors flex items-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Hall Tickets
                </button>
                <button
                  onClick={handleRefreshStatuses}
                  className="px-6 py-3 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl font-bold transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Refresh Status
                </button>
                <button
                  onClick={() => {
                    setRegistrationSuccess(false);
                    setGeneratedStudents([]);
                    setIsRegistering(false);
                  }}
                  className="px-6 py-3 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl font-bold transition-colors"
                >
                  Register More
                </button>
              </div>

              {/* WhatsApp Status Table */}
              <div className="mt-8 text-left bg-zinc-50 dark:bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap justify-between items-center gap-3">
                  <h3 className="font-bold text-zinc-900 dark:text-white">WhatsApp Delivery Status</h3>
                  <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full font-medium">Auto-queued to Cloud Tasks</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-100/50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 font-semibold">
                      <tr>
                        <th className="px-6 py-3">Student Name</th>
                        <th className="px-6 py-3">Student ID</th>
                        <th className="px-6 py-3">WhatsApp Number</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {generatedStudents.map((s, idx) => {
                        const status = s.registrationWhatsappStatus || 'queued';
                        let statusColor = "text-zinc-500 bg-zinc-100 dark:bg-zinc-800";
                        if (status === 'sent' || status === 'success') statusColor = "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/10";
                        else if (status === 'queued') statusColor = "text-blue-600 bg-blue-100 dark:bg-blue-500/10";
                        else if (status === 'failed') statusColor = "text-red-600 bg-red-100 dark:bg-red-500/10";

                        return (
                          <tr key={idx} className="bg-white dark:bg-zinc-950">
                            <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{s.name}</td>
                            <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{s.id}</td>
                            <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">{s.whatsapp}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor}`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {status === 'failed' ? (
                                <button
                                  onClick={() => handleRetryWhatsApp(s.id)}
                                  className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  Retry
                                </button>
                              ) : (
                                <span className="text-xs text-zinc-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Belt Test Selection */}
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Select Event / Belt Test</h2>
                  <select 
                    value={selectedBeltTestId}
                    onChange={(e) => setSelectedBeltTestId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">-- Select a test --</option>
                    {allBeltTests.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.programType})</option>
                    ))}
                  </select>
                </div>

              {/* Main Content Area */}
                <ManualBulkEntry
                  selectedProgram={selectedProgram}
                  availableSchools={availableSchools}
                  onStudentsGenerated={(generated) => {
                    const mapped: any[] = [];
                    for (let i = 0; i < generated.length; i++) {
                      mapped.push({
                        ...generated[i],
                        duplicateStatus: checkDuplicate(generated[i], mapped, i)
                      });
                    }
                    setStudents(mapped);
                  }} 
                />

              {/* Data Preview */}
              {students.length > 0 && (
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-zinc-400" />
                      Validation Results ({students.length} Total)
                    </h3>
                    {isCheckingDuplicates && <span className="text-blue-500 text-sm font-bold animate-pulse">Checking database...</span>}
                  </div>
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    {/* Desktop Table View */}
                    <div className="hidden md:block w-full">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="sticky top-0 bg-white dark:bg-zinc-950 shadow-sm z-10">
                        <tr className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          <th className="p-3 border-b border-zinc-200 dark:border-zinc-800">Name</th>
                          <th className="p-3 border-b border-zinc-200 dark:border-zinc-800">Program</th>
                          <th className="p-3 border-b border-zinc-200 dark:border-zinc-800">School</th>
                          <th className="p-3 border-b border-zinc-200 dark:border-zinc-800">Level</th>
                          <th className="p-3 border-b border-zinc-200 dark:border-zinc-800 text-right">Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {students.map((s, idx) => (
                          <tr key={idx} className={`${s.duplicateStatus?.error ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30' : s.duplicateStatus?.warning ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'}`}>
                            <td className="p-3 font-medium text-zinc-900 dark:text-zinc-200 flex flex-col gap-1 items-start">
                              <span>{s.name}</span>
                              {s.duplicateStatus?.error && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider">
                                  <AlertTriangle className="w-3 h-3" /> {s.duplicateStatus.error === 'Database' ? 'Duplicate in Database' : `Duplicate: ${s.duplicateStatus.error}`}
                                </span>
                              )}
                              {s.duplicateStatus?.warning && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                  <AlertTriangle className="w-3 h-3" /> {s.duplicateStatus.warning}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-zinc-600 dark:text-zinc-400">{s.programType}</td>
                            <td className="p-3 text-zinc-600 dark:text-zinc-400 truncate max-w-[150px]">{s.school}</td>
                            <td className="p-3 text-zinc-600 dark:text-zinc-400">{s.programType === 'KARATE' ? s.beltLevel : `Stage ${s.stageLevel}`}</td>
                            <td className="p-3 text-right font-medium text-zinc-900 dark:text-zinc-200">₹{s.fee}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                      {students.map((s, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border flex flex-col gap-2 ${s.duplicateStatus?.error ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/30' : s.duplicateStatus?.warning ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-900/30' : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800'}`}>
                          <div className="flex justify-between items-start">
                            <div className="font-bold text-zinc-900 dark:text-white text-lg">
                              {s.name}
                            </div>
                            <div className="font-bold text-zinc-900 dark:text-white text-lg">
                              ₹{s.fee}
                            </div>
                          </div>
                          
                          {s.duplicateStatus?.error && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider">
                                <AlertTriangle className="w-3 h-3" /> {s.duplicateStatus.error === 'Database' ? 'Duplicate in Database' : `Duplicate: ${s.duplicateStatus.error}`}
                              </span>
                            </div>
                          )}
                          {s.duplicateStatus?.warning && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                                <AlertTriangle className="w-3 h-3" /> {s.duplicateStatus.warning}
                              </span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 text-sm mt-1">
                            <div>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Program / Level</p>
                              <p className="text-zinc-800 dark:text-zinc-200 font-medium">
                                {s.programType} - {s.programType === 'KARATE' ? s.beltLevel : `Stage ${s.stageLevel}`}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">School</p>
                              <p className="text-zinc-800 dark:text-zinc-200 font-medium truncate">{s.school}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* UPLOAD DUPLICATES */}
                    {uploadDuplicates.length > 0 && (
                      <div>
                        <h4 className="font-bold text-blue-600 dark:text-blue-500 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Duplicate in Upload ({uploadDuplicates.length})
                        </h4>
                        <p className="text-xs text-blue-600 mb-2">These students appear multiple times in the file you uploaded. Only the first instance is kept.</p>
                        <div className="overflow-x-auto rounded-xl border border-blue-100 dark:border-blue-900/30">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-500">
                              <tr>
                                <th className="p-3 font-semibold">Name</th>
                                <th className="p-3 font-semibold">School</th>
                                <th className="p-3 font-semibold">Phone</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-50 dark:divide-amber-900/10">
                              {uploadDuplicates.map((s, idx) => (
                                <tr key={idx} className="bg-white dark:bg-zinc-950">
                                  <td className="p-3 font-medium text-zinc-900 dark:text-zinc-200">{s.name}</td>
                                  <td className="p-3 text-zinc-600 dark:text-zinc-400">{s.school}</td>
                                  <td className="p-3 text-zinc-600 dark:text-zinc-400">{s.whatsapp || s.contact}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* DATABASE DUPLICATES */}
                    {databaseDuplicates.length > 0 && (
                      <div>
                        <h4 className="font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Already Registered ({databaseDuplicates.length})
                        </h4>
                        <p className="text-xs text-red-600 mb-2">These students are already registered for this exact event. They will be skipped.</p>
                        <div className="overflow-x-auto rounded-xl border border-red-100 dark:border-red-900/30">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-500">
                              <tr>
                                <th className="p-3 font-semibold">Name</th>
                                <th className="p-3 font-semibold">School</th>
                                <th className="p-3 font-semibold">Phone</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-red-50 dark:divide-red-900/10">
                              {databaseDuplicates.map((s, idx) => (
                                <tr key={idx} className="bg-white dark:bg-zinc-950">
                                  <td className="p-3 font-medium text-zinc-900 dark:text-zinc-200">{s.name}</td>
                                  <td className="p-3 text-zinc-600 dark:text-zinc-400">{s.school}</td>
                                  <td className="p-3 text-zinc-600 dark:text-zinc-400">{s.whatsapp || s.contact}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>

            {/* Registration Summary */}
            <div className="lg:col-span-1">
              <div className="bg-zinc-950 dark:bg-zinc-900 text-white rounded-2xl p-6 shadow-xl sticky top-24">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  Registration Summary
                </h3>

                <div className="space-y-4 mb-6">
                  <div className="flex flex-wrap justify-between items-center gap-3 py-2 border-b border-zinc-800">
                    <span className="text-zinc-400">Total Valid Students</span>
                    <span className="font-bold text-lg">{students.length}</span>
                  </div>
                  <div className="flex flex-wrap justify-between items-center gap-3 py-2 border-b border-zinc-800">
                    <span className="text-zinc-400">Test Fees</span>
                    <span className="font-bold">₹{totalFee.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-zinc-900 dark:bg-zinc-950 p-4 rounded-xl mb-6 border border-zinc-800">
                  <div className="flex justify-between items-end">
                    <span className="text-zinc-400 font-medium">Total Amount</span>
                    <span className="text-3xl font-bold text-blue-500">₹{totalFee.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={handleRegisterStudents}
                  disabled={students.length === 0 || isRegistering || students.some(s => s.duplicateStatus?.error) || !selectedBeltTestId}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-zinc-950 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isRegistering ? (
                    <>
                      <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
                      Registering...
                    </>
                  ) : (
                    <>
                      Register {students.length > 0 ? students.length : ''} Students
                    </>
                  )}
                </button>
                
                {students.some(s => s.duplicateStatus?.error) && (
                  <p className="text-red-400 text-xs text-center mt-3 flex items-center justify-center gap-1 font-semibold bg-red-400/10 p-2 rounded-lg">
                    <AlertTriangle className="w-4 h-4" /> Resolve duplicates before proceeding.
                  </p>
                )}

                {!selectedBeltTestId && (
                  <p className="text-red-400 text-xs text-center mt-3 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> No belt test selected.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </SecretaryLayout>
  );
}
