import { requirePerm } from "@/lib/auth";
import { activeList, getSettings } from "@/lib/settings";
import { saveRules } from "@/app/actions/admin";
import { Flash, Head } from "@/components/ui";

export default async function Rules({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePerm("masters");
  const sp = await searchParams;
  const { rules } = await getSettings();
  return (
    <>
      <Head tag="Settings" title="Attendance rules" sub="How raw punches from every source become a daily attendance record, and how leave days are counted." />
      <Flash sp={sp} />
      <form action={saveRules} className="card stack">
        <div className="f">
          <div className="fld wide"><label htmlFor="merge">When someone punches on more than one source</label><select id="merge" name="merge" defaultValue={rules.merge}><option>First punch in, last punch out across all sources</option></select><span className="hint">The first punch of the day counts as arrival and the last Out punch as departure, whichever device recorded them.</span></div>
          <div className="fld"><label htmlFor="start">Track attendance from</label><input id="start" name="start" type="date" defaultValue={rules.start} /><span className="hint">Days before this (and before each person&apos;s joining date) are not marked absent. Set it to your go-live date.</span></div>
          <div className="fld"><label htmlFor="thr">Minimum attendance %</label><input id="thr" name="thr" type="number" min="0" max="100" defaultValue={rules.thr} /><span className="hint">Staff below this are flagged on the HR overview and monthly summary.</span></div>
          <div className="fld"><label htmlFor="thrCat">Threshold applies to</label><select id="thrCat" name="thrCat" defaultValue={rules.thrCat}>{(await activeList("cat")).map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="fld"><label htmlFor="half">Half day if hours worked are below</label><input id="half" name="half" type="number" min="0" max="12" step="0.5" defaultValue={rules.half} /><span className="hint">Needs both an In and an Out punch.</span></div>
          <div className="fld"><label htmlFor="countOffs">Count holidays and weekly offs inside leave</label><select id="countOffs" name="countOffs" defaultValue={rules.countOffs ? "yes" : "no"}><option value="no">No, skip them</option><option value="yes">Yes, count every calendar day</option></select></div>
        </div>
        <div className="admin-note">Late marks use each employee&apos;s shift start plus grace minutes (Master fields → Shifts). Holidays and the weekly off come from their own settings.</div>
        <div><button className="btn primary" type="submit">Save</button></div>
      </form>
    </>
  );
}
