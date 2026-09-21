import { Award, Trophy, ChevronRight } from 'lucide-react';
import { useProgram } from '../../contexts/ProgramContext';

export default function ProgramSwitcher() {
 const { currentProgram, switchProgram } = useProgram();

 const isKarate = currentProgram === 'KARATE';
 const switchToProgram = isKarate ? 'silambam' : 'karate';

 return (
 <div className="mx-2 mb-1">
 {/* Current program label */}
 <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 uppercase tracking-widest mb-2 px-2">
 Active Program
 </p>

 {/* Active indicator */}
 <div
 className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-2 ${
 isKarate
 ? 'bg-blue-500/15 border border-blue-500/30'
 : 'bg-emerald-500/15 border border-emerald-500/30'
 }`}
 >
 <div
 className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
 isKarate ? 'bg-blue-500/20' : 'bg-emerald-500/20'
 }`}
 >
 {isKarate
 ? <Award className="w-4 h-4 text-blue-400" />
 : <Trophy className="w-4 h-4 text-emerald-400" />}
 </div>
 <div className="flex-1 min-w-0">
 <p className={`text-sm font-bold ${isKarate ? 'text-blue-400' : 'text-emerald-400'}`}>
 {isKarate ? 'Karate' : 'Silambam'}
 </p>
 <p className="text-[10px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 dark:text-zinc-400 font-medium">Currently managing</p>
 </div>
 <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isKarate ? 'bg-blue-400' : 'bg-emerald-400'} animate-pulse`} />
 </div>

 {/* Switch button */}
 <button
 onClick={() => switchProgram(switchToProgram)}
 className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:hover:bg-zinc-200 border border-zinc-800 hover:border-zinc-700 transition-all duration-200 active:scale-95 group"
 >
 <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-zinc-800 group-hover:bg-zinc-700 transition-colors`}>
 {isKarate
 ? <Trophy className="w-3.5 h-3.5 text-emerald-400" />
 : <Award className="w-3.5 h-3.5 text-blue-400" />}
 </div>
 <span className="text-xs font-semibold flex-1 text-left">
 Switch to {isKarate ? 'Silambam' : 'Karate'}
 </span>
 <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70 transition-opacity" />
 </button>
 </div>
 );
}
