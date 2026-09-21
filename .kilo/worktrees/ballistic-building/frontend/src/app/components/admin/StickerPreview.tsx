import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface StickerStudent {
  id: string;
  name: string;
  belt?: string;
  school?: string;
  stickerPrinted?: boolean;
}

interface StickerPreviewProps {
  students: StickerStudent[];
  printRef: React.RefObject<HTMLDivElement>;
}

export default function StickerPreview({ students, printRef }: StickerPreviewProps) {
  // 60mm x 60mm (6x6cm) sticker layout.
  // Using flex wrap to allow multiple stickers per page.
  
  return (
    <>
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0mm; }
          html, body {
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
        `}
      </style>
      <div 
        className="hidden print:flex flex-wrap items-start justify-start gap-4 print:p-0 print:m-0" 
      ref={printRef} 
      id="sticker-print-area"
      style={{
        width: '100%',
        margin: 0,
        backgroundColor: 'white'
      }}
    >
      {students.map((student, index) => {
        // Must match HallTicketPage QR exactly
        const qrValue = JSON.stringify({
          id: student.id,
          name: student.name,
          belt: student.belt || "Belt Test",
          school: student.school || "Shadow Kai Karate Academy",
        });

        return (
          <div 
            key={`${student.id}-${index}`} 
            className="flex flex-col items-center justify-between bg-white text-black font-sans box-border border border-zinc-300"
            style={{ 
              width: '60mm', 
              height: '60mm', 
              padding: '4mm',
              margin: 0,
              overflow: 'hidden',
              pageBreakInside: 'avoid'
            }}
          >
            {/* Header / Name & ID */}
            <div className="w-full text-center space-y-0.5 mb-1.5">
              <div 
                className="font-extrabold leading-tight overflow-hidden text-center" 
                style={{ fontSize: '14px', maxHeight: '18px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
              >
                {(student.name || '').toUpperCase()}
              </div>
              <div 
                className="font-bold tracking-wider text-zinc-800" 
                style={{ fontSize: '9px' }}
              >
                {student.id}
              </div>
            </div>

            {/* QR Code */}
            <div className="flex-1 flex items-center justify-center w-full my-1">
              <QRCodeSVG
                value={qrValue}
                size={30} /* Reduced size for 60x60 */
                style={{ width: '30mm', height: '30mm' }}
                level="M"
                includeMargin={false}
              />
            </div>
            
            {/* Footer / Belt & School */}
            <div className="w-full text-center space-y-0.5 mt-1.5">
              <div 
                className="font-bold leading-tight" 
                style={{ fontSize: '11px' }}
              >
                {student.belt || "Belt Test"}
              </div>
              <div 
                className="font-semibold text-zinc-700 leading-tight overflow-hidden" 
                style={{ fontSize: '8px', maxHeight: '12px', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
              >
                {student.school || "Shadow Kai Karate Academy"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}
