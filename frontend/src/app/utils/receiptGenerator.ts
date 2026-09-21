import jsPDF from 'jspdf';
import { logoBase64 as LOGO_BASE64 } from './logoBase64';

export interface RegistrationReceiptInfo {
  registrationId: string;
  name: string;
  gender: string;
  school: string;
  beltLevel: string;
  programType: string;
  feeAmount: number;
}

export interface ReceiptData {
  orderId: string;
  paymentId: string;
  date: string;
  totalAmount: number;
  students: RegistrationReceiptInfo[];
  coachName?: string;
}

// Color Tokens
const C_PRIMARY: [number, number, number] = [17, 17, 17];
const C_GOLD: [number, number, number] = [212, 175, 55];
const C_GREEN: [number, number, number] = [34, 197, 94];
const C_GRAY: [number, number, number] = [107, 114, 128];
const C_BORDER: [number, number, number] = [229, 231, 235];
const C_WHITE: [number, number, number] = [255, 255, 255];
const C_LIGHT_BG: [number, number, number] = [249, 250, 251];

// Truncate helper
const truncate = (str: string, length: number) => {
  if (!str) return "";
  return str.length > length ? str.substring(0, length) + "..." : str;
};

/**
 * Generate a PDF receipt for bulk student registrations
 */
export async function generateBulkRegistrationReceipt(data: ReceiptData, returnBlob: boolean = false): Promise<Blob | void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pw = 210;
  const ph = 297;
  const margin = 15;
  const cw = pw - margin * 2;
  
  let currentY = margin;

  // Mask bypass IDs
  const isBypass = !data.orderId || data.orderId.startsWith('BYPASS');
  const dDate = new Date(data.date);
  const formattedReceiptNo = isBypass ? `RCT-${dDate.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}` : data.orderId;
  const formattedMethod = isBypass ? 'Internal Registration' : 'Office Registration';

  // 1. Premium Header
  doc.setFillColor(...C_PRIMARY);
  doc.rect(0, 0, pw, 35, 'F');
  
  if (LOGO_BASE64) {
    doc.addImage(LOGO_BASE64, 'PNG', margin, 5, 25, 25, 'LOGO', 'FAST');
  }

  // Left text
  doc.setTextColor(...C_GOLD);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text("TEAM SHADOW KAI", margin + 30, 16);
  
  doc.setTextColor(...C_WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text("Tamil Nadu Association", margin + 30, 23);

  // Right text
  doc.setTextColor(...C_WHITE);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text("OFFICIAL REGISTRATION RECEIPT", pw - margin, 16, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 200);
  doc.text(`Receipt No: ${formattedReceiptNo}`, pw - margin, 23, { align: 'right' });

  // Gold accent line
  doc.setFillColor(...C_GOLD);
  doc.rect(0, 35, pw, 1.5, 'F');

  currentY = 45;

  // 2. Payment Summary Card
  doc.setDrawColor(...C_BORDER);
  doc.setFillColor(...C_WHITE);
  doc.roundedRect(margin, currentY, cw, 42, 2, 2, 'FD');

  doc.setTextColor(...C_PRIMARY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text("PAYMENT SUMMARY", margin + 6, currentY + 8);

  doc.setDrawColor(...C_BORDER);
  doc.line(margin + 6, currentY + 12, margin + cw - 6, currentY + 12);

  const col1 = margin + 6;
  const col2 = margin + 55;
  const col3 = margin + 100;
  const col4 = margin + 145;

  // Row 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C_GRAY);
  doc.text("Receipt Number", col1, currentY + 18);
  doc.text("Date & Time", col2, currentY + 18);
  doc.text("Processed By", col3, currentY + 18);
  doc.text("Status", col4, currentY + 18);

  doc.setTextColor(...C_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(truncate(formattedReceiptNo, 20), col1, currentY + 23);
  doc.text(truncate(dDate.toLocaleString('en-IN'), 20), col2, currentY + 23);
  doc.text(truncate(data.coachName || "Coach", 20), col3, currentY + 23);
  
  // Status Badge
  doc.setFillColor(220, 252, 231); // light green bg
  doc.roundedRect(col4 - 2, currentY + 19, 18, 5.5, 1, 1, 'F');
  doc.setTextColor(...C_GREEN);
  doc.setFontSize(9);
  doc.text("PAID", col4 + 1.5, currentY + 23);

  // Row 2
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...C_GRAY);
  doc.text("Payment Method", col1, currentY + 31);
  if (!isBypass) {
    doc.text("Transaction ID", col2, currentY + 31);
  }
  
  doc.setTextColor(...C_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(truncate(formattedMethod, 20), col1, currentY + 36);
  if (!isBypass) {
    doc.text(truncate(data.paymentId, 30), col2, currentY + 36);
  }

  currentY += 48;

  // 3. Dual Section: Total Amount & Student Count Card
  const gap = 6;
  const halfCw = (cw - gap) / 2;
  
  // Left: Total Amount
  doc.setDrawColor(...C_BORDER);
  doc.setFillColor(...C_LIGHT_BG);
  doc.roundedRect(margin, currentY, halfCw, 28, 2, 2, 'FD');
  
  doc.setTextColor(...C_GRAY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("TOTAL AMOUNT PAID", margin + halfCw / 2, currentY + 9, { align: 'center' });
  
  doc.setTextColor(...C_GREEN);
  doc.setFontSize(24);
  // Using "Rs." instead of Rupee symbol to guarantee correct native PDF rendering without custom font
  doc.text(`Rs. ${data.totalAmount.toLocaleString('en-IN')}`, margin + halfCw / 2, currentY + 20, { align: 'center' });

  // Right: Students Summary
  const rightColX = margin + halfCw + gap;
  doc.setFillColor(...C_WHITE);
  doc.roundedRect(rightColX, currentY, halfCw, 28, 2, 2, 'FD');

  const uniquePrograms = Array.from(new Set(data.students.map(s => s.programType))).join(", ");
  const sumFees = data.students.reduce((acc, curr) => acc + (curr.feeAmount || 0), 0);

  doc.setTextColor(...C_GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text("Students Registered", rightColX + 6, currentY + 9);
  doc.text("Programs", rightColX + 6, currentY + 16);
  doc.text("Total Fees Configured", rightColX + 6, currentY + 23);

  doc.setTextColor(...C_PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.students.length}`, rightColX + halfCw - 6, currentY + 9, { align: 'right' });
  doc.text(truncate(uniquePrograms || "None", 18), rightColX + halfCw - 6, currentY + 16, { align: 'right' });
  doc.text(`Rs. ${sumFees.toLocaleString('en-IN')}`, rightColX + halfCw - 6, currentY + 23, { align: 'right' });

  currentY += 36;

  // 4. Student Table Redesign
  doc.setTextColor(...C_PRIMARY);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text("REGISTERED STUDENTS", margin, currentY);

  currentY += 6;

  // Table Header
  doc.setFillColor(...C_LIGHT_BG);
  doc.setDrawColor(...C_BORDER);
  doc.rect(margin, currentY, cw, 10, 'FD');

  doc.setTextColor(...C_GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  const tCol1 = margin + 6;
  const tCol2 = margin + 85;
  const tCol3 = margin + 130;
  const tCol4 = pw - margin - 6;

  doc.text("Student Details", tCol1, currentY + 6.5);
  doc.text("Registration ID", tCol2, currentY + 6.5, { align: 'center' });
  doc.text("Program", tCol3, currentY + 6.5);
  doc.text("Fee", tCol4, currentY + 6.5, { align: 'right' });

  currentY += 10;
  
  doc.setDrawColor(...C_BORDER);

  for (let i = 0; i < data.students.length; i++) {
    const student = data.students[i];
    const rowHeight = 24; // Increased to fit 3 lines
    
    // Page break logic
    if (currentY + rowHeight > ph - 45) {
      doc.addPage();
      currentY = 20;
      
      // Re-draw header on new page
      doc.setFillColor(...C_LIGHT_BG);
      doc.setDrawColor(...C_BORDER);
      doc.rect(margin, currentY, cw, 10, 'FD');
      doc.setTextColor(...C_GRAY);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text("Student Details", tCol1, currentY + 6.5);
      doc.text("Registration ID", tCol2, currentY + 6.5, { align: 'center' });
      doc.text("Program", tCol3, currentY + 6.5);
      doc.text("Fee", tCol4, currentY + 6.5, { align: 'right' });
      currentY += 10;
    }

    if (i % 2 === 0) {
      doc.setFillColor(252, 252, 253); // Very light gray for zebra
      doc.rect(margin, currentY, cw, rowHeight, 'F');
    }

    // Column 1: Student Details (3 vertical lines)
    doc.setTextColor(...C_PRIMARY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(truncate(student.name || "Unknown", 35), tCol1, currentY + 8);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C_PRIMARY);
    doc.text(truncate(student.school || "Unknown", 38), tCol1, currentY + 14);
    
    doc.setTextColor(...C_GRAY);
    doc.text(`Gender: ${truncate(student.gender || "U", 10)}`, tCol1, currentY + 20);

    // Column 2: Reg ID
    doc.setTextColor(...C_PRIMARY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const regId = student.registrationId || truncate((student.name || "Unknown").replace(/\s+/g, '').toUpperCase(), 12);
    doc.text(regId, tCol2, currentY + 14, { align: 'center' });

    // Column 3: Program
    doc.setTextColor(...C_PRIMARY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(truncate(student.programType || "Unknown", 15), tCol3, currentY + 10);
    
    doc.setTextColor(...C_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(truncate(student.beltLevel || "-", 20), tCol3, currentY + 16);

    // Column 4: Fee
    doc.setTextColor(...C_PRIMARY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Rs. ${student.feeAmount}`, tCol4, currentY + 14, { align: 'right' });

    // Bottom border for row
    doc.setDrawColor(...C_BORDER);
    doc.line(margin, currentY + rowHeight, margin + cw, currentY + rowHeight);

    currentY += rowHeight;
  }

  currentY += 12;

  // 5. Verification & Terms Box
  if (currentY > ph - 55) {
    doc.addPage();
    currentY = 20;
  }

  const termsW = 90;
  const verifW = cw - termsW - gap;

  // Receipt Verification Box
  doc.setFillColor(...C_LIGHT_BG);
  doc.setDrawColor(...C_BORDER);
  doc.roundedRect(margin, currentY, verifW, 26, 2, 2, 'FD');
  
  doc.setTextColor(...C_PRIMARY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("Receipt Verification", margin + 6, currentY + 8);
  
  doc.setTextColor(...C_GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text("Registration fee collected", margin + 6, currentY + 15);
  doc.text("by the academy coach.", margin + 6, currentY + 20);

  // Terms Section (aligned baseline to the box)
  const termsX = margin + verifW + gap;
  doc.setTextColor(...C_PRIMARY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("Terms & Conditions", termsX + 2, currentY + 6);
  
  doc.setTextColor(...C_GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text("• This receipt confirms successful registration.", termsX + 2, currentY + 12);
  doc.text("• Please retain this receipt for future reference.", termsX + 2, currentY + 16);
  doc.text("• Students will be notified with batch and test details closer to the date.", termsX + 2, currentY + 20);
  doc.text("• This is a computer-generated receipt, no signature required.", termsX + 2, currentY + 24);

  // 6. Organization Footer
  const footerY = ph - 15;
  doc.setDrawColor(...C_BORDER);
  doc.line(margin, footerY - 6, pw - margin, footerY - 6);
  
  doc.setTextColor(...C_GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text("Team Shadow Kai", margin, footerY);
  
  doc.setFont('helvetica', 'normal');
  doc.text("Tamil Nadu Association", pw / 2, footerY, { align: 'center' });
  doc.text("Official Registration System", pw - margin, footerY, { align: 'right' });

  if (returnBlob) {
    return doc.output('blob');
  } else {
    const filename = `Receipt_${formattedReceiptNo}.pdf`;
    doc.save(filename);
  }
}
