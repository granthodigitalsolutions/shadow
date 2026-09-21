import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, QrCode, UserPlus, CheckCircle, XCircle, Users, Building2, ArrowRight, X, Upload, Camera } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { serverTimestamp } from "firebase/firestore";
import {
 firebaseBatchService,
 firebaseStudentService,
 firebaseBeltTestService,
 firebaseSchoolService,
 firebaseRefereeService,
} from "../../services/firebaseData";
import { auth } from "../../config/firebase";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useToast } from "../../hooks/useToast";
import { Batch, StudentRecord, BeltTest, School, Referee } from "../../types/admin";
import { formatBatchName } from "../../utils/batchFormatters";

export default function BatchScanner() {
 const navigate = useNavigate();
 const { batchId } = useParams();
 const { showToast } = useToast();

 const [batch, setBatch] = useState<Batch | null>(null);
 const [referee, setReferee] = useState<Referee | null>(null);
 const [beltTest, setBeltTest] = useState<BeltTest | null>(null);
 const [batchSchool, setBatchSchool] = useState<School | null>(null);
 const [students, setStudents] = useState<StudentRecord[]>([]);
 const [totalAssignedCount, setTotalAssignedCount] = useState<number>(0);
 const [scanning, setScanning] = useState(false);
 const [loading, setLoading] = useState(true);
 const [cameraError, setCameraError] = useState<string | null>(null);
 const [processingImage, setProcessingImage] = useState(false);
 const [isScanningProcess, setIsScanningProcess] = useState(false);
 const [manualStudentId, setManualStudentId] = useState("SKT-");
 const [lastAddedStudent, setLastAddedStudent] = useState<{ name: string; beltLevel: string } | null>(null);
 const scannerRef = useRef<Html5Qrcode | null>(null);
 const scannerStarted = useRef(false);
 const isProcessingRef = useRef(false); // prevents concurrent processing
 const scannedInSessionRef = useRef<Set<string>>(new Set()); // tracks all IDs added this session
 const fileInputRef = useRef<HTMLInputElement | null>(null);
 const batchRef = useRef<Batch | null>(null); // always-current batch (avoids stale closure)
 const studentsEndRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 studentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [students.length]);

 const handleManualIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 // Replace all spaces with hyphens automatically
 let val = e.target.value.toUpperCase().replace(/ /g, '-');
 if (!val.startsWith("SKT-")) {
 const remainder = val.replace(/^S?K?T?-?/, "");
 val = "SKT-" + remainder;
 }
 setManualStudentId(val);
 };

 // Keep batchRef in sync with batch state so async callbacks always have fresh data
 useEffect(() => { batchRef.current = batch; }, [batch]);

 // Transfer modal for individual students scanning into a school batch
 const [transferModal, setTransferModal] = useState<{
 open: boolean;
 student: StudentRecord | null;
 confirming: boolean;
 }>({ open: false, student: null, confirming: false });

 // Warning modal for school students scanning into an individual batch
 const [schoolToIndividualModal, setSchoolToIndividualModal] = useState<{
 open: boolean;
 student: StudentRecord | null;
 confirming: boolean;
 }>({ open: false, student: null, confirming: false });

 useEffect(() => {
 fetchBatchData();
 }, [batchId]);

 useEffect(() => {
 if (!scanning) return;
 let cancelled = false;

 const startCamera = async () => {
 await new Promise(resolve => setTimeout(resolve, 200));
 if (cancelled || !document.getElementById('qr-reader')) return;

 setCameraError(null);

 try {
 const html5Qrcode = new Html5Qrcode('qr-reader');
 scannerRef.current = html5Qrcode;

 await html5Qrcode.start(
 { facingMode: 'environment' },
 { fps: 10, qrbox: { width: 250, height: 250 } },
 async (decodedText) => {
 let parsedId = decodedText;
 try {
 const parsed = JSON.parse(decodedText);
 if (parsed && (parsed.id || parsed.studentId)) {
 parsedId = parsed.id || parsed.studentId;
 }
 } catch (e) {}

 // Guard 1: already being processed
 if (isProcessingRef.current) return;
 // Guard 2: already added this session
 if (scannedInSessionRef.current.has(parsedId)) return;

 // Lock immediately — synchronous, blocks all future frames
 isProcessingRef.current = true;

 // Stop camera immediately before async work to prevent more callbacks
 if (scannerRef.current && scannerStarted.current) {
 try { await scannerRef.current.stop(); } catch (_) {}
 scannerStarted.current = false;
 }
 setScanning(false);

 await validateAndAddStudent(parsedId);

 // Unlock for next manual scan
 isProcessingRef.current = false;
 },
 () => {
 // Suppress per-frame errors
 }
 );
 scannerStarted.current = true;
 } catch (error: any) {
 if (cancelled) return;
 console.error('Scanner initialization error:', error);
 const name = error?.name || '';
 const msg = error?.message || '';
 if (name === 'NotAllowedError' || msg.includes('NotAllowedError')) {
 setCameraError('📷 Camera permission denied. Please allow camera access and try again.');
 } else if (name === 'NotFoundError' || msg.includes('NotFoundError')) {
 setCameraError('📷 No camera found on this device.');
 } else {
 setCameraError('📷 Unable to start camera. Please check your browser settings and try again.');
 }
 }
 };

 startCamera();

 return () => {
 cancelled = true;
 if (scannerRef.current && scannerStarted.current) {
 scannerRef.current.stop().catch(() => {});
 scannerStarted.current = false;
 }
 scannerRef.current = null;
 };
 }, [scanning]);

 const fetchBatchData = async () => {
 if (!batchId) return;

 try {
 const user = auth.currentUser;
 if (!user) {
 navigate("/referee/login");
 return;
 }

 const refereeData = await firebaseRefereeService.getByUid(user.uid);
 if (!refereeData) {
 showToast("Referee not found", "error");
 await auth.signOut();
 navigate("/referee/login");
 return;
 }
 setReferee(refereeData);

 const batchData = await firebaseBatchService.getById(batchId);

 if (!batchData) {
 showToast("Batch not found", "error");
 navigate("/referee/dashboard");
 return;
 }

 if (!batchData.refereeIds?.includes(refereeData.id)) {
 showToast("You are not assigned to this batch", "error");
 navigate("/referee/dashboard");
 return;
 }

 setBatch(batchData);

 const testData = await firebaseBeltTestService.getById(batchData.beltTestId);
 setBeltTest(testData);

 // Fetch school info for the batch (if it's a school batch)
 if (batchData.schoolId && batchData.schoolId !== "individual") {
 const schoolData = await firebaseSchoolService.getById(batchData.schoolId);
 setBatchSchool(schoolData);
 } else {
 setBatchSchool(null);
 }

 if (batchData.studentIds && batchData.studentIds.length > 0) {
 const allStudents = await firebaseStudentService.getAll();
 const studentsData = batchData.studentIds.map(id => allStudents.find(s => s.id === id));
 const validStudents = studentsData.filter((s) => s !== undefined) as StudentRecord[];
 const refereeStudents = validStudents.filter((s) => 
 s.refereeId === refereeData.id && 
 (!s.testStatus || s.testStatus === "pending")
 );
 setStudents(refereeStudents);
 setTotalAssignedCount(validStudents.filter(s => s.refereeId === refereeData.id).length);
 } else {
 setStudents([]);
 setTotalAssignedCount(0);
 }
 } catch (error) {
 console.error("Error fetching batch data:", error);
 showToast("Error loading batch", "error");
 } finally {
 setLoading(false);
 }
 };

 const validateAndAddStudent = async (studentId: string) => {
 if (!batch) return;

 setIsScanningProcess(true);
 try {
 const student = await firebaseStudentService.getById(studentId);

 if (!student) {
 showToast("Student not found", "error");
 return;
 }

 // Validation 1: Check payment status
 if (student.paymentStatus !== "verified") {
 showToast(`${student.name}: Payment not verified`, "error");
 return;
 }

 // Validation 2: Check if student already in this batch (use ref for fresh data)
 const currentBatch = batchRef.current;
 if (!currentBatch) return;
 if (currentBatch.studentIds.includes(studentId) || scannedInSessionRef.current.has(studentId)) {
 showToast(`${student.name}: Already in this batch`, "info");
 return;
 }

 // Validation 3: Check batch capacity
 if (currentBatch.studentIds.length >= currentBatch.maxSize) {
 showToast("Batch is full!", "error");
 return;
 }

 // Validation 4: Check if student already in another batch for same test
 const allBatches = await firebaseBatchService.getByBeltTest(currentBatch.beltTestId);
 const studentInAnotherBatch = allBatches.find(
 (b) => b.id !== currentBatch.id && b.studentIds.includes(studentId)
 );

 if (studentInAnotherBatch) {
 showToast(
 `${student.name}: Already in ${formatBatchName(studentInAnotherBatch)}`,
 "error"
 );
 return;
 }

 // Validation 5 (updated): School validation with individual student transfer flow
 const isSchoolBatch = currentBatch.schoolId && currentBatch.schoolId !== "individual";
 const isIndividualStudent =
 student.registrationType === "individual" || student.schoolId === "individual";

 if (isSchoolBatch && isIndividualStudent) {
 // Show transfer confirmation modal instead of blocking
 setTransferModal({ open: true, student, confirming: false });
 return;
 }

 if (!isSchoolBatch && !isIndividualStudent) {
 // Show confirmation modal for adding school student to individual batch
 setSchoolToIndividualModal({ open: true, student, confirming: false });
 return;
 }

 if (isSchoolBatch && student.schoolId !== currentBatch.schoolId) {
 const school = await firebaseSchoolService.getById(currentBatch.schoolId!);
 showToast(
 `${student.name} is registered in "${student.school || "another school"}". But this batch is strictly for "${school?.name || "a different school"}".`,
 "error"
 );
 return;
 }

 // Mark in session before async add (prevents race condition)
 scannedInSessionRef.current.add(studentId);

 // All validations passed — add student to batch
 await addStudentToBatch(studentId, student);
 } catch (error) {
 console.error("Error adding student:", error);
 showToast("Error adding student to batch", "error");
 scannedInSessionRef.current.delete(studentId);
 } finally {
 setIsScanningProcess(false);
 }
 };

 const addStudentToBatch = async (studentId: string, student: StudentRecord) => {
 const currentBatch = batchRef.current;
 if (!currentBatch) return;
 const updatedStudentIds = [...currentBatch.studentIds, studentId];

 await firebaseBatchService.update(currentBatch.id, {
 studentIds: updatedStudentIds,
 status: updatedStudentIds.length >= currentBatch.maxSize ? "ongoing" : "filling",
 });

 const allocatedRefId = await firebaseBatchService.allocateNewStudent(currentBatch.id, studentId, referee?.id);

 if (referee && allocatedRefId !== referee.id) {
 showToast(`✓ ${student.name} added to batch (allocated to other referee)!`, "success");
 } else {
 showToast(`✓ ${student.name} added to batch and allocated to you!`, "success");
 }
 
 // Surgical UI state update (immediate visibility, 0 extra reads)
 const now = new Date().toISOString();
 const updatedStudent: StudentRecord = {
 ...student,
 batchId: currentBatch.id,
 refereeId: allocatedRefId,
 scannedAt: now,
 updatedAt: now,
 };
 
 setBatch(prev => prev ? {
 ...prev,
 studentIds: updatedStudentIds,
 status: updatedStudentIds.length >= prev.maxSize ? "ongoing" : "filling"
 } : null);
 
 if (referee && allocatedRefId === referee.id) {
 setStudents(prev => [...prev, updatedStudent]);
 setTotalAssignedCount(prev => prev + 1);
 }

 // Show success state with student name for "Scan Another" flow
 setLastAddedStudent({ name: student.name, beltLevel: student.beltLevel || "" });
 };

 // Called when referee confirms transferring individual student to this batch's school
 const handleConfirmTransfer = async () => {
 const { student } = transferModal;
 if (!student || !batch || !batchSchool) return;

 setTransferModal((prev) => ({ ...prev, confirming: true }));
 try {
 const schoolName = `${batchSchool.name} - ${batchSchool.branch}`;
 await firebaseStudentService.transferToSchool(student.id, batch.schoolId!, schoolName);
 showToast(`${student.name} transferred to ${batchSchool.name}`, "success");
 setTransferModal({ open: false, student: null, confirming: false });
 // Now add to batch using updated student data
 await addStudentToBatch(student.id, { ...student, schoolId: batch.schoolId!, school: schoolName, registrationType: "school" });
 } catch (error) {
 console.error("Transfer error:", error);
 showToast("Transfer failed", "error");
 setTransferModal((prev) => ({ ...prev, confirming: false }));
 }
 };

 // Called when referee confirms adding a school student to an individual batch
 const handleConfirmSchoolToIndividual = async () => {
 const { student } = schoolToIndividualModal;
 if (!student || !batch) return;

 setSchoolToIndividualModal((prev) => ({ ...prev, confirming: true }));
 try {
 setSchoolToIndividualModal({ open: false, student: null, confirming: false });
 // Now add to batch using existing student data
 await addStudentToBatch(student.id, student);
 } catch (error) {
 console.error("Adding student error:", error);
 showToast("Adding student failed", "error");
 setSchoolToIndividualModal((prev) => ({ ...prev, confirming: false }));
 }
 };

 const handleStartScanning = () => {
 setLastAddedStudent(null);
 setScanning(true);
 };

 const handleStopScanning = async () => {
 if (scannerRef.current && scannerStarted.current) {
 try { await scannerRef.current.stop(); } catch (_) {}
 scannerStarted.current = false;
 }
 scannerRef.current = null;
 isProcessingRef.current = false;
 setScanning(false);
 setCameraError(null);
 };

 const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 setProcessingImage(true);

 const reader = new FileReader();
 reader.onload = (e) => {
 const img = new Image();
 img.onload = () => {
 const canvas = document.createElement('canvas');
 const ctx = canvas.getContext('2d');

 if (!ctx) {
 showToast("Failed to process image", "error");
 setProcessingImage(false);
 return;
 }

 canvas.width = img.width;
 canvas.height = img.height;
 ctx.drawImage(img, 0, 0);

 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
 const code = jsQR(imageData.data, imageData.width, imageData.height);

 if (code) {
 let parsedId = code.data;
 try {
 const parsed = JSON.parse(code.data);
 if (parsed && (parsed.id || parsed.studentId)) {
 parsedId = parsed.id || parsed.studentId;
 }
 } catch (e) {
 // Fallback: If JSON parsing fails (e.g. older QR codes containing URLs), try to extract the SKT ID via regex
 const match = code.data.match(/SKT-\d{4}-\d+/i);
 if (match) {
 parsedId = match[0].toUpperCase();
 } else {
 // Try to see if it's an api.qrserver.com URL with a data param
 try {
 if (code.data.includes("api.qrserver.com")) {
 const url = new URL(code.data);
 const dataParam = url.searchParams.get("data");
 if (dataParam) {
 const parsedUrlData = JSON.parse(decodeURIComponent(dataParam));
 if (parsedUrlData && (parsedUrlData.id || parsedUrlData.studentId)) {
 parsedId = parsedUrlData.id || parsedUrlData.studentId;
 }
 }
 }
 } catch (e2) {}
 }
 }

 validateAndAddStudent(parsedId);
 setProcessingImage(false);

 // Reset file input
 if (fileInputRef.current) {
 fileInputRef.current.value = '';
 }
 } else {
 showToast("No QR code found in image", "error");
 setProcessingImage(false);
 }
 };

 img.onerror = () => {
 showToast("Failed to load image", "error");
 setProcessingImage(false);
 };

 img.src = e.target?.result as string;
 };

 reader.onerror = () => {
 showToast("Failed to read file", "error");
 setProcessingImage(false);
 };

 reader.readAsDataURL(file);
 };

 const handleImportPhotoClick = () => {
 fileInputRef.current?.click();
 };

 const handleProceedToScoring = async () => {
 if (!batch) return;

 if (batch.studentIds.length === 0) {
 showToast("Please add at least one student before proceeding", "error");
 return;
 }

 try {
 await firebaseBatchService.update(batch.id, {
 status: "ongoing",
 startedAt: new Date().toISOString(),
 });

 navigate(`/referee/batch/${batch.id}/score`);
 } catch (error) {
 console.error("Error updating batch status:", error);
 showToast("Error proceeding to scoring", "error");
 }
 };

 const isBatchFull = batch ? batch.studentIds.length >= batch.maxSize : false;
 const isIndividualBatch = batch ? batch.schoolId === "individual" : false;

 // Auto-stop scanning if batch becomes full
 useEffect(() => {
 if (isBatchFull && scanning) {
 handleStopScanning();
 }
 }, [isBatchFull, scanning]);

 if (loading) {
 return (
 <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading batch...</p>
 </div>
 </div>
 );
 }

 if (!batch) {
 return null;
 }

 return (
 <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 {/* Header */}
 <div className="bg-zinc-950 text-white p-4 border-b-4 border-blue-500">
 <div className="container mx-auto max-w-5xl">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
 <button
 onClick={() => navigate("/referee/dashboard")}
 className="flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-sm transition-colors"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Dashboard
 </button>
 <ThemeToggle />
 </div>
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div>
 <h1
 className="text-4xl font-bold tracking-tight text-white mb-2"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 {formatBatchName(batch).toUpperCase()}
 <span className="text-blue-500 ml-3">QR SCANNER</span>
 </h1>
 <div className="flex items-center gap-3">
 <span className="bg-zinc-800 px-3 py-1 rounded-md text-xs font-bold text-zinc-300 uppercase tracking-wider">
 {isIndividualBatch ? "Individual Students" : batchSchool?.name || "School Batch"}
 </span>
 <span className="text-sm font-medium text-zinc-400">
 {(() => {
 const refIndex = batch.refereeIds?.indexOf(referee?.id || "") ?? -1;
 const numReferees = batch.refereeIds?.length || 1;
 const baseCap = Math.floor(batch.maxSize / numReferees);
 const extra = batch.maxSize % numReferees;
 const myCapacity = refIndex !== -1 ? (refIndex < extra ? baseCap + 1 : baseCap) : batch.maxSize;
 return `${totalAssignedCount} / ${myCapacity} Students`;
 })()}
 </span>
 </div>
 </div>
 <div className="text-right bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 backdrop-blur-sm">
 <div className="flex items-baseline gap-1 justify-end">
 {(() => {
 const refIndex = batch.refereeIds?.indexOf(referee?.id || "") ?? -1;
 const numReferees = batch.refereeIds?.length || 1;
 const baseCap = Math.floor(batch.maxSize / numReferees);
 const extra = batch.maxSize % numReferees;
 const myCapacity = refIndex !== -1 ? (refIndex < extra ? baseCap + 1 : baseCap) : batch.maxSize;
 return (
 <>
 <span className="text-4xl font-bold text-blue-500">{totalAssignedCount}</span>
 <span className="text-xl font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">/{myCapacity}</span>
 </>
 );
 })()}
 </div>
 <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">My Capacity</div>
 </div>
 </div>
 </div>
 </div>

 {/* Main Content */}
 <div className="container mx-auto max-w-5xl px-4 py-8">
 <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
 {/* QR Scanner Section */}
 <div className="lg:col-span-3 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-3xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-8 flex flex-col items-center">
 <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 w-full">
 <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-100">
 <QrCode className="w-5 h-5 text-blue-600" />
 </div>
 Scanner
 </h2>

 {/* State 0: Processing Scan */}
 {isScanningProcess ? (
 <div className="w-full text-center max-w-md py-12">
 <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
 <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 mb-2">Verifying...</h3>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">Checking student details and batch limits</p>
 </div>
 ) : scanning ? (
 <div className="w-full">
 <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-col items-center justify-center">
 <p className="text-sm font-bold text-blue-900 flex items-center gap-2">
 <span className="relative flex h-3 w-3">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
 <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
 </span>
 CAMERA ACTIVE
 </p>
 <p className="text-xs text-blue-700 font-medium mt-1">
 Point at QR code — stops automatically on scan
 </p>
 </div>

 <div id="qr-reader" className="mb-6 rounded-2xl overflow-hidden border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 bg-black"></div>

 {cameraError && (
 <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
 <div className="flex items-start gap-3">
 <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
 <div className="flex-1">
 <p className="font-bold text-red-900 mb-1 text-sm">Camera Error</p>
 <p className="text-sm text-red-700 mb-2">{cameraError}</p>
 <p className="text-xs font-bold text-red-800/70">
 Try: Reload page, check permissions, or use Photo Upload
 </p>
 </div>
 </div>
 </div>
 )}

 <button
 onClick={handleStopScanning}
 className="w-full px-6 py-3 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-2xl hover:bg-zinc-200 font-semibold shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-sm"
 >
 <X className="w-4 h-4" />
 Cancel Scanning
 </button>
 </div>
 ) : lastAddedStudent ? (
 <div className="w-full text-center max-w-md">
 <div className="mb-6 bg-green-50 border-2 border-green-300 rounded-2xl p-6">
 <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
 <CheckCircle className="w-8 h-8 text-green-600" />
 </div>
 <p className="font-bold text-green-900 text-xl mb-0.5">{lastAddedStudent.name}</p>
 <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">{lastAddedStudent.beltLevel}</p>
 <p className="text-sm text-green-700 font-semibold">✓ Added to batch successfully!</p>
 </div>

 {/* Hidden file input */}
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handlePhotoUpload}
 className="hidden bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />

 {!isBatchFull ? (
 <div className="space-y-3">
 <button
 onClick={handleStartScanning}
 className="w-full px-8 py-4 bg-blue-500 text-zinc-950 rounded-2xl font-bold text-lg shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 hover:bg-blue-400 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
 >
 <Camera className="w-6 h-6" />
 Scan Another Student
 </button>
 <div className="flex items-center gap-4 py-1">
 <div className="h-px bg-zinc-200 flex-1"></div>
 <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">OR</span>
 <div className="h-px bg-zinc-200 flex-1"></div>
 </div>
 <div className="flex gap-2 w-full mb-3">
 <input
 type="text"
 placeholder="e.g. SKT-2026..."
 value={manualStudentId}
 onChange={handleManualIdChange}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && manualStudentId.trim() && manualStudentId !== "SKT-") {
 validateAndAddStudent(manualStudentId.trim());
 setManualStudentId("SKT-");
 }
 }}
 className="flex-1 px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all uppercase bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 <button
 onClick={() => {
 validateAndAddStudent(manualStudentId.trim());
 setManualStudentId("SKT-");
 }}
 disabled={manualStudentId === "SKT-" || isBatchFull || processingImage || isScanningProcess}
 className="px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 disabled:opacity-50 transition-all"
 >
 Add
 </button>
 </div>
 <button
 onClick={handleImportPhotoClick}
 disabled={processingImage}
 className="w-full px-6 py-3 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-2xl hover:border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 font-bold active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
 >
 <Upload className="w-5 h-5" />
 {processingImage ? "Processing..." : "Upload QR Photo"}
 </button>
 </div>
 ) : (
 <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
 <p className="font-bold text-green-900">🎉 Batch is Full!</p>
 <p className="text-sm text-green-700 mt-1">Proceed to scoring below.</p>
 </div>
 )}
 </div>
 ) : (
 <div className="text-center w-full max-w-md">
 <div className="w-40 h-40 mx-auto mb-8 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 border-dashed rounded-3xl flex items-center justify-center relative">
 <div className="absolute inset-4 border-2 border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-xl opacity-50"></div>
 <QrCode className="w-16 h-16 text-zinc-400" />
 </div>
 <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 mb-3 tracking-tight">
 Ready to Scan
 </h3>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-8 font-medium">
 Point your camera at a student's QR code to add them to this batch.
 </p>
 {!isIndividualBatch && batchSchool && (
 <div className="mb-8 px-5 py-3 bg-blue-50 border border-blue-200 rounded-xl inline-flex items-center gap-3 text-sm text-blue-900 mx-auto w-full justify-center shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800">
 <Building2 className="w-5 h-5 text-blue-600" />
 <span className="font-medium">
 School: <strong className="font-bold">{batchSchool.name}</strong>
 </span>
 </div>
 )}

 {/* Hidden file input */}
 <input
 ref={fileInputRef}
 type="file"
 accept="image/*"
 onChange={handlePhotoUpload}
 className="hidden bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />

 <div className="space-y-4">
 <button
 onClick={handleStartScanning}
 disabled={isBatchFull || processingImage}
 className="w-full px-8 py-4 bg-blue-500 text-zinc-950 rounded-2xl font-bold text-lg shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 hover:bg-blue-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
 >
 <Camera className="w-6 h-6" />
 {isBatchFull ? "Batch is Full" : "Start Camera"}
 </button>

 <div className="flex items-center gap-4 py-2">
 <div className="h-px bg-zinc-200 flex-1"></div>
 <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">OR ENTER ID</span>
 <div className="h-px bg-zinc-200 flex-1"></div>
 </div>

 <div className="flex gap-2 w-full">
 <input
 type="text"
 placeholder="e.g. SKT-2026..."
 value={manualStudentId}
 onChange={handleManualIdChange}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && manualStudentId.trim() && manualStudentId !== "SKT-") {
 validateAndAddStudent(manualStudentId.trim());
 setManualStudentId("SKT-");
 }
 }}
 className="flex-1 px-4 py-3 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all uppercase bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 <button
 onClick={() => {
 validateAndAddStudent(manualStudentId.trim());
 setManualStudentId("SKT-");
 }}
 disabled={manualStudentId === "SKT-" || isBatchFull || processingImage || isScanningProcess}
 className="px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 disabled:opacity-50 transition-all"
 >
 Add
 </button>
 </div>

 <button
 onClick={handleImportPhotoClick}
 disabled={isBatchFull || processingImage}
 className="w-full px-6 py-4 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-2xl hover:border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 font-bold active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 <Upload className="w-5 h-5" />
 {processingImage ? "Processing..." : "Upload Photo"}
 </button>
 </div>

 <div className="mt-8 bg-zinc-950 rounded-2xl p-5 text-left border border-zinc-800">
 <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-3 flex items-center gap-2">
 <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
 Quick Tips
 </p>
 <ul className="text-sm text-zinc-400 space-y-2 font-medium">
 <li>• Type the ID directly, or use the camera to scan</li>
 <li>• Camera stops automatically after each scan</li>
 <li>• Tap "Scan Another Student" to continue</li>
 </ul>
 </div>
 </div>
 )}

 {isBatchFull && (
 <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-5 w-full">
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
 <CheckCircle className="w-6 h-6 text-green-600" />
 </div>
 <div>
 <p className="font-bold text-green-900 text-lg tracking-tight">Batch is Full!</p>
 <p className="text-sm font-medium text-green-700">
 You can now proceed to score students.
 </p>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Students List */}
 <div className="lg:col-span-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-3xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 flex flex-col h-[calc(100vh-12rem)] min-h-[600px] sticky top-6">
 <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 pb-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
 <Users className="w-4 h-4 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400" />
 </div>
 Students Added ({students.length})
 </h2>

 {students.length === 0 ? (
 <div className="text-center flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 <Users className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
 <p className="font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 mb-1">No students yet</p>
 <p className="text-sm">Scanned students will appear here</p>
 </div>
 ) : (
 <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
 {students.map((student, index) => (
 <div
 key={student.id}
 className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl group hover:border-blue-300 transition-colors"
 >
 <div className="w-8 h-8 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg flex items-center justify-center font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-sm shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 group-hover:border-blue-200 group-hover:text-blue-600 transition-colors">
 {index + 1}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 truncate">{student.name}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider truncate mt-0.5">
 {student.beltLevel}
 </p>
 </div>
 <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
 </div>
 ))}
 <div ref={studentsEndRef} />
 </div>
 )}

 {students.length > 0 && (
 <div className="pt-6 mt-2 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <button
 onClick={handleProceedToScoring}
 className="w-full px-6 py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 font-bold text-lg active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 flex items-center justify-center gap-2 group"
 >
 Proceed to Scoring
 <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
 </button>
 </div>
 )}
 </div>
 </div>

 </div>

 {/* Individual Student Transfer Modal */}
 {transferModal.open && transferModal.student && batchSchool && (
 <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
 {/* Header */}
 <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center border border-blue-200">
 <Building2 className="w-6 h-6 text-blue-600" />
 </div>
 <div>
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 tracking-tight">Individual Student</h3>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Transfer Request</p>
 </div>
 </div>
 <button
 onClick={() => setTransferModal({ open: false, student: null, confirming: false })}
 disabled={transferModal.confirming}
 className="w-10 h-10 rounded-full hover:bg-zinc-200 flex items-center justify-center transition-colors bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"
 >
 <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400" />
 </button>
 </div>

 {/* Body */}
 <div className="p-6 space-y-6">
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 space-y-3 text-sm">
 <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Student</span>
 <strong className="text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 text-base">{transferModal.student.name}</strong>
 </div>
 <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Registered As</span>
 <span className="bg-zinc-200 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">Individual</span>
 </div>
 <div className="flex flex-wrap justify-between items-center gap-3">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Belt</span>
 <strong className="text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{transferModal.student.beltLevel || "N/A"}</strong>
 </div>
 </div>

 <div className="flex items-center gap-4 p-5 bg-blue-50 border border-blue-200 rounded-2xl">
 <ArrowRight className="w-6 h-6 text-blue-500 flex-shrink-0" />
 <div>
 <p className="font-bold text-blue-900 text-sm uppercase tracking-wider mb-1">Transfer to School</p>
 <p className="text-sm font-medium text-blue-800">
 <strong className="font-bold">{batchSchool.name}</strong> — {batchSchool.branch}
 </p>
 </div>
 </div>

 <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 leading-relaxed text-center px-4">
 This will permanently transfer the student to <strong>{batchSchool.name}</strong> and
 add them to this batch. Their original individual registration will be saved.
 </p>
 </div>

 {/* Footer */}
 <div className="flex flex-col sm:flex-row items-center gap-3 p-6 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <button
 onClick={() => setTransferModal({ open: false, student: null, confirming: false })}
 disabled={transferModal.confirming}
 className="w-full sm:w-1/2 px-4 py-3 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors disabled:opacity-50 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 Skip / Reject
 </button>
 <button
 onClick={handleConfirmTransfer}
 disabled={transferModal.confirming}
 className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-400 text-zinc-950 rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 {transferModal.confirming ? (
 <>
 <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
 Transferring...
 </>
 ) : (
 <>
 <Building2 className="w-4 h-4" />
 Transfer & Add
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 )}

 {schoolToIndividualModal.open && schoolToIndividualModal.student && (
 <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
 {/* Header */}
 <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center border border-blue-200">
 <UserPlus className="w-6 h-6 text-blue-600" />
 </div>
 <div>
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 tracking-tight">School Student</h3>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Confirmation Request</p>
 </div>
 </div>
 <button
 onClick={() => setSchoolToIndividualModal({ open: false, student: null, confirming: false })}
 disabled={schoolToIndividualModal.confirming}
 className="w-10 h-10 rounded-full hover:bg-zinc-200 flex items-center justify-center transition-colors bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"
 >
 <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400" />
 </button>
 </div>

 {/* Body */}
 <div className="p-6 space-y-6">
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 space-y-3 text-sm">
 <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Student</span>
 <strong className="text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 text-base">{schoolToIndividualModal.student.name}</strong>
 </div>
 <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Registered As</span>
 <span className="bg-zinc-200 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">School</span>
 </div>
 <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">School Name</span>
 <strong className="text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 text-right">{schoolToIndividualModal.student.school || "N/A"}</strong>
 </div>
 <div className="flex flex-wrap justify-between items-center gap-3">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Belt</span>
 <strong className="text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{schoolToIndividualModal.student.beltLevel || "N/A"}</strong>
 </div>
 </div>

 <div className="flex items-center gap-4 p-5 bg-blue-50 border border-blue-200 rounded-2xl">
 <ArrowRight className="w-6 h-6 text-blue-500 flex-shrink-0" />
 <div>
 <p className="font-bold text-blue-900 text-sm uppercase tracking-wider mb-1">Add to Individual Batch</p>
 <p className="text-sm font-medium text-blue-800">
 This batch is for individual students.
 </p>
 </div>
 </div>

 <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 leading-relaxed text-center px-4">
 Notice: This is a school student. Are you sure you want to add them to this individual batch?
 </p>
 </div>

 {/* Footer */}
 <div className="flex flex-col sm:flex-row items-center gap-3 p-6 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <button
 onClick={() => setSchoolToIndividualModal({ open: false, student: null, confirming: false })}
 disabled={schoolToIndividualModal.confirming}
 className="w-full sm:w-1/2 px-4 py-3 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 transition-colors disabled:opacity-50 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 No, Reject
 </button>
 <button
 onClick={handleConfirmSchoolToIndividual}
 disabled={schoolToIndividualModal.confirming}
 className="w-full sm:w-1/2 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-400 text-zinc-950 rounded-xl font-bold transition-all disabled:opacity-50 active:scale-95 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 {schoolToIndividualModal.confirming ? (
 <>
 <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
 Adding...
 </>
 ) : (
 <>
 <UserPlus className="w-4 h-4" />
 Yes, Let Them
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 )}

 </div>
 );
}
