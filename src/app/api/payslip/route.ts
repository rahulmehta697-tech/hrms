import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { pdfStart, pdfFinish, pdfs, TABLE, autoTable } from "@/lib/files";
import { apiUser, deny, fileResponse, slug } from "@/lib/api";
import { can } from "@/lib/auth";
import { monthLabel } from "@/lib/dates";

export const dynamic = "force-dynamic";
const rs = (n: number) => "Rs " + Math.round(n).toLocaleString("en-IN");

export async function GET(req: Request) {
  const u = await apiUser();
  if (!u) return deny("Sign in first.", 401);
  const p = new URL(req.url).searchParams;
  const m = p.get("m") || "", e = (p.get("e") || u.employeeId || "").toUpperCase();
  if (!/^\d{4}-\d{2}$/.test(m) || !e) return deny("Missing month or employee.", 400);
  const own = u.employeeId?.toUpperCase() === e;
  const payroll = await can(u, "payroll");
  if (!own && !payroll) return deny("You can only download your own payslip.");
  const run = (await db().select().from(schema.payrollRuns).where(eq(schema.payrollRuns.month, m)))[0];
  if (!payroll && (!run || run.step < 4)) return deny("This payslip has not been released yet.", 404);
  const line = (await db().select().from(schema.payrollLines).where(and(eq(schema.payrollLines.month, m), eq(schema.payrollLines.employeeId, e))))[0];
  const emp = (await db().select().from(schema.employees).where(eq(schema.employees.id, e)))[0];
  if (!line || !emp) return deny("No payslip for that month.", 404);
  const { org } = await getSettings();
  const d = line.data;
  const doc = pdfStart(org, `Payslip for ${monthLabel(m)}${run && run.step >= 4 ? "" : " (draft)"}`, u.name, false);
  const mask = (s?: string | null) => (s ? "****" + s.slice(-4) : "-");
  autoTable(doc, { ...TABLE, theme: "plain", startY: 124, styles: { fontSize: 9, cellPadding: 3 }, columnStyles: { 0: { textColor: [90, 103, 98] }, 2: { textColor: [90, 103, 98] } },
    body: [["Employee ID", `${org.prefix}-${emp.id}`, "Designation", pdfs(emp.designation)], ["Name", pdfs(emp.name), "Department", pdfs(emp.department)], ["PAN", emp.pan ? mask(emp.pan) : "-", "UAN", emp.uan || "-"], ["Bank account", mask(emp.bankAccount), "Paid days", `${d.paidDays} of ${d.days}${d.lop ? ` (LOP ${d.lop})` : ""}`]] });
  const n = Math.max(d.earnings.length, d.deductions.length);
  const body = Array.from({ length: n }, (_, i) => [pdfs(d.earnings[i]?.[0] || ""), d.earnings[i] ? rs(d.earnings[i][1]) : "", pdfs(d.deductions[i]?.[0] || ""), d.deductions[i] ? rs(d.deductions[i][1]) : ""]);
  body.push(["Gross earnings", rs(d.gross), "Total deductions", rs(d.ded)]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const last = () => (doc as any).lastAutoTable.finalY as number;
  autoTable(doc, { ...TABLE, theme: "grid", startY: last() + 14, head: [["Earnings", "Amount", "Deductions", "Amount"]], body, columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } }, didParseCell: (h) => { if (h.section === "body" && h.row.index === n) h.cell.styles.fontStyle = "bold"; } });
  const y = last() + 24;
  doc.setFillColor(220, 237, 230); doc.rect(40, y - 14, doc.internal.pageSize.getWidth() - 80, 28, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(22, 32, 28); doc.text(`Net pay: ${rs(d.net)}`, 50, y + 4);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90, 103, 98);
  if (d.employer.length) doc.text(pdfs("Employer contributions (not deducted): " + d.employer.map((x) => `${x[0]} ${rs(x[1])}`).join(", ")), 40, y + 30);
  doc.text("This is a system-generated payslip and does not need a signature.", 40, y + 44);
  return fileResponse(pdfFinish(doc, org), `${slug(org.short)}-payslip-${e.toLowerCase()}-${m}.pdf`);
}
