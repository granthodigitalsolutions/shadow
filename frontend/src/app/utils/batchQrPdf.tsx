import jsPDF from 'jspdf';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { PDF_COLORS, drawBrandHeader, truncateText } from './pdfBranding';

export interface BatchQrPdfInfo {
  /** The batch code — also the exact payload encoded in the QR. */
  code: string;
  /** e.g. "Batch #1 (Karate)" — from formatBatchName(). */
  batchName: string;
  schoolName?: string;
  testName?: string;
  studentCount?: number;
}

// Same QR component + props BatchManagement shows on screen (QRCodeSVG,
// level "M", no built-in margin), so the printed QR is byte-for-byte the same
// code as the one the admin sees. Only rasterised so jsPDF can embed it.
const QR_RASTER_PX = 1024;

export function renderBatchQrSvg(code: string, size = QR_RASTER_PX): string {
  const markup = renderToStaticMarkup(
    <QRCodeSVG value={code} size={size} level="M" includeMargin={false} />,
  );
  // React omits xmlns on inline <svg>, but a standalone SVG image (which is
  // what we load it as) is invalid without it and fails to decode.
  return markup.includes('xmlns=') ? markup : markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}

export async function batchQrToPngDataUrl(code: string, px = QR_RASTER_PX): Promise<string> {
  const svg = renderBatchQrSvg(code, px);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not render the QR code'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, px, px);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Builds the single-page A4 batch QR sheet. Pure (no DOM) so it can be
 * exercised outside the browser — pass in an already-rasterised QR PNG.
 */
export function buildBatchQrPdf(qrPngDataUrl: string, info: BatchQrPdfInfo): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const pw = 210;
  const margin = 15;
  const centerX = pw / 2;

  const headerBottom = drawBrandHeader(doc, { pageWidth: pw, title: 'BATCH QR CODE', margin });

  // Batch name + context
  let y = headerBottom + 20;
  doc.setTextColor(...PDF_COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(truncateText(info.batchName, 40), centerX, y, { align: 'center' });

  const meta: string[] = [];
  if (info.schoolName) meta.push(info.schoolName);
  if (info.testName) meta.push(info.testName);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.gray);
  if (meta.length > 0) {
    doc.text(truncateText(meta.join('  |  '), 80), centerX, y, { align: 'center' });
    y += 7;
  }
  if (info.studentCount != null) {
    doc.text(`${info.studentCount} student${info.studentCount === 1 ? '' : 's'}`, centerX, y, { align: 'center' });
    y += 7;
  }

  // QR card — white padding around the code doubles as the quiet zone
  // scanners need, since the QR itself is rendered with no margin.
  const qrSize = 110;
  const pad = 8;
  const cardSize = qrSize + pad * 2;
  const cardX = centerX - cardSize / 2;
  const cardY = y + 10;
  doc.setDrawColor(...PDF_COLORS.gold);
  doc.setLineWidth(0.8);
  doc.setFillColor(...PDF_COLORS.white);
  doc.roundedRect(cardX, cardY, cardSize, cardSize, 3, 3, 'FD');
  doc.addImage(qrPngDataUrl, 'PNG', cardX + pad, cardY + pad, qrSize, qrSize, 'BATCH_QR', 'FAST');

  // Batch code
  const labelY = cardY + cardSize + 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text('BATCH CODE', centerX, labelY, { align: 'center', charSpace: 1 });

  doc.setFont('courier', 'bold');
  doc.setFontSize(48);
  doc.setTextColor(...PDF_COLORS.primary);
  doc.text(info.code, centerX, labelY + 18, { align: 'center', charSpace: 3 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text('Scan the QR code, or enter the batch code, on the examiner entry screen.', centerX, labelY + 30, { align: 'center' });

  // Footer
  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(margin, 279, pw - margin, 279);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 285);
  doc.text('Shadow Kai  |  Belt Test Management', pw - margin, 285, { align: 'right' });

  return doc;
}

/** Generates and downloads the one-page batch QR PDF. */
export async function downloadBatchQrPdf(info: BatchQrPdfInfo): Promise<void> {
  const png = await batchQrToPngDataUrl(info.code);
  const doc = buildBatchQrPdf(png, info);
  const safeName = info.batchName.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
  doc.save(`Batch_QR_${safeName || 'Batch'}_${info.code}.pdf`);
}
