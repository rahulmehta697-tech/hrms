import { requirePerm } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { WEEKOFF_OPTIONS } from "@/lib/config";
import { saveOrg } from "@/app/actions/admin";
import LogoInput from "@/components/LogoInput";
import { Flash, Head } from "@/components/ui";

export default async function Institute({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePerm("masters");
  const sp = await searchParams;
  const { org } = await getSettings();
  return (
    <>
      <Head tag="Settings" title="Organisation profile" sub="The name and logo appear on the sign-in page, in the top bar, and on every exported Excel and PDF file." />
      <Flash sp={sp} />
      <form action={saveOrg} className="stack">
        <div className="card"><h2>Logo</h2><LogoInput current={org.logo} />
          {org.logo && <label className="chk" style={{ marginTop: 8 }}><input type="checkbox" name="removeLogo" value="1" /> Remove the current logo</label>}</div>
        <div className="card"><h2>Details</h2><div className="f">
          <div className="fld wide"><label htmlFor="name">Organisation name</label><input id="name" name="name" defaultValue={org.name} required /></div>
          <div className="fld"><label htmlFor="short">Short name</label><input id="short" name="short" defaultValue={org.short} maxLength={12} /><span className="hint">Shown when there is no logo, and used in file names.</span></div>
          <div className="fld"><label htmlFor="addr">City / address line</label><input id="addr" name="addr" defaultValue={org.addr} /></div>
          <div className="fld"><label htmlFor="prefix">Employee ID prefix</label><input id="prefix" name="prefix" defaultValue={org.prefix} maxLength={8} /><span className="hint">Login IDs look like <span className="mono">{org.prefix}-F-1042</span>. Changing this changes everyone&apos;s login ID.</span></div>
          <div className="fld"><label htmlFor="fy">Leave year</label><select id="fy" name="fy" defaultValue={org.fy}><option>April – March</option><option>January – December</option></select></div>
          <div className="fld"><label htmlFor="weekoff">Weekly off</label><select id="weekoff" name="weekoff" defaultValue={org.weekoff}>{WEEKOFF_OPTIONS.map((w) => <option key={w}>{w}</option>)}</select></div>
          <div className="fld"><label htmlFor="tz">Time zone</label><select id="tz" name="tz" defaultValue={org.tz}><option>Asia/Kolkata</option><option>Asia/Dubai</option><option>Asia/Kathmandu</option><option>Asia/Dhaka</option><option>UTC</option></select></div>
        </div></div>
        <div className="card"><h2>HR office contact</h2><p className="hint" style={{ margin: "-6px 0 12px" }}>Shown to new joiners on the joining form, so they know whom to call.</p><div className="f">
          <div className="fld"><label htmlFor="hrPhone">Phone</label><input id="hrPhone" name="hrPhone" type="tel" defaultValue={org.hrPhone || ""} /></div>
          <div className="fld"><label htmlFor="hrEmail">Email</label><input id="hrEmail" name="hrEmail" type="email" defaultValue={org.hrEmail || ""} /></div>
        </div></div>
        <div><button className="btn primary" type="submit">Save</button></div>
      </form>
    </>
  );
}
