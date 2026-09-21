import { useState, useMemo } from 'react';
import { Send } from 'lucide-react';
import { athleticCriteria, technicalCriteria } from '../../data';
import { Student } from '../../types';
import { useDialog } from '../../contexts/DialogContext';

interface RefereePageProps {
 student: Partial<Student>;
}

export default function RefereePage({ student }: RefereePageProps) {
 const { showAlert } = useDialog();
 const initials = (student.name || 'AK')
 .split(' ')
 .map((n) => n[0])
 .join('')
 .toUpperCase()
 .slice(0, 2);

 const [scores, setScores] = useState<Record<string, number>>(() => {
 const initial: Record<string, number> = {};
 [...athleticCriteria, ...technicalCriteria].forEach((c) => {
 initial[c.k] = c.v;
 });
 return initial;
 });

 const totalScore = useMemo(() => {
 return Object.values(scores).reduce((sum, score) => sum + score, 0);
 }, [scores]);

 const adjustScore = (key: string, delta: number) => {
 setScores((prev) => ({
 ...prev,
 [key]: Math.max(0, Math.min(10, prev[key] + delta)),
 }));
 };

 return (
 <div>
 {/* Hero Section */}
 <div style={{ background: 'var(--red)', padding: '36px 28px 32px' }}>
 <div className="max-w-[960px] mx-auto">
 <h1
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: 'clamp(24px,4.5vw,54px)',
 letterSpacing: '3px',
 color: '#fff',
 lineHeight: 1,
 }}
 >
 REFEREE
 <br />
 <span style={{ color: 'rgba(0,0,0,.2)' }}>SCORING</span>
 </h1>
 <p className="text-[10.5px] font-bold mt-2.5" style={{ color: 'rgba(255,255,255,.8)' }}>
 நடுவர் மதிப்பீடு — Tap + or − to award scores
 </p>

 {/* Student Tag */}
 <div
 className="inline-flex items-center gap-2.5 px-4 pr-[18px] py-2 rounded-full mt-[18px]"
 style={{ background: 'rgba(0,0,0,.2)' }}
 >
 <div
 className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
 style={{
 background: 'var(--yellow)',
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '13px',
 color: '#000',
 }}
 >
 {initials}
 </div>
 <span className="text-[10.5px] font-bold text-white">
 {student.name || 'Aravind Kumar'} &nbsp;·&nbsp; White → Yellow Belt
 </span>
 </div>
 </div>
 </div>

 {/* Scoring Content */}
 <div className="max-w-[960px] mx-auto px-7 py-8 pb-[60px]">
 {/* Athletic Score */}
 <ScoreBlock
 title="Athletic Score"
 titleTamil="தடகள மதிப்பெண்"
 color="var(--red)"
 criteria={athleticCriteria}
 scores={scores}
 onAdjust={adjustScore}
 />

 {/* Technical Score */}
 <ScoreBlock
 title="Technical Score"
 titleTamil="தொழில்நுட்ப மதிப்பெண்"
 color="var(--blue)"
 criteria={technicalCriteria}
 scores={scores}
 onAdjust={adjustScore}
 />

 {/* Total Score */}
 <div
 className="rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-3 mb-4 mt-1"
 style={{ background: 'var(--ink)' }}
 >
 <div>
 <div className="text-[10.5px] font-extrabold" style={{ color: '#888' }}>
 Total Score
 </div>
 <div className="text-xs font-bold" style={{ color: '#666' }}>
 மொத்த மதிப்பெண்
 </div>
 </div>
 <div
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '52px',
 letterSpacing: '2px',
 color: 'var(--yellow)',
 lineHeight: 1,
 }}
 >
 {totalScore}
 <span className="text-[13.5px]" style={{ color: '#555' }}>
 /100
 </span>
 </div>
 </div>

 {/* Submit Button */}
 <button
 onClick={async () => {
 await showAlert({
 title: "Score Submitted",
 message: `Score submitted: ${totalScore}/100`,
 variant: "success",
 });
 }}
 className="w-full px-6 py-[18px] border-none rounded-2xl text-white cursor-pointer flex items-center justify-center gap-3 transition-all duration-200 hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(0,0,0,.2)] active:translate-y-0"
 style={{
 background: 'var(--red)',
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '22px',
 letterSpacing: '2.5px',
 }}
 >
 <Send size={22} />
 SUBMIT SCORE &nbsp;·&nbsp; மதிப்பெண் சமர்பிக்கவும்
 </button>
 </div>
 </div>
 );
}

function ScoreBlock({
 title,
 titleTamil,
 color,
 criteria,
 scores,
 onAdjust,
}: {
 title: string;
 titleTamil: string;
 color: string;
 criteria: typeof athleticCriteria;
 scores: Record<string, number>;
 onAdjust: (key: string, delta: number) => void;
}) {
 return (
 <div className="mb-6">
 <div className="flex items-center gap-2.5 mb-3">
 <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
 <div>
 <div
 className="text-[13.5px] tracking-[1.5px]"
 style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--ink)' }}
 >
 {title}
 </div>
 <div className="text-[8.25px]" style={{ color: 'var(--muted-color)' }}>
 {titleTamil}
 </div>
 </div>
 </div>

 <div className="bg-white dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 dark:bg-zinc-950 border-2 rounded-2xl overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
 {criteria.map((item, i) => (
 <div
 key={item.k}
 className={`flex items-center gap-3.5 px-4 py-3.5 transition-all ${
 i < criteria.length - 1 ? 'border-b-[1.5px]' : ''
 } hover:bg-[--off]`}
 style={{ borderColor: 'var(--off)' }}
 >
 <div
 className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
 style={{ background: item.bg }}
 >
 <svg viewBox="0 0 24 24" fill="none" stroke={item.ic} strokeWidth={2} width={19} height={19}>
 <g dangerouslySetInnerHTML={{ __html: item.icon }} />
 </svg>
 </div>

 <div className="flex-1">
 <div className="text-[11.25px] font-extrabold" style={{ color: 'var(--ink)' }}>
 {item.e}
 </div>
 <div className="text-[8.25px] font-semibold" style={{ color: 'var(--muted-color)' }}>
 {item.t}
 </div>
 </div>

 <div className="flex items-center gap-2.5">
 <button
 onClick={() => onAdjust(item.k, -1)}
 className="w-[42px] h-[42px] rounded-full border-[2.5px] flex items-center justify-center text-sm font-light cursor-pointer transition-all duration-[.12s] flex-shrink-0 hover:scale-110 active:scale-95"
 style={{
 borderColor: 'var(--border-color)',
 background: 'var(--off)',
 color: 'var(--ink)',
 fontFamily: "'Nunito', sans-serif",
 lineHeight: 1,
 }}
 >
 −
 </button>

 <div
 className="min-w-[34px] text-center"
 style={{
 fontFamily: "'Bebas Neue', sans-serif",
 fontSize: '28px',
 letterSpacing: '1px',
 color: 'var(--ink)',
 }}
 >
 {scores[item.k]}
 </div>

 <button
 onClick={() => onAdjust(item.k, 1)}
 className="w-[42px] h-[42px] rounded-full border-[2.5px] flex items-center justify-center text-sm font-light cursor-pointer transition-all duration-[.12s] flex-shrink-0 hover:scale-110 active:scale-95"
 style={{
 borderColor: 'var(--border-color)',
 background: 'var(--off)',
 color: 'var(--ink)',
 fontFamily: "'Nunito', sans-serif",
 lineHeight: 1,
 }}
 >
 +
 </button>

 <div className="text-xs font-bold" style={{ color: '#bbb' }}>
 /10
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
}
