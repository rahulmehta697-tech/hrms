import { notFound } from "next/navigation";
import { requirePerm } from "@/lib/auth";
import { getMasters } from "@/lib/settings";
import { barFor } from "@/lib/datasets";
import { masterDef, type Col } from "@/lib/config";
import { addMaster, deleteMaster, toggleMaster, updateMaster } from "@/app/actions/admin";
import DataBar from "@/components/DataBar";
import { Confirm, Flash, Head } from "@/components/ui";

export default async function MasterPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string>> }) {
  const u = await requirePerm("masters");
  const { kind } = await params;
  const def = masterDef(kind);
  if (!def) notFound();
  const sp = await searchParams;
  const all = await getMasters();
  const rows = all[kind] || [];
  const cats = all.cat.filter((r) => r.active).map((r) => String(r.data[0]));
  const bar = await barFor(u, "master-" + kind);
  const field = (c: Col, form: string, name: string, val: string | number | undefined) => {
    if (c.type?.startsWith("sel:")) {
      const opts = c.type.slice(4).split("|").flatMap((x) => (x === "@cat" ? cats : [x]));
      const v = String(val ?? "");
      return <select className="cellin" form={form} name={name} defaultValue={v} aria-label={c.label}>{!v && <option value="">—</option>}{(v && !opts.includes(v) ? [v, ...opts] : opts).map((o) => <option key={o}>{o}</option>)}</select>;
    }
    return <input className={"cellin" + (c.type === "num" ? " num" : "")} form={form} name={name} type={c.type === "num" ? "number" : c.type === "date" ? "date" : c.type === "time" ? "time" : "text"} step={c.type === "num" ? "any" : undefined} defaultValue={val ?? ""} required={c.required} aria-label={c.label} placeholder={c.help && form === "fnew" ? "e.g. F-0412" : undefined} />;
  };
  return (
    <>
      <Head tag="Master field" title={def.title} sub={`${def.desc} Edit a row and press Save; use Import to load many rows from Excel.`}><DataBar ds={"master-" + kind} importLabel={def.title.toLowerCase()} {...bar} /></Head>
      <Flash sp={sp} />
      <div className="card"><div className="tw"><table className="mt"><thead><tr>{def.cols.map((c) => <th key={c.key}>{c.label}</th>)}<th>Status</th><th></th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id} className={r.active ? "" : "off"}>
          {def.cols.map((c, i) => <td key={c.key}>{field(c, `f${r.id}`, `r${r.id}_${c.key}`, r.data[i])}</td>)}
          <td><span className={"pill " + (r.active ? "p-ok" : "p-mute")}>{r.active ? "Active" : "Inactive"}</span></td>
          <td><div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            <form id={`f${r.id}`} action={updateMaster}><input type="hidden" name="id" value={r.id} /><button className="btn sm" type="submit">Save</button></form>
            <form action={toggleMaster}><input type="hidden" name="id" value={r.id} /><button className="btn sm" type="submit">{r.active ? "Deactivate" : "Activate"}</button></form>
            <Confirm label="Remove" confirm={`Remove “${r.data[0]}”`} action={deleteMaster}><input type="hidden" name="id" value={r.id} /></Confirm>
          </div></td></tr>)}</tbody>
        <tfoot><tr>{def.cols.map((c) => <td key={c.key}>{field(c, "fnew", `n_${c.key}`, c.type === "num" ? "" : undefined)}</td>)}<td colSpan={2}><form id="fnew" action={addMaster}><input type="hidden" name="kind" value={kind} /><button className="btn primary sm" type="submit">Add</button></form></td></tr></tfoot>
      </table></div>
        {def.cols.some((c) => c.help) && <p className="hint">{def.cols.filter((c) => c.help).map((c) => `${c.label}: ${c.help}`).join(" ")}</p>}
        <p className="hint">Deactivate an entry to hide it from forms while keeping old records intact. Removing deletes it from the list only; records that already use it keep the value.</p>
      </div>
    </>
  );
}
