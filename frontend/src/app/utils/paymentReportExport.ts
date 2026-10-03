import {
  PaymentRow, ReportFilters, totalsOf, coachSummary, schoolSummary, transitionBreakdown,
  formatINRPdf, safeCell, sanitizeFilename, statusLabel,
} from "./paymentReport";
import { PDF_COLORS, drawBrandHeader } from "./pdfBranding";

// Both exports are built from the exact filtered rows the Payments page is
// showing (never re-queried), so totals always reconcile with what the admin
// sees. jsPDF / SheetJS are loaded on demand to stay out of the page bundle.

export interface ExportContext {
  rows: PaymentRow[];
  filters: ReportFilters;
  /** Human-readable filter lines, already resolved to names (not ids). */
  filterLines: string[];
  /** Used for file naming. */
  schoolName?: string;
  coachName?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateStamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStamp = (d: Date) => `${dateStamp(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function reportFilename(ctx: ExportContext, ext: "pdf" | "xlsx", now = new Date()): string {
  if (ctx.coachName) return `${sanitizeFilename(ctx.coachName)}_Registration_Report_${dateStamp(now)}.${ext}`;
  if (ctx.schoolName) return `${sanitizeFilename(ctx.schoolName)}_Payment_Report_${dateStamp(now)}.${ext}`;
  return `Payment_Report_${dateStamp(now)}.${ext}`;
}

export async function exportPaymentPdf(ctx: ExportContext): Promise<string> {
  const [pdfMod, tableMod]: any[] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  // Named export in the browser build; the Node build nests it under default.
  const jsPDF = pdfMod.jsPDF || pdfMod.default?.jsPDF || pdfMod.default;
  const autoTable = tableMod.default?.default || tableMod.default || tableMod.autoTable;
  const now = new Date();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  const t = totalsOf(ctx.rows);

  let y = drawBrandHeader(doc, { pageWidth: pageW, title: "PAYMENT REPORT", subtitle: timeStamp(now), height: 26, margin }) + 7;

  doc.setTextColor(...PDF_COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Payment & Student Registration Report", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text(`Generated: ${timeStamp(now)}`, margin, y);
  y += 5;
  doc.text(`Filters: ${ctx.filterLines.length ? ctx.filterLines.join("  |  ") : "None (all records)"}`, margin, y, { maxWidth: pageW - margin * 2 });
  y += 8;

  const head = { fillColor: PDF_COLORS.primary, textColor: PDF_COLORS.gold, fontStyle: "bold" as const };
  const common = { margin: { left: margin, right: margin }, styles: { fontSize: 8, cellPadding: 1.8 }, headStyles: head, alternateRowStyles: { fillColor: PDF_COLORS.lightBg } };
  const after = () => ((doc as any).lastAutoTable?.finalY ?? y) + 8;

  autoTable(doc, {
    ...common, startY: y,
    head: [["Registered Students", "Karate", "Silambam", "Total Amount", "Paid Amount", "Pending Amount", "Confirmed", "Pending", "Rejected"]],
    body: [[t.students, t.karate, t.silambam, formatINRPdf(t.totalAmount), formatINRPdf(t.paidAmount), formatINRPdf(t.pendingAmount), t.confirmedCount, t.pendingCount, t.rejectedCount]],
  });
  y = after();
  if (t.missingFee > 0) {
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.red);
    doc.text(`${t.missingFee} registration(s) have no stored fee and contribute Rs. 0 to the totals.`, margin, y - 4);
  }

  const breakdown = transitionBreakdown(ctx.rows);
  if (breakdown.length > 0) {
    autoTable(doc, {
      ...common, startY: y,
      head: [["Belt / Stage Transition", "Students", "Total Fees", "Paid", "Pending"]],
      body: breakdown.map((b) => [b.label, b.count, formatINRPdf(b.fee), formatINRPdf(b.paid), formatINRPdf(b.pending)]),
    });
    y = after();
  }

  const coaches = coachSummary(ctx.rows);
  autoTable(doc, {
    ...common, startY: y,
    head: [["Coach", "School", "Students", "Total Fees", "Paid", "Pending"]],
    body: [
      ...coaches.map((c) => [c.coach, c.school, c.students, formatINRPdf(c.totalAmount), formatINRPdf(c.paidAmount), formatINRPdf(c.pendingAmount)]),
      ["TOTAL", "", t.students, formatINRPdf(t.totalAmount), formatINRPdf(t.paidAmount), formatINRPdf(t.pendingAmount)],
    ],
    didParseCell: (d) => { if (d.row.index === coaches.length) d.cell.styles.fontStyle = "bold"; },
  });
  y = after();

  const schools = schoolSummary(ctx.rows);
  if (schools.length > 1 || ctx.filters.school === "all") {
    autoTable(doc, {
      ...common, startY: y,
      head: [["School", "Coaches", "Students", "Total Fees", "Paid", "Pending"]],
      body: [
        ...schools.map((s) => [s.school, s.coaches, s.students, formatINRPdf(s.totalAmount), formatINRPdf(s.paidAmount), formatINRPdf(s.pendingAmount)]),
        ["TOTAL", "", t.students, formatINRPdf(t.totalAmount), formatINRPdf(t.paidAmount), formatINRPdf(t.pendingAmount)],
      ],
      didParseCell: (d) => { if (d.row.index === schools.length) d.cell.styles.fontStyle = "bold"; },
    });
    y = after();
  }

  autoTable(doc, {
    ...common, startY: y,
    head: [["Student", "ID", "School", "Coach", "Exam", "Current", "Transition", "Fee", "Paid", "Balance", "Status", "Paid On", "Reference"]],
    body: [
      ...ctx.rows.map((r) => [
        r.name, r.id, r.school, r.coach, r.program === "KARATE" ? "Karate" : "Silambam", r.currentLevel, r.transitionLabel,
        r.fee === null ? "N/A" : formatINRPdf(r.fee), formatINRPdf(r.paid), formatINRPdf(r.balance),
        statusLabel(r.status), r.paymentDate ? r.paymentDate.slice(0, 10) : "-", r.reference || "-",
      ]),
      ["TOTAL", "", "", "", "", "", "", formatINRPdf(t.totalAmount), formatINRPdf(t.paidAmount), formatINRPdf(t.pendingAmount), "", "", ""],
    ],
    styles: { fontSize: 7, cellPadding: 1.4 },
    didParseCell: (d) => { if (d.row.index === ctx.rows.length) d.cell.styles.fontStyle = "bold"; },
  });

  const pages = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 6, { align: "right" });
    doc.text("Team Shadow Kai - Payment & Student Registration Report", margin, pageH - 6);
  }

  const name = reportFilename(ctx, "pdf", now);
  doc.save(name);
  return name;
}

export async function exportPaymentExcel(ctx: ExportContext): Promise<string> {
  const XLSX = await import("xlsx");
  const now = new Date();
  const t = totalsOf(ctx.rows);
  const wb = XLSX.utils.book_new();

  const money = (ws: any, cols: number[], fromRow: number, toRow: number) => {
    for (let r = fromRow; r <= toRow; r++) {
      for (const c of cols) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.t === "n") cell.z = "#,##0";
      }
    }
  };
  const widths = (ws: any, w: number[]) => { ws["!cols"] = w.map((wch) => ({ wch })); };

  // Sheet 1 - Summary
  const summary: any[][] = [
    ["Payment & Student Registration Report"],
    ["Generated", timeStamp(now)],
    ["Filters", ctx.filterLines.length ? ctx.filterLines.join(" | ") : "None (all records)"],
    [],
    ["Registered Students", t.students],
    ["Karate Students", t.karate],
    ["Silambam Students", t.silambam],
    ["Total Registration Amount (INR)", t.totalAmount],
    ["Total Paid (INR)", t.paidAmount],
    ["Total Pending (INR)", t.pendingAmount],
    ["Confirmed Payments", t.confirmedCount],
    ["Pending Payments", t.pendingCount],
    ["Rejected Payments", t.rejectedCount],
    ["Registrations without a stored fee", t.missingFee],
  ];
  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  money(wsSum, [1], 7, 9);
  widths(wsSum, [38, 60]);
  XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

  // Sheet 2 - Student Details (one row per registration)
  const dHead = ["Student Name", "Registration ID", "School", "Coach", "Exam Type", "Current Belt/Stage", "Transition", "Registration Fee (INR)", "Amount Paid (INR)", "Pending Balance (INR)", "Payment Status", "Payment Date", "Payment Method", "Payment Reference"];
  const dRows = ctx.rows.map((r) => [
    safeCell(r.name), safeCell(r.id), safeCell(r.school), safeCell(r.coach), r.program === "KARATE" ? "Karate" : "Silambam",
    safeCell(r.currentLevel), safeCell(r.transitionLabel), r.fee === null ? "N/A" : r.fee, r.paid, r.balance,
    statusLabel(r.status), r.paymentDate ? r.paymentDate.slice(0, 10) : "", safeCell(r.method), safeCell(r.reference),
  ]);
  const wsDet = XLSX.utils.aoa_to_sheet([dHead, ...dRows, ["TOTAL", "", "", "", "", "", "", t.totalAmount, t.paidAmount, t.pendingAmount, "", "", "", ""]]);
  money(wsDet, [7, 8, 9], 1, dRows.length + 1);
  widths(wsDet, [24, 26, 26, 22, 11, 18, 26, 20, 17, 20, 14, 13, 14, 22]);
  wsDet["!autofilter"] = { ref: `A1:N${dRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, wsDet, "Student Details");

  // Sheet 3 - Coach Summary
  const coaches = coachSummary(ctx.rows);
  const cRows = coaches.map((c) => [safeCell(c.coach), safeCell(c.school), c.students, c.karate, c.silambam, c.totalAmount, c.paidAmount, c.pendingAmount]);
  const wsCoach = XLSX.utils.aoa_to_sheet([
    ["Coach", "School", "Students", "Karate", "Silambam", "Total Fees (INR)", "Paid (INR)", "Pending (INR)"],
    ...cRows,
    ["TOTAL", "", t.students, t.karate, t.silambam, t.totalAmount, t.paidAmount, t.pendingAmount],
  ]);
  money(wsCoach, [5, 6, 7], 1, cRows.length + 1);
  widths(wsCoach, [26, 28, 10, 9, 10, 18, 14, 15]);
  wsCoach["!autofilter"] = { ref: `A1:H${cRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, wsCoach, "Coach Summary");

  // Sheet 4 - School Summary
  const schools = schoolSummary(ctx.rows);
  const sRows = schools.map((s) => [safeCell(s.school), s.coaches, s.students, s.karate, s.silambam, s.totalAmount, s.paidAmount, s.pendingAmount]);
  const wsSchool = XLSX.utils.aoa_to_sheet([
    ["School", "Coaches", "Students", "Karate", "Silambam", "Total Fees (INR)", "Paid (INR)", "Pending (INR)"],
    ...sRows,
    ["TOTAL", "", t.students, t.karate, t.silambam, t.totalAmount, t.paidAmount, t.pendingAmount],
  ]);
  money(wsSchool, [5, 6, 7], 1, sRows.length + 1);
  widths(wsSchool, [30, 9, 10, 9, 10, 18, 14, 15]);
  wsSchool["!autofilter"] = { ref: `A1:H${sRows.length + 1}` };
  XLSX.utils.book_append_sheet(wb, wsSchool, "School Summary");

  const name = reportFilename(ctx, "xlsx", now);
  XLSX.writeFile(wb, name);
  return name;
}
