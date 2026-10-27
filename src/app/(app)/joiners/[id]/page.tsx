import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm } from "@/lib/auth";
import { activeList, activeRows, getSettings } from "@/lib/settings";
import { shownStatus, STATUS_LABEL, docsFor, filesOf, suggestId, OPEN_STATES } from "@/lib/joiners";
import { JSTEPS, SECTIONS, mobile10, type Exp } from "@/lib/joinform";
import { masked } from "@/lib/secure";
import { fd, fdt } from "@/lib/dates";
import { toggleCheck, cancelInvite, rejectInvite, deleteInvite } from "@/app/actions/joiners";
import { ApproveBox, ReissueForm } from "@/components/JoinerHR";
import { Confirm, Flash, Head } from "@/components/ui";

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default async function Review({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  await requirePerm("employees");
  const sp = await searchParams;
  const inv = (await db().select().from(schema.joinerInvites).where(eq(schema.joinerInvites.id, Number((await params).id))))[0];
  if (!inv) notFound();
  const { org } = await getSettings();
  const st = shownStatus(inv), [lbl, cls] = STATUS_LABEL[st] || [st, "p-mute"];
  const d = inv.data as Record<string, string> & { experience?: Exp[] };
  const files = await filesOf({ inviteId: inv.id });
  const docs = await docsFor(inv.category);
  const submitted = inv.status === "submitted";
  const open = (OPEN_STATES as readonly string[]).includes(inv.status) || st === "expired";
  const n = SECTIONS.filter((k) => inv.checks[k]).length;
  const opts = { cat: await activeList("cat"), dept: await activeList("dept"), desig: await activeList("desig"), shift: await activeList("shift") };
  const head = String((await activeRows("dept")).find((r) => String(r.data[0]) === inv.department)?.data[2] || "");

  const show = (k: string) => {
    const v = String(d[k] ?? "").trim();
    if (k === "aadhaar") return d.aadhaarLast4 ? masked(d.aadhaarLast4) : "";
    if (k === "dob" && v) return fd(v);
    if (k === "permAddress" && !v && d.address) return "Same as current address";
    return v;
  };
  const flag = (k: string) => {
    if (k === "mobile" && inv.mobile && d.mobile && mobile10(d.mobile) !== inv.mobile) return `Different from the number you entered (${inv.mobile})`;
    if (k === "fullName" && d.fullName && d.fullName.toLowerCase() !== inv.name.toLowerCase()) return `You entered “${inv.name}”`;
    if (k === "accountHolder" && d.accountHolder && d.fullName && d.accountHolder.toLowerCase() !== d.fullName.toLowerCase()) return "Not the same as the full name";
    return "";
  };
  const Tick = ({ k }: { k: string }) => submitted ? (
    <form action={toggleCheck}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="k" value={k} />
      <button type="submit" className={"tick" + (inv.checks[k] ? " on" : "")} aria-pressed={!!inv.checks[k]}>{inv.checks[k] ? "✓ Checked" : "Mark checked"}</button></form>) : null;

  return (
    <>
      <a className="crumb-link" href="/joiners">← New joiners</a>
      <Head title={d.fullName || inv.name} sub={<>{inv.designation} · {inv.department}{inv.joinDate ? ` · joining ${fd(inv.joinDate)}` : ""}{inv.submittedAt ? ` · submitted ${fdt(inv.submittedAt, org.tz)}` : ""}</>}>
        <span className={"pill " + cls}>{st === "accepted" ? `Employee · ${org.prefix}-${inv.employeeId}` : lbl}</span>
      </Head>
      <Flash sp={sp} />
      {inv.status === "corrections" && inv.note && <div className="msg err">You asked for corrections: {inv.note}</div>}
      {inv.status === "rejected" && <div className="msg err">Rejected: {inv.note}</div>}
      {!submitted && open && <div className="msg ok">The joiner is still filling the form. What they have saved so far is shown below.{st === "expired" ? " The link has expired; send a new one if needed." : ""}</div>}

      <div className="vcols">
        <div className="stack" style={{ minWidth: 0 }}>
          {JSTEPS.map((s) => (
            <section className="card vsec" key={s.id} id={s.id}>
              <div className="vh"><h2>{s.title}</h2><Tick k={s.id} /></div>
              <div className="kv">
                {s.fields.map((f) => { const v = show(f.key), fl = flag(f.key); return (
                  <div key={f.key} style={f.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}><small>{f.label.replace(/,? if (you have one|any)$/, "").replace(" (as on Aadhaar)", "")}</small><b style={{ fontWeight: 500 }}>{v || <span className="muted">—</span>}</b>{fl && <span className="flag">{fl}</span>}</div>); })}
                {s.id === "edu" && <div style={{ gridColumn: "1 / -1" }}><small>Previous jobs</small>{d.experience?.length ? d.experience.map((x, i) => <div key={i}>{x.employer}{x.role ? ` · ${x.role}` : ""}{x.from || x.to ? ` · ${x.from || "?"} – ${x.to || "?"}` : ""}</div>) : <span className="muted">None (first job)</span>}</div>}
              </div>
            </section>))}
          <section className="card vsec" id="docs">
            <div className="vh"><h2>Documents · {files.length} uploaded</h2><Tick k="docs" /></div>
            {files.length ? <div className="vdocs">{files.map((f) => (
              <a key={f.id} className="vdoc" href={`/api/files/${f.id}`} target="_blank" rel="noopener">
                <div className="th">{f.mime.startsWith("image/") ? <img src={`/api/files/${f.id}`} alt="" loading="lazy" /> : "PDF"}</div>
                <span><b>{f.kind}</b><br /><span className="hint">{kb(f.size)} · open</span></span></a>))}</div>
              : <div className="kv"><span className="muted">Nothing uploaded yet.</span></div>}
            {docs.filter((x) => !files.some((f) => f.kind === x.name)).length > 0 && <p className="hint" style={{ padding: "0 16px 14px", margin: 0 }}>Not uploaded: {docs.filter((x) => !files.some((f) => f.kind === x.name)).map((x) => `${x.name}${x.req ? "" : " (optional)"}`).join(", ")}</p>}
          </section>
          <div className="card"><h3>History</h3><div className="list">{inv.history.map((h, i) => <div key={i}><span>{h.by} {h.action}{h.note ? ` — “${h.note}”` : ""}</span><span className="hint">{fdt(h.at, org.tz)}</span></div>)}</div></div>
        </div>

        <div className="vside">
          {submitted && <ApproveBox id={inv.id} ready={n === 5} n={n} sug={await suggestId(inv.category)} opts={opts} prefix={org.prefix} hasDocs={files.length > 0}
            v={{ designation: inv.designation, department: inv.department, category: inv.category, shift: inv.shift || "", doj: inv.joinDate || "", reportingTo: head }} />}
          {submitted && <ReissueForm id={inv.id} fix />}
          {open && <ReissueForm id={inv.id} fix={false} />}
          {st === "accepted" && <div className="card stack"><h2>Accepted</h2><p className="muted" style={{ margin: 0 }}>Added as employee <b className="mono">{org.prefix}-{inv.employeeId}</b>. Documents are on the employee&apos;s record.</p><a className="btn sm primary" href={`/employees/${inv.employeeId}`} style={{ alignSelf: "flex-start" }}>Open employee</a></div>}
          {(submitted || open) && <div className="card stack"><h3>Close this entry</h3>
            <div className="row">
              {(OPEN_STATES as readonly string[]).includes(inv.status) && st !== "expired" && <Confirm label="Cancel link" confirm="Yes, cancel the link" action={cancelInvite}><input type="hidden" name="id" value={inv.id} /></Confirm>}
              <Confirm label="Reject" confirm="Reject joiner" action={rejectInvite}><input type="hidden" name="id" value={inv.id} /><div className="fld" style={{ marginBottom: 8 }}><label htmlFor="reason">Reason (kept in the change log)</label><textarea id="reason" name="reason" required placeholder="Did not accept the offer." /></div></Confirm>
            </div></div>}
          {["rejected", "cancelled", "expired"].includes(st) && <div className="card stack"><h3>Delete details</h3><p className="hint" style={{ margin: 0 }}>Removes the submitted details and all uploaded documents for good.</p>
            <Confirm label="Delete everything" confirm="Yes, delete" action={deleteInvite}><input type="hidden" name="id" value={inv.id} /></Confirm></div>}
        </div>
      </div>
    </>
  );
}
