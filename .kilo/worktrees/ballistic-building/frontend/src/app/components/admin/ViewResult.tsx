import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
 ArrowLeft, User, Award, CheckCircle, XCircle,
 Download, Trophy, Target, Zap, Calendar, Hash,
} from "lucide-react";
import { firebaseStudentService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";
import { SubCategoryResult } from "../../types/admin";

import { generateFeedbackForms } from "../../utils/feedbackFormGenerator";

function SubBar({ sub }: { sub: SubCategoryResult }) {
 const pct = sub.maxScore > 0 ? (sub.score / sub.maxScore) * 100 : 0;
 const color =
 pct >= 70 ? "bg-green-500"
 : pct >= 40 ? "bg-blue-500"
 : "bg-red-500";

 return (
 <div className="flex items-center gap-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 last:border-0">
 <div className="w-36 shrink-0">
 <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 leading-tight">{sub.name}</p>
 <p className="text-[10px] text-zinc-400 mt-0.5">{Math.round(sub.weight * 100)}% weight</p>
 </div>
 <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 rounded-full overflow-hidden">
 <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
 </div>
 <div className="w-20 text-right shrink-0">
 <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{sub.score}</span>
 <span className="text-xs text-zinc-400"> / {sub.maxScore}</span>
 </div>
 </div>
 );
}

export default function ViewResult() {
 const { studentId } = useParams();
 const { programNavigate } = useProgram();
 const { showAlert } = useDialog();
 const [student, setStudent] = useState<any>(null);
 const [downloading, setDownloading] = useState(false);

 useEffect(() => {
 const fetchStudent = async () => {
 if (studentId) {
 const found = await firebaseStudentService.getById(studentId, "students_all", false);
 if (!found) {
 await showAlert({ title: "Not Found", message: "Student not found.", variant: "error" });
 programNavigate("results");
 return;
 }
 setStudent(found);
 }
 };
 fetchStudent();
 }, [studentId, programNavigate, showAlert]);

 if (!student) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-bold text-sm uppercase tracking-wider">Loading result...</p>
 </div>
 </div>
 </AdminLayout>
 );
 }

 const passed = student.testStatus === "passed" || student.testStatus === "pass";
 const subs: SubCategoryResult[] = student.subCategoryResults ?? [];
 const techSubs = subs.filter((s: SubCategoryResult) => s.category === "technical");
 const athSubs = subs.filter((s: SubCategoryResult) => s.category === "athletic");

 const techScore = student.scoringResults?.find((r: any) => r.parameterId === "technical")?.score ?? 0;
 const athScore = student.scoringResults?.find((r: any) => r.parameterId === "athletic")?.score
 ?? student.scoringResults?.find((r: any) => r.parameterId === "athletics")?.score ?? 0;

 const techLesson = student.scoringResults?.find((r: any) => r.parameterId === "technical")?.lessonNumber;
 const athLesson = student.scoringResults?.find((r: any) => r.parameterId === "athletic")?.lessonNumber
 ?? student.scoringResults?.find((r: any) => r.parameterId === "athletics")?.lessonNumber;

 const handleDownloadPDF = async () => {
 setDownloading(true);
 try {
 const pdfDoc = await generateFeedbackForms([student as any]);
 pdfDoc.save(`${(student.name || 'Student').replace(/\s+/g, '_')}_Result_${(student.id || '').slice(-6)}.pdf`);
 } finally {
 setTimeout(() => setDownloading(false), 1000);
 }
 };

 const InfoChip = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
 <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl">
 <div className="w-8 h-8 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800">
 <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400" />
 </div>
 <div>
 <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
 <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{value}</p>
 </div>
 </div>
 );

 return (
 <AdminLayout>
 <div className="max-w-3xl mx-auto space-y-6 pb-10">

 {/* Back + Download */}
 <div className="flex flex-wrap items-center justify-between gap-3">
 <button
 onClick={() => programNavigate("results")}
 className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50 font-bold text-sm transition-colors"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Results
 </button>
 <button
 onClick={handleDownloadPDF}
 disabled={downloading}
 className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-zinc-950 rounded-xl font-bold text-sm active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 disabled:opacity-60"
 >
 <Download className="w-4 h-4" />
 {downloading ? "Generating..." : "Download PDF"}
 </button>
 </div>

 {/* Result Hero Card */}
 <div className="bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-xl">
 <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-zinc-800">
 <div>
 <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {student.name}
 </h1>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">
 {student.school || "Individual"} · {student.beltLevel || (student.stageLevel != null ? `Stage ${student.stageLevel}` : "—")}
 </p>
 </div>
 <div className={`flex flex-col items-center px-5 py-3 rounded-2xl border ${passed ? "bg-green-950/50 border-green-800" : "bg-red-950/50 border-red-800"}`}>
 {passed ? (
 <CheckCircle className="w-8 h-8 text-green-400 mb-1" />
 ) : (
 <XCircle className="w-8 h-8 text-red-400 mb-1" />
 )}
 <span className={`text-xs font-bold uppercase tracking-wider ${passed ? "text-green-400" : "text-red-400"}`}>
 {passed ? "Passed" : "Failed"}
 </span>
 </div>
 </div>

 {/* Score strip */}
 <div className="grid grid-cols-4 divide-x divide-zinc-800">
 {[
 { label: "Total Score", value: `${student.score ?? 0}`, sub: "out of 200" },
 { label: "Percentage", value: `${student.percentage ?? 0}%`, sub: "combined" },
 { label: "Grade", value: getGrade(student.percentage), sub: "performance" },
 { label: "Ranking", value: student.ranking != null ? `#${student.ranking}` : "—", sub: "in test" },
 ].map((item) => (
 <div key={item.label} className="p-4 text-center">
 <p className="text-2xl font-bold text-blue-400">{item.value}</p>
 <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">{item.label}</p>
 <p className="text-[10px] text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{item.sub}</p>
 </div>
 ))}
 </div>
 </div>

 {/* Student Info */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <InfoChip icon={User} label="Gender" value={student.gender || "—"} />
 <InfoChip icon={Hash} label="Student ID" value={(student.id || '').slice(-8).toUpperCase()} />
 <InfoChip icon={Calendar} label="Test Date" value={student.testDate ? new Date(student.testDate).toLocaleDateString() : "—"} />
 <InfoChip icon={Trophy} label="Standard" value={student.standard ? `Std ${student.standard}` : "—"} />
 </div>

 {/* Technical Performance Section */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-zinc-950 border-b border-zinc-800">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
 <Target className="w-4 h-4 text-zinc-950" />
 </div>
 <div>
 <h2 className="font-bold text-white">Technical Performance</h2>
 {techLesson && (
 <p className="text-[11px] text-zinc-400">Lesson {techLesson}</p>
 )}
 </div>
 </div>
 <div className="text-right">
 <span className="text-2xl font-bold text-blue-400">{techScore}</span>
 <span className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"> / 100</span>
 </div>
 </div>

 <div className="px-6 py-4">
 {techSubs.length > 0 ? (
 techSubs.map((sub) => (
 <SubBar key={sub.id} sub={sub} />
 ))
 ) : (
 <div className="py-8 text-center">
 <p className="text-zinc-400 text-sm font-medium">Sub-category breakdown not available.</p>
 <p className="text-xs text-zinc-300 mt-1">Re-score student to generate breakdown.</p>
 </div>
 )}
 </div>
 </div>

 {/* Athletic Performance Section */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-zinc-950 border-b border-zinc-800">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
 <Zap className="w-4 h-4 text-zinc-950" />
 </div>
 <div>
 <h2 className="font-bold text-white">Athletic Performance</h2>
 {athLesson && (
 <p className="text-[11px] text-zinc-400">Lesson {athLesson}</p>
 )}
 </div>
 </div>
 <div className="text-right">
 <span className="text-2xl font-bold text-blue-400">{athScore}</span>
 <span className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"> / 100</span>
 </div>
 </div>

 <div className="px-6 py-4">
 {athSubs.length > 0 ? (
 athSubs.map((sub) => (
 <SubBar key={sub.id} sub={sub} />
 ))
 ) : (
 <div className="py-8 text-center">
 <p className="text-zinc-400 text-sm font-medium">Sub-category breakdown not available.</p>
 <p className="text-xs text-zinc-300 mt-1">Re-score student to generate breakdown.</p>
 </div>
 )}
 </div>
 </div>

 {/* Footer info */}
 <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl text-xs text-zinc-400 font-medium">
 <span>Student ID: {student.id}</span>
 <span>Scored: {student.scoredAt ? new Date(student.scoredAt).toLocaleString() : "—"}</span>
 </div>
 </div>
 </AdminLayout>
 );
}

function getGrade(pct?: number): string {
 if (pct == null) return "—";
 if (pct >= 90) return "A+";
 if (pct >= 80) return "A";
 if (pct >= 70) return "B";
 if (pct >= 60) return "C";
 return "F";
}
