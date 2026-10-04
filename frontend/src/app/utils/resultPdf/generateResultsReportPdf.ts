import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_COLORS, drawBrandHeader, truncateText } from '../pdfBranding';
import { pdfSafe } from '../paymentReport';

export type ResultStatusLabel = 'PASSED' | 'FAILED' | 'PENDING';

export interface ResultsReportRow {
  studentId: string;
  name: string;
  gender: string;
  school: string;
  standard: string;
  beltStage: string;
  batch: string;
  status: ResultStatusLabel;
  score: string;
  percentage: string;
  grade: string;
  rank: string;
  /** Detailed assessment (examiner-entered, exactly as saved; "\u2014" when unavailable). */
  coach: string;
  exam: string;
  transition: string;
  technicalLesson: string;
  technicalScore: string;
  athleticLesson: string;
  athleticScore: string;
  /** Technical + Athletic as saved don't add up to the saved total (shown, flagged, never "fixed"). */
  totalMismatch?: boolean;
}

export interface ResultsReportSummary {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  passRate: number;
  avgScore: number;
}

export interface ResultsReportOptions {
  /** Report title shown in the header band, e.g. "SCHOOL RESULTS". */
  title: string;
  /** School / batch / scope name shown under the title. */
  scopeLabel?: string;
  /** Label/value pairs printed in the info strip (School, Belt Test, Batch...). */
  details?: Array<{ label: string; value: string }>;
  summary: ResultsReportSummary;
  rows: ResultsReportRow[];
  /** Hide columns that are redundant for the report's scope. */
  showSchoolColumn?: boolean;
  showBatchColumn?: boolean;
  /** Hide the Coach column (e.g. when a single coach is filtered). */
  showCoachColumn?: boolean;
}

// Landscape A4 so the full result table fits without shrinking the type.
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 12;
const HEADER_H = 26;
const CONTENT_TOP = HEADER_H + 1.5 + 6; // below the brand band on continuation pages
const FOOTER_H = 14;

// Shortens text (with "...") until it fits the given width at the doc's current font.
function fitText(doc: jsPDF, value: string, maxWidth: number): string {
  if (doc.getTextWidth(value) <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && doc.getTextWidth(`${text}...`) > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}...`;
}

function drawSummaryTiles(doc: jsPDF, summary: ResultsReportSummary, y: number): number {
  const tiles: Array<{ label: string; value: string; color: [number, number, number] }> = [
    { label: 'TOTAL STUDENTS', value: String(summary.total), color: PDF_COLORS.primary },
    { label: 'PASSED', value: String(summary.passed), color: PDF_COLORS.green },
    { label: 'FAILED', value: String(summary.failed), color: PDF_COLORS.red },
    { label: 'PENDING', value: String(summary.pending), color: PDF_COLORS.blue },
    { label: 'PASS RATE', value: `${summary.passRate}%`, color: PDF_COLORS.primary },
    { label: 'AVG SCORE', value: String(summary.avgScore), color: PDF_COLORS.primary },
  ];
  const gap = 4;
  const tileW = (PAGE_W - MARGIN * 2 - gap * (tiles.length - 1)) / tiles.length;
  const tileH = 16;

  tiles.forEach((t, i) => {
    const x = MARGIN + i * (tileW + gap);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setFillColor(...PDF_COLORS.lightBg);
    doc.roundedRect(x, y, tileW, tileH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...t.color);
    doc.text(t.value, x + tileW / 2, y + 7.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text(t.label, x + tileW / 2, y + 12.5, { align: 'center' });
  });

  return y + tileH;
}

/**
 * Builds the multi-page, print-friendly results report. Pure jsPDF — no DOM —
 * so a 300-row result set simply flows onto as many pages as it needs, with
 * the brand band + table header repeated and "Page X of Y" on every page.
 */
export function buildResultsReportPdf(opts: ResultsReportOptions): jsPDF {
  const { title, scopeLabel, details = [], summary, rows, showSchoolColumn = true, showCoachColumn = true } = opts;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const generatedAt = new Date().toLocaleString();

  const bandSubtitle = scopeLabel ? truncateText(pdfSafe(scopeLabel), 60) : undefined;
  drawBrandHeader(doc, { pageWidth: PAGE_W, title, subtitle: bandSubtitle, height: HEADER_H, margin: MARGIN });

  // ── Info strip (first page only) ───────────────────────────────────────────
  let y = HEADER_H + 1.5 + 7;
  const infoItems = [...details, { label: 'Generated', value: generatedAt }];
  const colW = (PAGE_W - MARGIN * 2) / Math.min(infoItems.length, 4);
  infoItems.forEach((item, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = MARGIN + col * colW;
    const iy = y + row * 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text(item.label.toUpperCase(), x, iy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...PDF_COLORS.primary);
    doc.text(fitText(doc, pdfSafe(item.value || '-'), colW - 6), x, iy + 5);
  });
  y += Math.ceil(infoItems.length / 4) * 10 + 2;

  y = drawSummaryTiles(doc, summary, y) + 7;

  // ── Results table ──────────────────────────────────────────────────────────
  type Col = { header: string; get: (r: ResultsReportRow, i: number) => string; width?: number; align?: 'center' | 'left'; key: string };
  // Widths (mm) on landscape A4 (273mm usable): Name and School take what is left.
  const columns: Col[] = [
    { key: 'no', header: '#', get: (_r, i) => String(i + 1), width: 8, align: 'center' },
    { key: 'id', header: 'Student ID', get: (r) => r.studentId, width: 29 },
    { key: 'name', header: 'Student Name', get: (r) => r.name },
    ...(showSchoolColumn ? [{ key: 'school', header: 'School', get: (r: ResultsReportRow) => r.school } as Col] : []),
    ...(showCoachColumn ? [{ key: 'coach', header: 'Coach', get: (r: ResultsReportRow) => r.coach, width: 25 } as Col] : []),
    { key: 'exam', header: 'Exam', get: (r) => r.exam, width: 16 },
    { key: 'transition', header: 'Belt / Stage Transition', get: (r) => r.transition, width: 30 },
    { key: 'tl', header: 'Technical Lesson No.', get: (r) => r.technicalLesson, width: 17, align: 'center' },
    { key: 'ts', header: 'Technical Score', get: (r) => r.technicalScore, width: 15, align: 'center' },
    { key: 'al', header: 'Athletic Lesson No.', get: (r) => r.athleticLesson, width: 17, align: 'center' },
    { key: 'as', header: 'Athletic Score', get: (r) => r.athleticScore, width: 15, align: 'center' },
    { key: 'score', header: 'Total Score', get: (r) => (r.totalMismatch ? `${r.score} *` : r.score), width: 14, align: 'center' },
    { key: 'pct', header: '%', get: (r) => r.percentage, width: 14, align: 'center' },
    { key: 'status', header: 'Status', get: (r) => r.status, width: 19, align: 'center' },
  ];

  const body = rows.length > 0
    // pdfSafe: the built-in PDF font has no arrow glyph ("White → Yellow" printed as
    // garbled, letter-spaced text); it is written as "White to Yellow" instead.
    ? rows.map((r, i) => columns.map((c) => pdfSafe(c.get(r, i))))
    : [[{ content: 'No students to show', colSpan: columns.length, styles: { halign: 'center', textColor: PDF_COLORS.gray } }]];

  const columnStyles: Record<number, any> = {};
  columns.forEach((c, i) => {
    columnStyles[i] = { cellWidth: c.width ?? 'auto', halign: c.align ?? 'left' };
  });

  const statusIdx = columns.findIndex((c) => c.key === 'status');
  const nameIdx = columns.findIndex((c) => c.key === 'name');

  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: body as any,
    startY: y,
    margin: { top: CONTENT_TOP, left: MARGIN, right: MARGIN, bottom: FOOTER_H },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 1.6, lineColor: PDF_COLORS.border, lineWidth: 0.2, textColor: PDF_COLORS.primary, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: PDF_COLORS.primary, textColor: PDF_COLORS.gold, fontStyle: 'bold', fontSize: 7.4, halign: 'center', valign: 'middle' },
    alternateRowStyles: { fillColor: PDF_COLORS.lightBg },
    columnStyles,
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    didParseCell: (data) => {
      if (data.section === 'head' && columns[data.column.index]?.align !== 'center') {
        data.cell.styles.halign = 'left';
      }
      if (data.section !== 'body' || rows.length === 0) return;
      if (data.column.index === statusIdx) {
        const v = String(data.cell.raw);
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = v === 'PASSED' ? PDF_COLORS.green : v === 'FAILED' ? PDF_COLORS.red : PDF_COLORS.blue;
      }
      if (data.column.index === nameIdx) data.cell.styles.fontStyle = 'bold';
    },
    didDrawPage: (data) => {
      // Page 1's band was drawn above; every continuation page gets its own.
      if (data.pageNumber > 1) {
        drawBrandHeader(doc, { pageWidth: PAGE_W, title, subtitle: bandSubtitle, height: HEADER_H, margin: MARGIN });
      }
    },
  });

  // Note for scores that were saved inconsistently (shown as saved, never altered).
  const mismatches = rows.filter((r) => r.totalMismatch).length;
  const notes = [
    'Scores are shown exactly as saved by the examiner. "-" = not recorded for this student (older records).',
    ...(mismatches > 0 ? [`* ${mismatches} result(s): Technical + Athletic do not add up to the saved total; the saved total is shown.`] : []),
  ];
  let noteY = ((doc as any).lastAutoTable?.finalY ?? y) + 6;
  if (noteY + notes.length * 4.5 > PAGE_H - FOOTER_H) { doc.addPage(); noteY = CONTENT_TOP + 4; }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_COLORS.gray);
  notes.forEach((n, i) => doc.text(n, MARGIN, noteY + i * 4.5));

  // ── Footer on every page (needs the final page count) ──────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text(`Team Shadow Kai  |  ${title}  |  Generated ${generatedAt}`, MARGIN, PAGE_H - 5.5);
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, PAGE_H - 5.5, { align: 'right' });
  }

  return doc;
}
