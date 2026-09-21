import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Search, Camera, X, CheckCircle, AlertTriangle, Award, User, Loader2 } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { firebaseStudentService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";

export default function QRScanner() {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const { showAlert } = useDialog();
 const [studentId, setStudentId] = useState("");
 const [scannedStudent, setScannedStudent] = useState<any>(null);
 const [loading, setLoading] = useState(false);
 const [showScanner, setShowScanner] = useState(false);
 const [cameraError, setCameraError] = useState<string | null>(null);
 const [cameraStarting, setCameraStarting] = useState(false);
 const scannerRef = useRef<Html5Qrcode | null>(null);
 const scannerStarted = useRef(false);

 // Start camera as soon as the scanner modal is shown and DOM is ready
 useEffect(() => {
 if (!showScanner) return;

 let cancelled = false;

 const startCamera = async () => {
 // Wait for the DOM element to be mounted
 await new Promise(resolve => setTimeout(resolve, 200));
 if (cancelled || !document.getElementById("qr-reader")) return;

 setCameraStarting(true);
 setCameraError(null);

 try {
 const html5Qrcode = new Html5Qrcode("qr-reader");
 scannerRef.current = html5Qrcode;

 await html5Qrcode.start(
 { facingMode: "environment" },
 {
 fps: 10,
 qrbox: { width: 250, height: 250 },
 },
 async (decodedText) => {
 let parsedId = decodedText;
 try {
 const parsed = JSON.parse(decodedText);
 if (parsed && (parsed.id || parsed.studentId)) {
 parsedId = parsed.id || parsed.studentId;
 }
 } catch (e) {
 // raw string ID
 }

 setStudentId(parsedId);
 // Stop scanner first
 try {
 await html5Qrcode.stop();
 scannerStarted.current = false;
 } catch (_) {}
 setShowScanner(false);
 await fetchStudent(parsedId);
 },
 () => {
 // Suppress per-frame errors
 }
 );

 scannerStarted.current = true;
 } catch (err: any) {
 if (cancelled) return;
 console.error("Camera start error:", err);
 const name = err?.name || "";
 const msg = err?.message || "";
 if (name === "NotAllowedError" || msg.includes("NotAllowedError")) {
 setCameraError("Camera permission denied. Please tap Allow when your browser asks for camera access, then try again.");
 } else if (name === "NotFoundError" || msg.includes("NotFoundError")) {
 setCameraError("No camera found on this device.");
 } else if (name === "NotReadableError" || msg.includes("NotReadableError")) {
 setCameraError("Camera is already in use by another app. Please close it and try again.");
 } else {
 setCameraError("Unable to start camera. Please check your browser permissions and try again.");
 }
 } finally {
 if (!cancelled) setCameraStarting(false);
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
 }, [showScanner]);

 const fetchStudent = async (id: string) => {
 setLoading(true);
 try {
 const studentData = await firebaseStudentService.getById(id, "students_all", false);
 if (studentData) {
 if (studentData.testStatus && studentData.testStatus !== "pending") {
 await showAlert({
 title: "Already Completed",
 message: "This student has already completed their belt test.",
 variant: "warning",
 });
 }
 setScannedStudent(studentData);
 } else {
 await showAlert({ title: "Not Found", message: "Student not found. Please check the ID and try again.", variant: "error" });
 setScannedStudent(null);
 }
 } catch (error) {
 console.error("Error fetching student:", error);
 await showAlert({ title: "Error", message: "Failed to load student data. Please try again.", variant: "error" });
 setScannedStudent(null);
 } finally {
 setLoading(false);
 }
 };

 const handleScan = () => {
 if (!studentId.trim()) {
 showToast("Please enter a student ID", "error");
 return;
 }
 fetchStudent(studentId.trim());
 };

 const handleQRScan = () => {
 setShowScanner(true);
 setCameraError(null);
 };

 const handleStartTest = () => {
 if (scannedStudent) {
 navigate(`/admin/score-student/${scannedStudent.id}`);
 }
 };

 const handleCloseScanner = async () => {
 if (scannerRef.current && scannerStarted.current) {
 try { await scannerRef.current.stop(); } catch (_) {}
 scannerStarted.current = false;
 }
 scannerRef.current = null;
 setCameraError(null);
 setShowScanner(false);
 };

 return (
 <AdminLayout>
 <div className="space-y-4 sm:space-y-6">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-4 sm:p-6">
 <div className="flex items-center gap-3 mb-4 sm:mb-6">
 <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
 <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
 </div>
 <div>
 <h2 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 QR CODE SCANNER
 </h2>
 <p className="text-sm sm:text-base text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Scan student hall ticket</p>
 </div>
 </div>

 {!scannedStudent ? (
 <>
 <button
 onClick={handleQRScan}
 className="w-full mb-4 sm:mb-6 flex items-center justify-center gap-2 sm:gap-3 px-6 py-3 sm:py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors active:scale-95"
 >
 <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
 <span className="text-base sm:text-lg font-semibold">Open Camera Scanner</span>
 </button>

 <div className="relative mb-4">
 <div className="absolute inset-0 flex items-center">
 <span className="w-full border-t border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700" />
 </div>
 <div className="relative flex justify-center text-sm">
 <span className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 px-4 text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Or enter manually</span>
 </div>
 </div>

 <div className="space-y-3 sm:space-y-4">
 <div>
 <label className="block text-xs sm:text-sm font-semibold text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 mb-2">Student ID</label>
 <div className="relative">
 <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
 <input
 value={studentId}
 onChange={(e) => setStudentId(e.target.value)}
 placeholder="Enter student ID"
 onKeyPress={(e) => e.key === "Enter" && handleScan()}
 className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-indigo-600 focus:outline-none text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>
 </div>

 <button
 onClick={handleScan}
 className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold active:scale-95 text-sm sm:text-base"
 disabled={loading}
 >
 <Search className="w-4 h-4 sm:w-5 sm:h-5" />
 {loading ? "Searching..." : "Search Student"}
 </button>
 </div>

 <div className="mt-4 sm:mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
 <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
 <QrCode className="w-5 h-5" />
 Instructions
 </h4>
 <p className="text-sm text-blue-700">
 Scan the QR code from the student's hall ticket or manually enter their Student ID to fetch details and start the test.
 </p>
 </div>
 </>
 ) : (
 <div className="space-y-6">
 <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-center gap-3">
 <CheckCircle className="w-6 h-6 text-green-600" />
 <div>
 <h3 className="font-bold text-green-800">Student Found</h3>
 <p className="text-sm text-green-700">Ready for belt test</p>
 </div>
 </div>

 <div className="grid md:grid-cols-2 gap-4">
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Full Name</p>
 <p className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">{scannedStudent.name}</p>
 </div>
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">School</p>
 <p className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">{scannedStudent.school}</p>
 </div>
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Standard</p>
 <p className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">{scannedStudent.standard}</p>
 </div>
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Belt Level</p>
 <p className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">{scannedStudent.beltLevel}</p>
 </div>
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4 md:col-span-2">
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Student ID</p>
 <p className="font-mono text-sm text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">{scannedStudent.id}</p>
 </div>
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Payment Status</p>
 <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
 scannedStudent.paymentStatus === "verified"
 ? "bg-green-100 text-green-800"
 : "bg-blue-100 text-blue-800"
 }`}>
 {(scannedStudent.paymentStatus || "").toUpperCase()}
 </span>
 </div>
 <div className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Test Status</p>
 <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
 (scannedStudent.testStatus === "pending" || !scannedStudent.testStatus)
 ? "bg-blue-100 text-blue-800"
 : (scannedStudent.testStatus === "passed" || scannedStudent.testStatus === "pass")
 ? "bg-green-100 text-green-800"
 : "bg-red-100 text-red-800"
 }`}>
 {(scannedStudent.testStatus === "passed" || scannedStudent.testStatus === "pass")
 ? "PASSED"
 : (scannedStudent.testStatus === "failed" || scannedStudent.testStatus === "fail")
 ? "FAILED"
 : "PENDING"}
 </span>
 </div>
 </div>

 <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
 <button
 onClick={handleStartTest}
 className="flex-1 flex items-center justify-center gap-2 px-6 py-3 sm:py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-base sm:text-lg active:scale-95 transition-transform"
 >
 <Award className="w-5 h-5 sm:w-6 sm:h-6" />
 Start Belt Test
 </button>
 <button
 onClick={() => { setScannedStudent(null); setStudentId(""); }}
 className="px-6 py-3 sm:py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold active:scale-95 transition-transform"
 >
 Cancel
 </button>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Scanner Modal */}
 {showScanner && (
 <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-3 sm:p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
 <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
 <div className="flex items-center gap-2 sm:gap-3 min-w-0">
 <div className="w-9 h-9 sm:w-10 sm:h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
 <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
 </div>
 <div className="min-w-0">
 <h3 className="font-bold text-base sm:text-lg truncate">QR Scanner</h3>
 <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 truncate">Position QR code in frame</p>
 </div>
 </div>
 <button
 onClick={handleCloseScanner}
 className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:bg-zinc-800 flex-shrink-0 active:scale-95 transition-transform"
 >
 <X className="w-5 h-5 sm:w-6 sm:h-6" />
 </button>
 </div>

 {cameraStarting && !cameraError && (
 <div className="flex flex-col items-center justify-center py-12 gap-3">
 <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
 <p className="text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">Starting camera…</p>
 </div>
 )}

 {!cameraError ? (
 <div className="space-y-3 sm:space-y-4">
 {/* This div is always rendered so Html5Qrcode can attach to it */}
 <div
 id="qr-reader"
 className={`w-full rounded-lg overflow-hidden bg-black ${cameraStarting ? "hidden" : ""}`}
 />
 {!cameraStarting && (
 <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 sm:p-4 text-center">
 <p className="text-xs sm:text-sm text-blue-700 font-semibold">
 Align QR code within the frame — scanning automatically…
 </p>
 </div>
 )}
 </div>
 ) : (
 <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
 <div className="text-center">
 <div className="inline-block p-3 sm:p-4 bg-red-100 rounded-lg">
 <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-red-600" />
 </div>
 <div className="mt-3 sm:mt-4">
 <p className="font-bold text-red-800 mb-2 text-base sm:text-lg">Camera Error</p>
 <p className="text-xs sm:text-sm text-red-700 mb-3 sm:mb-4">{cameraError}</p>
 </div>
 </div>

 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-2 border-red-300 rounded-lg p-3 sm:p-4 text-left">
 <p className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-2 sm:mb-3 text-xs sm:text-sm">How to Fix:</p>
 <ol className="text-[11px] sm:text-xs text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 space-y-1.5 sm:space-y-2 list-decimal list-inside">
 <li>When browser asks for camera, tap <strong>"Allow"</strong></li>
 <li>If denied, go to <strong>Browser Settings → Camera</strong></li>
 <li>Allow this website to use your camera</li>
 <li>Then tap <strong>"Try Again"</strong> below</li>
 </ol>
 </div>

 <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
 <button
 onClick={() => {
 handleCloseScanner();
 setTimeout(() => handleQRScan(), 300);
 }}
 className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold active:scale-95 transition-transform text-sm"
 >
 Try Again
 </button>
 <button
 onClick={handleCloseScanner}
 className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold active:scale-95 transition-transform text-sm"
 >
 Use Manual Entry
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </AdminLayout>
 );
}
