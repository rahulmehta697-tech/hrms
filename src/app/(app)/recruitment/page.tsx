import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm, can } from "@/lib/auth";
import { activeList, activeRows } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { STAGES } from "@/lib/config";
import { addCandidate, addRequisition, moveCandidate, setRequisitionStatus, startOnboarding } from "@/app/actions/hr";
import DataBar from "@/components/DataBar";
import { Flash, Head, Pill } from "@/components/ui";

export default async function Recruitment({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("recruitment");
  const sp = await searchParams;
  const reqs = await db().select().from(schema.requisitions).orderBy(asc(schema.requisitions.status), desc(schema.requisitions.createdAt));
  const all = await db().select().from(schema.candidates);
  const cur = reqs.find((r) => r.id === sp.r) || reqs.find((r) => r.status === "Open") || reqs[0];
  const cands = cur ? await db().select().from(schema.candidates).where(eq(schema.candidates.requisitionId, cur.id)).orderBy(asc(schema.candidates.name)) : [];
  const bar = await barFor(u, "candidates");
  const canEmp = await can(u, "employees");
  const catOf = Object.fromEntries((await activeRows("desig")).map((r) => [String(r.data[0]), String(r.data[1] || "")]));
  const move = (id: number, stage: number, label: string, cls = "btn sm") => <form action={moveCandidate}><input type="hidden" name="id" value={id} /><input type="hidden" name="stage" value={stage} /><button className={cls} type="submit">{label}</button></form>;
  return (
    <>
      <Head title="Recruitment" sub="Open positions and their candidates. Import candidate lists from job portals or walk-in registers."><DataBar ds="candidates" importLabel="candidates" {...bar} /></Head>
      <Flash sp={sp} />
      <div className="card"><h2>Requisitions</h2>
        {reqs.length ? <div className="tw"><table><thead><tr><th>Req.</th><th>Position</th><th>Department</th><th className="r">Posts</th><th className="r">Candidates</th><th>Status</th><th>Why</th></tr></thead>
          <tbody>{reqs.map((r) => <tr key={r.id} style={r.id === cur?.id ? { background: "var(--accent-soft)" } : undefined}><td className="mono"><a href={`/recruitment?r=${r.id}`}>{r.id}</a></td><td><a href={`/recruitment?r=${r.id}`} style={{ color: "inherit" }}><b>{r.title}</b></a></td><td>{r.department}</td><td className="r num">{r.posts}</td><td className="r num">{all.filter((c) => c.requisitionId === r.id).length}</td><td><Pill s={r.status} /></td><td className="muted">{r.note}</td></tr>)}</tbody></table></div> : <div className="empty">No requisitions yet.</div>}
        <details style={{ marginTop: 12 }}><summary className="btn sm">Open a new requisition</summary>
          <form action={addRequisition} className="f" style={{ marginTop: 12 }}>
            <div className="fld"><label htmlFor="title">Position</label><input id="title" name="title" required list="desigs" /><datalist id="desigs">{(await activeList("desig")).map((d) => <option key={d} value={d} />)}</datalist></div>
            <div className="fld"><label htmlFor="department">Department</label><select id="department" name="department" required>{(await activeList("dept")).map((d) => <option key={d}>{d}</option>)}</select></div>
            <div className="fld"><label htmlFor="posts">Number of posts</label><input id="posts" name="posts" type="number" min="1" defaultValue="1" /></div>
            <div className="fld"><label htmlFor="note">Reason</label><input id="note" name="note" placeholder="e.g. Replacement, new unit, regulatory shortfall" /></div>
            <div className="fld wide"><div><button className="btn primary" type="submit">Open requisition</button></div></div>
          </form></details>
      </div>
      {cur && <div className="card">
        <div className="row between" style={{ marginBottom: 12 }}><h2>{cur.title} · {cur.department} <span className="hint mono">{cur.id}</span></h2>
          <form action={setRequisitionStatus}><input type="hidden" name="id" value={cur.id} /><input type="hidden" name="status" value={cur.status === "Open" ? "Closed" : "Open"} /><button className="btn sm" type="submit">{cur.status === "Open" ? "Close requisition" : "Reopen"}</button></form></div>
        <div className="tw"><div className="pipe">{STAGES.map((s, si) => { const cs = cands.filter((c) => c.stage === si); return (
          <div className="col" key={s}><h3><span>{s}</span><span className="muted num">{cs.length}</span></h3>
            {cs.map((c) => <div className="cand" key={c.id}><b>{c.name}</b><small>{c.details || "—"}{c.mobile ? ` · ${c.mobile}` : ""}</small>
              <div className="row" style={{ gap: 4 }}>{si < 4 && move(c.id, si + 1, `→ ${STAGES[si + 1]}`)}{move(c.id, -1, "Not selected", "btn sm danger")}</div>
              {si === 4 && (canEmp
                ? <a className="btn sm primary" href={`/joiners?new=1&name=${encodeURIComponent(c.name)}&mobile=${encodeURIComponent(c.mobile)}&desig=${encodeURIComponent(cur.title)}&dept=${encodeURIComponent(cur.department)}${catOf[cur.title] ? "&cat=" + encodeURIComponent(catOf[cur.title]) : ""}#invite`}>Send joining form</a>
                : <form action={startOnboarding} className="row" style={{ gap: 4 }}><input type="hidden" name="id" value={c.id} /><input className="mini" type="date" name="joinDate" aria-label="Joining date" /><button className="btn sm primary" type="submit">Start onboarding</button></form>)}
            </div>)}</div>); })}</div></div>
        {cands.some((c) => c.stage < 0) && <p className="hint">Not selected: {cands.filter((c) => c.stage < 0).map((c) => c.name).join(", ")}</p>}
        <form action={addCandidate} className="row" style={{ marginTop: 12, alignItems: "end" }}>
          <input type="hidden" name="requisitionId" value={cur.id} />
          <div className="fld" style={{ flex: "1 1 200px" }}><label htmlFor="name">Candidate name</label><input id="name" name="name" required /></div>
          <div className="fld" style={{ flex: "0 1 150px" }}><label htmlFor="mobile">Mobile</label><input id="mobile" name="mobile" /></div>
          <div className="fld" style={{ flex: "1 1 240px" }}><label htmlFor="details">Qualification / experience</label><input id="details" name="details" /></div>
          <button className="btn primary" type="submit">Add candidate</button>
        </form>
      </div>}
    </>
  );
}
