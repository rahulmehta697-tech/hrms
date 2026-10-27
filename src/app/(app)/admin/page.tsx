import { requirePerm } from "@/lib/auth";
import { setupSteps } from "@/lib/setup";
import { Flash, Head } from "@/components/ui";

export default async function SetupChecklist({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("masters");
  const sp = await searchParams;
  const { steps, done } = await setupSteps(u);
  return (
    <>
      <Head tag="Settings" title="Setup checklist" sub={`${done} of ${steps.length} done. Work down the list; each step links to the page where you do it.`} />
      <Flash sp={sp} />
      <div className="card"><div className="bar" style={{ marginBottom: 14 }}><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
        <div className="list">{steps.map((s, i) => (
          <div key={s.title}><div style={{ minWidth: 0, flex: "1 1 300px" }}><b>{i + 1}. {s.title}</b>{s.optional && <span className="hint"> · optional</span>}<div className="hint">{s.detail}</div></div>
            <div className="row"><span className={"pill " + (s.done ? "p-ok" : "p-warn")}>{s.done ? "Done" : "To do"}</span><a className="btn sm" href={s.href}>Open</a></div></div>))}</div>
      </div>
    </>
  );
}
