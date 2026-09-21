import { useState, useEffect, useRef } from "react";
import { Search, DollarSign, CheckCircle, XCircle, FileSpreadsheet, Download, ChevronDown, Filter, Calendar, X } from "lucide-react";
import { studentService } from "../../utils/adminData";
import { firebaseStudentService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { useProgram } from "../../contexts/ProgramContext";
import { DocumentSnapshot } from "firebase/firestore";
import { useToast } from "../../hooks/useToast";
import { logoBase64 } from "../../utils/logoBase64";
import { belts } from "../../data";

export default function PaymentVerification() {
 // Search & Basic Filters
 const [searchTerm, setSearchTerm] = useState("");

 // Advanced Filters
 const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
 const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
 const [schoolFilter, setSchoolFilter] = useState("all");
 const [beltFilter, setBeltFilter] = useState("all");
 const [amountRangeFilter, setAmountRangeFilter] = useState({ min: "", max: "" });
 const [dateRangeFilter, setDateRangeFilter] = useState({ from: "", to: "" });
 const [testDateFilter, setTestDateFilter] = useState("");

 const [payments, setPayments] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const { currentProgram } = useProgram();
 const { showToast } = useToast();
 const lastFetchedProgram = useRef<string | null>(null);

 useEffect(() => {
 if (lastFetchedProgram.current === currentProgram) return;
 lastFetchedProgram.current = currentProgram;
 setPendingStudents([]);
 setVerifiedStudents([]);
 setLoading(true);
 fetchPayments();
 }, [currentProgram]);

 const fetchPayments = async () => {
 setLoading(true);
 try {
 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram;
 const result = await firebaseStudentService.getVerifiedPayments(programFilter);
 setPayments(result);
 } catch (error) {
 console.error('Error fetching payments:', error);
 showToast('Error loading payments', 'error');
 } finally {
 setLoading(false);
 }
 };


 const filteredPayments = payments.filter((s) => {
 // Search filter
 const matchesSearch = (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
 (s.school || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
 (s.paymentDetails?.transactionId || "").toLowerCase().includes(searchTerm.toLowerCase());

 // Advanced filters
 const matchesPaymentMethod = paymentMethodFilter === "all" || s.paymentDetails?.method === paymentMethodFilter;
 const matchesSchool = schoolFilter === "all" || s.school === schoolFilter;
 const matchesBelt = beltFilter === "all" || s.beltLevel === beltFilter;

 // Amount range filter
 let matchesAmountRange = true;
 if (amountRangeFilter.min || amountRangeFilter.max) {
 const amount = s.paymentDetails?.amount || 0;
 if (amountRangeFilter.min) {
 matchesAmountRange = matchesAmountRange && amount >= Number(amountRangeFilter.min);
 }
 if (amountRangeFilter.max) {
 matchesAmountRange = matchesAmountRange && amount <= Number(amountRangeFilter.max);
 }
 }

 // Date range filter (payment date)
 let matchesDateRange = true;
 if (dateRangeFilter.from || dateRangeFilter.to) {
 const paymentDate = s.paymentDetails?.paymentDate ? new Date(s.paymentDetails.paymentDate) : null;
 if (paymentDate) {
 if (dateRangeFilter.from) {
 matchesDateRange = matchesDateRange && paymentDate >= new Date(dateRangeFilter.from);
 }
 if (dateRangeFilter.to) {
 const toDate = new Date(dateRangeFilter.to);
 toDate.setHours(23, 59, 59, 999);
 matchesDateRange = matchesDateRange && paymentDate <= toDate;
 }
 }
 }

 // Test date filter
 let matchesTestDate = true;
 if (testDateFilter) {
 const testDate = s.paymentDetails?.testDate ? new Date(s.paymentDetails.testDate).toISOString().split('T')[0] : null;
 matchesTestDate = testDate === testDateFilter;
 }

 return matchesSearch && matchesPaymentMethod && matchesSchool && matchesBelt &&
 matchesAmountRange && matchesDateRange && matchesTestDate;
 });

 const uniquePaymentMethods = Array.from(new Set(payments.map(s => s.paymentDetails?.method).filter(Boolean))).sort();
 const uniqueSchools = Array.from(new Set(payments.map(s => s.school).filter(Boolean))).sort();
  const uniqueBeltLevels = currentProgram === 'SELAMBAM'
    ? Array.from({ length: 8 }, (_, i) => `Stage ${i + 1}`)
    : currentProgram === 'KARATE'
      ? ['White', 'Yellow', 'Orange', 'Blue', 'Green', 'II Brown', 'I Brown', 'Black Belt']
      : ['White', 'Yellow', 'Orange', 'Blue', 'Green', 'II Brown', 'I Brown', 'Black Belt', ...Array.from({ length: 8 }, (_, i) => `Stage ${i + 1}`)];

 const clearAllFilters = () => {
 setSearchTerm("");
 setPaymentMethodFilter("all");
 setSchoolFilter("all");
 setBeltFilter("all");
 setAmountRangeFilter({ min: "", max: "" });
 setDateRangeFilter({ from: "", to: "" });
 setTestDateFilter("");
 };

 const activeFiltersCount = [
 paymentMethodFilter !== "all",
 schoolFilter !== "all",
 beltFilter !== "all",
 amountRangeFilter.min !== "" || amountRangeFilter.max !== "",
 dateRangeFilter.from !== "" || dateRangeFilter.to !== "",
 testDateFilter !== "",
 ].filter(Boolean).length;

 const totalRevenue = payments
 .filter(p => p.paymentStatus === 'verified')
 .reduce((sum, p) => sum + (p.paymentDetails?.amount || 0), 0);

 const exportToExcel = () => {
 const exportData = filteredPayments.map(student => ({
 'Student ID': student.id,
 'Name': student.name,
 'Gender': student.gender || '-',
 'School': student.school,
 'Standard': student.standard,
 'Belt Level': student.beltLevel,
 'Contact': student.contact,
 'WhatsApp': student.whatsapp,
 'Amount': student.paymentDetails?.amount,
 'Payment Method': student.paymentDetails?.method,
 'Transaction ID': student.paymentDetails?.transactionId,
 'Payment Date': student.paymentDetails?.paymentDate ? new Date(student.paymentDetails.paymentDate).toLocaleString() : '',
 'Test Date': student.paymentDetails?.testDate ? new Date(student.paymentDetails.testDate).toLocaleDateString() : '',
 'Test Time': student.paymentDetails?.testTime,
 'Payment Status': (student.paymentStatus || "").toUpperCase(),
 }));

 const ws = XLSX.utils.json_to_sheet(exportData);
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, 'Payments');
 XLSX.writeFile(wb, `Payment_Details_${new Date().toISOString().split('T')[0]}.xlsx`);
 };

 const exportToPDF = () => {
 const doc = new jsPDF();

 // Header Background (Black)
 doc.setFillColor(0, 0, 0);
 doc.rect(0, 0, 210, 35, 'F');

 if (logoBase64) {
   doc.addImage(logoBase64, 'PNG', 10, 5, 25, 25);
 }

 // Title (Yellow)
 doc.setTextColor(255, 215, 0);
 doc.setFontSize(22);
 doc.setFont(undefined, 'bold');
 doc.text('SHADOW KAI KARATE', 105, 15, { align: 'center' });

 // Subtitle (White)
 doc.setTextColor(255, 255, 255);
 doc.setFontSize(14);
 doc.setFont(undefined, 'normal');
 doc.text('Payment Details Report', 105, 25, { align: 'center' });

 // Reset text color
 doc.setTextColor(0, 0, 0);
 doc.setFontSize(10);
 doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 45);
 doc.text(`Total Payments: ${filteredPayments.length}`, 14, 51);
 doc.text(`Total Revenue: ₹${totalRevenue.toLocaleString()}`, 14, 57);

 // Divider line
 doc.setDrawColor(200, 200, 200);
 doc.line(14, 62, 196, 62);

 let yPos = 70;
 doc.setFontSize(9);

 filteredPayments.forEach((student, index) => {
 if (yPos > 270) {
 doc.addPage();
 yPos = 20;
 }

 // Student name header
 doc.setFillColor(245, 245, 245);
 doc.rect(14, yPos - 4, 182, 8, 'F');
 doc.setFont(undefined, 'bold');
 doc.setFontSize(10);
 doc.text(`${index + 1}. ${student.name}`, 16, yPos);
 yPos += 8;

 doc.setFont(undefined, 'normal');
 doc.setFontSize(9);

 // Left column
 doc.text(`ID: ${student.id}`, 16, yPos);
 yPos += 5;
 doc.text(`Gender: ${student.gender || '-'}`, 16, yPos);
 yPos += 5;
 doc.text(`School: ${student.school}`, 16, yPos);
 yPos += 5;
 doc.text(`Belt: ${student.beltLevel}`, 16, yPos);
 yPos += 5;
 doc.text(`Contact: ${student.contact}`, 16, yPos);
 yPos -= 15;

 // Right column - Payment details
 doc.setFont(undefined, 'bold');
 doc.setTextColor(0, 128, 0);
 doc.text(`Amount: ₹${student.paymentDetails?.amount.toLocaleString()}`, 110, yPos);
 doc.setTextColor(0, 0, 0);
 doc.setFont(undefined, 'normal');
 yPos += 5;
 doc.text(`Method: ${student.paymentDetails?.method}`, 110, yPos);
 yPos += 5;
 doc.text(`Transaction: ${student.paymentDetails?.transactionId ? student.paymentDetails.transactionId.substring(0, 20) : 'N/A'}`, 110, yPos);
 yPos += 5;
 doc.text(`Status: ${student.paymentStatus ? (student.paymentStatus || '').toUpperCase() : 'N/A'}`, 110, yPos);
 yPos += 8;

 // Separator
 doc.setDrawColor(230, 230, 230);
 doc.line(14, yPos, 196, yPos);
 yPos += 6;
 });

 doc.save(`Payment_Details_${new Date().toISOString().split('T')[0]}.pdf`);
 };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading payments...</p>
 </div>
 </div>
 </AdminLayout>
 );
 }

 return (
 <AdminLayout>
 <div className="space-y-6">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-6">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
 <h2 className="text-2xl font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 PAYMENT DETAILS
 </h2>
 <div className="flex items-center gap-3">
 <div className="flex gap-2">
 <button
 onClick={exportToExcel}
 className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm"
 >
 <FileSpreadsheet className="w-4 h-4" />
 Export Excel
 </button>
 <button
 onClick={exportToPDF}
 className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold text-sm"
 >
 <Download className="w-4 h-4" />
 Export PDF
 </button>
 </div>
 <div className="bg-green-50 border-2 border-green-200 rounded-lg px-6 py-3">
 <p className="text-sm text-green-700 font-semibold mb-1">Total Revenue</p>
 <p className="text-3xl font-bold text-green-600">₹{totalRevenue.toLocaleString()}</p>
 </div>
 </div>
 </div>

 <div className="space-y-4">
 {/* Search Input */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
 <input
 type="text"
 placeholder="Search by name, school, or transaction ID..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-blue-600 focus:outline-none bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>

 {/* Advanced Filters Toggle & Controls */}
 <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <button
 onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
 className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 transition-colors"
 >
 <Filter className="w-4 h-4" />
 Advanced Filters
 {activeFiltersCount > 0 && (
 <span className="px-2 py-0.5 bg-green-600 text-white rounded-full text-xs">
 {activeFiltersCount}
 </span>
 )}
 <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
 </button>
 {activeFiltersCount > 0 && (
 <button
 onClick={clearAllFilters}
 className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-semibold"
 >
 <X className="w-4 h-4" />
 Clear All Filters
 </button>
 )}
 </div>

 {/* Advanced Filters Panel */}
 {showAdvancedFilters && (
 <div className="p-4 bg-gray-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-lg border-2 border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 space-y-4">
 <h3 className="font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 flex items-center gap-2">
 <Filter className="w-4 h-4" />
 Advanced Payment Filtering
 </h3>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {/* Payment Method */}
 <div>
 <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">Payment Method</label>
 <select
 value={paymentMethodFilter}
 onChange={(e) => setPaymentMethodFilter(e.target.value)}
 className="w-full px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="all">All Methods</option>
 {uniquePaymentMethods.map((method) => (
 <option key={method} value={method}>{method}</option>
 ))}
 </select>
 </div>

 {/* School Filter */}
 <div>
 <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">School</label>
 <select
 value={schoolFilter}
 onChange={(e) => setSchoolFilter(e.target.value)}
 className="w-full px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="all">All Schools</option>
 {uniqueSchools.map((school) => (
 <option key={school} value={school}>{school}</option>
 ))}
 </select>
 </div>

 {/* Belt Level */}
 <div>
 <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">Belt Level</label>
 <select
 value={beltFilter}
 onChange={(e) => setBeltFilter(e.target.value)}
 className="w-full px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 >
 <option value="all">All Belt Levels</option>
 {uniqueBeltLevels.map((belt) => (
 <option key={belt} value={belt}>{belt}</option>
 ))}
 </select>
 </div>

 {/* Amount Min */}
 <div>
 <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">Min Amount (₹)</label>
 <input
 type="number"
 placeholder="Min"
 value={amountRangeFilter.min}
 onChange={(e) => setAmountRangeFilter({ ...amountRangeFilter, min: e.target.value })}
 className="w-full px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>

 {/* Amount Max */}
 <div>
 <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">Max Amount (₹)</label>
 <input
 type="number"
 placeholder="Max"
 value={amountRangeFilter.max}
 onChange={(e) => setAmountRangeFilter({ ...amountRangeFilter, max: e.target.value })}
 className="w-full px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>

 {/* Test Date */}
 <div>
 <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">Test Date</label>
 <input
 type="date"
 value={testDateFilter}
 onChange={(e) => setTestDateFilter(e.target.value)}
 className="w-full px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>

 {/* Payment Date From */}
 <div>
 <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">Payment Date From</label>
 <input
 type="date"
 value={dateRangeFilter.from}
 onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, from: e.target.value })}
 className="w-full px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>

 {/* Payment Date To */}
 <div>
 <label className="block text-xs font-semibold text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1.5">Payment Date To</label>
 <input
 type="date"
 value={dateRangeFilter.to}
 onChange={(e) => setDateRangeFilter({ ...dateRangeFilter, to: e.target.value })}
 className="w-full px-3 py-2 border-2 border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 rounded-lg focus:border-green-600 focus:outline-none bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-sm bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 </div>
 </div>

 {/* Filter Summary */}
 <div className="pt-3 border-t border-gray-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <p className="text-xs text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">
 <span className="font-semibold">Showing:</span> {filteredPayments.length} of {payments.length} payments
 {totalRevenue > 0 && (
 <span className="ml-3">
 <span className="font-semibold">Filtered Revenue:</span>{" "}
 <span className="text-green-600 font-bold">
 ₹{filteredPayments.reduce((sum, p) => sum + (p.paymentDetails?.amount || 0), 0).toLocaleString()}
 </span>
 </span>
 )}
 </p>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 <div className="space-y-4">
 {filteredPayments.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-lg shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 p-12 text-center">
 <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
 <p className="text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 text-lg">No payments found</p>
 </div>
 ) : (
 filteredPayments.map((student) => (
 <div key={student.id} className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl border-2 border-gray-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-green-200 hover:shadow-lg transition-all overflow-hidden">
 {/* Header Section with Gradient */}
 <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <h3 className="text-xl font-bold text-gray-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 mb-1">{student.name}</h3>
 <div className="flex flex-wrap items-center gap-2">
 <span className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">ID: {student.id}</span>
 <span className="text-gray-300">•</span>
 <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
 student.gender === 'Male' ? 'bg-blue-100 text-blue-700' :
 student.gender === 'Female' ? 'bg-pink-100 text-pink-700' :
 'bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400'
 }`}>
 {student.gender || 'Not Specified'}
 </span>
 <span className="text-gray-300">•</span>
 <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
 {student.beltLevel}
 </span>
 </div>
 </div>
 <div className="flex-shrink-0">
 <PaymentStatusBadge status={student.paymentStatus} />
 </div>
 </div>
 </div>

 {/* Content Section */}
 <div className="p-6">
 <div className="grid md:grid-cols-3 gap-6">
 {/* Student Info */}
 <div className="space-y-3">
 <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-3">
 <div className="w-8 h-0.5 bg-gray-300"></div>
 Student Info
 </div>
 <div className="space-y-2">
 <div>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-0.5">School</p>
 <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{student.school}</p>
 </div>
 <div>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-0.5">Standard</p>
 <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{student.standard}</p>
 </div>
 <div>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-0.5">Contact</p>
 <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">{student.contact}</p>
 </div>
 <div>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-0.5">WhatsApp</p>
 <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">{student.whatsapp}</p>
 </div>
 </div>
 </div>

 {/* Payment Details */}
 <div className="space-y-3">
 <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-3">
 <div className="w-8 h-0.5 bg-gray-300"></div>
 Payment
 </div>
 <div className="bg-green-50 rounded-lg p-4 border border-green-100">
 <p className="text-xs text-green-600 font-semibold mb-1">Amount Paid</p>
 <p className="text-3xl font-bold text-green-700">
 ₹{student.paymentDetails?.amount.toLocaleString()}
 </p>
 </div>
 <div className="space-y-2">
 <div>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-0.5">Payment Method</p>
 <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{student.paymentDetails?.method}</p>
 </div>
 <div>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-1">Transaction ID</p>
 <code className="block bg-gray-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 px-3 py-2 rounded-lg text-xs text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 font-mono break-all">
 {student.paymentDetails?.transactionId}
 </code>
 </div>
 <div>
 <p className="text-xs text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-0.5">Payment Date</p>
 <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">
 {student.paymentDetails && new Date(student.paymentDetails.paymentDate).toLocaleString()}
 </p>
 </div>
 </div>
 </div>

 {/* Test Schedule */}
 <div className="space-y-3">
 <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wide mb-3">
 <div className="w-8 h-0.5 bg-gray-300"></div>
 Test Schedule
 </div>
 <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100 space-y-2">
 <div>
 <p className="text-xs text-indigo-600 font-semibold mb-1">Test Date</p>
 <p className="text-lg font-bold text-indigo-900">
 {student.paymentDetails && new Date(student.paymentDetails.testDate).toLocaleDateString('en-IN', {
 weekday: 'short',
 year: 'numeric',
 month: 'short',
 day: 'numeric'
 })}
 </p>
 </div>
 <div>
 <p className="text-xs text-indigo-600 font-semibold mb-1">Test Time</p>
 <p className="text-lg font-bold text-indigo-900">{student.paymentDetails?.testTime}</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 ))
 )}

 </div>
 </div>
 </AdminLayout>
 );
}

function StatCard({ label, value, color, icon: Icon }: any) {
 const colors: any = {
 blue: "bg-blue-50 text-blue-600 border-blue-200",
 green: "bg-green-50 text-green-600 border-green-200",
 red: "bg-red-50 text-red-600 border-red-200",
 amber: "bg-blue-50 text-blue-600 border-blue-200",
 };

 return (
 <div className={`${colors[color]} border-2 rounded-lg p-4`}>
 <div className="flex items-center gap-2 mb-2">
 <Icon className="w-5 h-5" />
 <p className="text-sm font-semibold">{label}</p>
 </div>
 <p className="text-2xl font-bold">{value}</p>
 </div>
 );
}

function PaymentStatusBadge({ status }: { status: string }) {
 const styles: any = {
 verified: "bg-green-100 text-green-800 border-green-200",
 rejected: "bg-red-100 text-red-800 border-red-200",
 };

 const icons: any = {
 verified: <CheckCircle className="w-4 h-4" />,
 rejected: <XCircle className="w-4 h-4" />,
 };

 return (
 <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border-2 ${styles[status]}`}>
 {icons[status]}
 {status.toUpperCase()}
 </span>
 );
}
