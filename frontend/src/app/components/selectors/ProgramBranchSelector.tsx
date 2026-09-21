import { ChevronDown, Layers, GitBranch } from "lucide-react";
import { useProgramContext } from "../../contexts/ProgramContext";
import { Program, Branch } from "../../types/program";

/**
 * Global Program + Branch selector that lives in the Admin navbar.
 * Compact on mobile, expanded on desktop.
 */
export default function ProgramBranchSelector() {
 const {
 programs,
 filteredBranches,
 selectedProgram,
 selectedBranch,
 setSelectedProgram,
 setSelectedBranch,
 loading,
 } = useProgramContext();

 if (loading) {
 return (
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950/10 animate-pulse">
 <div className="w-16 h-4 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950/20 rounded" />
 <div className="w-16 h-4 bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950/20 rounded" />
 </div>
 );
 }

 return (
 <div className="flex items-center gap-2 flex-wrap">
 {/* ── Program Selector ──────────────────────────────────────────────── */}
 <div className="relative group">
 <button
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 dark:bg-zinc-100 dark:bg-zinc-950 dark:bg-zinc-100 dark:bg-zinc-950 dark:bg-zinc-100 dark:bg-zinc-950/10 hover:bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950/20 transition-colors text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 border border-white/20"
 title="Select Program"
 >
 <Layers className="w-3.5 h-3.5 flex-shrink-0" />
 <span className="text-xs font-semibold whitespace-nowrap max-w-[100px] truncate">
 {selectedProgram?.shortName ?? "Program"}
 </span>
 <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
 </button>
 {/* Dropdown */}
 <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 overflow-hidden hidden group-hover:block">
 {programs.map((prog) => (
 <ProgramOption
 key={prog.id}
 program={prog}
 isSelected={selectedProgram?.id === prog.id}
 onSelect={() => setSelectedProgram(prog)}
 />
 ))}
 {programs.length === 0 && (
 <div className="px-4 py-3 text-xs text-gray-400">No programs found</div>
 )}
 </div>
 </div>

 {/* Separator */}
 <span className="text-white/30 text-xs">/</span>

 {/* ── Branch Selector ────────────────────────────────────────────────── */}
 <div className="relative group">
 <button
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-950 dark:bg-zinc-100 dark:bg-zinc-950 dark:bg-zinc-100 dark:bg-zinc-950 dark:bg-zinc-100 dark:bg-zinc-950/10 hover:bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950/20 transition-colors text-white dark:text-zinc-900 dark:text-zinc-900 dark:text-zinc-900 border border-white/20"
 title="Select Branch"
 >
 <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
 <span className="text-xs font-semibold whitespace-nowrap max-w-[120px] truncate">
 {selectedBranch?.name ?? "All Branches"}
 </span>
 <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
 </button>
 {/* Dropdown */}
 <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 dark:border-zinc-800 overflow-hidden hidden group-hover:block">
 {filteredBranches.map((branch) => (
 <BranchOption
 key={branch.id}
 branch={branch}
 isSelected={selectedBranch?.id === branch.id}
 onSelect={() => setSelectedBranch(branch)}
 />
 ))}
 {filteredBranches.length === 0 && (
 <div className="px-4 py-3 text-xs text-gray-400">
 No branches for this program
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
function ProgramOption({
 program,
 isSelected,
 onSelect,
}: {
 program: Program;
 isSelected: boolean;
 onSelect: () => void;
}) {
 return (
 <button
 onClick={onSelect}
 className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-sm ${
 isSelected
 ? "bg-blue-50 text-blue-700 font-semibold"
 : "text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900"
 }`}
 >
 <span className="text-base">{program.icon}</span>
 <div className="min-w-0">
 <div className="font-semibold truncate">{program.shortName}</div>
 <div className="text-xs text-gray-400 truncate">{program.name}</div>
 </div>
 {isSelected && (
 <div
 className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
 style={{ background: program.color }}
 />
 )}
 </button>
 );
}

function BranchOption({
 branch,
 isSelected,
 onSelect,
}: {
 branch: Branch;
 isSelected: boolean;
 onSelect: () => void;
}) {
 return (
 <button
 onClick={onSelect}
 className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors text-sm ${
 isSelected
 ? "bg-blue-50 text-blue-700 font-semibold"
 : "text-gray-700 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:bg-zinc-900 dark:bg-zinc-900"
 }`}
 >
 <GitBranch className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
 <span className="truncate">{branch.name}</span>
 {isSelected && (
 <div className="ml-auto w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
 )}
 </button>
 );
}
