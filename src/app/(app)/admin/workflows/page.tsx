import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { APPROVERS } from "@/lib/config";
import { saveFlows } from "@/app/actions/admin";
import { Flash, Head } from "@/components/ui";

export default async function Workflows({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePerm("masters");
  const sp = await searchParams;
  const { flows } = await getSettings();
  return (
    <>
      <Head tag="Settings" title="Approval workflows" sub="Who approves each kind of request, in order. “Reporting HOD” is the head set for the employee's department; other levels are anyone with that portal role." />
      <Flash sp={sp} />
      <form action={saveFlows} className="card stack">
        <div className="tw"><table style={{ minWidth: 620 }}><thead><tr><th>Request</th><th>Level 1</th><th>Level 2</th><th>Level 3</th></tr></thead>
          <tbody>{flows.map((f) => <tr key={f.key}><td><b>{f.title}</b></td>{[0, 1, 2].map((i) => <td key={i}><select className="mini" name={`${f.key}_${i}`} defaultValue={f.chain[i] || ""} aria-label={`${f.title} level ${i + 1}`}><option value="">—</option>{APPROVERS.map((a) => <option key={a}>{a}</option>)}</select></td>)}</tr>)}</tbody></table></div>
        <p className="hint" style={{ margin: 0 }}>If an employee is the head of their own department, or the department has no head set, the HOD level is skipped.</p>
        <div><button className="btn primary" type="submit">Save</button></div>
      </form>
    </>
  );
}
