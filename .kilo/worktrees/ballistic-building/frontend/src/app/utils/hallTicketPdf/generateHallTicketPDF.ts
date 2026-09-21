import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { HallTicketStudentInfo, BeltTestEventInfo } from '../hallTicketGenerator';
import { getMascotImage, getMascotAccentColor } from '../mascot';
import { logoBase64 } from '../logoBase64';

// Helper to convert an image URL to a base64 string for jsPDF
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to fetch image as base64:", url, error);
    return "";
  }
}

// Convert hex to rgb for jsPDF
function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

const FALLBACK_EVENT: BeltTestEventInfo = {
  name: 'Shadow Kai — Belt Test',
  date: 'TBD',
  time: 'TBD',
  venue: 'TBD',
};

// Generates a single Hall Ticket natively onto the provided jsPDF document.
// The document is assumed to be A4 landscape.
export async function drawHallTicket(
  doc: jsPDF,
  student: HallTicketStudentInfo,
  belt: any
): Promise<void> {
  
  const isSilambam = (student.programType || "").toUpperCase() === 'SELAMBAM';
  const mascotUrl = getMascotImage(isSilambam ? 'SILAMBAM' : 'KARATE', isSilambam ? `Stage ${student.stageLevel || 1}` : belt.to);
  const accentColorHex = getMascotAccentColor(isSilambam ? 'SILAMBAM' : 'KARATE', isSilambam ? `Stage ${student.stageLevel || 1}` : belt.to) || '#f59e0b';
  const accentRGB = hexToRgb(accentColorHex);

  const eventInfo = student.eventInfo || FALLBACK_EVENT;

  // Constants
  const w = 297; // A4 landscape width
  const h = 207.9; // 1000x700 aspect ratio equivalent height in mm
  const leftPanelW = w * 0.65;
  const rightPanelW = w * 0.35;
  const rightPanelX = leftPanelW;

  // Backgrounds
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, leftPanelW, h, 'F');
  
  doc.setFillColor(252, 252, 252);
  doc.rect(rightPanelX, 0, rightPanelW, h, 'F');
  
  // Right panel border line
  doc.setDrawColor(243, 244, 246);
  doc.setLineWidth(0.5);
  doc.line(rightPanelX, 0, rightPanelX, h);

  // === LEFT PANEL ===
  const marginL = 25;
  let currY = 25;

  // Header
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', marginL, currY, 18, 18);
  }
  
  currY += 8;
  doc.setTextColor(24, 24, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("TEAM SHADOW KAI", marginL + 22, currY);
  
  currY += 5;
  doc.setTextColor(156, 163, 175);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("OFFICIAL BELT EXAMINATION HALL TICKET", marginL + 22, currY);

  // Program Badge
  const programText = isSilambam ? 'SILAMBAM' : 'KARATE';
  doc.setFillColor(255, 215, 0); // var(--yellow)
  doc.roundedRect(leftPanelW - marginL - 30, 25, 30, 8, 1, 1, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(programText, leftPanelW - marginL - 15, 30.5, { align: 'center' });

  // Accent Divider
  currY += 15;
  doc.setFillColor(accentRGB[0], accentRGB[1], accentRGB[2]);
  doc.roundedRect(marginL, currY, leftPanelW - (marginL * 2), 0.8, 0.4, 0.4, 'F');

  // Student Name
  currY += 18;
  doc.setTextColor(24, 24, 27);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text((student.name || 'STUDENT NAME').toUpperCase(), marginL, currY);
  
  currY += 5;
  doc.setDrawColor(243, 244, 246);
  doc.line(marginL, currY, leftPanelW - marginL, currY);

  // Student Details Rows
  currY += 8;
  const details = [
    { label: "Student ID", value: student.id || '—' },
    { label: "Gender", value: student.gender || '—' },
    { label: "School", value: student.school || '—' },
    { label: "Standard", value: student.standard || '—' },
    { label: "Contact", value: student.whatsapp || student.contact || '—' },
  ];

  details.forEach((det, idx) => {
    // Draw row
    doc.setTextColor(148, 163, 184); // #94a3b8
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(det.label, marginL, currY);
    
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(det.value, leftPanelW - marginL, currY, { align: 'right' });
    
    currY += 4;
    doc.setDrawColor(249, 250, 251); // #f9fafb
    doc.line(marginL, currY, leftPanelW - marginL, currY);
    currY += 6;
  });

  // Event Information
  currY += 5;
  
  // Section Title
  doc.setTextColor(accentRGB[0], accentRGB[1], accentRGB[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("EVENT INFORMATION", marginL, currY);
  
  doc.setDrawColor(241, 245, 249);
  doc.line(marginL + 38, currY - 1, leftPanelW - marginL, currY - 1);
  
  currY += 8;
  
  // Event Grid
  const drawGridItem = (label: string, value: string, x: number, y: number) => {
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(39, 39, 42);
    doc.setFontSize(10);
    doc.text(value, x, y + 4.5);
  };
  
  drawGridItem("Date", eventInfo.date, marginL, currY);
  drawGridItem("Reporting Time", eventInfo.time, marginL + 75, currY);
  
  currY += 12;
  drawGridItem("Venue", eventInfo.venue, marginL, currY);
  
  // End of left panel content

  // === RIGHT PANEL ===
  const rightCenter = rightPanelX + (rightPanelW / 2);
  let rY = 25;

  // Belt / Stage Display (Top half)
  rY = 75; // Position vertically where the mascot used to be
  
  // Belt Text
  doc.setTextColor(accentRGB[0], accentRGB[1], accentRGB[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text((isSilambam ? `STAGE ${student.stageLevel || 1}` : (belt?.to || 'NEW BELT')).toUpperCase(), rightCenter, rY, { align: 'center' });

  // Verification Area (Bottom)
  rY = h - 75;
  
  // Verification Status
  doc.setTextColor(21, 128, 61); // green
  doc.setFontSize(8);
  doc.text("VERIFIED", rightCenter, rY, { align: 'center' });

  rY += 5;

  // QR Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.roundedRect(rightCenter - 25, rY, 50, 50, 3, 3, 'FD');
  
  const qrValue = student.qrData || JSON.stringify({
    id: student.id,
    name: student.name,
    v: "1"
  });
  
  try {
    const qrDataUrl = await QRCode.toDataURL(qrValue, { 
      errorCorrectionLevel: 'H',
      margin: 0,
      width: 150
    });
    doc.addImage(qrDataUrl, 'PNG', rightCenter - 20, rY + 5, 40, 40);
  } catch (err) {
    console.error("QR Code generation failed for PDF", err);
  }

  // ID Badge at bottom
  rY += 55;
  doc.setFillColor(24, 24, 27);
  doc.roundedRect(rightCenter - 20, rY, 40, 10, 2, 2, 'F');
  doc.setTextColor(113, 113, 122);
  doc.setFontSize(6);
  doc.text("UNIQUE ID", rightCenter, rY + 3.5, { align: 'center' });
  doc.setTextColor(250, 250, 250);
  doc.setFontSize(9);
  doc.text(student.id, rightCenter, rY + 8, { align: 'center' });
}
