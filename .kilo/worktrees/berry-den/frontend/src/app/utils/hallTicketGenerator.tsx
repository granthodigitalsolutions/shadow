import React from 'react';
import { createRoot } from 'react-dom/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { belts } from '../data';
import { HallTicketCard } from '../components/shared/HallTicketCard';
import { getMascotAccentColor } from './mascot';
import { ensureAppFontsLoaded, waitForClonedStylesheets } from './html2canvasCaptureHelpers';

export interface HallTicketStudentInfo {
  id: string;
  name: string;
  gender: string;
  school: string;
  standard: string;
  contact: string;
  whatsapp: string;
  programType: string;
  beltLevel?: string;
  stageLevel?: number;
  eventInfo?: BeltTestEventInfo;
  qrData?: string; // Original QR payload string
}

export interface BeltTestEventInfo {
  name: string;
  date: string;
  time: string;
  venue: string;
  locationAddress?: string;
  locationLink?: string;
}

/**
 * Dynamically renders the HallTicketCard into a hidden DOM element,
 * captures it with html2canvas, and returns the canvas.
 */
async function captureHallTicketCanvas(student: HallTicketStudentInfo): Promise<HTMLCanvasElement> {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureAppFontsLoaded();

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.opacity = '0';
      container.style.width = '800px';
      container.style.height = '1131px';
      document.body.appendChild(container);

      const root = createRoot(container);
      
      const isSilambam = (student.programType || "").toUpperCase() === 'SELAMBAM';
      
      // Determine belt
      let belt = belts[0];
      if (!isSilambam && student.beltLevel) {
        const b = belts.find(b => (b.from || '').toLowerCase() === (student.beltLevel || '').toLowerCase() || (b.to || '').toLowerCase() === (student.beltLevel || '').toLowerCase());
        if (b) belt = b;
        else belt = { ...belts[0], to: student.beltLevel, from: 'Previous Belt' };
      }
      
      const accentColor = getMascotAccentColor(isSilambam ? 'SILAMBAM' : 'KARATE', isSilambam ? `Stage ${student.stageLevel || 1}` : belt.to);

      root.render(
        <HallTicketCard
          student={student as any}
          beltTest={student.eventInfo as any}
          belt={belt}
          isSilambam={isSilambam}
          mascotSrc={""} // No tiger images
          accentColor={accentColor}
        />
      );

      // Give React time to render 
      setTimeout(async () => {
        try {
          const element = container.querySelector('[id^="receipt-print-area"]') as HTMLElement;
          if (!element) throw new Error("Could not find receipt-print-area element");
          
          const canvas = await html2canvas(element, {
            scale: 3,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 800,
            windowHeight: 1131,
            onclone: (clonedDoc: Document) => waitForClonedStylesheets(clonedDoc),
          });
          
          root.unmount();
          container.remove();
          resolve(canvas);
        } catch (e) {
          root.unmount();
          container.remove();
          reject(e);
        }
      }, 500);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Generate a multi-page PDF for bulk registration download.
 */
export async function generateBulkHallTickets(
  students: HallTicketStudentInfo[]
): Promise<void> {
  // A4 Portrait is 210mm x 297mm
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    
    const canvas = await captureHallTicketCanvas(student);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Fit into 210x297 A4 Portrait
    if (i > 0) {
      doc.addPage('a4', 'portrait');
    }
    
    doc.addImage(imgData, 'JPEG', 0, 0, 210, 296.89); // Use exact 800/1131 ratio in mm to prevent distortion
  }
  
  doc.save("Bulk_HallTickets.pdf");
}

/**
 * Generate a single PDF Blob (used for uploading to Storage).
 */
export async function generateSingleHallTicketBlob(
  student: HallTicketStudentInfo
): Promise<Blob> {
  const canvas = await captureHallTicketCanvas(student);
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  
  pdf.addImage(imgData, 'JPEG', 0, 0, 210, 296.89);
  return pdf.output('blob');
}
