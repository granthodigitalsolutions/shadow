import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Save, User, School, Award, Lock, Unlock } from "lucide-react";
import { firebaseStudentService, firebaseBeltTestService, firebaseAdminSettingsService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";
import {
 SCORING_CATEGORIES,
 calculateSubScores,
 buildScoringResults,
} from "../../constants/scoring";
import { generateFeedbackForms } from "../../utils/feedbackFormGenerator";
import { uploadResultPDF, deleteOldResultPDF } from "../../services/storageService";

export default function ScoreStudent() {
 const { studentId } = useParams();
 const { programNavigate, currentProgram } = useProgram();
 const { showToast } = useToast();
 const { showConfirm } = useDialog();
 const [student, setStudent] = useState<any>(null);
 const [activeBeltTest, setActiveBeltTest] = useState<any>(null);
 const [scores, setScores] = useState<{ [key: string]: number }>({});
 const [lessonNumbers, setLessonNumbers] = useState<{ [key: string]: any }>({});
 const [examinerRemarks, setExaminerRemarks] = useState<string>("");
 const [passPercentage, setPassPercentage] = useState<number>(60);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 const fetchData = async () => {
 if (studentId) {
  const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
  const [foundStudent, activeTest, adminSettings] = await Promise.all([
  firebaseStudentService.getById(studentId, "students_all", false),
  firebaseBeltTestService.getActive(programFilter),
  firebaseAdminSettingsService.get(programFilter),
  ]);

 if (!foundStudent) {
 showToast("Student not found", "error");
 programNavigate("qr-scanner");
 return;
 }

 if (!activeTest) {
 showToast("No active belt test found", "error");
 programNavigate("dashboard");
 return;
 }

  setStudent(foundStudent);
  setActiveBeltTest(activeTest);
  setPassPercentage(adminSettings?.minimumPassingPercentage || 60);

 const initialScores: { [key: string]: number } = {};
 const initialLessons: { [key: string]: number } = {};

 // If student has existing scores, load them; otherwise start from 0
 if (foundStudent.scoringResults && Array.isArray(foundStudent.scoringResults)) {
 foundStudent.scoringResults.forEach((result: any) => {
 initialScores[result.parameterId] = result.score || 0;
 initialLessons[result.parameterId] = result.lessonNumber || 1;
 });
 // Fill in any missing parameters with 0
 SCORING_CATEGORIES.forEach((param: any) => {
 if (!(param.id in initialScores)) {
 initialScores[param.id] = 0;
 initialLessons[param.id] = 1;
 }
 });
 } else {
 // New test - initialize all to 0
 SCORING_CATEGORIES.forEach((param: any) => {
 initialScores[param.id] = 0;
 initialLessons[param.id] = 1;
 });
 }

 setScores(initialScores);
 setLessonNumbers(initialLessons);
 setExaminerRemarks(foundStudent.examinerRemarks || "");
 setLoading(false);
 }
 };

 fetchData();
 }, [studentId, programNavigate]);

 const handleScoreChange = (parameterId: string, value: number, maxPoints: number) => {
 setScores((prev) => ({
 ...prev,
 [parameterId]: Math.min(Math.max(0, value), maxPoints),
 }));
 };

 const handleLessonChange = (parameterId: string, value: any) => {
 setLessonNumbers((prev) => ({
 ...prev,
 [parameterId]: value === "" ? "" : Math.max(1, value),
 }));
 };

 const handleUnlock = async () => {
    const ok = await showConfirm({
      title: "Unlock Result",
      message: "Are you sure you want to unlock this result? This will allow scores to be modified and PDFs to be regenerated.",
      confirmText: "Yes, Unlock",
      variant: "warning",
    });
    if (!ok) return;

    try {
      await firebaseStudentService.update(studentId!, { resultLocked: false });
      setStudent(prev => ({ ...prev, resultLocked: false }));
      
      const { firebaseAnalyticsService } = await import("../../services/analyticsService");
      await firebaseAnalyticsService.trackResultLock(false);
      
      showToast("Result unlocked successfully", "success");
    } catch (error) {
      console.error('Error unlocking result:', error);
      showToast('Failed to unlock result', 'error');
    }
  };

  const calculateTotal = () => {
 return Object.values(scores).reduce((sum, score) => sum + score, 0);
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 const isEditing = student.testStatus !== "pending";

 if (isEditing) {
 const ok = await showConfirm({
 title: "Update Score",
 message: "Are you sure you want to update this student's score? This will replace their existing result.",
 confirmText: "Yes, Update",
 variant: "warning",
 });
 if (!ok) return;
 }

 const totalScore = calculateTotal();
 const maxScore = SCORING_CATEGORIES.reduce((sum, p) => sum + p.maxPoints, 0);
 const percentage = Math.round((totalScore / maxScore) * 100);
 const passed = percentage >= passPercentage;

 const techScore = scores['technical'] ?? 0;
 const athScore = scores['athletic'] ?? scores['athletics'] ?? 0;

 // Auto-calculate 16 sub-categories
 const subCategoryResults = calculateSubScores(techScore, athScore, student.programType);
 const scoringResults = buildScoringResults(techScore, athScore, lessonNumbers);

 try {
 // Prepare student object for PDF generation
 const studentForPdf = {
 ...student,
 score: totalScore,
 percentage,
 result: passed ? "pass" : "fail",
 testStatus: passed ? "passed" : "failed",
 scoringResults,
 subCategoryResults,
 testDate: new Date().toISOString(),
 examinerRemarks,
 };

 // Generate and upload PDF
 let resultPdfUrl = null;
 let storageFolder = null;
 let resultPdfPath = null;

 try {
 // Delete old PDF first if it exists
 if ((student as any).resultPdfPath) {
   await deleteOldResultPDF((student as any).resultPdfPath);
 }

 const pdfDoc = await generateFeedbackForms([studentForPdf as any]);
 const pdfBlob = pdfDoc.output('blob') as Blob;
 
 if (pdfBlob) {
 const uploadResult = await uploadResultPDF(studentId!, pdfBlob, currentProgram === 'ALL' ? student.programType : currentProgram);
 resultPdfUrl = uploadResult.downloadURL;
 storageFolder = uploadResult.folder;
 resultPdfPath = uploadResult.fullPath;

//  console.log("[Firestore] Updating student:", studentId);
//  console.log("[Firestore] Saving PDF URL:", resultPdfUrl);

 const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
 const { db } = await import("../../config/firebase");

 await updateDoc(doc(db, "students", studentId!), {
 resultPdfUrl: resultPdfUrl,
 resultPdfPath: resultPdfPath,
 pdfUploaded: true,
 uploadedAt: serverTimestamp(),
 storageFolder: storageFolder
 });

//  console.log("[Firestore] Student updated successfully");
 }
 } catch (pdfError) {
 console.error("[Firestore] Failed to save PDF URL:", pdfError);
 }

 // Now update the regular score data using the service
  const { serverTimestamp } = await import("firebase/firestore");
  await firebaseStudentService.update(studentId!, {
  score: totalScore,
  percentage,
  testStatus: passed ? "passed" : "failed",
  scoringResults,
  subCategoryResults,
  testDate: new Date().toISOString(),
  examinerRemarks,
  lastScoreUpdatedAt: serverTimestamp(),
  resultFinalized: false
  });

 const message = isEditing
 ? `Score updated! ${totalScore}/${maxScore} (${percentage}%) - ${passed ? "PASSED" : "FAILED"}`
 : `Student evaluated! ${totalScore}/${maxScore} (${percentage}%) - ${passed ? "PASSED" : "FAILED"}`;

 showToast(message, passed ? 'success' : 'info');
 setTimeout(() => programNavigate("results"), 1000);
 } catch (error) {
 console.error('Error saving score:', error);
 showToast('Failed to save score. Please try again.', 'error');
 }
 };

 if (loading) {
 return (
 <AdminLayout>
 <div className="text-center py-12">
 <p className="text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading...</p>
 </div>
 </AdminLayout>
 );
 }

 const totalScore = calculateTotal();
 const maxScore = SCORING_CATEGORIES.reduce((sum, p) => sum + p.maxPoints, 0);
 const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
 const isEditing = student.testStatus !== "pending";
 const passed = percentage >= passPercentage;

 return (
 <AdminLayout>
 <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-4 sm:p-6">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
 <h2 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {isEditing ? 'EDIT STUDENT SCORE' : 'STUDENT EVALUATION'}
 </h2>
 {isEditing && (
 <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
 EDITING
 </span>
 )}
 </div>

 {student.resultLocked && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border-2 border-red-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-800 font-bold">
                  Result Locked: This student's result has been finalized and locked to prevent further changes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUnlock}
                className="px-4 py-2 bg-white text-red-700 border border-red-300 rounded-lg text-sm font-bold shadow-sm hover:bg-red-50 flex items-center gap-2"
              >
                <Unlock className="w-4 h-4" /> Unlock Result
              </button>
            </div>
          )}

          {!student.resultLocked && isEditing && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
 <p className="text-xs sm:text-sm text-orange-800">
 <strong>Note:</strong> You are editing an existing score. The previous result was:{' '}
 <strong>{student.testStatus === 'passed' ? 'PASSED' : 'FAILED'}</strong> with{' '}
 <strong>{student.score}/{maxScore}</strong> ({student.percentage}%)
 </p>
 </div>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-lg">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
 <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
 </div>
 <div className="min-w-0">
 <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Student Name</p>
 <p className="font-semibold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 text-sm sm:text-base truncate">{student.name}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
 <School className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
 </div>
 <div className="min-w-0">
 <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">School</p>
 <p className="font-semibold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 text-sm sm:text-base truncate">{student.school}</p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
 <Award className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
 </div>
 <div className="min-w-0">
 <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Belt Level</p>
 <p className="font-semibold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 text-sm sm:text-base truncate">{student.beltLevel}</p>
 </div>
 </div>
 </div>

 <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg">
 <div className="grid grid-cols-3 gap-3 sm:gap-0 sm:flex sm:items-center sm:justify-between">
 <div className="text-center sm:text-left">
 <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Current Score</p>
 <p className="text-xl sm:text-3xl font-bold text-indigo-600">{totalScore} / {maxScore}</p>
 </div>
 <div className="text-center">
 <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Percentage</p>
 <p className="text-xl sm:text-3xl font-bold text-purple-600">{percentage}%</p>
 </div>
  <div className="text-center sm:text-right">
  <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Result</p>
  <p className={`text-lg sm:text-2xl font-bold ${passed ? "text-green-600" : "text-red-600"}`}>
  {passed ? "PASS" : "FAIL"}
  </p>
  </div>
 </div>
 </div>
 </div>

 <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-4 sm:p-6">
 <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 SCORING PARAMETERS
 </h3>

 <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
 {SCORING_CATEGORIES.map((param: any, index: number) => (
 <div key={param.id} className="border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
 <div>
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200">{param.name}</h4>
 <div className="mt-2 flex items-center gap-2">
 <label className="text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Lesson No:</label>
 <input
 type="text"
 inputMode="numeric"
 pattern="[0-9]*"
 value={lessonNumbers[param.id] === "" ? "" : (lessonNumbers[param.id] || "")}
 disabled={student.resultLocked}
 onFocus={(e) => e.target.select()}
 onBlur={(e) => {
 if (e.target.value === "") {
 handleLessonChange(param.id, 1);
 }
 }}
 onChange={(e) => {
 const val = e.target.value.replace(/[^0-9]/g, '');
 handleLessonChange(param.id, val === "" ? "" : parseInt(val));
 }}
 className="w-20 px-2 py-1 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded text-sm font-semibold focus:border-indigo-600 focus:outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>
 </div>
 <div className="text-right">
 <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 block mb-1">Score</span>
 <div className="flex items-center gap-2">
 <input
 type="number"
 value={scores[param.id]}
 disabled={student.resultLocked}
onChange={(e) => handleScoreChange(param.id, parseInt(e.target.value) || 0, param.maxPoints)}
 className="w-20 px-2 py-1 border-2 border-indigo-300 rounded text-lg font-bold text-indigo-700 text-center focus:border-indigo-600 focus:outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 min="0"
 max={param.maxPoints}
 required
 />
 <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">/ {param.maxPoints}</span>
 </div>
 </div>
 </div>

 <div className="mt-4 flex items-center gap-4 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 p-3 rounded-lg">
 <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">0</span>
 <input
 type="range"
 min="0"
 max={param.maxPoints}
 value={scores[param.id]}
 disabled={student.resultLocked}
onChange={(e) => handleScoreChange(param.id, parseInt(e.target.value), param.maxPoints)}
 className="flex-1 h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{param.maxPoints}</span>
 </div>
 </div>
 ))}
 </div>

 <div className="mb-4 sm:mb-6 border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg p-4">
 <h4 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-2">Examiner Remarks</h4>
 <textarea
 value={examinerRemarks}
 onChange={(e) => setExaminerRemarks(e.target.value)}
 placeholder="Add any specific feedback, technical corrections, or athletic observations..."
 className="w-full h-32 px-3 py-2 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg text-sm focus:border-indigo-600 focus:outline-none resize-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>

 <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
 <button
 type="submit"
 className="flex-1 flex items-center justify-center gap-2 px-6 py-3 sm:py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-semibold text-base sm:text-lg active:scale-95 transition-transform"
 >
 <Save className="w-5 h-5 sm:w-6 sm:h-6" />
 {isEditing ? 'Update Score' : 'Submit Evaluation'}
 </button>
 <button
 type="button"
 onClick={() => programNavigate("qr-scanner")}
 className="px-6 py-3 sm:py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold active:scale-95 transition-transform"
 >
 Cancel
 </button>
 </div>
 </form>

  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 sm:p-4">
  <h4 className="font-bold text-blue-800 mb-2 text-sm sm:text-base">Passing Criteria</h4>
  <p className="text-xs sm:text-sm text-blue-700">
  Minimum {passPercentage}% required to pass the belt test. Total score must be at least {Math.ceil(maxScore * (passPercentage / 100))} out of {maxScore}.
  </p>
  </div>
 </div>
 </AdminLayout>
 );
}
