import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PERMS, PERM_KEYS, ROLES, ROLE_KEYS } from "@/lib/config";
import { saveAccess } from "@/app/actions/admin";
import { Flash, Head } from "@/components/ui";

export default async function Access({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { access } = await getSettings();
  return (
    <>
      <Head tag="Settings" title="Roles & access" sub="What each portal role can see and do. Import and Export buttons appear only for roles with those permissions." />
      <Flash sp={sp} />
      <form action={saveAccess} className="card stack">
        <div className="tw"><table style={{ minWidth: 860 }}><thead><tr><th>Role</th>{PERM_KEYS.map((p) => <th key={p} style={{ whiteSpace: "normal" }}>{PERMS[p]}</th>)}</tr></thead>
          <tbody>{ROLE_KEYS.map((r) => <tr key={r}><td><b>{ROLES[r]}</b></td>{PERM_KEYS.map((p) => <td key={p}><input type="checkbox" name={`${r}:${p}`} defaultChecked={access[r].includes(p)} disabled={r === "admin"} aria-label={`${ROLES[r]}: ${PERMS[p]}`} style={{ width: 16, height: 16, accentColor: "var(--admin)" }} /></td>)}</tr>)}</tbody></table></div>
        <p className="hint" style={{ margin: 0 }}>Everyone can always see their own attendance, leave and payslips, download their own payslip and change their own password. “Approve requests” lets a role act on the workflow levels assigned to it.</p>
        <div><button className="btn primary" type="submit">Save</button></div>
      </form>
    </>
  );
}
