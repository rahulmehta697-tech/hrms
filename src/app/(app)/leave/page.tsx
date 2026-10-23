import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { balances, getEmployee } from "@/lib/logic";
import { addDays, fd, nowIn } from "@/lib/dates";
import { applyLeave, cancelLeave } from "@/app/actions/staff";
import { Flash, Head, Pill } from "@/components/ui";

export default async function LeavePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requireUser();
  const sp = await searchParams;
  const emp = await getEmployee(u.employeeId);
  if (!emp) return <><Head title="Leave" /><div className="empty">Your login is not linked to an employee record.</div></>;
  const { org, rules, flows } = await getSettings();
  const bal = await balances(emp.id, emp.category);
  const today = nowIn(org.tz).date;
  const mine = await db().select().from(schema.leaveRequests).where(eq(schema.leaveRequests.employeeId, emp.id)).orderBy(desc(schema.leaveRequests.fromDate)).limit(50);
  const short = flows.find((f) => f.key === "leave_short")!, long = flows.find((f) => f.key === "leave_long")!;
  return (
    <>
      <Head title="Leave" sub={`Up to 3 days goes to ${short.chain.join(" → ")}; longer leave goes to ${long.chain.join(" → ")}. ${rules.countOffs ? "Holidays and weekly offs inside the dates are counted." : "Holidays and weekly offs inside the dates are not counted."}`} />
      <Flash sp={sp} />
      <div className="card"><h2>Balance · {bal.year.label}</h2>
        <div className="tw"><table><thead><tr><th>Leave type</th><th className="r">Yearly quota</th><th className="r">Carried / credited</th><th className="r">Taken</th><th className="r">Pending</th><th className="r">Available</th></tr></thead>
          <tbody>{bal.rows.map((r) => <tr key={r.code}><td><b>{r.name}</b> <span className="hint mono">{r.code}</span></td><td className="r num">{r.quota}</td><td className="r num">{r.opening}</td><td className="r num">{r.used}</td><td className="r num">{r.pending}</td><td className="r num"><b>{r.available}</b></td></tr>)}</tbody></table></div>
      </div>
      <div className="card"><h2>Apply for leave</h2>
        {bal.rows.length ? <form action={applyLeave} className="f">
          <div className="fld"><label htmlFor="type">Leave type</label><select id="type" name="type">{bal.rows.map((r) => <option key={r.code} value={r.code}>{r.name} ({r.available} available)</option>)}</select></div>
          <div className="fld"><label htmlFor="from">From</label><input id="from" name="from" type="date" defaultValue={addDays(today, 1)} required /></div>
          <div className="fld"><label htmlFor="to">To</label><input id="to" name="to" type="date" defaultValue={addDays(today, 1)} required /></div>
          <div className="fld"><label htmlFor="cover">Work cover (optional)</label><input id="cover" name="cover" placeholder="Who covers your duties" /></div>
          <div className="fld wide"><label htmlFor="reason">Reason</label><textarea id="reason" name="reason" required /></div>
          <div className="fld wide"><div><button className="btn primary" type="submit">Send for approval</button></div></div>
        </form> : <div className="empty">No leave types apply to your category. Ask HR to check the Leave types master.</div>}
      </div>
      <div className="card"><h2>My leave requests</h2>
        {mine.length ? <div className="tw"><table><thead><tr><th>Request</th><th>Type</th><th>Dates</th><th className="r">Days</th><th>Status</th><th></th></tr></thead>
          <tbody>{mine.map((r) => <tr key={r.id}><td className="mono">LV-{r.id}</td><td>{r.type}</td><td className="num">{fd(r.fromDate)}{r.toDate !== r.fromDate ? " – " + fd(r.toDate) : ""}</td><td className="r num">{r.days}</td><td><Pill s={r.status} />{r.status === "pending" && <div className="hint">with {r.chain[r.level]}</div>}{r.status === "rejected" && r.history.at(-1)?.note && <div className="hint">“{r.history.at(-1)?.note}”</div>}</td>
            <td>{r.status === "pending" && <form action={cancelLeave}><input type="hidden" name="id" value={r.id} /><button className="btn sm" type="submit">Cancel</button></form>}</td></tr>)}</tbody></table></div> : <div className="empty">No leave requests yet.</div>}
      </div>
    </>
  );
}
