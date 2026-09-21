import React, { useState, useEffect, useMemo } from "react";
import { 
  Activity, Users, PlayCircle, CheckCircle, Clock, Search, Filter, 
  ChevronRight, AlertCircle, Eye, RefreshCw, BarChart2, Calendar
} from "lucide-react";
import {
  firebaseBatchService,
  firebaseBeltTestService,
  firebaseSchoolService,
  firebaseStudentService,
  firebaseCoachService,
  firebaseCoachSchoolService
} from "../../../services/firebaseData";
import { Batch, BeltTest, School, StudentRecord, Coach } from "../../../types/admin";
import { useProgram } from "../../../contexts/ProgramContext";
import { formatBatchName } from "../../../utils/batchFormatters";
import { getGrade } from "../../../constants/scoring";
import { useToast } from "../../../hooks/useToast";
import { format } from "date-fns";
import AdminLayout from "../AdminLayout";

export default function BatchMonitoringDashboard() {
  const { currentProgram } = useProgram();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tests, setTests] = useState<BeltTest[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [coachLinks, setCoachLinks] = useState<{secretaryId: string, schoolId: string}[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  useEffect(() => {
    fetchData();
    
    // Set up a refresh interval for "Live" feel
    const interval = setInterval(() => {
      fetchData(false);
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [currentProgram]);

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const programFilter = currentProgram === 'ALL' ? undefined : currentProgram as 'KARATE' | 'SELAMBAM';
      
      const [
        bData, tData, sData, secData, stuData, linkData
      ] = await Promise.all([
        firebaseBatchService.getAll(programFilter),
        firebaseBeltTestService.getAll(programFilter),
        firebaseSchoolService.getAll(false, programFilter),
        firebaseCoachService.getAll(),
        firebaseStudentService.getAll(programFilter),
        firebaseCoachSchoolService.getAllLinks()
      ]);

      setBatches(bData);
      setTests(tData);
      setSchools(sData);
      setCoaches(secData);
      setStudents(stuData);
      setCoachLinks(linkData);
      
    } catch (error) {
      console.error("Error fetching monitoring data", error);
      if (showLoading) showToast("Failed to fetch dashboard data", "error");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // --- Derived Data & Metrics ---

  const {
    kpiStats,
    liveBatches,
    enrichedBatches,
    coachStats
  } = useMemo(() => {
    let total = batches.length;
    let unassigned = 0; // Batches with no referees assigned
    let inProgress = 0; // ongoing
    let completed = 0;  // completed
    let pending = 0;    // waiting
    let filling = 0;    // filling
    
    const enriched = batches.map(batch => {
      const test = tests.find(t => t.id === batch.beltTestId);
      const school = schools.find(s => s.id === batch.schoolId);
      const batchStudents = students.filter(s => batch.studentIds?.includes(s.id));
      
      const completedStudents = batchStudents.filter(s => s.scoredAt || s.score !== undefined).length;
      const progress = batchStudents.length > 0 ? Math.round((completedStudents / batchStudents.length) * 100) : 0;
      
      let coachName = "Unknown";
      if (school) {
        // Try to find if this school is linked to a coach in coachSchools
        const link = coachLinks.find(l => l.schoolId === school.id);
        if (link) {
          const coach = coaches.find(c => c.uid === link.secretaryId);
          if (coach) coachName = coach.fullName;
        } else if (school.createdBy) {
          // Fallback to createdBy if link not found (some older records might only have this)
          const coach = coaches.find(c => c.uid === school.createdBy);
          if (coach) coachName = coach.fullName;
        }
      }

      // Fallback: If still unknown (e.g., individual batches or unlinked schools),
      // check if the students in the batch belong to a coach
      if (coachName === "Unknown" && batchStudents.length > 0) {
        const studentWithSec = batchStudents.find(s => !!s.secretaryId);
        if (studentWithSec) {
          const coach = coaches.find(c => c.uid === studentWithSec.secretaryId);
          if (coach) coachName = coach.fullName;
        }
      }

      const assigned = batch.refereeIds && batch.refereeIds.length > 0;

      // Update KPIs
      if (!assigned) unassigned++;
      if (batch.status === 'ongoing') inProgress++;
      else if (batch.status === 'completed') completed++;
      else if (batch.status === 'waiting') pending++;
      else if (batch.status === 'filling') filling++;

      return {
        ...batch,
        testName: test?.name || "Unknown Test",
        beltName: test?.belts?.[0]?.name || "Mixed Belts",
        date: test?.date || "TBD",
        time: test?.time || "TBD",
        venue: test?.venue || "TBD",
        schoolName: school?.name || "Individual",
        coachName,
        totalStudents: batchStudents.length,
        completedStudents,
        progress,
        isAssigned: assigned,
        students: batchStudents
      };
    });

    const live = enriched.filter(b => b.status === 'ongoing');

    // Coach stats
    const coachMap: Record<string, { total: number, inProgress: number, completed: number, pending: number }> = {};
    enriched.forEach(b => {
      if (b.coachName !== "Unknown") {
        if (!coachMap[b.coachName]) coachMap[b.coachName] = { total: 0, inProgress: 0, completed: 0, pending: 0 };
        coachMap[b.coachName].total++;
        if (b.status === 'ongoing') coachMap[b.coachName].inProgress++;
        else if (b.status === 'completed') coachMap[b.coachName].completed++;
        else coachMap[b.coachName].pending++;
      }
    });

    return {
      kpiStats: {
        total,
        assigned: total - unassigned,
        unassigned,
        inProgress,
        completed,
        pending: pending + filling
      },
      liveBatches: live,
      enrichedBatches: enriched,
      coachStats: Object.entries(coachMap).map(([name, stats]) => ({ name, ...stats }))
    };
  }, [batches, tests, schools, coaches, students, coachLinks]);

  // --- Filtering ---
  const filteredBatches = enrichedBatches.filter(b => {
    if (statusFilter !== "all" && b.status !== statusFilter && 
        !(statusFilter === 'pending' && (b.status === 'waiting' || b.status === 'filling'))) {
      return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.batchNumber.toString().includes(q) ||
        (b.customName && b.customName.toLowerCase().includes(q)) ||
        b.testName.toLowerCase().includes(q) ||
        b.schoolName.toLowerCase().includes(q) ||
        b.coachName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading && batches.length === 0) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-zinc-500 font-medium">Loading Dashboard Data...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-950 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
              LIVE BATCH MONITORING
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Real-time overview of all belt test batches across academies.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => fetchData()} className="p-2.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:bg-zinc-100 transition-colors" title="Refresh Data">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Total Batches" value={kpiStats.total} icon={<Activity />} color="text-zinc-800 dark:text-zinc-100" bg="bg-white dark:bg-zinc-900" />
        <KpiCard title="Assigned" value={kpiStats.assigned} icon={<Users />} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" border="border-blue-100 dark:border-blue-800/30" />
        <KpiCard title="Unassigned" value={kpiStats.unassigned} icon={<AlertCircle />} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-900/20" border="border-orange-100 dark:border-orange-800/30" />
        <KpiCard title="In Progress" value={kpiStats.inProgress} icon={<PlayCircle />} color="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-900/20" border="border-indigo-100 dark:border-indigo-800/30" />
        <KpiCard title="Completed" value={kpiStats.completed} icon={<CheckCircle />} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" border="border-green-100 dark:border-green-800/30" />
        <KpiCard title="Pending" value={kpiStats.pending} icon={<Clock />} color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-900/20" border="border-yellow-100 dark:border-yellow-800/30" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MAIN BATCHES LIST */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col h-full min-h-[500px]">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row gap-4 justify-between">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search batches, schools, coaches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-zinc-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="ongoing">🟢 In Progress</option>
                  <option value="pending">⏳ Pending</option>
                  <option value="completed">✅ Completed</option>
                </select>
              </div>
            </div>
            
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Batch</th>
                    <th className="px-4 py-3 font-semibold">Sport / Belt</th>
                    <th className="px-4 py-3 font-semibold text-center">Progress</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                        No batches found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map(batch => (
                      <tr key={batch.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-zinc-900 dark:text-white">{formatBatchName(batch)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900 dark:text-zinc-200">{batch.programType === 'KARATE' ? 'Karate' : 'Silambam'}</div>
                          <div className="text-xs text-zinc-500">{batch.beltName}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-bold">{batch.completedStudents} / {batch.totalStudents}</span>
                            <div className="w-20 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${batch.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                style={{ width: `${batch.progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={batch.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => setSelectedBatch(batch)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SIDEBAR: LIVE & COACH STATS */}
        <div className="space-y-6">
          
          {/* CURRENTLY CONDUCTING */}
          <div className="bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-600/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <PlayCircle className="w-24 h-24" />
            </div>
            <div className="p-5 border-b border-indigo-500/30 flex items-center gap-2 relative z-10">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
              <h2 className="font-bold tracking-wider" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                LIVE CONDUCTING
              </h2>
            </div>
            <div className="p-5 space-y-4 relative z-10">
              {liveBatches.length > 0 ? (
                liveBatches.slice(0, 3).map(batch => (
                  <div key={batch.id} className="bg-white/10 rounded-xl p-3 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition" onClick={() => setSelectedBatch(batch)}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold">{formatBatchName(batch)}</div>
                        <div className="text-xs text-indigo-100">{batch.programType === 'KARATE' ? 'Karate' : 'Silambam'} • {batch.beltName}</div>
                      </div>
                      <div className="bg-indigo-700 px-2 py-1 rounded text-xs font-bold">{batch.progress}%</div>
                    </div>
                    <div className="text-xs text-indigo-100 space-y-1">
                      <div className="flex justify-between"><span>Progress:</span> <span className="font-medium text-white">{batch.completedStudents} / {batch.totalStudents} Completed</span></div>
                    </div>
                    <div className="w-full h-1 bg-indigo-900/50 rounded-full mt-3 overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${batch.progress}%` }}></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-indigo-200">
                  <PlayCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No batches currently in progress.</p>
                </div>
              )}
            </div>
          </div>


        </div>
      </div>

      {/* BATCH DETAIL MODAL */}
      {selectedBatch && (
        <BatchDetailModal 
          batch={selectedBatch} 
          onClose={() => setSelectedBatch(null)} 
        />
      )}
      </div>
    </AdminLayout>
  );
}

// --- Helper Components ---

function KpiCard({ title, value, icon, color, bg, border = "border-transparent" }: any) {
  return (
    <div className={`p-4 rounded-2xl border ${bg} ${border} flex flex-col justify-between`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{title}</span>
        <div className={`${color} opacity-80`}>{React.cloneElement(icon, { className: "w-5 h-5" })}</div>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ongoing') return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>LIVE</span>;
  if (status === 'completed') return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">DONE</span>;
  if (status === 'waiting') return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">WAITING</span>;
  if (status === 'filling') return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">FILLING</span>;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 uppercase">{status}</span>;
}

function BatchDetailModal({ batch, onClose }: { batch: any, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 animate-fade-in">
        
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900 rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white uppercase" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '1px' }}>
              {formatBatchName(batch)}
            </h2>
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{batch.programType === 'KARATE' ? 'Karate' : 'Silambam'}</span>
              <span>•</span>
              <span>{batch.beltName}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status={batch.status} />
            <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <DetailItem icon={<Calendar />} label="Date & Time" value={`${batch.date} at ${batch.time}`} />
            <DetailItem icon={<BarChart2 />} label="Venue" value={batch.venue} />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-300">Batch Progress</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{batch.completedStudents} / {batch.totalStudents} <span className="text-base font-normal">Students Completed</span></div>
            </div>
            <div className="text-right flex flex-col items-end">
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{batch.progress}%</div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg text-zinc-900 dark:text-white mb-3">Candidate Progress</h3>
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">Student Name</th>
                    <th className="px-4 py-2 font-semibold text-center">Status</th>
                    <th className="px-4 py-2 font-semibold text-center">Score</th>
                    <th className="px-4 py-2 font-semibold text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {batch.students.map((student: any, idx: number) => (
                    <tr key={student.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5 text-zinc-500">{(idx + 1).toString().padStart(2, '0')}</td>
                      <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-200">{student.name}</td>
                      <td className="px-4 py-2.5 text-center">
                        {student.score !== undefined ? (
                          <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded">Completed</span>
                        ) : (
                          <span className="text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold">
                        {student.percentage !== undefined ? `${student.percentage}%` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {student.score !== undefined ? (
                          <span className={`font-bold text-sm ${student.testStatus === 'failed' ? 'text-red-600' : 'text-green-600'}`}>
                            {getGrade(student.percentage)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                  {batch.students.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">No students found in this batch.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
        {React.cloneElement(icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
        {label}
      </div>
      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-200">{value}</div>
    </div>
  );
}
