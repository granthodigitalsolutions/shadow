import { useState, useEffect, useRef } from "react";
import { UserCheck, Plus, Edit, Trash2, Save, X, Eye, EyeOff, School as SchoolIcon, RefreshCw, Check, XCircle, Search, Filter, ChevronDown, Phone } from "lucide-react";
import { firebaseRefereeService, firebaseSchoolService, firebaseBatchService } from "../../services/firebaseData";
import { auth } from "../../config/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import AdminLayout from "./AdminLayout";
import { useToast } from "../../hooks/useToast";
import { useDialog } from "../../contexts/DialogContext";
import { useProgram } from "../../contexts/ProgramContext";
import { Referee, School, Batch } from "../../types/admin";

export default function RefereeManagement() {
 const { showToast } = useToast();
 const { showConfirm } = useDialog();
 const { currentProgram } = useProgram();
 const lastFetchedProgram = useRef<string | null>(null);
 const [referees, setReferees] = useState<Referee[]>([]);
 const [searchQuery, setSearchQuery] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [schools, setSchools] = useState<School[]>([]);
 const [batches, setBatches] = useState<Batch[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadingSchools, setLoadingSchools] = useState(true);
 const [showModal, setShowModal] = useState(false);
 const [editingReferee, setEditingReferee] = useState<Referee | null>(null);
 const [viewingRefereeDetails, setViewingRefereeDetails] = useState<Referee | null>(null);
 const [showPassword, setShowPassword] = useState(false);
 const [refreshing, setRefreshing] = useState(false);
 const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  const filteredReferees = referees.filter(ref => {
    const matchesSearch = (ref.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (ref.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    if (statusFilter === "active" && !ref.active) return false;
    if (statusFilter === "inactive" && ref.active) return false;
    return matchesSearch;
  });

 const [formData, setFormData] = useState({
 name: "",
 email: "",
 phoneNumber: "",
 schoolId: "",
 password: "",
 active: true,
 });

 useEffect(() => {
 setStats({
 total: referees.length,
 active: referees.filter(r => r.isActive).length,
 inactive: referees.filter(r => !r.isActive).length
 });
 }, [referees]);

 useEffect(() => {
 if (lastFetchedProgram.current === currentProgram) return;
 lastFetchedProgram.current = currentProgram;
 setReferees([]);
 setLoading(true);
 fetchData();
 }, [currentProgram]);

 const fetchData = async (forceRefresh: boolean = false) => {
 if (forceRefresh) {
 setRefreshing(true);
 } else {
 setLoading(true);
 }
 try {
 await Promise.all([
 fetchReferees(forceRefresh),
 fetchSchools(forceRefresh),
 fetchBatches(forceRefresh),
 ]);
 } catch (error) {
 console.error("Error loading data:", error);
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 };

 const fetchBatches = async (forceRefresh: boolean = false) => {
 try {
 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
 const data = await firebaseBatchService.getAll(programFilter);
 setBatches(data);
 } catch (error) {
 console.error("Error fetching batches:", error);
 }
 };

 const fetchReferees = async (forceRefresh: boolean = false) => {
 try {
 const data = await firebaseRefereeService.getAll();
 setReferees(data);
 } catch (error) {
 console.error("Error fetching referees:", error);
 showToast("Error loading referees", "error");
 }
 };

 const fetchSchools = async (forceRefresh: boolean = false) => {
 try {
 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
 const data = await firebaseSchoolService.getAll(programFilter);
 setSchools(data);
 } catch (error) {
 console.error("Error fetching schools:", error);
 showToast("Error loading schools", "error");
 } finally {
 setLoadingSchools(false);
 }
 };

 const handleOpenModal = (referee?: Referee) => {
 if (referee) {
 setEditingReferee(referee);
 setFormData({
 name: referee.name,
 email: referee.email,
 phoneNumber: referee.phoneNumber,
 schoolId: referee.schoolId,
 password: "", // Don't show password
 active: referee.active,
 });
 } else {
 setEditingReferee(null);
 setFormData({
 name: "",
 email: "",
 phoneNumber: "",
 schoolId: "",
 password: "",
 active: true,
 });
 }
 setShowModal(true);
 };

 const handleCloseModal = () => {
 setShowModal(false);
 setEditingReferee(null);
 setShowPassword(false);
 setFormData({
 name: "",
 email: "",
 phoneNumber: "",
 schoolId: "",
 password: "",
 active: true,
 });
 };

 const generatePassword = () => {
 const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
 let password = "";
 for (let i = 0; i < 12; i++) {
 password += chars.charAt(Math.floor(Math.random() * chars.length));
 }
 setFormData({ ...formData, password });
 setShowPassword(true);
 };

 const handleSubmit = async () => {
 if (!formData.name.trim() || !formData.email.trim() || !formData.phoneNumber.trim()) {
 showToast("Please fill in all required fields", "error");
 return;
 }

 if (!editingReferee && !formData.password) {
 showToast("Password is required for new referees", "error");
 return;
 }

 try {
 if (editingReferee) {
 // Update existing referee — service returns finalReferee with server timestamps
 const finalReferee = await firebaseRefereeService.update(editingReferee.id, {
 name: formData.name,
 email: formData.email,
 phoneNumber: formData.phoneNumber,
 schoolId: formData.schoolId,
 active: formData.active,
 });
 if (finalReferee) {
 // Surgical UI state update — no full refetch
 setReferees(prev => prev.map(r =>
 r.id === finalReferee.id
 ? { ...finalReferee, isActive: finalReferee.active }
 : r
 ));
 }
 showToast("Referee updated successfully!", "success");
 } else {
 // Create new referee with Firebase Auth
 const userCredential = await createUserWithEmailAndPassword(
 auth,
 formData.email,
 formData.password
 );

 // Create referee document — returns new doc ID
 const newId = await firebaseRefereeService.create({
 name: formData.name,
 email: formData.email,
 phoneNumber: formData.phoneNumber,
 schoolId: formData.schoolId,
 uid: userCredential.user.uid,
 assignedBatchIds: [],
 active: formData.active,
 });

 // Fetch the newly created document to get server timestamps
 const newReferee = await firebaseRefereeService.getById(newId, false);
 if (newReferee) {
 // Surgical UI state update — prepend new referee without full refetch
 setReferees(prev => [{ ...newReferee, isActive: newReferee.active }, ...prev]);
 }

 showToast(
 `Referee created successfully! Login: ${formData.email} / ${formData.password}`,
 "success"
 );
 }

 handleCloseModal();
 } catch (error: any) {
 console.error("Error saving referee:", error);
 if (error.code === "auth/email-already-in-use") {
 showToast("Email already in use", "error");
 } else {
 showToast("Error saving referee", "error");
 }
 }
 };

 const handleToggleActive = async (id: string, active: boolean) => {
 try {
 // Service returns finalReferee with server timestamps after toggleActive
 const finalReferee = await firebaseRefereeService.toggleActive(id, !active);
 if (finalReferee) {
 // Surgical UI state update — no full refetch
 setReferees(prev => prev.map(r =>
 r.id === id
 ? { ...finalReferee, isActive: finalReferee.active }
 : r
 ));
 }
 showToast(
 `Referee ${!active ? "activated" : "deactivated"} successfully!`,
 "success"
 );
 } catch (error) {
 console.error("Error toggling referee status:", error);
 showToast("Error updating referee status", "error");
 }
 };

 const handleDelete = async (id: string, name: string) => {
 const confirmed = await showConfirm({
 title: "Delete Referee?",
 message: `Are you sure you want to delete ${name}? This action cannot be undone.`,
 confirmText: "Delete",
 variant: "danger",
 });

 if (confirmed) {
 try {
 await firebaseRefereeService.delete(id);
 // Surgical UI state update — no full refetch
 setReferees(prev => prev.filter(r => r.id !== id));
 showToast("Referee deleted successfully", "success");
 } catch (error) {
 console.error("Error deleting referee:", error);
 showToast("Error deleting referee", "error");
 }
 }
 };

 const getSchoolName = (schoolId: string) => {
 if (!schoolId) return "Unassigned";
 const school = schools.find((s) => s.id === schoolId);
 return school ? `${school.name} - ${school.branch}` : "Unknown School";
 };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading referees...</p>
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
 <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center">
 <UserCheck className="w-6 h-6 text-indigo-500" />
 </div>
 <div>
 <h2
 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50"
 style={{ fontFamily: "'Bebas Neue', sans-serif" }}
 >
 REFEREE MANAGEMENT
 </h2>
 <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-0.5">Manage referees and credentials</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => fetchData(true)}
 disabled={refreshing}
 className="flex items-center justify-center p-2.5 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 hover:bg-zinc-200 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 disabled:opacity-50"
 title="Refresh Referees"
 >
 <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
 </button>
 <button
 onClick={() => handleOpenModal()}
 className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-zinc-950 rounded-xl hover:bg-blue-600 font-bold active:scale-95 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 <Plus className="w-5 h-5" />
 Add Referee
 </button>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 text-center">
 <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 tracking-tight">{stats.total}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Total Referees</p>
 </div>
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 text-center">
 <p className="text-3xl font-bold text-green-600 tracking-tight">
 {stats.active}
 </p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Active Referees</p>
 </div>
 <div className="bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-2xl p-5 text-center">
 <p className="text-3xl font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 tracking-tight">
 {stats.inactive}
 </p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">Inactive Referees</p>
 </div>
 </div>  </div>

  {/* Filters & Search */}
  <div className="px-6 mb-6 flex flex-wrap gap-4">
    <div className="flex-1 min-w-[250px] relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        placeholder="Search by name or email..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-900 dark:text-white"
      />
    </div>

    <div className="relative">
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="appearance-none pl-10 pr-8 py-2 border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-gray-900 dark:text-white cursor-pointer"
      >
        <option value="all">All Accounts</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    </div>
  </div>

    <div className="px-6 pb-6">
      {filteredReferees.length === 0 ? (
        <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-12 text-center">
          <UserCheck className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 mb-1">No referees found</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-6">No referees matching your criteria were found.</p>
                    <button
            onClick={() => handleOpenModal()}
            className="px-6 py-2.5 bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-100 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors"
          >
            Add A Referee
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReferees.map((referee) => (
            <div
              key={referee.id}
                            className={`relative bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 p-5 group flex flex-col h-full ${!referee.active ? 'opacity-75 grayscale-[20%]' : ''}`}
            >
              {/* Top Section */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Avatar */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-base font-bold shadow-sm ${referee.active ? 'bg-gradient-to-br from-blue-400 to-blue-500 text-blue-950' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'}`}>
                    {referee.name.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[16px] text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
                      {referee.name}
                    </h3>
                    <p className="text-[13px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                      {referee.email}
                    </p>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="flex-shrink-0 ml-3 flex items-center gap-1.5 mt-1">
                  <span className="relative flex h-2 w-2">
                    {referee.active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${referee.active ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}></span>
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${referee.active ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {referee.active ? 'Active' : 'Offline'}
                  </span>
                </div>
              </div>

              {/* Contact & Meta */}
              <div className="flex flex-col gap-2.5 mt-1 mb-6 text-[13px] text-zinc-600 dark:text-zinc-400 flex-grow">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium">{referee.phoneNumber}</span>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800/80 mt-auto">
                <button
                  onClick={() => setViewingRefereeDetails(referee)}
                  className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  Assigned Details
                </button>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(referee.id, referee.active)}
                    title={referee.active ? "Deactivate" : "Activate"}
                    className={`p-2 rounded-lg transition-colors ${referee.active ? 'text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20' : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-500 dark:hover:bg-emerald-950/30'}`}
                  >
                    {referee.active ? <XCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleOpenModal(referee)}
                    title="Edit"
                    className="p-2 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(referee.id, referee.name)}
                    title="Delete"
                    className="p-2 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
</div>

{/* Assigned Details Modal */}
{viewingRefereeDetails && (() => {
 const assignedBatches = batches.filter(b =>
 (viewingRefereeDetails.assignedBatchIds || []).includes(b.id)
 );
 return (
 <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-xl max-w-md w-full overflow-hidden max-h-[80vh] flex flex-col">
 <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 flex-shrink-0">
 <div>
 <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">Assigned Details</h3>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium mt-0.5">{viewingRefereeDetails.name}</p>
 </div>
 <button
 onClick={() => setViewingRefereeDetails(null)}
 className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-full p-1 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className="p-6 overflow-y-auto flex-1">
 {assignedBatches.length === 0 ? (
 <div className="text-center py-8">
 <p className="text-4xl mb-3">📋</p>
 <p className="font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300">No Batches Assigned</p>
 <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mt-1">This referee has no batch assignments yet.</p>
 </div>
 ) : (
 <ul className="space-y-3">
 {assignedBatches.map((batch) => {
 const school = schools.find(s => s.id === batch.schoolId);
 const schoolName = school ? `${school.name}${school.branch ? ` - ${school.branch}` : ''}` : (batch.schoolId === 'individual' ? 'Individual Group' : 'Unknown School');
 const batchName = batch.customName || `Batch ${batch.batchNumber}`;
 return (
 <li key={batch.id} className="flex items-center gap-3 p-3.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl">
 <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 flex-shrink-0 text-sm font-bold">{batch.batchNumber}</span>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 truncate">{schoolName}</p>
 <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium mt-0.5">→ {batchName}</p>
 </div>
 <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
 batch.status === 'completed' ? 'bg-green-100 text-green-700' :
 batch.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
 'bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400'
 }`}>{batch.status}</span>
 </li>
 );
 })}
 </ul>
 )}
 </div>
 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end flex-shrink-0">
 <button
 onClick={() => setViewingRefereeDetails(null)}
 className="px-5 py-2.5 text-sm font-bold bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-100 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors active:scale-95"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 );
 })()}

 {/* Add/Edit Referee Modal */}
 {showModal && (
 <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
 <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 flex-shrink-0">
 <h3
 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50"
 >
 {editingReferee ? "Edit Referee" : "Add New Referee"}
 </h3>
 <button
 onClick={handleCloseModal}
 className="text-zinc-400 hover:text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-full p-1 shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 
 <div className="p-6 overflow-y-auto flex-1 space-y-4">
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Full Name *
 </label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="Referee Kumar"
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Email *
 </label>
 <input
 type="email"
 value={formData.email}
 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
 className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="referee@shadowkai.com"
 disabled={!!editingReferee}
 />
 {editingReferee && (
 <p className="text-xs font-bold text-blue-500 mt-1.5">Email cannot be changed</p>
 )}
 </div>

 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Phone Number *
 </label>
 <input
 type="text"
 value={formData.phoneNumber}
 onChange={(e) =>
 setFormData({ ...formData, phoneNumber: e.target.value })
 }
 className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="+91 98765 43210"
 />
 </div>



 {!editingReferee && (
 <div>
 <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
 Password *
 </label>
 <div className="flex gap-2">
 <div className="relative flex-1">
 <input
 type={showPassword ? "text" : "password"}
 value={formData.password}
 onChange={(e) =>
 setFormData({ ...formData, password: e.target.value })
 }
 className="w-full px-4 py-2.5 pr-10 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 placeholder="Enter password"
 />
 <button
 type="button"
 onClick={() => setShowPassword(!showPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400"
 >
 {showPassword ? (
 <EyeOff className="w-4 h-4" />
 ) : (
 <Eye className="w-4 h-4" />
 )}
 </button>
 </div>
 <button
 type="button"
 onClick={generatePassword}
 className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-100 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 font-bold text-sm whitespace-nowrap active:scale-95 transition-all"
 >
 Generate
 </button>
 </div>
 <p className="text-xs font-bold text-blue-500 mt-1.5">
 Save this password! Referee will need it to login.
 </p>
 </div>
 )}

 <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 rounded-xl">
 <input
 type="checkbox"
 id="active"
 checked={formData.active}
 onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
 className="w-5 h-5 rounded border-2 border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 text-blue-500 focus:ring-blue-500 rounded-md bg-transparent dark:bg-zinc-900 dark:text-zinc-50"
 />
 <label htmlFor="active" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 select-none">
 Active <span className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium ml-1">(referee can login)</span>
 </label>
 </div>

 <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
 <p className="text-xs font-bold text-blue-700">
 <span className="uppercase tracking-wider">Note:</span> {editingReferee ? "Changes will be saved to the referee account." : "A new Firebase Auth account will be created for this referee."}
 </p>
 </div>
 </div>

 <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 flex justify-end gap-3 flex-shrink-0">
 <button
 onClick={handleCloseModal}
 className="px-5 py-2.5 text-sm font-bold text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:hover:text-white dark:text-zinc-50 dark:text-zinc-50 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 font-bold transition-colors active:scale-95"
 >
 <Save className="w-4 h-4" />
 {editingReferee ? "Update" : "Create"}
 </button>
 </div>
 </div>
 </div>
 )}
 </AdminLayout>
 );
}


