import { desc, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { fdt } from "@/lib/dates";
import DataBar from "@/components/DataBar";
import { Head, Pager } from "@/components/ui";

const SIZE = 100;
export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireAdmin();
  const sp = await searchParams;
  const { org } = await getSettings();
  const q = (sp.q || "").trim(), page = Math.max(1, Number(sp.p) || 1);
  const where = q ? or(ilike(schema.audit.action, `%${q}%`), ilike(schema.audit.who, `%${q}%`)) : undefined;
  const total = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.audit).where(where))[0].c);
  const rows = await db().select().from(schema.audit).where(where).orderBy(desc(schema.audit.at)).limit(SIZE).offset((page - 1) * SIZE);
  const bar = await barFor(u, "audit");
  return (
    <>
      <Head tag="System" title="Change log" sub="Sign-ins, setting changes, approvals, imports and exports, newest first."><DataBar ds="audit" {...bar} /></Head>
      <div className="card">
        <form className="row" style={{ marginBottom: 12, alignItems: "end" }}><div className="fld" style={{ flex: "1 1 260px" }}><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Person or change" /></div><button className="btn" type="submit">Search</button></form>
        {rows.length ? <div className="list">{rows.map((a) => <div key={a.id}><div>{a.action}<div className="hint">{a.who}</div></div><span className="muted num">{fdt(a.at, org.tz)}</span></div>)}</div> : <div className="empty">Nothing logged yet.</div>}
        <Pager page={page} total={total} size={SIZE} href={(p) => `/admin/audit?${new URLSearchParams({ ...(q && { q }), p: String(p) })}`} />
      </div>
    </>
  );
}
