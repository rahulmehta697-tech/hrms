import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm, can } from "@/lib/auth";
import { activeRows, getSettings } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { fd, nowIn } from "@/lib/dates";
import { addJoiner, removeJoiner, tickJoiner } from "@/app/actions/hr";
import DataBar from "@/components/DataBar";
import { Confirm, Flash, Head } from "@/components/ui";

export default async function Onboarding({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("recruitment");
  const sp = await searchParams;
  const { org } = await getSettings();
  const today = nowIn(org.tz).date;
  const items = await activeRows("docs");
  const js = await db().select().from(schema.joiners).orderBy(desc(schema.joiners.joinDate));
  const bar = await barFor(u, "onboarding");
  const canEmp = await can(u, "employees");
  return (
    <>
      <Head title="Onboarding" sub="New joiners and their checklist. Checklist items come from Master fields → Onboarding checklist."><DataBar ds="onboarding" {...bar} /></Head>
      <Flash sp={sp} />
      {js.length ? <div className="grid g2">{js.map((j) => {
        const its = items.filter((r) => r.data[1] === "All" || r.data[1] === j.kind);
        const done = its.filter((r) => j.done[String(r.data[0])]).length, n = its.length;
        return (
          <div className="card" key={j.id} id={"j" + j.id}>
            <div className="row between" style={{ alignItems: "start" }}><div><h2>{j.name}</h2><p className="muted" style={{ margin: "2px 0 0" }}>{j.roleText || "—"}{j.joinDate ? ` · joins ${fd(j.joinDate)}` : ""}</p></div>
              <span className={"pill num " + (done === n ? "p-ok" : j.joinDate && j.joinDate <= today ? "p-warn" : "p-mute")}>{done}/{n}</span></div>
            <div className="bar" style={{ margin: "12px 0 6px" }}><i style={{ width: `${n ? (done / n) * 100 : 0}%` }} /></div>
            {its.map((r) => { const k = String(r.data[0]), on = !!j.done[k]; return (
              <form key={k} action={tickJoiner} className="chk"><input type="hidden" name="id" value={j.id} /><input type="hidden" name="item" value={k} /><input type="hidden" name="on" value={on ? "0" : "1"} />
                <button type="submit" className="btn link" style={{ padding: 0, fontSize: "inherit", color: "inherit", textAlign: "left", display: "flex", gap: 10 }} aria-pressed={on}><span aria-hidden="true" style={{ width: 16, height: 16, border: "1.5px solid var(--line)", borderRadius: 4, background: on ? "var(--accent)" : "transparent", flex: "none", marginTop: 2 }} />{k}</button></form>); })}
            <div className="row" style={{ marginTop: 10 }}>
              {canEmp && <a className="btn sm" href={`/employees/new?name=${encodeURIComponent(j.name)}`}>Create employee record</a>}
              <Confirm label="Remove" confirm={`Remove ${j.name}`} action={removeJoiner}><input type="hidden" name="id" value={j.id} /></Confirm>
            </div>
          </div>); })}</div> : <div className="card"><div className="empty">No joiners yet. Start onboarding from a candidate at the Joining stage, or add someone below.</div></div>}
      <div className="card"><h2>Add a joiner</h2>
        <form action={addJoiner} className="f">
          <div className="fld"><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
          <div className="fld"><label htmlFor="roleText">Role and department</label><input id="roleText" name="roleText" placeholder="Staff Nurse · Medical ICU" /></div>
          <div className="fld"><label htmlFor="kind">Kind of staff</label><select id="kind" name="kind"><option>All</option><option>Doctors</option><option>Nursing</option><option>Paramedical</option></select></div>
          <div className="fld"><label htmlFor="joinDate">Joining date</label><input id="joinDate" name="joinDate" type="date" /></div>
          <div className="fld wide"><div><button className="btn primary" type="submit">Add joiner</button></div></div>
        </form>
      </div>
    </>
  );
}
