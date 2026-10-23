import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { actionable } from "@/lib/logic";
import { fd } from "@/lib/dates";
import { decide } from "@/app/actions/approvals";
import { Flash, Head } from "@/components/ui";

function Decide({ kind, id }: { kind: string; id: number }) {
  return (
    <form action={decide} className="row" style={{ alignItems: "stretch" }}>
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
      <input className="inp" name="note" placeholder="Note (needed to reject)" style={{ width: 220 }} aria-label="Note" />
      <button className="btn sm danger" name="action" value="reject" type="submit">Reject</button>
      <button className="btn sm primary" name="action" value="approve" type="submit">Approve</button>
    </form>
  );
}

export default async function Approvals({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("approve");
  const sp = await searchParams;
  const { org } = await getSettings();
  const leaves = await actionable(u, await db().select().from(schema.leaveRequests).where(eq(schema.leaveRequests.status, "pending")));
  const regs = await actionable(u, await db().select().from(schema.regRequests).where(eq(schema.regRequests.status, "pending")));
  const ids = [...new Set([...leaves, ...regs].map((r) => r.employeeId))];
  const emps = new Map((ids.length ? await db().select().from(schema.employees).where(inArray(schema.employees.id, ids)) : []).map((e) => [e.id, e]));
  const overlaps = async (l: (typeof leaves)[number]) => {
    const e = emps.get(l.employeeId);
    if (!e) return 0;
    const r = await db().select({ id: schema.leaveRequests.id }).from(schema.leaveRequests).innerJoin(schema.employees, eq(schema.employees.id, schema.leaveRequests.employeeId))
      .where(and(eq(schema.employees.department, e.department), inArray(schema.leaveRequests.status, ["pending", "approved"]), lte(schema.leaveRequests.fromDate, l.toDate), gte(schema.leaveRequests.toDate, l.fromDate)));
    return r.length - 1;
  };
  const ov = await Promise.all(leaves.map(overlaps));
  return (
    <>
      <Head title="Approvals" sub={`${leaves.length + regs.length} waiting for you. Requests move to the next approver in the workflow after you approve.`} />
      <Flash sp={sp} />
      {!leaves.length && !regs.length && <div className="card"><div className="empty">All caught up. New requests you need to approve appear here.</div></div>}
      {leaves.map((l, i) => { const e = emps.get(l.employeeId); return (
        <div className="card" key={"l" + l.id}><div className="row between" style={{ alignItems: "start" }}>
          <div style={{ minWidth: 0, flex: "1 1 320px" }}>
            <h2>{e?.name || l.employeeId} <span className="muted" style={{ fontWeight: 400, fontSize: ".85rem" }}>· {e?.designation} · {e?.department}</span></h2>
            <p style={{ margin: "4px 0 0" }}><b>{l.type}</b> · {fd(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fd(l.toDate) : ""} · {l.days} day{l.days === 1 ? "" : "s"}</p>
            <p className="muted" style={{ margin: "2px 0 0" }}>{l.reason}</p>
            <p className="hint" style={{ margin: "6px 0 0" }}>{l.cover ? `Cover: ${l.cover} · ` : ""}Route: {l.chain.join(" → ")} (step {l.level + 1}) · LV-{l.id} · <span className="mono">{org.prefix}-{l.employeeId}</span></p>
            {l.history.length > 0 && <p className="hint" style={{ margin: "2px 0 0" }}>{l.history.map((h) => `${h.action} by ${h.by}`).join("; ")}</p>}
            {ov[i] > 0 && <div className="warnline">{ov[i]} other {ov[i] > 1 ? "people" : "person"} from {e?.department} off on overlapping dates</div>}
          </div>
          <Decide kind="leave" id={l.id} />
        </div></div>); })}
      {regs.length > 0 && <div className="card"><h2>Attendance regularisation</h2><div className="list">{regs.map((r) => { const e = emps.get(r.employeeId); return (
        <div key={"r" + r.id}><div><b>{e?.name || r.employeeId}</b> · {fd(r.date)} · {r.direction} at {r.time}<div className="hint">{r.reason} · {e?.department}</div></div><Decide kind="reg" id={r.id} /></div>); })}</div></div>}
    </>
  );
}
