import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm, can } from "@/lib/auth";
import { activeList, activeRows, getSettings } from "@/lib/settings";
import { balances, getEmployee } from "@/lib/logic";
import { fdt, inr } from "@/lib/dates";
import { setSalary } from "@/app/actions/hr";
import EmpForm from "@/components/EmpForm";
import { Flash, Head, Pill } from "@/components/ui";

export default async function EmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("employees");
  const { id } = await params;
  const sp = await searchParams;
  const e = await getEmployee(decodeURIComponent(id).toUpperCase());
  if (!e) notFound();
  const { org } = await getSettings();
  const opts = { desig: await activeList("desig"), dept: await activeList("dept"), cat: await activeList("cat"), shift: await activeList("shift") };
  const login = (await db().select().from(schema.users).where(eq(schema.users.login, e.id.toUpperCase())))[0];
  const pay = await can(u, "payroll");
  const sal = pay ? await db().select().from(schema.salaryStructure).where(eq(schema.salaryStructure.employeeId, e.id)) : [];
  const comps = await activeRows("sal");
  const kind = Object.fromEntries(comps.map((c) => [String(c.data[0]), String(c.data[1])]));
  const bal = await balances(e.id, e.category);
  return (
    <>
      <Head title={e.name} sub={<><span className="mono">{org.prefix}-{e.id}</span> · {e.designation} · {e.department}</>}><a className="btn sm" href="/employees">Back to list</a></Head>
      <Flash sp={sp} />
      <div className="grid g3">
        <div className="card"><h3>Portal login</h3>{login ? <div className="list"><div><span className="muted">Status</span><Pill s={login.status} /></div><div><span className="muted">Last sign-in</span><span>{fdt(login.lastLogin, org.tz)}</span></div></div> : <p className="muted" style={{ margin: 0 }}>No login yet. The Master Admin creates logins under Users & passwords.</p>}</div>
        <div className="card" style={{ gridColumn: "span 2" }}><h3>Leave balance · {bal.year.label}</h3><div className="bal">{bal.rows.map((r) => <div key={r.code}><b>{r.available}</b><small>{r.name}</small></div>)}</div></div>
      </div>
      <EmpForm e={e} opts={opts} isNew={false} prefix={org.prefix} />
      {pay && <div className="card" id="salary"><h2>Salary structure (monthly)</h2>
        <p className="hint" style={{ margin: "-6px 0 12px" }}>Full-month amounts. Provident fund, ESI and Employer PF are calculated automatically when added (enter 1 as the amount). Set an amount to 0 to remove a line.</p>
        {sal.length ? <div className="tw"><table style={{ minWidth: 400 }}><thead><tr><th>Component</th><th>Type</th><th className="r">Monthly amount</th></tr></thead><tbody>{sal.map((x) => <tr key={x.component}><td>{x.component}</td><td className="muted">{kind[x.component] || "Not in master"}</td><td className="r num">{["Provident fund", "ESI", "Employer PF"].includes(x.component) ? "Auto" : inr(Number(x.amount))}</td></tr>)}</tbody></table></div> : <div className="empty">No salary structure yet.</div>}
        <form action={setSalary} className="row" style={{ marginTop: 12, alignItems: "end" }}>
          <input type="hidden" name="id" value={e.id} />
          <div className="fld" style={{ flex: "1 1 220px" }}><label htmlFor="component">Component</label><select id="component" name="component">{comps.map((c) => <option key={c.id}>{String(c.data[0])}</option>)}</select></div>
          <div className="fld" style={{ flex: "0 1 160px" }}><label htmlFor="amount">Monthly amount</label><input id="amount" name="amount" type="number" min="0" step="1" required /></div>
          <button className="btn primary" type="submit">Save line</button>
        </form>
      </div>}
    </>
  );
}
