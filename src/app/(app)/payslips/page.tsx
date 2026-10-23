import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getEmployee } from "@/lib/logic";
import { inr, monthLabel } from "@/lib/dates";
import { Head, Ico } from "@/components/ui";

export default async function Payslips({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const emp = await getEmployee(u.employeeId);
  if (!emp) return <><Head title="Payslips" /><div className="empty">Your login is not linked to an employee record.</div></>;
  const { org } = await getSettings();
  const all = await db().select({ l: schema.payrollLines }).from(schema.payrollLines).innerJoin(schema.payrollRuns, eq(schema.payrollRuns.month, schema.payrollLines.month)).where(and(eq(schema.payrollLines.employeeId, emp.id), gte(schema.payrollRuns.step, 4))).orderBy(desc(schema.payrollLines.month)).limit(36);
  if (!all.length) return <><Head title="Payslips" /><div className="card"><div className="empty">No payslips have been released to you yet.</div></div></>;
  const cur = all.find((x) => x.l.month === sp.m)?.l || all[0].l, d = cur.data;
  return (
    <>
      <Head title="Payslips" sub={<>{emp.name} · <span className="mono">{org.prefix}-{emp.id}</span>{emp.uan ? <> · UAN <span className="mono">{emp.uan}</span></> : null}</>}>
        <a className="btn" href={`/api/payslip?m=${cur.month}`}>{Ico.pdf}Download PDF</a>
      </Head>
      <div className="row">{all.map((x) => <a key={x.l.month} className={"pill " + (x.l.month === cur.month ? "p-info" : "p-mute")} style={{ textDecoration: "none" }} href={`/payslips?m=${x.l.month}`}>{monthLabel(x.l.month)}</a>)}</div>
      <div className="card"><div className="row between" style={{ marginBottom: 14 }}><h2>{monthLabel(cur.month)}</h2><span className="hint">Paid days {d.paidDays} of {d.days}{d.lop ? ` · loss of pay ${d.lop}` : ""}</span></div>
        <div className="slip">
          <div><div className="label" style={{ marginBottom: 4 }}>Earnings</div>{d.earnings.map((x) => <div className="ln" key={x[0]}><span>{x[0]}</span><span>{inr(x[1])}</span></div>)}<div className="ln tot"><span>Gross earnings</span><span>{inr(d.gross)}</span></div></div>
          <div><div className="label" style={{ marginBottom: 4 }}>Deductions</div>{d.deductions.map((x) => <div className="ln" key={x[0]}><span>{x[0]}</span><span>{inr(x[1])}</span></div>)}<div className="ln tot"><span>Total deductions</span><span>{inr(d.ded)}</span></div>
            {d.employer.length > 0 && <p className="hint">Employer contributions (not deducted): {d.employer.map((x) => `${x[0]} ${inr(x[1])}`).join(", ")}</p>}</div>
        </div>
        <div className="net" style={{ marginTop: 16 }}><span>Net pay</span><b>{inr(d.net)}</b></div>
      </div>
    </>
  );
}
