import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { School, Users, Plus, Edit, Trash2, Save, X, Layers, Phone, Copy } from "lucide-react";
import { firebaseSchoolService, firebaseBatchService } from "../../services/firebaseData";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";
import { School as SchoolType } from "../../types/admin";

export default function SchoolManagement() {
 const navigate = useNavigate();
 const { showToast } = useToast();
 const { showConfirm } = useDialog();
 const { currentProgram, programNavigate } = useProgram();

 const [schools, setSchools] = useState<SchoolType[]>([]);
 const [batchCounts, setBatchCounts] = useState<{ [schoolId: string]: number }>({});
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [showModal, setShowModal] = useState(false);
 const [editingSchool, setEditingSchool] = useState<SchoolType | null>(null);
 const [formData, setFormData] = useState({
 name: "",
 branch: "",
 contactPerson: "",
 contactNumber: "",
 active: true,
 });

 const prevSig = useRef<string>("");

 useEffect(() => {
 const sig = `${currentProgram}`;
 if (prevSig.current === sig) return;
 prevSig.current = sig;
 fetchSchools();
 }, [currentProgram]);

 const fetchSchools = async () => {
 try {
 // 'ALL' means no filter — pass undefined to get all programs
 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
 const [schoolsData, batchesData] = await Promise.all([
 firebaseSchoolService.getAll(programFilter),
 firebaseBatchService.getAll(programFilter),
 ]);

 setSchools(schoolsData);

 // Calculate batch counts per school
 const counts: { [schoolId: string]: number } = {};
 batchesData.forEach((batch) => {
 counts[batch.schoolId] = (counts[batch.schoolId] || 0) + 1;
 });
 setBatchCounts(counts);
 } catch (error) {
 console.error("Error fetching schools:", error);
 showToast("Error loading schools", "error");
 } finally {
 setLoading(false);
 }
 };

 const handleOpenModal = (school?: SchoolType) => {
 if (school) {
 setEditingSchool(school);
 setFormData({
 name: school.name,
 branch: school.branch,
 contactPerson: school.contactPerson || "",
 contactNumber: school.contactNumber || "",
 active: school.active,
 });
 } else {
 setEditingSchool(null);
 setFormData({
 name: "",
 branch: "",
 contactPerson: "",
 contactNumber: "",
 active: true,
 });
 }
 setShowModal(true);
 };

 const handleCloseModal = () => {
 setShowModal(false);
 setEditingSchool(null);
 setFormData({
 name: "",
 branch: "",
 contactPerson: "",
 contactNumber: "",
 active: true,
 });
 };

 const handleSubmit = async () => {
 if (!formData.name.trim() || !formData.branch.trim()) {
 showToast("Please fill in required fields", "error");
 return;
 }

 setSubmitting(true);
 try {
 if (editingSchool) {
 await firebaseSchoolService.update(editingSchool.id, formData);
 showToast("School updated successfully!", "success");
 } else {
 // Ensure programType is valid — never pass 'ALL'
 const programType = currentProgram === 'ALL' ? 'KARATE' : currentProgram as 'KARATE' | 'SELAMBAM';
 await firebaseSchoolService.create({ ...formData, programType });
 showToast("School created successfully!", "success");
 }
 handleCloseModal();
 await fetchSchools(true); // bypass cache after mutation
 } catch (error) {
 console.error("Error saving school:", error);
 showToast("Error saving school", "error");
 } finally {
 setSubmitting(false);
 }
 };

 const handleToggleActive = async (id: string, active: boolean) => {
 try {
 await firebaseSchoolService.toggleActive(id, !active);
 showToast(
 `School ${!active ? "activated" : "deactivated"} successfully!`,
 "success"
 );
 await fetchSchools(true);
 } catch (error) {
 console.error("Error toggling school status:", error);
 showToast("Error updating school status", "error");
 }
 };

 const handleDelete = async (id: string, name: string) => {
 const ok = await showConfirm({
 title: "Delete School",
 message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
 confirmText: "Delete",
 variant: "danger",
 });
 if (!ok) return;

 try {
 await firebaseSchoolService.delete(id);
 showToast("School deleted successfully!", "success");
 setSchools(prev => prev.filter(s => s.id !== id));
 } catch (error) {
 console.error("Error deleting school:", error);
 showToast("Error deleting school", "error");
 }
 };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading schools...</p>
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
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
 <School className="w-6 h-6 text-indigo-500" />
 </div>
 <div>
 <h2 className="text-2xl font-bold" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 SCHOOL MANAGEMENT
 </h2>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">Manage schools and branches</p>
 </div>
 </div>
 <button
 onClick={() => handleOpenModal()}
 className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-zinc-950 rounded-xl hover:bg-blue-600 font-bold active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 <Plus className="w-5 h-5" />
 Add School
 </button>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 text-center">
 <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 tracking-tight">{schools.length}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Total Schools</p>
 </div>
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 text-center">
 <p className="text-3xl font-bold text-green-600 tracking-tight">
 {schools.filter(s => s.active).length}
 </p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Active Schools</p>
 </div>
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 text-center">
 <p className="text-3xl font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 tracking-tight">
 {schools.filter(s => !s.active).length}
 </p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Inactive Schools</p>
 </div>
 </div>
 </div>

 {schools.length === 0 ? (
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-12 text-center">
 <School className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
 <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 mb-1">No schools found</p>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-6">You haven't added any schools yet.</p>
 <button
 onClick={() => handleOpenModal()}
 className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-100 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors"
 >
 Add Your First School
 </button>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {schools.map((school) => (
 <div
 key={school.id}
 className={`group bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border transition-all duration-300 overflow-hidden ${
 school.active
 ? "border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700"
 : "border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 opacity-80"
 }`}
 >
 {/* Header with solid accent */}
 <div className={`h-1.5 ${
 school.active
 ? "bg-blue-500"
 : "bg-zinc-300"
 }`} />

 <div className="p-6">
 {/* School Info Header */}
 <div className="flex items-start justify-between mb-5">
 <div className="flex items-center gap-3.5 flex-1 min-w-0">
 <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
 school.active
 ? "bg-indigo-50 border border-indigo-100"
 : "bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"
 }`}>
 <School className={`w-7 h-7 transition-colors ${
 school.active ? "text-indigo-500" : "text-zinc-400"
 }`} />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="font-bold text-xl text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 truncate mb-0.5">{school.name}</h3>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium truncate">{school.branch}</p>
 
 </div>
 </div>
 <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase flex-shrink-0 ml-2 ${
 school.active
 ? "bg-green-100 text-green-700"
 : "bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"
 }`}>
 {school.active ? "Active" : "Inactive"}
 </span>
 </div>

 {/* Contact Details */}
 <div className="mb-5 space-y-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 {school.contactPerson && (
 <div className="flex items-center gap-2.5 text-sm">
 <div className="w-7 h-7 rounded-md bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex items-center justify-center flex-shrink-0">
 <Users className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400" />
 </div>
 <span className="text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 font-medium">{school.contactPerson}</span>
 </div>
 )}
 {school.contactNumber && (
 <div className="flex items-center gap-2.5 text-sm">
 <div className="w-7 h-7 rounded-md bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex items-center justify-center flex-shrink-0">
 <Phone className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400" />
 </div>
 <span className="text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 font-medium">{school.contactNumber}</span>
 </div>
 )}
 <div className="flex items-center gap-2.5 text-sm">
 <div className="w-7 h-7 rounded-md bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex items-center justify-center flex-shrink-0">
 <Layers className="w-3.5 h-3.5 text-indigo-500" />
 </div>
 <span className="text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 font-bold">{batchCounts[school.id] || 0} Batches</span>
 </div>
 </div>

 {/* Primary Action Button */}
 <button
 onClick={() => programNavigate(`schools/${school.id}/batches`)}
 className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-950 dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-100 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 text-sm font-bold active:scale-[0.98] transition-all duration-200"
 >
 <Layers className="w-4 h-4" />
 Manage Batches
 </button>

 {/* Secondary Actions */}
 <div className="flex gap-2">
 <button
 onClick={() => handleOpenModal(school)}
 className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 text-sm font-bold active:scale-[0.98] transition-all duration-200"
 >
 <Edit className="w-4 h-4" />
 Edit
 </button>
 <button
 onClick={() => handleToggleActive(school.id, school.active)}
 className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold active:scale-[0.98] transition-all duration-200 ${
 school.active
 ? "bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 hover:bg-zinc-200"
 : "bg-green-100 text-green-700 hover:bg-green-200"
 }`}
 >
 {school.active ? "Deactivate" : "Activate"}
 </button>
 <button
 onClick={() => handleDelete(school.id, school.name)}
 className="p-2 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-red-500 rounded-lg hover:bg-red-50 hover:text-red-600 active:scale-[0.98] transition-all duration-200"
 title="Delete School"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Add/Edit School Modal */}
 {showModal && (
 <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900">
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">
 {editingSchool ? "Edit School" : "Add New School"}
 </h3>
 <button
 onClick={handleCloseModal}
 className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-full p-1 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 School Name *
 </label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="ABC School"
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Branch / Location *
 </label>
 <input
 type="text"
 value={formData.branch}
 onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
 className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="Trichy"
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Contact Person
 </label>
 <input
 type="text"
 value={formData.contactPerson}
 onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
 className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="John Doe"
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Contact Number
 </label>
 <input
 type="text"
 value={formData.contactNumber}
 onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
 className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="+91 98765 43210"
 />
 </div>

 <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl">
 <input
 type="checkbox"
 id="active"
 checked={formData.active}
 onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
 className="w-5 h-5 rounded border-2 border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 text-blue-500 focus:ring-blue-500 rounded-md bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 <label htmlFor="active" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 select-none">
 Active <span className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium ml-1">(students can register)</span>
 </label>
 </div>
 </div>
 
 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end gap-3 mt-4">
 <button
 onClick={handleCloseModal}
 className="px-5 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 disabled={submitting}
 className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 font-bold transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {submitting ? (
 <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
 ) : (
 <Save className="w-4 h-4" />
 )}
 {submitting ? "Saving..." : editingSchool ? "Update" : "Create"}
 </button>
 </div>
 </div>
 </div>
 )}
 </AdminLayout>
 );
}
