import { useState, useEffect, useRef, useMemo } from "react";
import { 
  Search, Printer, User, Building, CheckCircle, Square, CheckSquare, Filter, 
  X, AlertCircle, RefreshCw, FileText, CheckCircle2, Clock, Check
} from "lucide-react";
import { useProgram } from "../../contexts/ProgramContext";
import { firebaseStudentService, firebaseSchoolService } from "../../services/firebaseData";
import { auth } from "../../config/firebase";
import { useToast } from "../../hooks/useToast";
import StickerPreview, { StickerStudent } from "./StickerPreview";
import { StudentRecord, School } from "../../types";
import AdminLayout from "./AdminLayout";

type PrintMode = "individual" | "schoolAndBelt";
type StickerStatus = "all" | "not_printed" | "printed";

// --- Subcomponents for UI ---

const Badge = ({ children, color }: { children: React.ReactNode, color: string }) => {
  const colorClasses: Record<string, string> = {
    green: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200/50 dark:border-green-500/20",
    red: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/50 dark:border-red-500/20",
    orange: "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200/50 dark:border-orange-500/20",
    zinc: "bg-zinc-50 dark:bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-200/50 dark:border-zinc-500/20",
    blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/20",
  };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium text-xs border ${colorClasses[color] || colorClasses.zinc}`}>
      {children}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string | number, icon: any, color: string }) => {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-current" />
      </div>
      <div>
        <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</div>
        <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</div>
      </div>
    </div>
  );
};

// Custom Hook for Debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function StickerPrinting() {
  const { currentProgram } = useProgram();
  const { showToast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<PrintMode>("individual");
  const [loading, setLoading] = useState(false);

  // Data states
  const [schools, setSchools] = useState<School[]>([]);
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [availableBelts, setAvailableBelts] = useState<string[]>([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  // Immediate search support: we sync the instant query to another state when enter is pressed
  const [forcedQuery, setForcedQuery] = useState("");
  const debouncedSearchQueryRaw = useDebounce(searchQuery, 300);
  const debouncedSearchQuery = forcedQuery || debouncedSearchQueryRaw;
  
  // Clear forced query if we type
  useEffect(() => {
    setForcedQuery("");
  }, [searchQuery]);
  
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedBelt, setSelectedBelt] = useState("");
  const [stickerStatusFilter, setStickerStatusFilter] = useState<StickerStatus>("all");

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

  // Print workflow states
  const [isPrintConfirmOpen, setIsPrintConfirmOpen] = useState(false);
  const [isPrintProgressOpen, setIsPrintProgressOpen] = useState(false);
  const [printProgress, setPrintProgress] = useState({ current: 0, total: 0 });
  const [showPreviewPref, setShowPreviewPref] = useState(true);
  
  // Final print list (used by hidden preview)
  const [studentsToPrint, setStudentsToPrint] = useState<StickerStudent[]>([]);

  // Init
  useEffect(() => {
    const pref = localStorage.getItem("shadow_kai_sticker_preview_pref");
    if (pref !== null) {
      setShowPreviewPref(pref === "true");
    }
    fetchInitialData();
  }, [currentProgram]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const prog = currentProgram === 'ALL' ? undefined : currentProgram as any;
      const [schoolsData, studentsData] = await Promise.all([
        firebaseSchoolService.getAll(prog),
        firebaseStudentService.getAll(prog)
      ]);
      
      setSchools(schoolsData);
      setAllStudents(studentsData);
      
      const predefinedBelts = currentProgram === 'SELAMBAM'
        ? Array.from({ length: 8 }, (_, i) => `Stage ${i + 1}`)
        : currentProgram === 'KARATE'
          ? ['White', 'Yellow', 'Orange', 'Blue', 'Green', 'II Brown', 'I Brown', 'Black Belt']
          : ['White', 'Yellow', 'Orange', 'Blue', 'Green', 'II Brown', 'I Brown', 'Black Belt', ...Array.from({ length: 8 }, (_, i) => `Stage ${i + 1}`)];
      
      setAvailableBelts(predefinedBelts);

      // Reset filters
      setSearchQuery("");
      setForcedQuery("");
      setSelectedSchoolId("");
      setSelectedBelt("");
      setStickerStatusFilter("all");
      setSelectedStudentIds(new Set());
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("Error loading data", "error");
    } finally {
      setLoading(false);
    }
  };

  // Immediate search trigger when hitting enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setForcedQuery(searchQuery);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setForcedQuery("");
    setSelectedSchoolId("");
    setSelectedBelt("");
    setStickerStatusFilter("all");
    setSelectedStudentIds(new Set());
  };

  // Memoized filtered students
  const filteredStudents = useMemo(() => {
    return allStudents.filter(s => {
      // 1. School / Belt Filtering — the selectors are shown in both tabs, so the
      // filter must apply regardless of which mode is active.
      if (selectedSchoolId && s.schoolId !== selectedSchoolId) return false;
      if (selectedBelt) {
        const belt = s.beltLevel || s.stageLevel?.toString();
        if (belt !== selectedBelt) return false;
      }

      // 2. Text Search Filtering (for Individual mode primarily, but applies to both if needed)
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const matchesName = (s.name || '').toLowerCase().includes(query);
        const matchesId = (s.id || '').toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }

      // 3. Status Filtering
      if (stickerStatusFilter === "printed" && !s.stickerPrinted) return false;
      if (stickerStatusFilter === "not_printed" && s.stickerPrinted) return false;

      return true;
    });
  }, [allStudents, mode, selectedSchoolId, selectedBelt, debouncedSearchQuery, stickerStatusFilter]);

  // For individual mode, limit results if no query is present to avoid lagging
  const displayedStudents = useMemo(() => {
    if (mode === "individual" && !debouncedSearchQuery && !selectedSchoolId && !selectedBelt) {
      return filteredStudents.slice(0, 50); // Show max 50 until specific filter applied
    }
    return filteredStudents;
  }, [filteredStudents, mode, debouncedSearchQuery, selectedSchoolId, selectedBelt]);

  // Statistics
  const stats = useMemo(() => {
    const ready = displayedStudents.filter(s => !s.stickerPrinted).length;
    const printed = displayedStudents.filter(s => s.stickerPrinted).length;
    return {
      total: displayedStudents.length,
      ready,
      printed,
      selected: selectedStudentIds.size
    };
  }, [displayedStudents, selectedStudentIds]);

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedStudentIds.size === displayedStudents.length && displayedStudents.length > 0) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(displayedStudents.map(s => s.id)));
    }
  };

  const toggleStudentSelection = (id: string) => {
    const newSelection = new Set(selectedStudentIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedStudentIds(newSelection);
  };

  // Status Toggle
  const togglePrintStatus = async (studentId: string, currentStatus: boolean | undefined) => {
    try {
      const adminId = auth.currentUser?.uid || "unknown";
      const newStatus = !currentStatus;
      await firebaseStudentService.update(studentId, {
        stickerPrinted: newStatus,
        stickerPrintedAt: newStatus ? new Date().toISOString() : null,
        stickerPrintedBy: newStatus ? adminId : undefined
      });
      showToast(newStatus ? "Marked as Printed" : "Marked as Not Printed", "success");
      
      const printTime = new Date().toISOString();
      setAllStudents(prev => prev.map(s => s.id === studentId ? { 
        ...s, 
        stickerPrinted: newStatus, 
        stickerPrintedBy: newStatus ? adminId : undefined, 
        stickerPrintedAt: newStatus ? printTime : undefined 
      } : s));
    } catch (error) {
      console.error("Error toggling print status:", error);
      showToast("Failed to update status", "error");
    }
  };

  // Bulk Status Mark
  const markSelectedAsPrinted = async (status: boolean) => {
    if (selectedStudentIds.size === 0) return;
    
    setLoading(true);
    try {
      const adminId = auth.currentUser?.uid || "unknown";
      const printTime = new Date().toISOString();
      
      const promises = Array.from(selectedStudentIds).map(id => 
        firebaseStudentService.update(id, {
          stickerPrinted: status,
          stickerPrintedAt: status ? printTime : null,
          stickerPrintedBy: status ? adminId : undefined
        })
      );
      
      await Promise.all(promises);
      
      setAllStudents(prev => prev.map(s => {
        if (selectedStudentIds.has(s.id)) {
          return {
            ...s,
            stickerPrinted: status,
            stickerPrintedAt: status ? printTime : undefined,
            stickerPrintedBy: status ? adminId : undefined
          };
        }
        return s;
      }));
      
      showToast(`Marked ${selectedStudentIds.size} students as ${status ? 'Printed' : 'Not Printed'}`, "success");
      setSelectedStudentIds(new Set()); // Clear selection
    } catch (error) {
      console.error("Error bulk updating print status:", error);
      showToast("Failed to update print status in database", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Printing Workflow ---
  
  const initiatePrintSelected = () => {
    if (selectedStudentIds.size === 0) return;
    
    const selectedRecords = allStudents.filter(s => selectedStudentIds.has(s.id));
    setStudentsToPrint(selectedRecords.map(s => ({
      id: s.id,
      name: s.name,
      belt: s.beltLevel || s.stageLevel?.toString() || "Belt Test",
      school: s.school || schools.find(sch => sch.id === s.schoolId)?.name || "Unknown School",
      stickerPrinted: s.stickerPrinted
    })));
    
    setIsPrintConfirmOpen(true);
  };
  
  const initiatePrintSingle = (s: StudentRecord) => {
    setStudentsToPrint([{
      id: s.id,
      name: s.name,
      belt: s.beltLevel || s.stageLevel?.toString() || "Belt Test",
      school: s.school || schools.find(sch => sch.id === s.schoolId)?.name || "Unknown School",
      stickerPrinted: s.stickerPrinted
    }]);
    
    setIsPrintConfirmOpen(true);
  };

  const handleConfirmedPrint = async () => {
    setIsPrintConfirmOpen(false);
    
    // Save preference
    localStorage.setItem("shadow_kai_sticker_preview_pref", showPreviewPref.toString());

    if (!showPreviewPref) {
      // Print immediately
      executeNativePrint();
      return;
    }

    // Generate progress
    setIsPrintProgressOpen(true);
    setPrintProgress({ current: 0, total: studentsToPrint.length });
    
    // Simulate generation progress smoothly
    for (let i = 1; i <= studentsToPrint.length; i++) {
      await new Promise(resolve => setTimeout(resolve, Math.min(50, 2000 / studentsToPrint.length)));
      setPrintProgress({ current: i, total: studentsToPrint.length });
    }
    
    setTimeout(() => {
      setIsPrintProgressOpen(false);
      executeNativePrint();
    }, 500);
  };

  const executeNativePrint = async () => {
    window.print();
    
    // After print dialog, update students status
    try {
      const adminId = auth.currentUser?.uid || "unknown";
      const printTime = new Date().toISOString();
      
      const promises = studentsToPrint.map(s => 
        firebaseStudentService.update(s.id, {
          stickerPrinted: true,
          stickerPrintedAt: printTime,
          stickerPrintedBy: adminId
        })
      );
      
      await Promise.all(promises);
      showToast("Sticker print status updated successfully", "success");
      
      setAllStudents(prev => prev.map(s => {
        if (studentsToPrint.some(sp => sp.id === s.id)) {
          return { ...s, stickerPrinted: true, stickerPrintedBy: adminId, stickerPrintedAt: printTime };
        }
        return s;
      }));
      
      // Clear selection if we bulk printed
      if (studentsToPrint.length > 1) {
        setSelectedStudentIds(new Set());
      }
    } catch (error) {
      console.error("Error updating print status:", error);
      showToast("Failed to update print status in database", "error");
    }
  };


  return (
    <AdminLayout>
      <div className="print:hidden p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 pb-32">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Sticker Printing</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Generate and print 6 × 6 cm student belt-test stickers.</p>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl max-w-md shadow-sm border border-zinc-200 dark:border-zinc-800">
          <button 
            onClick={() => { setMode("individual"); clearFilters(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${mode === "individual" ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-500 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
          >
            <User className="w-4 h-4" /> Individual
          </button>
          <button 
            onClick={() => { setMode("schoolAndBelt"); clearFilters(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all ${mode === "schoolAndBelt" ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-500 shadow-sm" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}
          >
            <Building className="w-4 h-4" /> By School & Belt
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={stats.total} icon={User} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard label="Ready to Print" value={stats.ready} icon={Printer} color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard label="Already Printed" value={stats.printed} icon={CheckCircle2} color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          <StatCard label="Selected" value={stats.selected} icon={CheckSquare} color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
        </div>

        {/* Compact Filters Row */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by ID or Name..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white text-sm"
              />
            </div>
            
            {(mode === "schoolAndBelt" || mode === "individual") && (
              <>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white text-sm w-[200px]"
                >
                  <option value="">All Schools</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>

                <select
                  value={selectedBelt}
                  onChange={(e) => setSelectedBelt(e.target.value)}
                  className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white text-sm w-[160px]"
                >
                  <option value="">All Belts</option>
                  {availableBelts.map(belt => <option key={belt} value={belt}>{belt}</option>)}
                </select>
              </>
            )}

            <select
              value={stickerStatusFilter}
              onChange={(e) => setStickerStatusFilter(e.target.value as StickerStatus)}
              className="px-4 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white text-sm w-[160px]"
            >
              <option value="all">All Statuses</option>
              <option value="not_printed">Ready to Print</option>
              <option value="printed">Already Printed</option>
            </select>

            <button 
              onClick={clearFilters}
              className="px-4 py-2 flex items-center gap-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-sm font-medium"
            >
              <X className="w-4 h-4" /> Clear
            </button>
          </div>

          {/* Active Filter Chips */}
          {(debouncedSearchQuery || selectedSchoolId || selectedBelt || stickerStatusFilter !== "all") && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/50">
              {debouncedSearchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium">
                  Search: {debouncedSearchQuery}
                  <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => { setSearchQuery(""); setForcedQuery(""); }} />
                </span>
              )}
              {selectedSchoolId && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium">
                  School: {schools.find(s => s.id === selectedSchoolId)?.name}
                  <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedSchoolId("")} />
                </span>
              )}
              {selectedBelt && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium">
                  Belt: {selectedBelt}
                  <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedBelt("")} />
                </span>
              )}
              {stickerStatusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-medium">
                  Status: {stickerStatusFilter === "printed" ? "Already Printed" : "Ready to Print"}
                  <X className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => setStickerStatusFilter("all")} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm relative">
          
          {displayedStudents.length > 0 ? (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-sm relative">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">
                      <button onClick={toggleSelectAll} className="text-zinc-500 hover:text-blue-500 transition-colors focus:outline-none">
                        {displayedStudents.length > 0 && selectedStudentIds.size === displayedStudents.length ? (
                          <CheckSquare className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Student Details</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Current Belt</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Applying Belt</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Print Status</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300">Result</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700 dark:text-zinc-300 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                  {displayedStudents.map((s) => (
                    <tr key={s.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${selectedStudentIds.has(s.id) ? 'bg-blue-50/30 dark:bg-blue-500/5' : ''}`}>
                      <td className="px-4 py-4 text-center align-top">
                        <button onClick={() => toggleStudentSelection(s.id)} className="text-zinc-400 hover:text-blue-500 transition-colors focus:outline-none">
                          {selectedStudentIds.has(s.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-500" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-zinc-400" />
                            {s.name}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono mt-0.5">{s.id}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {s.school || schools.find(sch => sch.id === s.schoolId)?.name || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top pt-5 text-zinc-500 dark:text-zinc-400 font-medium text-xs">—</td>
                      <td className="px-4 py-4 align-top pt-5">
                        <Badge color="orange">{s.beltLevel || s.stageLevel || "Belt Test"}</Badge>
                      </td>
                      <td className="px-4 py-4 align-top pt-5">
                        <div className="flex flex-col gap-1 items-start">
                          <button 
                            onClick={() => togglePrintStatus(s.id, s.stickerPrinted)}
                            className="focus:outline-none hover:scale-105 transition-transform"
                            title="Click to toggle status manually"
                          >
                            {s.stickerPrinted ? (
                              <Badge color="green"><CheckCircle2 className="w-3 h-3" /> Printed</Badge>
                            ) : (
                              <Badge color="zinc"><Clock className="w-3 h-3" /> Ready</Badge>
                            )}
                          </button>
                          
                          {s.stickerPrinted && s.stickerPrintedAt && (
                            <span className="text-[10px] text-zinc-400">
                              {new Date(s.stickerPrintedAt).toLocaleDateString()} {new Date(s.stickerPrintedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top pt-5">
                        {s.testStatus === 'passed' ? <Badge color="green">PASS</Badge> :
                         s.testStatus === 'failed' ? <Badge color="red">FAIL</Badge> :
                         <Badge color="orange">PENDING</Badge>}
                      </td>
                      <td className="px-4 py-4 align-top pt-4 text-right">
                        <button
                          onClick={() => initiatePrintSingle(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-blue-100 text-zinc-700 hover:text-blue-700 dark:bg-zinc-800 dark:hover:bg-blue-500/20 dark:text-zinc-300 dark:hover:text-blue-400 rounded-lg font-semibold text-xs transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {s.stickerPrinted ? "Print Again" : "Print"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center px-4">
              <div className="w-24 h-24 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">No Students Found</h3>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-sm">
                Choose a school or search for a student to generate stickers.
              </p>
            </div>
          )}
        </div>

        {/* Printing Tips Section */}
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 flex gap-4 items-start">
          <AlertCircle className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-blue-900 dark:text-blue-400 mb-2">Printing Tips</h4>
            <ul className="list-disc list-inside text-sm text-blue-800/80 dark:text-blue-300/80 space-y-1.5">
              <li>Use <strong>Actual Size (100%)</strong> scale in the print dialog.</li>
              <li>Disable <strong>Fit to Page</strong>.</li>
              <li>Set <strong>Margins</strong> to <strong>None</strong>.</li>
              <li>Disable <strong>Headers & Footers</strong> so URLs and dates don't print.</li>
              <li>Print on <strong>6 × 6 cm (60 × 60 mm)</strong> sticker sheets.</li>
              <li>Preview once before printing a new sticker sheet.</li>
            </ul>
          </div>
        </div>

        {/* Floating Action Bar */}
        {selectedStudentIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-800 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-40 border border-zinc-700 animate-fade-in-up">
            <div className="font-bold whitespace-nowrap">
              <span className="text-blue-500">{selectedStudentIds.size}</span> Selected
            </div>
            
            <div className="w-px h-6 bg-zinc-700"></div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={initiatePrintSelected}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-colors"
              >
                <Printer className="w-4 h-4" /> Print Selected
              </button>
              
              <button 
                onClick={() => markSelectedAsPrinted(true)}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl font-medium transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-green-400" /> Mark Printed
              </button>
              
              <button 
                onClick={() => setSelectedStudentIds(new Set())}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl font-medium transition-colors text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" /> Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Print Confirmation Dialog */}
        {isPrintConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Print Stickers</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Review your print job details before continuing.</p>
              
              <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium text-sm">School</span>
                  <span className="text-zinc-900 dark:text-white font-bold">{studentsToPrint.length === 1 ? studentsToPrint[0].school : (selectedSchoolId ? schools.find(s => s.id === selectedSchoolId)?.name : "Multiple Schools")}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium text-sm">Belt</span>
                  <span className="text-zinc-900 dark:text-white font-bold">{studentsToPrint.length === 1 ? studentsToPrint[0].belt : (selectedBelt || "Multiple Belts")}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium text-sm">Students</span>
                  <span className="text-zinc-900 dark:text-white font-bold">{studentsToPrint.length}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500 font-medium text-sm">Sticker Size</span>
                  <span className="text-blue-600 dark:text-blue-500 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">6 × 6 cm</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-medium text-sm">Estimated Pages</span>
                  <span className="text-zinc-900 dark:text-white font-bold">{Math.ceil(studentsToPrint.length / 12)}</span>
                </div>
              </div>

              {/* Preference Checkbox */}
              <label className="flex items-center gap-3 mb-8 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showPreviewPref ? 'bg-blue-500 border-blue-500 text-zinc-950' : 'border-zinc-300 dark:border-zinc-700 text-transparent group-hover:border-blue-500'}`}>
                  <Check className="w-3 h-3" />
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={showPreviewPref}
                  onChange={(e) => setShowPreviewPref(e.target.checked)}
                />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Show progress preview before printing</span>
              </label>

              <div className="flex gap-3">
                <button 
                  onClick={() => setIsPrintConfirmOpen(false)}
                  className="flex-1 py-3 px-4 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmedPrint}
                  className="flex-1 py-3 px-4 bg-blue-500 hover:bg-blue-600 text-zinc-950 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" /> Print Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Print Progress Dialog */}
        {isPrintProgressOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white dark:bg-zinc-950 animate-fade-in">
            <div className="max-w-md w-full text-center space-y-8">
              <div className="relative w-24 h-24 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
              
              <div>
                <h3 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Generating Stickers...</h3>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">Please wait while we format {studentsToPrint.length} stickers for printing.</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm font-bold text-zinc-700 dark:text-zinc-300 px-1">
                  <span>Progress</span>
                  <span className="text-blue-500">{printProgress.current} / {printProgress.total}</span>
                </div>
                <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-150 ease-out"
                    style={{ width: `${(printProgress.current / (printProgress.total || 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* Hidden Print Container */}
      <StickerPreview students={studentsToPrint} printRef={printRef} />
    </AdminLayout>
  );
}
