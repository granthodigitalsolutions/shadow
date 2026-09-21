import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Calendar, Clock, MapPin, Home, 
  User, Building, BookOpen, Phone, MessageCircle, ArrowRight 
} from 'lucide-react';
import { Student } from '../../types';
import { BeltTest } from '../../types/admin';
import badgeLogo from '../../../assets/shadow-kai-logo.png';

export interface HallTicketCardProps {
  student: Student;
  beltTest: BeltTest | null;
  belt: { from: string; to: string; fc: string; fb: string | null };
  isSilambam: boolean;
  mascotSrc: string;
  accentColor: string;
}

const FALLBACK_EVENT = {
  name: 'Shadow Kai — Belt Test',
  date: 'TBD',
  time: 'TBD',
  venue: 'TBD',
};

export const HallTicketCard = forwardRef<HTMLDivElement, HallTicketCardProps>(
  ({ student, beltTest, belt, isSilambam }, ref) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const width = entry.contentRect.width;
          setScale(width / 800);
        }
      });
      observer.observe(wrapper);
      return () => observer.disconnect();
    }, []);
    
    const qrValue = JSON.stringify({
      id: student.id,
      name: student.name,
      belt: isSilambam ? `Stage ${student.stageLevel || 1}` : `${belt.from} → ${belt.to}`,
      school: student.school,
    });

    const studentInitials = student.name ? student.name.charAt(0).toUpperCase() : 'S';

    // Helpers to get pill colors based on belt
    const getBeltColor = (beltName: string) => {
      if (!beltName) return '#e5e7eb';
      const b = beltName.toUpperCase();
      if (b.includes('WHITE')) return '#f8fafc';
      if (b.includes('YELLOW')) return '#facc15';
      if (b.includes('ORANGE')) return '#f97316';
      if (b.includes('GREEN')) return '#22c55e';
      if (b.includes('BLUE')) return '#3b82f6';
      if (b.includes('PURPLE')) return '#a855f7';
      if (b.includes('BROWN')) return '#78350f';
      if (b.includes('RED')) return '#ef4444';
      if (b.includes('BLACK')) return '#111827';
      return '#e5e7eb';
    };

    const fromColor = isSilambam ? '#22c55e' : getBeltColor(belt.from);
    const toColor = isSilambam ? '#3b82f6' : getBeltColor(belt.to);

    return (
      <div ref={wrapperRef} style={{ position: 'relative', overflow: 'hidden', width: '100%', aspectRatio: '800/1131', margin: '0 auto', maxWidth: '800px' }}>
        <div
          id={`receipt-print-area-${student.id}`}
          ref={ref}
          className="bg-[#ffffff] overflow-hidden flex flex-col"
          style={{
            position: 'absolute', top: 0, left: 0,
            boxShadow: '0 24px 80px rgba(0,0,0,.12)',
            border: '1.5px solid #e8e4de',
            width: '800px', height: '1131px', 
            transform: `scale(${scale})`, transformOrigin: 'top left',
            boxSizing: 'border-box', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', pageBreakInside: 'avoid', breakInside: 'avoid'
          }}
        >
          {/* Top Rainbow Strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500" />
          
          {/* Header */}
          <div className="bg-[#111827] px-10 py-6 flex items-center gap-6 border-b-4 border-amber-600">
            <img src={badgeLogo} alt="Logo" className="w-[72px] h-[72px] rounded-full object-cover border-[3px] border-red-600 bg-red-600" />
            <div>
              <h1 className="font-bebas text-4xl tracking-wider text-white leading-none m-0 mb-1.5">TEAM SHADOW KAI</h1>
              <p className="text-[12px] font-semibold text-gray-400 tracking-wide m-0">
                Tamil Nadu Karate Association · தமிழ்நாடு கராத்தே சங்கம்
              </p>
            </div>
          </div>

          {/* Main Body */}
          <div className="relative p-10 flex-1 box-border flex flex-col justify-between" style={{ minHeight: 'calc(1131px - 120px)' }}>
            
            {/* Background Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] opacity-[0.04] pointer-events-none z-0">
              <img src={badgeLogo} alt="" className="w-full h-auto object-contain filter grayscale" />
            </div>

            <div className="relative z-10 space-y-10">
              
              {/* Event Information Section */}
              <div className="space-y-4 mt-2">
                <SectionHeader title="EVENT INFORMATION" dotColor="#3b82f6" />
                
                <div className="grid grid-cols-3 gap-4">
                  <InfoBox icon={Calendar} label="DATE" value={beltTest?.date || FALLBACK_EVENT.date} bg="bg-[#eff6ff]" iconColor="text-blue-600" />
                  <InfoBox icon={Clock} label="REPORTING TIME" value={beltTest?.time || FALLBACK_EVENT.time} bg="bg-[#fff7ed]" iconColor="text-orange-600" />
                  <InfoBox icon={MapPin} label="VENUE" value={beltTest?.venue || FALLBACK_EVENT.venue} bg="bg-[#fef2f2]" iconColor="text-red-600" />
                </div>
                <InfoBox 
                  icon={Home} 
                  label="FULL ADDRESS" 
                  value={beltTest?.locationAddress || FALLBACK_EVENT.venue} 
                  bg="bg-[#f0fdf4]" 
                  iconColor="text-green-600" 
                  fullWidth 
                />
              </div>

              {/* Divider line */}
              <hr className="border-gray-100/80 my-2" />

              {/* Student Identity */}
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-5">
                  <div className="w-[72px] h-[72px] rounded-2xl bg-[#ffedd5] flex items-center justify-center text-orange-500 font-bebas text-4xl shadow-sm border border-orange-100">
                    {studentInitials}
                  </div>
                  <div>
                    <h2 className="font-bebas text-4xl tracking-wide text-gray-900 leading-none m-0">{student.name || 'STUDENT NAME'}</h2>
                    <p className="text-gray-500 text-[13px] font-bold mt-1.5 m-0">மாணவர்</p>
                  </div>
                </div>

                <div className="bg-[#111827] border-2 border-yellow-500/50 rounded-xl px-4 sm:px-6 py-3 text-center shadow-lg shrink-0">
                  <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-1.5 m-0">UNIQUE ID</p>
                  <p className="font-bebas text-2xl sm:text-3xl text-yellow-400 tracking-wider m-0 whitespace-nowrap">{student.id}</p>
                </div>
              </div>

              {/* Student Details & QR */}
              <div className="flex gap-10 mt-6 relative z-10 px-2">
                <div className="flex-1 space-y-4">
                  <SectionHeader title="STUDENT DETAILS" dotColor="#f97316" />
                  
                  <div className="space-y-0 pt-3 border-l-[1.5px] border-gray-100 pl-5 ml-1.5">
                    <DetailRow icon={User} label="Gender" value={student.gender || '—'} />
                    <DetailRow icon={Building} label="School" value={student.school || '—'} />
                    <DetailRow icon={BookOpen} label="Standard" value={student.standard || '—'} />
                    <DetailRow icon={Phone} label="Contact" value={student.contact || '—'} />
                    <DetailRow icon={MessageCircle} label="Parent WhatsApp" value={student.whatsapp || student.contact || '—'} />
                  </div>
                </div>

                <div className="w-[280px] flex justify-end shrink-0">
                  <div className="bg-white p-6 rounded-3xl border-2 border-gray-100 shadow-sm flex flex-col items-center justify-center w-full">
                    <QRCodeSVG value={qrValue} size={180} level="H" includeMargin={false} fgColor="#0D0D0D" />
                    <div className="text-center mt-5">
                      <p className="text-[11px] font-bold text-gray-700 m-0">Scan for Verification</p>
                      <p className="text-[10px] font-semibold text-gray-400 mt-1 m-0">சரிபார்க்க ஸ்கேன் செய்யவும்</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stage Transition */}
              <div className="pt-4 space-y-4 px-2">
                <SectionHeader title={isSilambam ? "STAGE TRANSITION" : "BELT TRANSITION"} dotColor="#ef4444" />
                
                <div className="bg-[#f9fafb] border border-gray-100 rounded-3xl p-8 flex justify-center items-center shadow-[inset_0_2px_10px_rgba(0,0,0,0.01)]">
                  <div className="flex items-center gap-8">
                    {/* Left Pill */}
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="h-6 w-20 rounded-full shadow-sm border border-black/5" style={{ backgroundColor: fromColor }} />
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-widest">{isSilambam ? `STAGE ${student.stageLevel || 1}` : belt?.from}</span>
                    </div>

                    {/* Arrow */}
                    <div className="flex flex-col items-center gap-1.5 opacity-40">
                      <ArrowRight size={22} className="text-gray-500" strokeWidth={2.5} />
                      <span className="text-[9px] font-bold text-gray-500 tracking-widest">TEST</span>
                    </div>

                    {/* Right Pill */}
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="h-6 w-20 rounded-full shadow-sm border border-black/5" style={{ backgroundColor: toColor }} />
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-widest">{isSilambam ? `STAGE ${(student.stageLevel || 1) + 1}` : belt?.to}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            
            {/* Bottom Divider */}
            <div className="relative mt-auto pt-10 pb-4">
              <div className="absolute inset-0 top-1/2 flex items-center">
                <div className="w-full border-t-[1.5px] border-gray-100"></div>
              </div>
              <div className="relative flex justify-center">
                <div className="h-2 w-2 rounded-full bg-gray-200"></div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    );
  }
);

HallTicketCard.displayName = 'HallTicketCard';

/* ── Sub-components ── */

function SectionHeader({ title, dotColor }: { title: string; dotColor: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
      <span className="text-[11px] font-extrabold text-gray-500 tracking-[0.15em] uppercase">{title}</span>
      <div className="flex-1 h-[1.5px] bg-gray-100 ml-2" />
    </div>
  );
}

function InfoBox({ icon: Icon, label, value, bg, iconColor, fullWidth = false }: { icon: any, label: string, value: string, bg: string, iconColor: string, fullWidth?: boolean }) {
  return (
    <div className={`${bg} rounded-2xl p-5 ${fullWidth ? 'w-full flex items-center gap-4' : 'flex flex-col gap-3'} border border-black/5 shadow-sm`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className={iconColor} />
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</span>
      </div>
      <span className={`text-[13px] font-bold text-gray-900 leading-tight ${fullWidth ? 'mt-0' : 'mt-1'}`}>{value}</span>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="py-3.5 flex items-center justify-between border-b border-dashed border-gray-200/60 last:border-0 relative">
      <div className="absolute -left-[27px] bg-white text-gray-400 p-0.5">
        <Icon size={14} strokeWidth={2.5} />
      </div>
      <span className="text-[12px] font-bold text-gray-500">{label}</span>
      <span className="text-[13px] font-bold text-gray-900 text-right pr-6">{value}</span>
    </div>
  );
}

