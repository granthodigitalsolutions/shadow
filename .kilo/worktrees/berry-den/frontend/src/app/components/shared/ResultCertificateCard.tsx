import React, { forwardRef, useEffect, useRef, useState } from 'react';
import badgeLogo from '../../../assets/shadow-kai-logo.png';

export interface ResultCertificateStudentInfo {
  id: string;
  name: string;
  school: string;
  programType: string; // 'KARATE' | 'SELAMBAM' | 'SILAMBAM'
  beltLevel?: string;
  stageLevel?: number;
  percentage: number;
  grade: string;
  testDate?: string;
}

export interface ResultCertificateCardProps {
  student: ResultCertificateStudentInfo;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'A+': { bg: '#fffbeb', text: '#b45309', border: '#f59e0b' },
  'A':  { bg: '#ecfdf5', text: '#047857', border: '#10b981' },
  'B':  { bg: '#eff6ff', text: '#1d4ed8', border: '#3b82f6' },
  'C':  { bg: '#fefce8', text: '#a16207', border: '#eab308' },
  'D':  { bg: '#fff7ed', text: '#c2410c', border: '#f97316' },
  'F':  { bg: '#fef2f2', text: '#b91c1c', border: '#ef4444' },
};

export const ResultCertificateCard = forwardRef<HTMLDivElement, ResultCertificateCardProps>(
  ({ student }, ref) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setScale(entry.contentRect.width / 800);
        }
      });
      observer.observe(wrapper);
      return () => observer.disconnect();
    }, []);

    const isSilambam = (student.programType || '').toUpperCase().startsWith('SEL') ||
      (student.programType || '').toUpperCase().startsWith('SIL');

    const programLabel = isSilambam ? 'Silambam' : 'Karate';
    const disciplineLine = isSilambam ? 'TRADITIONAL SILAMBAM ACADEMY' : 'KARATE DO ACADEMY';

    const beltAppliedLabel = isSilambam
      ? `STAGE ${student.stageLevel ?? 1}`
      : (student.beltLevel || 'BELT TEST').toUpperCase();

    const gradeColors = GRADE_COLORS[student.grade] || GRADE_COLORS['C'];

    const formattedDate = student.testDate
      ? new Date(student.testDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

    return (
      <div ref={wrapperRef} style={{ position: 'relative', overflow: 'hidden', width: '100%', aspectRatio: '800/1131', margin: '0 auto', maxWidth: '800px' }}>
        <div
          id={`result-certificate-${student.id}`}
          ref={ref}
          className="bg-white overflow-hidden flex flex-col"
          style={{
            position: 'absolute', top: 0, left: 0,
            boxShadow: '0 24px 80px rgba(0,0,0,.12)',
            border: '1.5px solid #e8e4de',
            width: '800px', height: '1131px',
            transform: `scale(${scale})`, transformOrigin: 'top left',
            boxSizing: 'border-box', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            pageBreakInside: 'avoid', breakInside: 'avoid',
          }}
        >
          {/* Top accent strip */}
          <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444, #f59e0b)' }} />

          {/* Header */}
          <div className="flex flex-col items-center pt-9 pb-5">
            <img
              src={badgeLogo}
              alt="Shadow Kai"
              className="w-[76px] h-[76px] rounded-full object-cover border-[3px] border-amber-500 bg-white shadow-sm"
            />
            <h1
              className="text-3xl tracking-[0.08em] text-gray-900 mt-3 mb-0.5"
              style={{ fontFamily: "'Bebas Neue', sans-serif" }}
            >
              TEAM SHADOW KAI
            </h1>
            <p className="text-[11px] font-bold text-gray-400 tracking-[0.2em] uppercase">
              {disciplineLine}
            </p>
          </div>

          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-3 px-16">
            <div className="flex-1 h-px bg-gray-200" />
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Main content */}
          <div className="relative flex-1 flex flex-col items-center justify-center px-16 text-center">
            {/* Watermark */}
            <img
              src={badgeLogo}
              alt=""
              className="absolute top-1/2 left-1/2 w-[420px] h-[420px] object-contain opacity-[0.035] pointer-events-none"
              style={{ transform: 'translate(-50%, -50%)', filter: 'grayscale(1)' }}
            />

            <div className="relative z-10 flex flex-col items-center">
              <p className="text-[11px] font-extrabold text-amber-600 tracking-[0.35em] uppercase mb-3">
                Certificate of Achievement
              </p>
              <h2
                className="text-[64px] leading-none text-gray-900 tracking-wide"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                CONGRATULATIONS
              </h2>

              <p className="text-[13px] font-semibold text-gray-400 mt-9 mb-1 uppercase tracking-[0.15em]">
                This certificate is proudly presented to
              </p>
              <h3
                className="text-[46px] leading-tight text-amber-600 mt-1"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                {student.name}
              </h3>

              <p className="text-[13px] font-semibold text-gray-400 mt-4 uppercase tracking-[0.15em]">of</p>
              <p className="text-xl font-extrabold text-gray-800 mt-1 mb-8">{student.school || 'Individual Student'}</p>

              <p className="text-[15px] font-medium text-gray-600 max-w-md leading-relaxed">
                for successfully completing the {programLabel} Belt Test applied for
              </p>
              <p
                className="text-[30px] tracking-wide text-gray-900 mt-1 mb-9"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                {beltAppliedLabel}
              </p>

              {/* Grade + Percentage */}
              <div className="flex items-stretch gap-6">
                <div
                  className="flex flex-col items-center justify-center rounded-2xl px-10 py-5 border-2"
                  style={{ backgroundColor: gradeColors.bg, borderColor: gradeColors.border }}
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] mb-1" style={{ color: gradeColors.text }}>
                    Grade
                  </span>
                  <span
                    className="text-[44px] leading-none font-extrabold"
                    style={{ color: gradeColors.text }}
                  >
                    {student.grade}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-2xl px-10 py-5 border-2 border-gray-200 bg-gray-50">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-gray-500 mb-1">
                    Percentage
                  </span>
                  <span className="text-[44px] leading-none font-extrabold text-gray-900">
                    {student.percentage}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-12 py-5 border-t border-gray-100 text-[10px] font-bold text-gray-400 tracking-wide uppercase">
            <span>Certificate ID: {student.id}</span>
            {formattedDate && <span>Test Date: {formattedDate}</span>}
          </div>
          <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #ef4444, #f59e0b)' }} />
        </div>
      </div>
    );
  }
);

ResultCertificateCard.displayName = 'ResultCertificateCard';
