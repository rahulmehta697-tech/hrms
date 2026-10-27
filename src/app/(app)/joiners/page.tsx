import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { activeList, getSettings } from "@/lib/settings";
import { shownStatus, STATUS_LABEL } from "@/lib/joiners";
import { fd, fdt } from "@/lib/dates";
import { InviteForm } from "@/components/JoinerHR";
import { Flash, Head, Stat } from "@/components/ui";

const FILTERS: [string, string, string[]][] = [
  ["all", "All", []], ["verify", "To verify", ["submitted"]], ["waiting", "Waiting for joiner", ["sent", "opened", "corrections"]],
  ["accepted", "Accepted", ["accepted"]], ["closed", "Expired, cancelled or rejected", ["expired", "cancelled", "rejected"]],
];

export default async function Joiners({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePerm("employees");
  const sp = await searchParams;
  const { org } = await getSettings();
  const all = (await db().select({ i: schema.joinerInvites.id, name: schema.joinerInvites.name, designation: schema.joinerInvites.designation, department: schema.joinerInvites.department, joinDate: schema.joinerInvites.joinDate,
    status: schema.joinerInvites.status, expiresAt: schema.joinerInvites.expiresAt, submittedAt: schema.joinerInvites.submittedAt, createdAt: schema.joinerInvites.createdAt, employeeId: schema.joinerInvites.employeeId })
    .from(schema.joinerInvites).orderBy(desc(schema.joinerInvites.createdAt))).map((r) => ({ ...r, st: shownStatus(r) }));
  const f = FILTERS.find((x) => x[0] === sp.f) || FILTERS[0];
  const rows = f[2].length ? all.filter((r) => f[2].includes(r.st)) : all;
  const cnt = (s: string[]) => all.filter((r) => s.includes(r.st)).length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const opts = { cat: await activeList("cat"), dept: await activeList("dept"), desig: await activeList("desig"), shift: await activeList("shift") };
  const ready = opts.cat.length && opts.dept.length && opts.desig.length;
  const showForm = sp.new === "1" || (!all.length && ready);
  return (
    <>
      <Head title="New joiners" sub="Send each new joiner a one-time link to fill in their details. You check what they submit before they become an employee.">
        {!showForm && <a className="btn primary" href="/joiners?new=1#invite">Invite a new joiner</a>}
      </Head>
      <Flash sp={sp} />
      {!ready && <div className="msg err">Add categories, departments and designations under Settings first. The invite form uses them.</div>}
      {showForm && ready ? <InviteForm opts={opts} pre={{ name: sp.name || "", mobile: sp.mobile || "", department: sp.dept || "", designation: sp.desig || "", category: sp.cat || "", joinDate: sp.join || "" }} /> : null}
      <div className="grid g4">
        <Stat n={cnt(["submitted"])} label="ready for you to verify" />
        <Stat n={cnt(["sent", "opened"])} label="waiting for the joiner" />
        <Stat n={cnt(["corrections"])} label="sent back for corrections" />
        <Stat n={all.filter((r) => r.st === "accepted" && r.createdAt >= monthStart).length} label="accepted this month" />
      </div>
      <div className="row" role="group" aria-label="Filter">
        {FILTERS.map(([k, l, s]) => <a key={k} className={"btn sm" + (f[0] === k ? " primary" : "")} href={`/joiners${k === "all" ? "" : "?f=" + k}`} aria-current={f[0] === k ? "true" : undefined}>{l}{s.length ? ` · ${cnt(s)}` : ""}</a>)}
      </div>
      <div className="card">
        {rows.length ? <div className="tw"><table>
          <thead><tr><th>Joiner</th><th>Role</th><th>Joining</th><th>Status</th><th>Last update</th><th className="r"><span className="sr">Action</span></th></tr></thead>
          <tbody>{rows.map((r) => { const [lbl, cls] = STATUS_LABEL[r.st] || [r.st, "p-mute"]; return (
            <tr key={r.i}>
              <td><a href={`/joiners/${r.i}`}><b>{r.name}</b></a></td>
              <td>{r.designation}<small className="muted" style={{ display: "block" }}>{r.department}</small></td>
              <td className="num">{r.joinDate ? fd(r.joinDate) : "—"}</td>
              <td><span className={"pill " + cls}>{r.st === "accepted" && r.employeeId ? `Employee · ${org.prefix}-${r.employeeId}` : lbl}</span></td>
              <td className="hint">{r.st === "submitted" ? `Submitted ${fdt(r.submittedAt, org.tz)}` : ["sent", "opened", "corrections"].includes(r.st) ? `Link expires ${fdt(r.expiresAt, org.tz)}` : `Created ${fdt(r.createdAt, org.tz)}`}</td>
              <td className="r"><a className={"btn sm" + (r.st === "submitted" ? " primary" : "")} href={`/joiners/${r.i}`}>{r.st === "submitted" ? "Verify" : "Open"}</a></td>
            </tr>); })}</tbody></table></div>
          : <div className="empty">{all.length ? "Nothing here." : "No joiners yet. Use “Invite a new joiner” to create the first link."}</div>}
      </div>
    </>
  );
}
