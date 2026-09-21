import { useEffect, useState, useMemo } from "react";
import { Users, DollarSign, CheckCircle, RefreshCw, AlertTriangle, FileText } from "lucide-react";
import { firebaseStudentService } from "../../services/firebaseData";
import { firebaseAuthService } from "../../services/firebaseAuth";
import SecretaryLayout from "./SecretaryLayout";
import { StudentRecord } from "../../types/admin";

export default function SecretaryDashboard() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const user = firebaseAuthService.getCurrentUser();
    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = firebaseStudentService.listenBySecretary(user.uid, (studentsList) => {
      studentsList.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      setStudents(studentsList);
      setError(null);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  const fetchData = async () => {}; // Stub for refresh button

  const stats = useMemo(() => {
    const verified = students.filter(s => s.paymentStatus === "verified");
    return {
      total: students.length,
      verifiedCount: verified.length,
      revenue: verified.reduce((sum, s) => sum + (s.paymentDetails?.amount || 0), 0),
      pendingCount: students.length - verified.length,
    };
  }, [students]);

  if (error) {
    return (
      <SecretaryLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-zinc-200 mb-2">{error}</h2>
        </div>
      </SecretaryLayout>
    );
  }

  if (loading) {
    return (
      <SecretaryLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-zinc-400">Loading dashboard...</p>
          </div>
        </div>
      </SecretaryLayout>
    );
  }

  return (
    <SecretaryLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-950 dark:text-white" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            SECRETARY OVERVIEW
          </h1>
          <button 
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-500' : 'text-zinc-500 dark:text-zinc-400'}`} />
            <span className="hidden sm:inline dark:text-zinc-300">Refresh</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Registrations</p>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white pl-1">{stats.total}</h3>
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Verified Payments</p>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white pl-1">{stats.verifiedCount}</h3>
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pending Payments</p>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white pl-1">{stats.pendingCount}</h3>
          </div>

          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total Fees Collected</p>
            </div>
            <h3 className="text-3xl font-bold text-zinc-900 dark:text-white pl-1">₹{stats.revenue.toLocaleString()}</h3>
          </div>
        </div>

        {/* Recent Registrations Table */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Recent Registrations
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                  <th className="p-4">Student</th>
                  <th className="p-4">School</th>
                  <th className="p-4">Program</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Fee Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                      No registrations found. Use the Bulk Registration tool to add students.
                    </td>
                  </tr>
                ) : (
                  students.map(student => (
                    <tr key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-zinc-900 dark:text-white">{student.name}</div>
                        <div className="text-xs text-zinc-500">{(student.id || '').slice(-6).toUpperCase()}</div>
                      </td>
                      <td className="p-4 text-zinc-700 dark:text-zinc-300">{student.school}</td>
                      <td className="p-4">
                        <div className="text-zinc-900 dark:text-zinc-200 font-medium">{student.programType}</div>
                        <div className="text-xs text-zinc-500">{student.beltLevel || student.stageLevel || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        {student.paymentStatus === 'verified' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-500/20">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-medium text-zinc-900 dark:text-zinc-300">
                        {student.paymentDetails?.amount ? `₹${student.paymentDetails.amount}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SecretaryLayout>
  );
}
