import { useEffect, useState, useMemo, useRef } from "react";
import {
  Users, DollarSign, CheckCircle, XCircle, CreditCard, FileText,
 Clock, QrCode, Calendar, Bell, ClipboardList, UserCheck
} from "lucide-react";
import { firebaseBeltTestService, firebaseStudentService, firebaseSchoolService, firebaseBatchService } from "../../services/firebaseData";
import { AlertTriangle } from "lucide-react";
import AdminLayout from "./AdminLayout";
import { useProgram } from "../../contexts/ProgramContext";
import { SearchableDropdown } from "../ui/SearchableDropdown";
import { firebaseAuthAccessService, AuthAccessConfig } from "../../services/firebaseAuthAccessService";
import { ShieldAlert, ShieldCheck, Shield } from "lucide-react";


function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export default function AdminDashboard() {
 const { currentProgram, programNavigate } = useProgram();
 const lastFetchedProgram = useRef<string | null>(null);
 const [activeBeltTest, setActiveBeltTest] = useState<any>(null);
 const [students, setStudents] = useState<any[]>([]);
 const [schools, setSchools] = useState<any[]>([]);
 const [selectedSchool, setSelectedSchool] = useState<string>('ALL');
 const [batches, setBatches] = useState<any[]>([]);
 const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
 const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthAccessConfig | null>(null);

 useEffect(() => {
 if (lastFetchedProgram.current === currentProgram) return;
 lastFetchedProgram.current = currentProgram;
 setStudents([]);
 setSchools([]);
 setSelectedSchool('ALL');
 setBatches([]);
 setSelectedBatch('ALL');
 setActiveBeltTest(null);
 setLoading(true);
 setError(null);
 
  setLoading(true);
  
  let studentsLoaded = false;
  let testLoaded = false;
  
  const checkLoading = () => {
    if (studentsLoaded && testLoaded) setLoading(false);
  };
  

  
  const programFilter = currentProgram === 'ALL' ? undefined : currentProgram;
  
  firebaseSchoolService.getActive(programFilter as any).then(setSchools).catch(console.error);
  
  const unsubStudents = firebaseStudentService.listenAll((data) => {
    setStudents(data);
    studentsLoaded = true;
    checkLoading();
  }, programFilter as any);
  
  const unsubTest = firebaseBeltTestService.listenActive((data) => {
    setActiveBeltTest(data);
    testLoaded = true;
    checkLoading();
  }, programFilter as any);
  
  const unsubAuth = firebaseAuthAccessService.subscribe(setAuthConfig);
  
  return () => {
    unsubStudents();
    unsubTest();
    unsubAuth();
  };
  }, [currentProgram]);

 useEffect(() => {
   if (selectedSchool === 'ALL') {
     setBatches([]);
     setSelectedBatch('ALL');
     return;
   }
   
   const programFilter = currentProgram === 'ALL' ? undefined : currentProgram;
   firebaseBatchService.getAll(programFilter as any).then((allBatches) => {
     setBatches(allBatches.filter(b => b.schoolId === selectedSchool));
   }).catch(console.error);
   
   setSelectedBatch('ALL');
 }, [selectedSchool, currentProgram]);

 const filteredStudents = useMemo(() => {
  let filtered = students;
  if (selectedSchool !== 'ALL') {
    filtered = filtered.filter(s => s.schoolId === selectedSchool);
  }
  if (selectedBatch !== 'ALL') {
    filtered = filtered.filter(s => s.batchId === selectedBatch);
  }
  return filtered;
 }, [students, selectedSchool, selectedBatch]);

 const stats = useMemo(() => ({
 total: filteredStudents.length,
 revenue: filteredStudents
 .filter((s) => s.paymentStatus === "verified")
 .reduce((sum, s) => sum + (s.paymentDetails?.amount || 0), 0),
 passed: filteredStudents.filter((s) => s.testStatus === "passed" || s.testStatus === "pass").length,
 failed: filteredStudents.filter((s) => s.testStatus === "failed" || s.testStatus === "fail").length,
 pendingTests: filteredStudents.filter((s) => s.testStatus !== "passed" && s.testStatus !== "pass" && s.testStatus !== "failed" && s.testStatus !== "fail").length,
 completedTests: filteredStudents.filter((s) => s.testStatus === "passed" || s.testStatus === "pass" || s.testStatus === "failed" || s.testStatus === "fail").length,
 }), [filteredStudents]);



 if (error) {
 return (
 <AdminLayout>
 <div className="flex flex-col items-center justify-center min-h-[60vh]">
 <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
 <h2 className="text-2xl font-bold text-gray-800 dark:text-zinc-200 mb-2">{error}</h2>
 <p className="text-gray-500">Please check your permissions or try again later.</p>
 </div>
 </AdminLayout>
 );
 }

 if (loading) {
 return (
 <AdminLayout>
 <div className="flex items-center justify-center min-h-[60vh]">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400">Loading dashboard...</p>
 </div>
 </div>
 </AdminLayout>
 );
 }

 if (!activeBeltTest) {
 const programName = currentProgram === 'KARATE' ? 'Karate Belt Test' : currentProgram === 'SELAMBAM' ? 'Selambam Stage Test' : 'Test';
 const createButtonText = currentProgram === 'KARATE' ? 'Create Belt Test' : currentProgram === 'SELAMBAM' ? 'Create Stage Test' : 'Create Test';

 return (
 <AdminLayout>
 <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
 <Calendar className="w-24 h-24 text-gray-300 mb-6" />
 <h2 className="text-3xl font-bold text-gray-800 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 dark:text-zinc-200 mb-3" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {currentProgram === 'ALL' ? 'NO ACTIVE TESTS' : `NO ACTIVE ${programName.toUpperCase()}`}
 </h2>
 <p className="text-gray-600 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 mb-6 max-w-md">
 {currentProgram === 'ALL'
 ? 'Create and activate a test to start accepting student registrations and managing evaluations.'
 : `Create and activate a ${programName.toLowerCase()} to start accepting student registrations and managing evaluations.`}
 </p>
 <button
 onClick={() => programNavigate("create-belt-test")}
 className="px-8 py-3 bg-blue-500 text-zinc-950 rounded-xl font-bold hover:bg-blue-600 transition-all shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 active:scale-95"
 >
 {createButtonText}
 </button>
 </div>
 </AdminLayout>
 );
 }

 return (
 <AdminLayout>
 <div className="space-y-6">
 <div className="bg-zinc-950 dark:bg-zinc-100 border border-zinc-800 text-white dark:text-zinc-900 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
 {/* Subtle decoration */}
 <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
 <div>
 <p className="text-blue-500 font-bold text-xs tracking-wider uppercase mb-1">Active Belt Test</p>
 <h2 className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
 {activeBeltTest.name.toUpperCase()}
 </h2>
 <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
 <Calendar className="w-4 h-4"/>
 <span>{new Date(activeBeltTest.date).toLocaleDateString()}</span>
 <span className="w-1 h-1 bg-zinc-600 rounded-full"></span>
 <Clock className="w-4 h-4"/>
 <span>{activeBeltTest.time}</span>
 </div>
 </div>
 <button
 onClick={() => programNavigate("manage-belt-tests")}
 className="w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 text-zinc-950 rounded-xl font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:bg-zinc-800 dark:bg-zinc-800 transition-colors shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 active:scale-95 flex items-center justify-center gap-2"
 >
 Manage Tests
 </button>
 </div>
 </div>

  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
    <div className="flex flex-col gap-1.5 w-full sm:w-auto">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Filter by School:</label>
      <SearchableDropdown
        options={[
          { label: "All Schools", value: "ALL" },
          { label: "Individual", value: "individual" },
          ...schools.map(s => ({ label: s.name, value: s.id }))
        ]}
        value={selectedSchool}
        onChange={setSelectedSchool}
        placeholder="Select a school..."
      />
    </div>

    <div className="flex flex-col gap-1.5 w-full sm:w-auto">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Filter by Batch:</label>
      <SearchableDropdown
        options={[
          { label: "All Batches", value: "ALL" },
          ...batches.map(b => ({ label: `Batch ${b.batchNumber}${b.customName ? ` - ${b.customName}` : ''}`, value: b.id }))
        ]}
        value={selectedBatch}
        onChange={setSelectedBatch}
        placeholder="Select a batch..."
        disabled={selectedSchool === 'ALL'}
        emptyMessage="No batches found."
      />
    </div>
  </div>

 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
 <StatCard icon={Users} label="Total Students" value={stats.total} color="blue" />
 <StatCard icon={DollarSign} label="Total Revenue" value={`₹${stats.revenue.toLocaleString()}`} color="green" />
 <StatCard icon={CheckCircle} label="Passed Tests" value={stats.passed} color="emerald" />
 <StatCard icon={XCircle} label="Failed Tests" value={stats.failed} color="red" />
 <StatCard icon={Clock} label="Pending Tests" value={stats.pendingTests} color="amber" />
 </div>

 {stats.total === 0 && (
   <div className="mt-8 p-12 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed text-center">
     <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
       <Users className="w-8 h-8 text-zinc-400" />
     </div>
     <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">No Students Found</h3>
     <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-md mx-auto">
       There are no students matching your current school and batch filters. Try adjusting your filter criteria above.
     </p>
   </div>
 )}

 
        {/* Authentication Status Card */}
        {authConfig && (
          <div className="mt-8 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                Authentication Status
              </h3>
              <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                <p>Last Updated: {new Date(authConfig.globalUpdatedAt).toLocaleTimeString()}</p>
                <p>by {authConfig.globalUpdatedBy.name}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Secretary Access</h4>
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Registration</span>
                  <span className={`flex items-center gap-1 text-xs font-bold ${authConfig.roles.secretary.registration.enabled ? 'text-green-600' : 'text-red-600'}`}>
                    {authConfig.roles.secretary.registration.enabled ? <><ShieldCheck className="w-4 h-4"/> OPEN</> : <><ShieldAlert className="w-4 h-4"/> CLOSED</>}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Login</span>
                  <span className={`flex items-center gap-1 text-xs font-bold ${authConfig.roles.secretary.login.enabled ? 'text-green-600' : 'text-red-600'}`}>
                    {authConfig.roles.secretary.login.enabled ? <><ShieldCheck className="w-4 h-4"/> OPEN</> : <><ShieldAlert className="w-4 h-4"/> CLOSED</>}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Referee Access</h4>
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Registration</span>
                  <span className={`flex items-center gap-1 text-xs font-bold ${authConfig.roles.referee.registration.enabled ? 'text-green-600' : 'text-red-600'}`}>
                    {authConfig.roles.referee.registration.enabled ? <><ShieldCheck className="w-4 h-4"/> OPEN</> : <><ShieldAlert className="w-4 h-4"/> CLOSED</>}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Login</span>
                  <span className={`flex items-center gap-1 text-xs font-bold ${authConfig.roles.referee.login.enabled ? 'text-green-600' : 'text-red-600'}`}>
                    {authConfig.roles.referee.login.enabled ? <><ShieldCheck className="w-4 h-4"/> OPEN</> : <><ShieldAlert className="w-4 h-4"/> CLOSED</>}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-right">
              <button onClick={() => programNavigate("auth-settings")} className="text-xs font-bold text-blue-600 hover:text-blue-700">
                Manage Authentication Settings &rarr;
              </button>
            </div>
          </div>
        )}


 </div>
 </AdminLayout>
 );
}

function StatCard({ icon: Icon, label, value, color }: any) {
 const colorMap: any = {
 blue: "bg-blue-50 text-blue-600 border-blue-100",
 green: "bg-green-50 text-green-600 border-green-100",
 emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
 red: "bg-red-50 text-red-600 border-red-100",
 purple: "bg-purple-50 text-purple-600 border-purple-100",
 amber: "bg-blue-50 text-blue-600 border-blue-100",
 };

 return (
 <div className={`bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 dark:shadow-none dark:border dark:border-zinc-800 border border-zinc-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 p-5 flex flex-col justify-between h-full`}>
 <div className={`w-10 h-10 rounded-xl ${colorMap[color]} flex items-center justify-center mb-4`}>
 <Icon className="w-5 h-5" />
 </div>
 <div>
 <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 dark:text-zinc-50 tracking-tight">{value}</p>
 <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-wider mt-1">{label}</p>
 </div>
 </div>
 );
}



function StatusBadge({ status }: { status: string }) {
 const normalizedStatus = 
 status === "pass" ? "passed" :
 status === "fail" ? "failed" :
 status;

 const styles: any = {
 passed: "bg-green-100 text-green-700",
 failed: "bg-red-100 text-red-700",
 pending: "bg-blue-100 text-blue-700",
 };

 return (
 <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider ${styles[normalizedStatus] || styles.pending}`}>
 {(normalizedStatus || "pending").toUpperCase()}
 </span>
 );
}
