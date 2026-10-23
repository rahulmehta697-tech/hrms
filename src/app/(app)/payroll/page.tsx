import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { activeList, getSettings } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { fdt, inr, monthLabel, nowIn } from "@/lib/dates";
import { addPayInput, deletePayInput, payrollAction } from "@/app/actions/hr";
import DataBar from "@/components/DataBar";
import { Flash, Head, Ico, Stat } from "@/components/ui";

const STEPS = [["Compute salaries", "Earnings, loss of pay, PF, ESI, TDS and inputs"], ["HR review", "HR checks the register and exceptions"], ["Accounts approval", "Accounts signs off the totals"], ["Close and release", "Payslips become visible to staff"]];

export default async function Payroll({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("payroll");
  const sp = await searchParams;
  const { org } = await getSettings();
  const m = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : nowIn(org.tz).date.slice(0, 7);
  const run = (await db().select().from(schema.payrollRuns).where(eq(schema.payrollRuns.month, m)))[0];
  const step = run?.step || 0;
  const lines = await db().select({ l: schema.payrollLines, e: schema.employees }).from(schema.payrollLines).leftJoin(schema.employees, eq(schema.employees.id, schema.payrollLines.employeeId)).where(eq(schema.payrollLines.month, m)).orderBy(asc(schema.payrollLines.employeeId));
  const inputs = await db().select({ i: schema.payInputs, n: schema.employees.name }).from(schema.payInputs).leftJoin(schema.employees, eq(schema.employees.id, schema.payInputs.employeeId)).where(eq(schema.payInputs.month, m));
  const tot = (f: (d: (typeof lines)[number]["l"]["data"]) => number) => lines.reduce((s, x) => s + f(x.l.data), 0);
  const sumD = (n: string) => tot((d) => d.deductions.find((x) => x[0] === n)?.[1] || 0);
  const noBank = lines.filter((x) => !x.e?.bankAccount).length;
  const lop = lines.filter((x) => x.l.data.lop > 0).length;
  const withStruct = Number((await db().selectDistinct({ e: schema.salaryStructure.employeeId }).from(schema.salaryStructure)).length);
  const comps = [...(await activeList("sal")), "LOP days"];
  const regBar = await barFor(u, "payroll-register"), bankBar = await barFor(u, "bank-file"), inBar = await barFor(u, "pay-inputs"), salBar = await barFor(u, "salary");
  const action = (act: string, label: string, primary = true) => <form action={payrollAction}><input type="hidden" name="month" value={m} /><input type="hidden" name="act" value={act} /><button className={"btn " + (primary ? "primary" : "")} type="submit">{label}</button></form>;
  return (
    <>
      <Head title={`Payroll · ${monthLabel(m)}`} sub={`${withStruct} employees have a salary structure. Salary structures can be imported from Excel.`}>
        <div className="row">
          <form className="row"><input className="inp" type="month" name="m" defaultValue={m} aria-label="Month" style={{ width: 170 }} /><button className="btn sm" type="submit">Open</button></form>
          <DataBar ds="salary" label="Salary structures" importLabel="salary structures" {...salBar} />
        </div>
      </Head>
      <Flash sp={sp} />
      <div className="steps">{STEPS.map(([t, s], i) => <div key={t} className={i < step ? "done" : i === step ? "cur" : ""}><b>{t}</b><small>{i < step ? "Done" : s}</small></div>)}</div>
      <div className="row">
        {step <= 1 && action("compute", step === 1 ? "Recompute" : "Compute salaries")}
        {step >= 1 && step < 4 && action("next", step === 1 ? "Mark HR reviewed" : step === 2 ? "Accounts approve" : "Close and release payslips")}
        {step >= 2 && action("reopen", "Reopen for changes", false)}
        {run?.history.length ? <span className="hint">Last: {run.history.at(-1)!.action} by {run.history.at(-1)!.by}, {fdt(run.history.at(-1)!.at, org.tz)}</span> : null}
      </div>
      {lines.length > 0 && <>
        <div className="grid g4"><Stat n={inr(tot((d) => d.gross))} label="gross earnings" /><Stat n={inr(tot((d) => d.ded))} label="deductions" /><Stat n={inr(tot((d) => d.net))} label="net to bank" /><Stat n={lines.length} label="employees paid" /></div>
        <div className="grid g2">
          <div className="card"><h2>Needs a look</h2><div className="list">
            <div><span>Employees with loss-of-pay days</span><span className="pill p-warn">{lop}</span></div>
            <div><span>No bank account on record</span><span className={"pill " + (noBank ? "p-bad" : "p-ok")}>{noBank}</span></div>
            <div><span>Variable inputs this month</span><span className="pill p-info">{inputs.length}</span></div></div></div>
          <div className="card"><h2>Statutory</h2><div className="list">
            <div><span>Provident fund (employee)</span><span className="num">{inr(sumD("Provident fund"))}</span></div>
            <div><span>ESI (employee)</span><span className="num">{inr(sumD("ESI"))}</span></div>
            <div><span>Income tax (TDS)</span><span className="num">{inr(sumD("Income tax (TDS)"))}</span></div>
            <div><span>Employer PF + ESI</span><span className="num">{inr(tot((d) => d.employer.reduce((s, x) => s + x[1], 0)))}</span></div></div></div>
        </div>
      </>}
      <div className="card"><div className="row between" style={{ marginBottom: 12 }}><div><h2>Variable inputs</h2><p className="hint" style={{ margin: "4px 0 0" }}>Arrears, allowances, one-off deductions, and “LOP days” for loss of pay. Recompute after changes.</p></div><DataBar ds="pay-inputs" params={`m=${m}`} importLabel="payroll inputs" canImport={inBar.canImport && step < 2} canExport={inBar.canExport} /></div>
        {inputs.length > 0 && <div className="tw"><table><thead><tr><th>Employee</th><th>Component</th><th className="r">Amount</th><th>Remarks</th><th></th></tr></thead><tbody>{inputs.map(({ i, n }) => <tr key={i.id}><td>{n}<div className="hint mono">{org.prefix}-{i.employeeId}</div></td><td>{i.component}</td><td className="r num">{i.component === "LOP days" ? `${i.amount} days` : inr(Number(i.amount))}</td><td className="muted">{i.remarks}</td><td>{step < 2 && <form action={deletePayInput}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="month" value={m} /><button className="btn sm" type="submit">Remove</button></form>}</td></tr>)}</tbody></table></div>}
        {step < 2 && <form action={addPayInput} className="row" style={{ marginTop: 12, alignItems: "end" }}>
          <input type="hidden" name="month" value={m} />
          <div className="fld" style={{ flex: "0 1 160px" }}><label htmlFor="employeeId">Employee ID</label><input id="employeeId" name="employeeId" required placeholder="F-1042" /></div>
          <div className="fld" style={{ flex: "1 1 200px" }}><label htmlFor="component">Component</label><select id="component" name="component">{comps.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="fld" style={{ flex: "0 1 130px" }}><label htmlFor="amount">Amount</label><input id="amount" name="amount" type="number" step="0.5" required /></div>
          <div className="fld" style={{ flex: "1 1 200px" }}><label htmlFor="remarks">Remarks</label><input id="remarks" name="remarks" /></div>
          <button className="btn primary" type="submit">Add input</button>
        </form>}
      </div>
      <div className="card"><div className="row between" style={{ marginBottom: 12 }}><h2>Payroll register</h2>{lines.length > 0 && <div className="row" style={{ gap: 16 }}><DataBar ds="payroll-register" label="Register" params={`m=${m}`} canExport={regBar.canExport} /><DataBar ds="bank-file" label="Bank list" params={`m=${m}`} canExport={bankBar.canExport} /></div>}</div>
        {lines.length ? <div className="tw"><table><thead><tr><th>Employee</th><th className="r">Paid days</th><th className="r">Gross</th><th className="r">Deductions</th><th className="r">Net pay</th><th></th></tr></thead>
          <tbody>{lines.slice(0, 200).map(({ l, e }) => <tr key={l.employeeId}><td>{e?.name}<div className="hint mono">{org.prefix}-{l.employeeId}</div></td><td className="r num">{l.data.paidDays}/{l.data.days}</td><td className="r num">{inr(l.data.gross)}</td><td className="r num">{inr(l.data.ded)}</td><td className="r num"><b>{inr(l.data.net)}</b></td><td><a className="btn sm" href={`/api/payslip?m=${m}&e=${l.employeeId}`}>{Ico.pdf}Payslip</a></td></tr>)}</tbody></table></div>
          : <div className="empty">Not computed yet. Add salary structures, then press Compute salaries.</div>}
        {lines.length > 200 && <p className="hint">Showing 200 of {lines.length}. Export the register for the full list.</p>}
      </div>
    </>
  );
}
