import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Power, Calendar } from "lucide-react";
import { beltTestService } from "../../utils/adminData";
import AdminLayout from "./AdminLayout";
import { useProgram } from "../../contexts/ProgramContext";
import { useDialog } from "../../contexts/DialogContext";

export default function ManageBeltTests() {
 const { currentProgram, programNavigate } = useProgram();
 const { showConfirm } = useDialog();
 const [beltTests, setBeltTests] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 fetchBeltTests(true);
 }, [currentProgram]);

 const fetchBeltTests = async () => {
 setLoading(true);
 setError(null);
 try {
 const programFilter = currentProgram === 'ALL' ? undefined : currentProgram;
 // Always bypass cache to get fresh data
 const data = await beltTestService.getAll(programFilter as any);
 setBeltTests(data);
 } catch (err) {
 console.error('Failed to load tests:', err);
 setError('Failed to load tests. Please refresh the page.');
 } finally {
 setLoading(false);
 }
 };

 const handleToggleActive = async (id: string, currentStatus: boolean) => {
 try {
 // Optimistic UI update
 setBeltTests(prev => prev.map(t => t.id === id ? { ...t, isActive: !currentStatus } : t));
 await beltTestService.update(id, { isActive: !currentStatus });
 await fetchBeltTests(true);
 } catch (err: any) {
 console.error("Toggle active failed:", err);
 setError(`Failed to ${currentStatus ? 'deactivate' : 'activate'} test: ${err.message}`);
 await fetchBeltTests(true); // Revert on failure
 }
 };

 const handleDelete = async (id: string) => {
 const ok = await showConfirm({
 title: "Delete Belt Test",
 message: "Are you sure you want to permanently delete this belt test? This action cannot be undone.",
 confirmText: "Delete",
 variant: "danger",
 });
 if (ok) {
 try {
 // Optimistic UI removal
 setBeltTests(prev => prev.filter(t => t.id !== id));
 await beltTestService.delete(id);
 await fetchBeltTests(true);
 } catch (err: any) {
 console.error("Delete failed:", err);
 setError(`Failed to delete test: ${err.message}`);
 await fetchBeltTests(true); // Revert on failure
 }
 }
 };

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading tests...</p>
 </div>
 </div>
 </AdminLayout>
 );
 }

 if (error) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <p className="text-red-500 font-semibold mb-4">{error}</p>
 <button onClick={() => fetchBeltTests(true)} className="px-6 py-2 bg-blue-500 text-zinc-950 font-bold rounded-xl">
 Retry
 </button>
 </div>
 </div>
 </AdminLayout>
 );
 }

 return (
 <AdminLayout>
 <div className="space-y-6">
 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-6 md:p-8">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
 <div>
 <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {currentProgram === 'KARATE' ? 'MANAGE KARATE BELT TESTS' :
 currentProgram === 'SELAMBAM' ? 'MANAGE SELAMBAM STAGE TESTS' :
 'MANAGE TESTS'}
 </h2>
 <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">
 {currentProgram === 'KARATE' ? 'Create and manage karate belt test configurations' :
 currentProgram === 'SELAMBAM' ? 'Create and manage selambam stage test configurations' :
 'Create and manage test configurations'}
 </p>
 </div>
 {beltTests.length === 0 && (
 <button
 onClick={() => programNavigate("create-belt-test")}
 className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-zinc-950 rounded-xl hover:bg-blue-600 font-bold shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 active:scale-95 transition-all"
 >
 <Plus className="w-5 h-5" />
 Create New Test
 </button>
 )}
 </div>

 {beltTests.length === 0 ? (
 <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 border-dashed">
 <Calendar className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
 <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-bold mb-6">No tests configured</p>
 <button
 onClick={() => programNavigate("create-belt-test")}
 className="px-8 py-3 bg-zinc-900 dark:bg-zinc-100 dark:bg-zinc-100 dark:bg-zinc-100 text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 rounded-xl font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 transition-colors shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 >
 Create Your First Test
 </button>
 </div>
 ) : (
 <div className="space-y-4">
 {beltTests.map((test) => (
 <div
 key={test.id}
 className={`bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border p-6 transition-all group ${test.isActive ? 'border-blue-500 shadow-md dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800' : 'border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 dark:border-zinc-700 opacity-90 hover:opacity-100'}`}
 >
 <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-4">
 <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {test.name.toUpperCase()}
 </h3>
 <ActiveBadge isActive={test.isActive} />
 </div>
 <div className="grid sm:grid-cols-2 gap-4 text-sm bg-zinc-50 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800">
 <div className="space-y-2">
 <p className="flex flex-wrap justify-between items-center gap-3">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Date</span>
 <span className="font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{new Date(test.date).toLocaleDateString()}</span>
 </p>
 <p className="flex flex-wrap justify-between items-center gap-3">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Time</span>
 <span className="font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">{test.time}</span>
 </p>
 <p className="flex flex-wrap justify-between items-center gap-3">
 <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Test ID</span>
 <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 bg-zinc-200 px-2 py-0.5 rounded">{test.id.slice(0, 8)}...</span>
 </p>
 </div>
 <div className="space-y-2">
  <p className="flex flex-wrap justify-between items-center gap-3">
  <span className="font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider text-xs">Created</span>
  <span className="font-semibold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50">
  {test.createdAt 
  ? (test.createdAt.toDate 
  ? test.createdAt.toDate().toLocaleDateString() 
  : new Date(test.createdAt).toLocaleDateString()) 
  : 'N/A'}
  </span>
  </p>
 </div>
 </div>
 </div>

 <div className="flex lg:flex-col gap-2">
 <button
 onClick={() => programNavigate(`edit-belt-test/${test.id}`)}
 className="flex-1 lg:flex-none p-3 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 title="Edit"
 >
 <Edit className="w-5 h-5" />
 </button>
 <button
 onClick={() => handleToggleActive(test.id, test.isActive)}
 className={`flex-1 lg:flex-none p-3 rounded-xl flex items-center justify-center shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 transition-colors ${
 test.isActive
 ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
 : "bg-green-100 text-green-700 hover:bg-green-200"
 }`}
 title={test.isActive ? "Deactivate" : "Activate"}
 >
 <Power className="w-5 h-5" />
 </button>
 <button
 onClick={() => handleDelete(test.id)}
 className="flex-1 lg:flex-none p-3 bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-red-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800"
 title="Delete"
 >
 <Trash2 className="w-5 h-5" />
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="bg-zinc-950 rounded-2xl p-6 border border-zinc-800 shadow-xl relative overflow-hidden">
 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
 <h4 className="font-bold text-blue-500 mb-3 tracking-wide uppercase text-sm">Important Rules</h4>
 <ul className="text-sm font-medium text-zinc-400 space-y-2">
 <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Only ONE belt test can be created in the system</li>
 <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Only ONE belt test can be active at a time</li>
 <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Activating a new test automatically deactivates others</li>
 <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> When all tests are inactive, student registration is disabled</li>
 </ul>
 </div>
 </div>
 </AdminLayout>
 );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
 return (
 <span
 className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${
 isActive
 ? "bg-green-100 text-green-700 border border-green-200"
 : "bg-zinc-100 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800"
 }`}
 >
 {isActive ? "Active" : "Inactive"}
 </span>
 );
}
