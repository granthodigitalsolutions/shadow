import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDF_COLORS, drawBrandHeader, truncateText } from '../pdfBranding';

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
  const { title, scopeLabel, details = [], summary, rows, showSchoolColumn = true, showBatchColumn = true } = opts;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const generatedAt = new Date().toLocaleString();

  const bandSubtitle = scopeLabel ? truncateText(scopeLabel, 60) : undefined;
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
    doc.text(fitText(doc, item.value || '-', colW - 6), x, iy + 5);
  });
  y += Math.ceil(infoItems.length / 4) * 10 + 2;

  y = drawSummaryTiles(doc, summary, y) + 7;

  // ── Results table ──────────────────────────────────────────────────────────
  type Col = { header: string; get: (r: ResultsReportRow, i: number) => string; width?: number; align?: 'center' | 'left'; key: string };
  const columns: Col[] = [
    { key: 'no', header: '#', get: (_r, i) => String(i + 1), width: 9, align: 'center' },
    { key: 'id', header: 'Student ID', get: (r) => r.studentId, width: 34 },
    { key: 'name', header: 'Name', get: (r) => r.name },
    { key: 'gender', header: 'Gender', get: (r) => r.gender, width: 15 },
    ...(showSchoolColumn ? [{ key: 'school', header: 'School', get: (r: ResultsReportRow) => r.school } as Col] : []),
    { key: 'std', header: 'Std', get: (r) => r.standard, width: 12, align: 'center' },
    { key: 'belt', header: 'Belt/Stage', get: (r) => r.beltStage, width: 22 },
    ...(showBatchColumn ? [{ key: 'batch', header: 'Batch', get: (r: ResultsReportRow) => r.batch, width: 32 } as Col] : []),
    { key: 'status', header: 'Status', get: (r) => r.status, width: 20, align: 'center' },
    { key: 'score', header: 'Score', get: (r) => r.score, width: 14, align: 'center' },
    { key: 'pct', header: '%', get: (r) => r.percentage, width: 15, align: 'center' },
    { key: 'grade', header: 'Grade', get: (r) => r.grade, width: 14, align: 'center' },
    { key: 'rank', header: 'Rank', get: (r) => r.rank, width: 14, align: 'center' },
  ];

  const body = rows.length > 0
    ? rows.map((r, i) => columns.map((c) => c.get(r, i)))
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
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, lineColor: PDF_COLORS.border, lineWidth: 0.2, textColor: PDF_COLORS.primary, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: PDF_COLORS.primary, textColor: PDF_COLORS.gold, fontStyle: 'bold', fontSize: 8, halign: 'center' },
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
