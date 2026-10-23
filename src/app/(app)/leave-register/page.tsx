import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, can } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { fd } from "@/lib/dates";
import DataBar from "@/components/DataBar";
import { Flash, Head, Pager, Pill } from "@/components/ui";

const SIZE = 50;
export default async function LeaveRegister({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser();
  if (!(await can(u, "employees")) && !(await can(u, "attendance"))) redirect("/?err=" + encodeURIComponent("You don't have access to that page."));
  const sp = await searchParams;
  const { org } = await getSettings();
  const tab = sp.tab === "opening" ? "opening" : "requests";
  const st = sp.status || "", q = (sp.q || "").trim(), page = Math.max(1, Number(sp.p) || 1);
  const leaveBar = await barFor(u, "leave"), openBar = await barFor(u, "leave-opening");
  const conds: SQL[] = [];
  if (st) conds.push(eq(schema.leaveRequests.status, st));
  if (q) conds.push(or(ilike(schema.employees.name, `%${q}%`), ilike(schema.leaveRequests.employeeId, `%${q}%`))!);
  const reqs = tab === "requests" ? await db().select({ l: schema.leaveRequests, n: schema.employees.name, d: schema.employees.department }).from(schema.leaveRequests).leftJoin(schema.employees, eq(schema.employees.id, schema.leaveRequests.employeeId)).where(conds.length ? and(...conds) : undefined).orderBy(desc(schema.leaveRequests.fromDate)).limit(1000) : [];
  const open = tab === "opening" ? await db().select({ o: schema.leaveOpening, n: schema.employees.name }).from(schema.leaveOpening).leftJoin(schema.employees, eq(schema.employees.id, schema.leaveOpening.employeeId)).where(q ? or(ilike(schema.employees.name, `%${q}%`), ilike(schema.leaveOpening.employeeId, `%${q}%`)) : undefined).limit(1000) : [];
  const qs = (p: number) => "/leave-register?" + new URLSearchParams({ tab, ...(st && { status: st }), ...(q && { q }), p: String(p) });
  return (
    <>
      <Head title="Leave register" sub="All leave across the institute, plus opening balances carried forward from your old records.">
        {tab === "requests" ? <DataBar ds="leave" params={st ? `status=${st}` : ""} importLabel="leave records" {...leaveBar} /> : <DataBar ds="leave-opening" importLabel="opening balances" {...openBar} />}
      </Head>
      <Flash sp={sp} />
      <div className="tabs"><a href="/leave-register" aria-current={tab === "requests" ? "page" : undefined}>Leave requests</a><a href="/leave-register?tab=opening" aria-current={tab === "opening" ? "page" : undefined}>Opening balances</a></div>
      <form className="row" style={{ alignItems: "end" }}>
        <input type="hidden" name="tab" value={tab} />
        <div className="fld" style={{ flex: "1 1 220px" }}><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Name or ID" /></div>
        {tab === "requests" && <div className="fld" style={{ flex: "0 1 180px" }}><label htmlFor="status">Status</label><select id="status" name="status" defaultValue={st}><option value="">All</option><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></div>}
        <button className="btn" type="submit">Filter</button>
      </form>
      <div className="card">
        {tab === "requests" ? (reqs.length ? <div className="tw"><table><thead><tr><th>Request</th><th>Employee</th><th>Type</th><th>Dates</th><th className="r">Days</th><th>Status</th></tr></thead>
          <tbody>{reqs.slice((page - 1) * SIZE, page * SIZE).map(({ l, n, d }) => <tr key={l.id}><td className="mono">LV-{l.id}</td><td>{n || l.employeeId}<div className="hint">{d} · <span className="mono">{org.prefix}-{l.employeeId}</span></div></td><td>{l.type}</td><td className="num">{fd(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fd(l.toDate) : ""}</td><td className="r num">{l.days}</td><td><Pill s={l.status} />{l.status === "pending" && <div className="hint">with {l.chain[l.level]}</div>}</td></tr>)}</tbody></table></div> : <div className="empty">No leave records match.</div>)
          : (open.length ? <div className="tw"><table><thead><tr><th>Employee</th><th>Leave type</th><th className="r">Leave year</th><th className="r">Opening balance</th></tr></thead>
            <tbody>{open.slice((page - 1) * SIZE, page * SIZE).map(({ o, n }) => <tr key={o.employeeId + o.type + o.year}><td>{n || o.employeeId}<div className="hint mono">{org.prefix}-{o.employeeId}</div></td><td>{o.type}</td><td className="r num">{o.year}</td><td className="r num">{o.opening}</td></tr>)}</tbody></table></div> : <div className="empty">No opening balances yet. Import them from your old records so balances start correctly.</div>)}
        <Pager page={page} total={tab === "requests" ? reqs.length : open.length} size={SIZE} href={qs} />
      </div>
    </>
  );
}
