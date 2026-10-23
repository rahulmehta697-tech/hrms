import { and, asc, ilike, ne, notInArray, or, sql, eq, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { ROLES, ROLE_KEYS } from "@/lib/config";
import { fdt } from "@/lib/dates";
import { savePolicy, userAction } from "@/app/actions/admin";
import { CreateLogin, ResetBtn } from "@/components/TempPw";
import BulkLogins from "@/components/BulkLogins";
import DataBar from "@/components/DataBar";
import { Flash, Head, Pager, Pill, Stat } from "@/components/ui";

const SIZE = 50;
export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireAdmin();
  const sp = await searchParams;
  const { org, pol } = await getSettings();
  const q = (sp.q || "").trim(), st = sp.st || "", page = Math.max(1, Number(sp.p) || 1);
  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(schema.users.name, `%${q}%`), ilike(schema.users.login, `%${q.replace(new RegExp("^" + org.prefix + "-", "i"), "")}%`))!);
  if (st) conds.push(eq(schema.users.status, st));
  const where = conds.length ? and(...conds) : undefined;
  const total = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.users).where(where))[0].c);
  const rows = await db().select().from(schema.users).where(where).orderBy(asc(schema.users.name)).limit(SIZE).offset((page - 1) * SIZE);
  const counts = await db().select({ s: schema.users.status, m: schema.users.mustChange, c: sql<number>`count(*)` }).from(schema.users).groupBy(schema.users.status, schema.users.mustChange);
  const n = (f: (x: (typeof counts)[number]) => boolean) => counts.filter(f).reduce((s, x) => s + Number(x.c), 0);
  const logins = (await db().select({ l: schema.users.login }).from(schema.users)).map((x) => x.l);
  const noLogin = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.employees).where(logins.length ? and(ne(schema.employees.status, "Exited"), notInArray(sql`upper(${schema.employees.id})`, logins)) : ne(schema.employees.status, "Exited")))[0].c);
  const bar = await barFor(u, "users");
  const roles = ROLE_KEYS.map((r) => [r, ROLES[r]] as [string, string]);
  const act = (id: number, a: string, label: string, danger = false) => <form action={userAction}><input type="hidden" name="id" value={id} /><input type="hidden" name="act" value={a} /><input type="hidden" name="q" value={q} /><button className={"btn sm" + (danger ? " danger" : "")} type="submit">{label}</button></form>;
  const qs = (p: number) => "/admin/users?" + new URLSearchParams({ ...(q && { q }), ...(st && { st }), p: String(p) });
  return (
    <>
      <Head tag="Settings" title="Users & passwords" sub="Everyone signs in with their employee ID and a password. Create, reset, unlock or disable logins here."><DataBar ds="users" {...bar} /></Head>
      <Flash sp={sp} />
      <div className="grid g4"><Stat n={n(() => true)} label="logins" /><Stat n={n((x) => x.m)} label="still on a temporary password" /><Stat n={n((x) => x.s === "Locked")} label="locked" /><Stat n={n((x) => x.s === "Disabled")} label="disabled" /></div>
      {noLogin > 0 && <div className="card"><BulkLogins count={noLogin} /></div>}
      <div className="card"><h2>Create one login</h2><CreateLogin prefix={org.prefix} roles={roles} /></div>
      <div className="card">
        <form className="row" style={{ marginBottom: 12, alignItems: "end" }}>
          <div className="fld" style={{ flex: "1 1 240px" }}><label htmlFor="q">Search logins</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Name or login ID" /></div>
          <div className="fld" style={{ flex: "0 1 160px" }}><label htmlFor="st">Status</label><select id="st" name="st" defaultValue={st}><option value="">All</option><option>Active</option><option>Locked</option><option>Disabled</option></select></div>
          <button className="btn" type="submit">Filter</button>
        </form>
        <div className="tw"><table style={{ minWidth: 820 }}><thead><tr><th>Login ID</th><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Actions</th></tr></thead>
          <tbody>{rows.map((x) => { const me = x.id === u.id; return (
            <tr key={x.id}><td className="mono">{x.login === "ADMIN" ? "admin" : `${org.prefix}-${x.login}`}</td><td>{x.name}</td>
              <td>{me ? ROLES[x.role as keyof typeof ROLES] : <form action={userAction} className="row" style={{ gap: 4 }}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="act" value="role" /><input type="hidden" name="q" value={q} /><select className="mini" name="role" defaultValue={x.role} aria-label={`Role for ${x.name}`}>{roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><button className="btn sm" type="submit">Set</button></form>}</td>
              <td><Pill s={x.status} />{x.mustChange && <> <span className="pill p-warn">Temp password</span></>}</td><td className="muted num">{fdt(x.lastLogin, org.tz)}</td>
              <td>{me ? <span className="hint">You</span> : <div className="row" style={{ gap: 4, alignItems: "start" }}>{x.status === "Locked" && act(x.id, "unlock", "Unlock")}<ResetBtn id={x.id} prefix={org.prefix} />{x.status === "Disabled" ? act(x.id, "enable", "Enable") : act(x.id, "disable", "Disable", true)}</div>}</td></tr>); })}</tbody></table></div>
        <Pager page={page} total={total} size={SIZE} href={qs} />
        <p className="hint">Passwords are stored encrypted and are never shown or exported. Temporary passwords appear once, right after you create or reset them.</p>
      </div>
      <form action={savePolicy} className="card stack"><h2>Password policy</h2><div className="f">
        <div className="fld"><label htmlFor="min">Minimum length</label><input id="min" name="min" type="number" min="6" max="32" defaultValue={pol.min} /></div>
        <div className="fld"><label htmlFor="complex">Require a letter, number and symbol</label><select id="complex" name="complex" defaultValue={pol.complex ? "yes" : "no"}><option value="yes">Yes</option><option value="no">No</option></select></div>
        <div className="fld"><label htmlFor="expiry">Password expiry</label><select id="expiry" name="expiry" defaultValue={String(pol.expiry)}><option value="0">Never</option><option value="60">Every 60 days</option><option value="90">Every 90 days</option><option value="180">Every 180 days</option></select></div>
        <div className="fld"><label htmlFor="lock">Lock after wrong attempts</label><select id="lock" name="lock" defaultValue={String(pol.lock)}><option>3</option><option>5</option><option>10</option></select></div>
        <div className="fld"><label htmlFor="session">Stay signed in for</label><select id="session" name="session" defaultValue={String(pol.session)}><option value="4">4 hours</option><option value="8">8 hours</option><option value="12">12 hours</option><option value="24">24 hours</option></select></div>
      </div><div><button className="btn primary" type="submit">Save policy</button></div></form>
    </>
  );
}
