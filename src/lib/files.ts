import "server-only";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { Org } from "./config";
import { fdt } from "./dates";
import { PRODUCT } from "./product";

type Cell = string | number;

export async function toXlsx(org: Org, title: string, by: string, headers: string[], rows: Cell[][]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = org.name;
  const ws = wb.addWorksheet(title.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31));
  ws.addRow([org.name]).font = { bold: true, size: 14 };
  ws.addRow([title]).font = { bold: true, size: 12 };
  ws.addRow([`Generated ${fdt(new Date(), org.tz)} by ${by} · Powered by ${PRODUCT.name}`]).font = { italic: true, color: { argb: "FF5A6762" } };
  ws.addRow([]);
  const h = ws.addRow(headers);
  h.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17705C" } }; c.alignment = { vertical: "middle", wrapText: true }; });
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: headers.length } };
  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.columns.forEach((col, i) => { const len = Math.max(headers[i].length, ...rows.slice(0, 500).map((r) => String(r[i] ?? "").length)); col.width = Math.min(50, Math.max(10, len + 2)); });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Standard PDF fonts cannot draw ₹ and some punctuation. */
export const pdfs = (s: unknown) => String(s ?? "").replace(/₹/g, "Rs ").replace(/→/g, "->").replace(/[–—]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/≤/g, "<=").replace(/•/g, "*").replace(/…/g, "...").replace(/[^\x00-\xFF]/g, "?");

export function pdfStart(org: Org, title: string, by: string, landscape: boolean) {
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  let x = 40;
  if (org.logoPng) { try { doc.addImage(org.logoPng, "PNG", 40, 26, 42, 42); x = 92; } catch { /* ignore a bad logo */ } }
  doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(22, 32, 28); doc.text(pdfs(org.name), x, 44);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90, 103, 98); doc.text(pdfs(org.addr), x, 58);
  doc.setDrawColor(214, 223, 219); doc.line(40, 78, doc.internal.pageSize.getWidth() - 40, 78);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(22, 32, 28); doc.text(pdfs(title), 40, 98);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90, 103, 98); doc.text(pdfs(`Generated ${fdt(new Date(), org.tz)} by ${by}`), 40, 112);
  return doc;
}
export function pdfFinish(doc: jsPDF, org: Org) {
  const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(pdfs(org.name), 40, H - 22); doc.text(pdfs(`Powered by ${PRODUCT.name}`), W / 2, H - 22, { align: "center" }); doc.text(`Page ${i} of ${n}`, W - 40, H - 22, { align: "right" }); }
  return Buffer.from(doc.output("arraybuffer"));
}
export const TABLE = { styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" as const, textColor: [22, 32, 28] as [number, number, number] }, headStyles: { fillColor: [23, 112, 92] as [number, number, number], textColor: 255, fontStyle: "bold" as const }, alternateRowStyles: { fillColor: [243, 246, 245] as [number, number, number] }, margin: { left: 40, right: 40, bottom: 40 } };

export function toPdf(org: Org, title: string, by: string, headers: string[], rows: Cell[][]) {
  const doc = pdfStart(org, title, by, headers.length > 5);
  autoTable(doc, { ...TABLE, head: [headers.map(pdfs)], body: rows.map((r) => r.map((c) => pdfs(typeof c === "number" ? c.toLocaleString("en-IN") : c))), startY: 124 });
  return pdfFinish(doc, org);
}
export { autoTable };

export async function template(org: Org, title: string, headers: string[], help: string[], required: string[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  const h = ws.addRow(headers);
  h.eachCell((c) => { c.font = { bold: true }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEDE6" } }; });
  ws.columns.forEach((c, i) => { c.width = Math.max(14, headers[i].length + 4); });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  const ins = wb.addWorksheet("Instructions");
  ins.addRow([`${org.name} · ${title} import template · ${PRODUCT.name}`]).font = { bold: true, size: 13 };
  ins.addRow(["Fill the Data sheet from row 2. Keep the header row as it is. One row per record. Rows with problems are shown before anything is saved."]);
  ins.addRow([]);
  ins.addRow(["Column", "Required", "What to enter"]).font = { bold: true };
  headers.forEach((hd, i) => ins.addRow([hd, required.includes(hd) ? "Yes" : "No", help[i] || "Text"]));
  ins.columns = [{ width: 28 }, { width: 10 }, { width: 100 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------------- reading uploads ---------------- */
const pad = (n: number) => String(n).padStart(2, "0");
function cellText(v: ExcelJS.CellValue): Cell | Date {
  if (v == null) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellText((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ("error" in v) return "";
  }
  return v as Cell;
}
export function normCell(v: Cell | Date | boolean, type?: "date" | "time" | "num"): Cell {
  if (v instanceof Date) {
    // Excel stores dates without a zone; exceljs gives them as UTC.
    if (type === "time" || v.getUTCFullYear() < 1901) { const m = Math.round((v.getUTCHours() * 60 + v.getUTCMinutes() + v.getUTCSeconds() / 60)); return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; }
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (type === "time" && v >= 0 && v < 1) { const m = Math.round(v * 1440); return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }
    if (type === "date" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
    return type === "num" ? v : String(v);
  }
  let s = String(v).trim();
  if (type === "date") {
    let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (m) s = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
    if (m) s = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    const mm = s.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[a-z]*[\s\-,]+(\d{4})$/);
    if (mm) { const i = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(mm[2].toLowerCase()); if (i >= 0) s = `${mm[3]}-${pad(i + 1)}-${pad(+mm[1])}`; }
  }
  if (type === "time") { const m = s.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/); if (m) { let h = +m[1]; if (m[3]) { const pm = /p/i.test(m[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } s = `${pad(h)}:${m[2]}`; } }
  if (type === "num" && s !== "" && !isNaN(Number(s.replace(/,/g, "")))) return Number(s.replace(/,/g, ""));
  return s;
}
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === "," ) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
/** Returns the sheet as rows of raw cell values. */
export async function readUpload(name: string, buf: Buffer): Promise<(Cell | Date)[][]> {
  if (/\.csv$/i.test(name)) return parseCsv(buf.toString("utf8").replace(/^﻿/, ""));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets.find((w) => w.name !== "Instructions") || wb.worksheets[0];
  if (!ws) return [];
  const out: (Cell | Date)[][] = [];
  ws.eachRow({ includeEmpty: false }, (r) => { const vals: (Cell | Date)[] = []; for (let c = 1; c <= r.cellCount; c++) vals.push(cellText(r.getCell(c).value)); out.push(vals); });
  return out;
}
