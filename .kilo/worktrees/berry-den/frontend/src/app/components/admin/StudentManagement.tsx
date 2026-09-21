import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Search, Edit, Award, ClipboardList, Download, FileSpreadsheet, X, Save, Filter, ChevronDown, User, UserCircle, School, Trash2, Phone } from "lucide-react";
import { firebaseStudentService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from "../../hooks/useToast";
import { useProgram } from "../../contexts/ProgramContext";

const getBeltHoverClass = (belt: string | undefined | null) => {
  if (!belt) return 'hover:bg-indigo-600 hover:text-white';
  const lower = belt.toLowerCase();
  if (lower.includes('white')) return 'hover:bg-white hover:text-zinc-900 hover:border-zinc-300 transition-colors border border-transparent';
  if (lower.includes('yellow')) return 'hover:bg-yellow-400 hover:text-white transition-colors';
  if (lower.includes('orange')) return 'hover:bg-orange-500 hover:text-white transition-colors';
  if (lower.includes('green')) return 'hover:bg-green-600 hover:text-white transition-colors';
  if (lower.includes('blue')) return 'hover:bg-blue-600 hover:text-white transition-colors';
  if (lower.includes('purple')) return 'hover:bg-purple-600 hover:text-white transition-colors';
  if (lower.includes('brown')) return 'hover:bg-amber-800 hover:text-white transition-colors';
  if (lower.includes('black')) return 'hover:bg-zinc-900 hover:text-white transition-colors dark:hover:bg-black';
  if (lower.includes('red')) return 'hover:bg-red-600 hover:text-white transition-colors';
  return 'hover:bg-indigo-600 hover:text-white transition-colors';
};
import { logoBase64 } from "../../utils/logoBase64";

export default function StudentManagement() {
 const navigate = useNavigate();
 const location = useLocation();
 const { showToast } = useToast();
 const { currentProgram } = useProgram();

  // Unified Registration Type Tab (replaces IndividualStudents)
 const [activeTab, setActiveTab] = useState<"all" | "school" | "individual">(
 (location.pathname || '').includes("individual-students") ? "individual" : "all"
 );

 // Search & Basic Filters
 const [searchTerm, setSearchTerm] = useState("");
 const [beltFilter, setBeltFilter] = useState("all");
 const [genderFilter, setGenderFilter] = useState("all");

 // Advanced Filters
 const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
 const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
 const [testStatusFilter, setTestStatusFilter] = useState("all");
 const [schoolFilter, setSchoolFilter] = useState("all");
 const [dateRangeFilter, setDateRangeFilter] = useState({ from: "", to: "" });

 const [students, setStudents] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 // Edit Modal
 const [editingStudent, setEditingStudent] = useState<any>(null);
 const [editForm, setEditForm] = useState({
 name: "", gender: "", school: "", standard: "", contact: "", whatsapp: "",
 });

 useEffect(() => {
 setStudents([]);
 setSearchTerm("");
 setBeltFilter("all");
 setGenderFilter("all");
 setSchoolFilter("all");
 setPaymentStatusFilter("all");
 setTestStatusFilter("all");
 setDateRangeFilter({ from: "", to: "" });
 setLoading(true);

 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram;
 // Use real-time listener so new registrations (e.g. from secretaries) appear instantly
 const unsubscribe = firebaseStudentService.listenAll((result) => {
   setStudents(result);
   setLoading(false);
 }, programFilter);

 return () => unsubscribe();
 }, [currentProgram]);


 const filteredStudents = students.filter((s) => {
 // Only Admin-confirmed (paymentStatus === 'verified') students are Active and shown here.
 // Pending/rejected registrations are reviewed via Secretary Management > School detail.
 if (s.paymentStatus !== "verified") return false;

 // Tab filter
 if (activeTab !== "all" && s.registrationType !== activeTab) return false;

 // Search filter
 const q = searchTerm.toLowerCase();
 if (q && !(
 (s.name || "").toLowerCase().includes(q) ||
 (s.school || "").toLowerCase().includes(q) ||
 (s.id || "").toLowerCase().includes(q)
 )) return false;

 if (beltFilter !== "all" && s.beltLevel !== beltFilter) return false;
 if (genderFilter !== "all" && s.gender !== genderFilter) return false;
 if (paymentStatusFilter !== "all" && s.paymentStatus !== paymentStatusFilter) return false;
 if (testStatusFilter !== "all" && s.testStatus !== testStatusFilter) return false;
 if (schoolFilter !== "all" && s.school !== schoolFilter) return false;

 if (dateRangeFilter.from || dateRangeFilter.to) {
 const regDate = new Date(s.registeredAt);
 if (dateRangeFilter.from && regDate < new Date(dateRangeFilter.from)) return false;
 if (dateRangeFilter.to) {
 const toDate = new Date(dateRangeFilter.to);
 toDate.setHours(23, 59, 59, 999);
 if (regDate > toDate) return false;
 }
 }
 return true;
 });

  const uniqueBeltLevels = currentProgram === 'SELAMBAM'
    ? Array.from({ length: 8 }, (_, i) => `Stage ${i + 1}`)
    : currentProgram === 'KARATE'
      ? ['White', 'Yellow', 'Orange', 'Blue', 'Green', 'II Brown', 'I Brown', 'Black Belt']
      : ['White', 'Yellow', 'Orange', 'Blue', 'Green', 'II Brown', 'I Brown', 'Black Belt', ...Array.from({ length: 8 }, (_, i) => `Stage ${i + 1}`)];
 const uniqueSchools = Array.from(new Set(students.map(s => s.school).filter(Boolean))).sort();

 const activeFiltersCount = [
 beltFilter !== "all", genderFilter !== "all", paymentStatusFilter !== "all",
 testStatusFilter !== "all", schoolFilter !== "all", dateRangeFilter.from !== "", dateRangeFilter.to !== ""
 ].filter(Boolean).length;

 const clearAllFilters = () => {
 setSearchTerm("");
 setBeltFilter("all");
 setGenderFilter("all");
 setPaymentStatusFilter("all");
 setTestStatusFilter("all");
 setSchoolFilter("all");
 setDateRangeFilter({ from: "", to: "" });
 };

 const handleEditClick = (student: any) => {
 setEditingStudent(student);
 setEditForm({
 name: student.name || "", gender: student.gender || "", school: student.school || "",
 standard: student.standard || "", contact: student.contact || "", whatsapp: student.whatsapp || "",
 });
 };

 const handleSaveEdit = async () => {
 if (!editingStudent) return;
 if (!editForm.name.trim() || !editForm.gender || !editForm.school.trim() || !editForm.standard.trim() || !editForm.whatsapp.trim()) {
 showToast('Please fill in all required fields', 'error');
 return;
 }
 try {
 // Service reads back the single updated doc (1 read) to get server timestamps, then returns it
 const finalStudent = await firebaseStudentService.update(editingStudent.id, { ...editForm });
 if (finalStudent) {
 // Surgical UI state update — no full collection refetch
 setStudents(prev => prev.map(s => s.id === finalStudent.id ? finalStudent : s));
 }
 setEditingStudent(null);
 showToast('Student details updated successfully!', 'success');
 } catch (error) {
 showToast('Failed to update student details', 'error');
 }
 };

 const handleDeleteStudent = async (id: string) => {
 if (window.confirm("Are you sure you want to delete this student record?")) {
 try {
 await firebaseStudentService.delete(id);
 setStudents(students.filter(s => s.id !== id));
 showToast("Student deleted successfully", "success");
 } catch (error) {
 showToast("Failed to delete student", "error");
 }
 }
 };

 const exportToExcel = () => {
    if (filteredStudents.length === 0) {
      showToast("No students to export", "info");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(filteredStudents.map(s => ({
      ID: s.id,
      Name: s.name,
      Gender: s.gender,
      Program: s.programType,
      Level: s.programType === 'KARATE' ? s.beltLevel : `Stage ${s.stageLevel}`,
      School: s.school,
      Standard: s.standard,
      Contact: s.contact,
      WhatsApp: s.whatsapp,
      PaymentStatus: s.paymentStatus || 'pending',
      TestStatus: s.testStatus || 'pending'
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    XLSX.writeFile(workbook, `Students_Export_${new Date().getTime()}.xlsx`);
    showToast("Exported to Excel", "success");
  };

  const exportToPDF = () => {
    try {
      if (filteredStudents.length === 0) {
        showToast("No students to export", "info");
        return;
      }
      const doc = new jsPDF('landscape');
      
      // Add Logo
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 14, 10, 30, 30);
      }
      
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text(`Team Shadow Kai`, 50, 22);
      doc.setFontSize(14);
      doc.text(`Students Export - ${currentProgram}`, 50, 30);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 50, 36);

      const tableColumn = ["ID", "Name", "Program", "Level", "School", "Contact", "Payment"];
      const tableRows = filteredStudents.map(s => [
        s.id || '',
        s.name || '',
        s.programType || '',
        s.programType === 'KARATE' ? (s.beltLevel || '') : `Stage ${s.stageLevel || ''}`,
        s.school || '',
        s.contact || '',
        s.paymentStatus || 'pending'
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [0, 0, 0], textColor: [255, 215, 0] },
        alternateRowStyles: { fillColor: [250, 250, 250] }
      });

      doc.save(`Students_Export_${new Date().getTime()}.pdf`);
      showToast("Exported to PDF", "success");
    } catch (err: any) {
      console.error("PDF Export Error:", err);
      showToast(`PDF Export Error: ${err.message}`, "error");
    }
  };

 if (loading) return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
 </div>
 </AdminLayout>
 );

 return (
 <AdminLayout>
 <div className="max-w-7xl mx-auto space-y-6">
 
 {/* Header Section */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div>
 <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 STUDENT MANAGEMENT
 </h1>
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-sm mt-1">Manage, filter, and review all registered students.</p>
 </div>
 <div className="flex gap-2 w-full md:w-auto">
 <button onClick={exportToExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 font-semibold transition-colors">
 <FileSpreadsheet className="w-4 h-4 text-green-600" /> Export XLS
 </button>
 <button onClick={exportToPDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 font-semibold transition-colors">
 <Download className="w-4 h-4 text-red-600" /> Export PDF
 </button>
 </div>
 </div>

 {/* Tab Navigation (Consolidation of IndividualStudents) */}
 <div className="flex p-1 bg-zinc-200/50 rounded-xl w-full md:w-fit">
 {[
 { id: "all", label: "All Students", icon: User },
 { id: "school", label: "School Registrations", icon: School },
 { id: "individual", label: "Individual Registrations", icon: UserCircle }
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
 activeTab === tab.id 
 ? "bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800" 
 : "text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 hover:bg-zinc-200/50"
 }`}
 >
 <tab.icon className="w-4 h-4" />
 <span className="hidden sm:inline">{tab.label}</span>
 </button>
 ))}
 </div>

 {/* Filters Card */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-5 space-y-4">
 <div className="flex flex-col md:flex-row gap-4">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
 <input
 type="text"
 placeholder="Search by name, ID, or school..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>
 <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 md:max-w-[200px] bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="all">All Schools</option>
 {uniqueSchools.map(s => <option key={s} value={s}>{s}</option>)}
 </select>
 <select value={beltFilter} onChange={(e) => setBeltFilter(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="all">All Belts</option>
 {uniqueBeltLevels.map(b => <option key={b} value={b}>{b}</option>)}
 </select>
 <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 outline-none text-sm font-medium text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="all">All Genders</option>
 <option value="Male">Male</option>
 <option value="Female">Female</option>
 </select>
 <button
 onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
 className={`px-4 py-3 border rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all ${
 showAdvancedFilters || activeFiltersCount > 0 ? "bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-100 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 border-zinc-900" : "bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-900"
 }`}
 >
 <Filter className="w-4 h-4" />
 Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
 </button>
 </div>

 {/* Advanced Filters */}
 {showAdvancedFilters && (
 <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
 <div>
 <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-2">Payment Status</label>
 <select value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)} className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg text-sm bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="all">All</option>
 <option value="verified">Verified</option>
 <option value="pending">Pending</option>
 <option value="rejected">Rejected</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-2">Test Status</label>
 <select value={testStatusFilter} onChange={(e) => setTestStatusFilter(e.target.value)} className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-lg text-sm bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="all">All</option>
 <option value="pending">Pending</option>
 <option value="passed">Passed</option>
 <option value="failed">Failed</option>
 </select>
 </div>
 <div className="flex items-end">
 {activeFiltersCount > 0 && (
 <button onClick={clearAllFilters} className="text-sm font-semibold text-red-500 hover:text-red-600 px-2 py-2">
 Clear all filters
 </button>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Filtered Result Count */}
 <div className="flex flex-wrap items-center justify-between gap-2 px-1">
 <p className="text-sm text-zinc-500 dark:text-zinc-400">
 Showing <span className="font-bold text-zinc-900 dark:text-zinc-50">{filteredStudents.length}</span>
 {" "}of <span className="font-semibold text-zinc-700 dark:text-zinc-300">{students.length}</span> students
 </p>
 {(activeFiltersCount > 0 || !!searchTerm) && (
 <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-bold">
 <Filter className="w-3 h-3" />
 {activeFiltersCount + (searchTerm ? 1 : 0)} filter{activeFiltersCount + (searchTerm ? 1 : 0) === 1 ? "" : "s"} applied
 </span>
 )}
 </div>

 {/* Data Table Container */}
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-left border-collapse">
 <thead>
 <tr className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-semibold">
 <th className="px-6 py-4">Student Info ({filteredStudents.length})</th>
 <th className="px-6 py-4">Registration</th>
 <th className="px-6 py-4">Status</th>
 <th className="px-6 py-4 text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-zinc-100">
 {filteredStudents.length === 0 ? (
 <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">No students found matching your criteria.</td></tr>
 ) : (
 filteredStudents.map((student) => (
 <tr key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900/50 transition-colors group">
 <td className="px-6 py-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
 {student.registrationType === 'individual' ? <UserCircle className="w-5 h-5 text-indigo-500" /> : <User className="w-5 h-5 text-indigo-500" />}
 </div>
 <div>
 <p className="font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{(student.name || "").trim() ? student.name : `Unnamed (${student.id})`}</p>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">{student.id} &bull; {student.gender}</p>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
 Parent: <span className="font-medium text-zinc-700 dark:text-zinc-300">{student.whatsapp || "N/A"}</span> &bull; <span className="font-medium text-zinc-700 dark:text-zinc-300">{student.programType === 'KARATE' ? student.beltLevel : `Stage ${student.stageLevel}`}</span>
 </p>
 </div>
 </div>
 </td>
 <td className="px-6 py-4">
 <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate max-w-[200px]" title={student.school || 'Individual'}>
   {student.school || <span className="text-zinc-400 italic">Individual</span>}
 </p>
 <div className="flex flex-wrap gap-1.5 mt-1.5">
   <span className={`inline-flex px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider cursor-default ${student.programType === 'KARATE' ? getBeltHoverClass(student.beltLevel) : 'hover:bg-indigo-600 hover:text-white transition-colors'}`}>
     {student.programType === 'SELAMBAM' ? `Stage ${student.stageLevel || '?'}` : (student.beltLevel || 'No Belt')}
   </span>
   {student.standard && (
     <span className="inline-flex px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wider">
       Std {student.standard}
     </span>
   )}
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="flex flex-col gap-1.5 items-start">
 <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
 student.testStatus === 'passed' ? 'bg-green-100 text-green-700' :
 student.testStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
 }`}>
 Test: {student.testStatus}
 </span>
 <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
 student.paymentStatus === 'verified' ? 'bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300' : 'bg-blue-100 text-blue-700'
 }`}>
 Pay: {student.paymentStatus}
 </span>
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="flex items-center justify-center gap-2">
 <button onClick={() => handleEditClick(student)} className="p-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-indigo-600 hover:border-indigo-200 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 transition-all" title="Edit">
 <Edit className="w-4 h-4" />
 </button>
 {student.testStatus !== "pending" && (
 <button onClick={() => navigate(`/result/${student.id}`)} className="p-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-green-600 hover:border-green-200 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 transition-all" title="View Result">
 <ClipboardList className="w-4 h-4" />
 </button>
 )}
 <button onClick={() => handleDeleteStudent(student.id)} className="p-2 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-red-600 hover:border-red-200 rounded-lg shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 transition-all" title="Delete">
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>

 {/* Edit Modal (Streamlined) */}
 {editingStudent && (
 <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">Edit Student Record</h3>
 <button onClick={() => setEditingStudent(null)} className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-full p-1 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"><X className="w-4 h-4"/></button>
 </div>
 <div className="p-6 space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="col-span-2">
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Full Name</label>
 <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"/>
 </div>
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Gender</label>
 <select value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50">
 <option value="Male">Male</option><option value="Female">Female</option>
 </select>
 </div>
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Standard</label>
 <input type="text" value={editForm.standard} onChange={e => setEditForm({...editForm, standard: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium bg-white dark:bg-zinc-950 dark:bg-zinc-900 text-gray-900 dark:text-zinc-50 dark:text-zinc-50 bg-transparent dark:bg-zinc-900 dark:text-zinc-50"/>
 </div>
 <div className="col-span-2">
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">School</label>
 <input type="text" value={editForm.school} onChange={e => setEditForm({...editForm, school: e.target.value})} className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-gray-900 dark:text-zinc-50"/>
 </div>
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Contact Number <span className="normal-case text-zinc-400 font-medium">(optional)</span></label>
 <input type="tel" value={editForm.contact} onChange={e => setEditForm({...editForm, contact: e.target.value})} placeholder="Mobile Number" className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-gray-900 dark:text-zinc-50"/>
 </div>
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">WhatsApp Number <span className="text-red-500">*</span></label>
 <input type="tel" value={editForm.whatsapp} onChange={e => setEditForm({...editForm, whatsapp: e.target.value})} placeholder="WhatsApp Number" required className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium text-gray-900 dark:text-zinc-50"/>
 </div>
 </div>
 </div>
 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end gap-3">
 <button onClick={() => setEditingStudent(null)} className="px-5 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50 transition-colors">Cancel</button>
 <button onClick={handleSaveEdit} className="px-5 py-2.5 text-sm font-bold bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 transition-colors flex items-center gap-2"><Save className="w-4 h-4"/> Save Changes</button>
 </div>
 </div>
 </div>
 )}
 </AdminLayout>
 );
}
