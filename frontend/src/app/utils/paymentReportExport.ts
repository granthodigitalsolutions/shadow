import {
  PaymentRow, ReportFilters, totalsOf, coachSummary, schoolSummary, transitionSummary, coachSections,
  assertReportReconciles, pdfSafe, formatINRPdf, safeCell, sanitizeFilename, statusLabel,
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
  /** Label/value pairs for the PDF "Applied Filters" table ("All" when not set). */
  filterItems?: [string, string][];
  /** Transition ids in configured order (Karate then Silambam) for the transition summary. */
  transitionOrder?: string[];
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
  // Refuse to produce a PDF whose sections disagree with each other.
  assertReportReconciles(ctx.rows, ctx.transitionOrder);

  const [pdfMod, tableMod]: any[] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  // Named export in the browser build; the Node build nests it under default.
  const jsPDF = pdfMod.jsPDF || pdfMod.default?.jsPDF || pdfMod.default;
  const autoTable = tableMod.default?.default || tableMod.default || tableMod.autoTable;

  const now = new Date();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const bottom = 14; // room for the footer
  const t = totalsOf(ctx.rows);
  const S = pdfSafe;
  const money = (n: number) => formatINRPdf(n);

  let y = drawBrandHeader(doc, {
    pageWidth: pageW,
    title: "PAYMENT & STUDENT REGISTRATION REPORT",
    subtitle: `Generated: ${timeStamp(now)}`,
    height: 28,
    margin,
  }) + 8;

  // Starts a new page when fewer than `needed` mm remain, so a heading is never
  // stranded at the bottom away from its table.
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - bottom) { doc.addPage(); y = 16; }
  };
  const heading = (text: string, sub?: string) => {
    ensureSpace(36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...PDF_COLORS.primary);
    doc.text(S(text), margin, y);
    y += 2;
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...PDF_COLORS.gray);
      doc.text(S(sub), margin, y + 4);
      y += 8;
    }
    y += 3;
  };

  const base = {
    margin: { left: margin, right: margin, bottom },
    styles: { fontSize: 8.5, cellPadding: 2.2, overflow: "linebreak" as const, valign: "middle" as const },
    headStyles: { fillColor: PDF_COLORS.primary, textColor: PDF_COLORS.gold, fontStyle: "bold" as const },
    alternateRowStyles: { fillColor: PDF_COLORS.lightBg },
    rowPageBreak: "avoid" as const, // never split a row across pages
    showHead: "everyPage" as const, // repeat column headers on every page
  };
  const after = (gap = 9) => { y = ((doc as any).lastAutoTable?.finalY ?? y) + gap; };
  // Column indexes of the table being drawn that hold numbers (set by right()).
  let rightCols: number[] = [];
  const boldRow = (rowIndex: number) => (d: any) => {
    // Header cells must follow their numeric column's alignment.
    if (d.section === "head" && rightCols.includes(d.column.index)) d.cell.styles.halign = "right";
    if (d.section === "body" && d.row.index === rowIndex) {
      d.cell.styles.fontStyle = "bold";
      d.cell.styles.fillColor = [229, 231, 235];
    }
  };
  const right = (cols: number[]) => {
    rightCols = cols;
    const o: Record<number, any> = {};
    cols.forEach((c) => { o[c] = { halign: "right" }; });
    return o;
  };

  // 1. Applied filters ------------------------------------------------------------
  const items = ctx.filterItems && ctx.filterItems.length
    ? ctx.filterItems
    : ([["School", "All"], ["Coach", "All"], ["Exam Type", "All"], ["Belt / Stage Transition", "All"], ["Payment Status", "All"], ["Registration Date", "All"]] as [string, string][]);
  heading("Applied Filters");
  autoTable(doc, {
    ...base, startY: y,
    head: [items.map(([k]) => S(k))],
    body: [items.map(([, v]) => S(v))],
  });
  after();

  // 2. Overall summary --------------------------------------------------------------
  heading("Overall Registration & Payment Summary");
  autoTable(doc, {
    ...base, startY: y,
    head: [["Registered Students", "Karate", "Silambam", "Total Fees", "Total Paid", "Total Pending", "Confirmed", "Pending", "Rejected"]],
    body: [[t.students, t.karate, t.silambam, money(t.totalAmount), money(t.paidAmount), money(t.pendingAmount), t.confirmedCount, t.pendingCount, t.rejectedCount]],
    columnStyles: right([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    didParseCell: boldRow(-1),
  });
  after(4);
  if (t.missingFee > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_COLORS.red);
    doc.text(`${t.missingFee} registration(s) have no stored fee: they are counted as students and add Rs. 0 to every amount.`, margin, y + 3);
    y += 8;
  } else {
    y += 4;
  }

  // 3. Belt / stage transition summary ------------------------------------------------
  const trans = transitionSummary(ctx.rows, ctx.transitionOrder);
  heading("Belt / Stage Transition Summary");
  autoTable(doc, {
    ...base, startY: y,
    head: [["Exam Type", "Belt / Stage Transition", "Students", "Total Fees", "Paid", "Pending", "Confirmed", "Pending", "Rejected"]],
    body: [
      ...trans.map((r) => [
        r.program === "KARATE" ? "Karate" : "Silambam",
        S(r.label) + (r.source === "unmapped" ? " (unmapped)" : ""),
        r.students, money(r.totalAmount), money(r.paidAmount), money(r.pendingAmount), r.confirmedCount, r.pendingCount, r.rejectedCount,
      ]),
      ["TOTAL", "", t.students, money(t.totalAmount), money(t.paidAmount), money(t.pendingAmount), t.confirmedCount, t.pendingCount, t.rejectedCount],
    ],
    columnStyles: right([2, 3, 4, 5, 6, 7, 8]),
    didParseCell: boldRow(trans.length),
  });
  after();

  // 4. Coach-wise summary --------------------------------------------------------------
  const coaches = coachSummary(ctx.rows);
  heading("Coach-Wise Registration & Payment Summary");
  autoTable(doc, {
    ...base, startY: y,
    head: [["Coach", "School", "Students", "Total Fees", "Paid", "Pending", "Confirmed", "Pending", "Rejected"]],
    body: [
      ...coaches.map((c) => [S(c.coachId ? c.coach : "Unassigned Coach"), S(c.school), c.students, money(c.totalAmount), money(c.paidAmount), money(c.pendingAmount), c.confirmedCount, c.pendingCount, c.rejectedCount]),
      ["TOTAL", "", t.students, money(t.totalAmount), money(t.paidAmount), money(t.pendingAmount), t.confirmedCount, t.pendingCount, t.rejectedCount],
    ],
    columnStyles: right([2, 3, 4, 5, 6, 7, 8]),
    didParseCell: boldRow(coaches.length),
  });
  after();

  // School summary - only useful when the report spans several schools.
  const schools = schoolSummary(ctx.rows);
  if (schools.length > 1) {
    heading("School-Wise Summary");
    autoTable(doc, {
      ...base, startY: y,
      head: [["School", "Coaches", "Students", "Total Fees", "Paid", "Pending", "Confirmed", "Pending", "Rejected"]],
      body: [
        ...schools.map((s) => [S(s.school), s.coaches, s.students, money(s.totalAmount), money(s.paidAmount), money(s.pendingAmount), s.confirmedCount, s.pendingCount, s.rejectedCount]),
        ["TOTAL", "", t.students, money(t.totalAmount), money(t.paidAmount), money(t.pendingAmount), t.confirmedCount, t.pendingCount, t.rejectedCount],
      ],
      columnStyles: right([1, 2, 3, 4, 5, 6, 7, 8]),
      didParseCell: boldRow(schools.length),
    });
    after();
  }

  // 5. Student details, one section per coach ---------------------------------------------
  const sections = coachSections(ctx.rows);
  heading("Student Details by Coach", `${sections.length} coach section${sections.length === 1 ? "" : "s"} - each student appears once, under the coach on their registration.`);
  sections.forEach((sec, i) => {
    // Keep the coach heading with at least the table header and first rows.
    ensureSpace(46);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PDF_COLORS.primary);
    doc.text(S(`Coach ${i + 1} - ${sec.coach}`), margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text(S(`School: ${sec.schools.join(", ")}`), margin, y + 5);
    y += 8;

    const multiSchool = sec.schools.length > 1;
    const head = ["Student", "Registration ID", "Exam", "Current Belt", "Belt / Stage Transition", ...(multiSchool ? ["School"] : []), "Fee", "Paid", "Balance", "Status"];
    const n = head.length;
    const moneyCols = [n - 4, n - 3, n - 2];
    const body: any[][] = sec.rows.map((r) => [
      S(r.name), S(r.id), r.program === "KARATE" ? "Karate" : "Silambam", S(r.currentLevel), S(r.transitionLabel),
      ...(multiSchool ? [S(r.school)] : []),
      r.fee === null ? "N/A" : money(r.fee), money(r.paid), money(r.balance), statusLabel(r.status),
    ]);
    const st = sec.totals;
    body.push([
      { content: `Subtotal - ${st.students} student${st.students === 1 ? "" : "s"}   (Confirmed ${st.confirmedCount} | Pending ${st.pendingCount} | Rejected ${st.rejectedCount})`, colSpan: n - 4 },
      money(st.totalAmount), money(st.paidAmount), money(st.pendingAmount), "",
    ]);
    autoTable(doc, {
      ...base, startY: y,
      head: [head],
      body,
      styles: { ...base.styles, fontSize: 8, cellPadding: 1.9 },
      // Fixed widths (sum 269-273mm of the 273mm text area) keep columns aligned
      // across coach sections and stop transition names wrapping needlessly.
      columnStyles: {
        ...right(moneyCols),
        ...Object.fromEntries(
          (multiSchool ? [32, 30, 19, 18, 42, 42, 21, 21, 21, 25] : [38, 36, 21, 25, 52, 25, 25, 25, 26]).map((w, i) => [i, { ...(moneyCols.includes(i) ? { halign: "right" } : {}), cellWidth: w }]),
        ),
      },
      didParseCell: boldRow(body.length - 1),
    });
    after(11);
  });

  // 6. Grand totals ------------------------------------------------------------------------
  heading("Grand Totals");
  autoTable(doc, {
    ...base, startY: y,
    head: [["Registered Students", "Karate", "Silambam", "Total Fees", "Total Paid", "Total Pending", "Confirmed", "Pending", "Rejected"]],
    body: [[t.students, t.karate, t.silambam, money(t.totalAmount), money(t.paidAmount), money(t.pendingAmount), t.confirmedCount, t.pendingCount, t.rejectedCount]],
    columnStyles: right([0, 1, 2, 3, 4, 5, 6, 7, 8]),
    didParseCell: boldRow(0),
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.gray);
    doc.text("Team Shadow KAI - Payment & Student Registration Report", margin, pageH - 6);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 6, { align: "right" });
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
