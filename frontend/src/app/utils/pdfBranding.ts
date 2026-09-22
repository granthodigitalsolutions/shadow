import type jsPDF from 'jspdf';
import { logoBase64 } from './logoBase64';

// Shadow Kai PDF branding — same palette and header treatment as
// receiptGenerator.ts (black band, gold accent line, logo on the left).
export type RGB = [number, number, number];

export const PDF_COLORS = {
  primary: [17, 17, 17] as RGB,
  gold: [212, 175, 55] as RGB,
  gray: [107, 114, 128] as RGB,
  border: [229, 231, 235] as RGB,
  white: [255, 255, 255] as RGB,
  lightBg: [249, 250, 251] as RGB,
  green: [22, 163, 74] as RGB,
  red: [220, 38, 38] as RGB,
  blue: [37, 99, 235] as RGB,
};

interface BrandHeaderOptions {
  /** Page width in mm (portrait A4 = 210, landscape A4 = 297). */
  pageWidth: number;
  /** Right-aligned document title, e.g. "BATCH QR CODE". */
  title: string;
  /** Optional right-aligned second line under the title. */
  subtitle?: string;
  /** Band height in mm. */
  height?: number;
  margin?: number;
}

/**
 * Draws the Shadow Kai brand band (logo + "TEAM SHADOW KAI" + document title)
 * at the top of the current page and returns the Y position just below it.
 */
export function drawBrandHeader(doc: jsPDF, opts: BrandHeaderOptions): number {
  const { pageWidth, title, subtitle, height = 32, margin = 15 } = opts;
  const logoSize = height - 10;

  doc.setFillColor(...PDF_COLORS.primary);
  doc.rect(0, 0, pageWidth, height, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 5, logoSize, logoSize, 'SK_LOGO', 'FAST');
  }

  const textX = margin + logoSize + 5;
  doc.setTextColor(...PDF_COLORS.gold);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('TEAM SHADOW KAI', textX, height / 2 - 1);

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Tamil Nadu Association', textX, height / 2 + 6);

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, pageWidth - margin, height / 2 - (subtitle ? 1 : -2), { align: 'right' });

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(subtitle, pageWidth - margin, height / 2 + 6, { align: 'right' });
  }

  doc.setFillColor(...PDF_COLORS.gold);
  doc.rect(0, height, pageWidth, 1.5, 'F');

  return height + 1.5;
}

/** Truncates text with an ellipsis so it never overflows a fixed-width cell. */
export function truncateText(value: string, max: number): string {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, Math.max(0, max - 3))}...` : value;
}
