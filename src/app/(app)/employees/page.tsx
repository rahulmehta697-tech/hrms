import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { activeList, getSettings } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { EMP_STATUS } from "@/lib/config";
import DataBar from "@/components/DataBar";
import { Flash, Head, Pager, Pill } from "@/components/ui";

const SIZE = 50;
export default async function Employees({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("employees");
  const sp = await searchParams;
  const { org } = await getSettings();
  const q = (sp.q || "").trim(), dept = sp.dept || "", cat = sp.cat || "", st = sp.st || "", page = Math.max(1, Number(sp.p) || 1);
  const conds: SQL[] = [];
  if (q) conds.push(or(ilike(schema.employees.name, `%${q}%`), ilike(schema.employees.id, `%${q.replace(new RegExp("^" + org.prefix + "-", "i"), "")}%`), ilike(schema.employees.designation, `%${q}%`), ilike(schema.employees.mobile, `%${q}%`))!);
  if (dept) conds.push(eq(schema.employees.department, dept));
  if (cat) conds.push(eq(schema.employees.category, cat));
  if (st) conds.push(eq(schema.employees.status, st));
  const where = conds.length ? and(...conds) : undefined;
  const total = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.employees).where(where))[0].c);
  const rows = await db().select().from(schema.employees).where(where).orderBy(asc(schema.employees.name)).limit(SIZE).offset((page - 1) * SIZE);
  const all = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.employees))[0].c);
  const bar = await barFor(u, "employees");
  const qs = (p: number) => "/employees?" + new URLSearchParams({ ...(q && { q }), ...(dept && { dept }), ...(cat && { cat }), ...(st && { st }), p: String(p) });
  return (
    <>
      <Head title="Employees" sub={`${all.toLocaleString("en-IN")} employee records. Import adds or updates many at once.`}>
        <div className="row"><DataBar ds="employees" importLabel="employees" {...bar} /><a className="btn primary sm" href="/employees/new">Add employee</a></div>
      </Head>
      <Flash sp={sp} />
      <div className="card">
        <form className="row" style={{ marginBottom: 12, alignItems: "end" }}>
          <div className="fld" style={{ flex: "1 1 220px" }}><label htmlFor="q">Search</label><input id="q" name="q" type="search" defaultValue={q} placeholder="Name, ID, designation, mobile" /></div>
          <div className="fld" style={{ flex: "0 1 200px" }}><label htmlFor="dept">Department</label><select id="dept" name="dept" defaultValue={dept}><option value="">All</option>{(await activeList("dept")).map((d) => <option key={d}>{d}</option>)}</select></div>
          <div className="fld" style={{ flex: "0 1 180px" }}><label htmlFor="cat">Category</label><select id="cat" name="cat" defaultValue={cat}><option value="">All</option>{(await activeList("cat")).map((d) => <option key={d}>{d}</option>)}</select></div>
          <div className="fld" style={{ flex: "0 1 140px" }}><label htmlFor="st">Status</label><select id="st" name="st" defaultValue={st}><option value="">All</option>{EMP_STATUS.map((d) => <option key={d}>{d}</option>)}</select></div>
          <button className="btn" type="submit">Filter</button>
        </form>
        {rows.length ? <div className="tw"><table><thead><tr><th>ID</th><th>Name</th><th>Designation</th><th>Department</th><th>Category</th><th>Status</th></tr></thead>
          <tbody>{rows.map((e) => <tr key={e.id}><td className="mono"><a href={`/employees/${e.id}`}>{org.prefix}-{e.id}</a></td><td><a href={`/employees/${e.id}`} style={{ color: "inherit" }}>{e.name}</a></td><td>{e.designation}</td><td className="muted">{e.department}</td><td className="muted">{e.category}</td><td><Pill s={e.status} /></td></tr>)}</tbody></table></div>
          : <div className="empty">{all ? "No employees match these filters." : "No employees yet. Add one, or import your employee list from Excel."}</div>}
        <Pager page={page} total={total} size={SIZE} href={qs} />
      </div>
    </>
  );
}
