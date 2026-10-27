"use client";
import { useActionState, useState } from "react";
import { createInvite, reissueLink, approveInvite, type LinkState, type ApproveState } from "@/app/actions/joiners";

type Opts = { cat: string[]; dept: string[]; desig: string[]; shift: string[] };
const fmt = (iso: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* clipboard blocked */ } }}>{done ? "Copied" : label}</button>;
}

export function LinkResult({ r, again }: { r: NonNullable<LinkState>; again?: React.ReactNode }) {
  const msg = `Hello ${r.name}, welcome to ${r.org}. Please fill in your joining details here: ${r.link} \nThis link works once and expires on ${fmt(r.expires!)}.`;
  return (
    <div className="stack" role="status">
      <h3>Link ready for {r.name}</h3>
      <div className="linkbox"><span style={{ flex: 1 }}>{r.link}</span></div>
      <div className="row">
        <Copy text={r.link!} label="Copy link" />
        <Copy text={msg} label="Copy message" />
        <a className="btn sm" href={`https://wa.me/${r.mobile ? "91" + r.mobile : ""}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
        {r.email && <a className="btn sm" href={`mailto:${r.email}?subject=${encodeURIComponent("Your joining form")}&body=${encodeURIComponent(msg)}`}>Email</a>}
      </div>
      <ul className="jlist hint" style={{ margin: 0 }}>
        <li>Works for one submission, until {fmt(r.expires!)}.</li>
        <li>Send it only to {r.name}. Anyone with the link can fill the form.</li>
        <li>This link is shown only now. If it gets lost, create a new one from the joiner&apos;s page; the old one stops working.</li>
      </ul>
      {again}
    </div>
  );
}

export function InviteForm({ opts, pre }: { opts: Opts; pre: Record<string, string> }) {
  const [st, act, pending] = useActionState<LinkState, FormData>(createInvite, null);
  const [key, setKey] = useState(0);
  if (st?.link) return <div className="card" key={key}><LinkResult r={st} again={<div className="row"><a className="btn sm" href={`/joiners/${st.id}`}>Open {st.name}&apos;s page</a><a className="btn sm primary" href="/joiners?new=1" onClick={() => setKey(key + 1)}>Invite another</a></div>} /></div>;
  const sel = (n: string, l: string, list: string[], blank?: string) => (
    <div className="fld"><label htmlFor={"i-" + n}>{l}</label><select id={"i-" + n} name={n} defaultValue={list.includes(pre[n] || "") ? pre[n] : ""} required={!blank}>
      <option value="" disabled={!blank}>{blank || "Choose…"}</option>{list.map((x) => <option key={x}>{x}</option>)}</select></div>);
  return (
    <form action={act} className="card stack" id="invite">
      <div><h2>Invite a new joiner</h2><p className="hint" style={{ margin: "4px 0 0" }}>You get a link for this person only. They fill in their own details and documents; you check them before they become an employee.</p></div>
      <div className="f">
        <div className="fld"><label htmlFor="i-name">Full name</label><input id="i-name" name="name" defaultValue={pre.name || ""} required /></div>
        <div className="fld"><label htmlFor="i-mobile">Mobile</label><input id="i-mobile" name="mobile" type="tel" inputMode="numeric" defaultValue={pre.mobile || ""} placeholder="For WhatsApp" /></div>
        <div className="fld"><label htmlFor="i-email">Email</label><input id="i-email" name="email" type="email" defaultValue={pre.email || ""} /></div>
        {sel("category", "Category", opts.cat)}
        {sel("department", "Department", opts.dept)}
        {sel("designation", "Designation", opts.desig)}
        {sel("shift", "Shift", opts.shift, "Default shift")}
        <div className="fld"><label htmlFor="i-joinDate">Joining date</label><input id="i-joinDate" name="joinDate" type="date" defaultValue={pre.joinDate || ""} /></div>
        <div className="fld"><label htmlFor="i-days">Link works for</label><select id="i-days" name="days" defaultValue="7"><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></div>
      </div>
      {st?.err && <div className="msg err" role="alert">{st.err}</div>}
      <div className="row"><button className="btn primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create one-time link"}</button><a className="btn" href="/joiners">Cancel</a></div>
    </form>
  );
}

/** A fresh link: for corrections (needs a note) or to replace a lost or expired one. */
export function ReissueForm({ id, fix }: { id: number; fix: boolean }) {
  const [st, act, pending] = useActionState<LinkState, FormData>(reissueLink, null);
  if (st?.link) return <div className="card"><LinkResult r={st} /></div>;
  return (
    <form action={act} className="card stack">
      <input type="hidden" name="id" value={id} />
      <h2>{fix ? "Ask for corrections" : "Send a new link"}</h2>
      <p className="hint" style={{ margin: 0 }}>{fix ? "The joiner gets a new one-time link. Their answers stay filled in, so they only fix what you mention." : "Use this if the link was lost or has expired. The old link stops working."}</p>
      {fix && <div className="fld"><label htmlFor="note">What needs fixing (the joiner sees this)</label><textarea id="note" name="note" required placeholder="Please upload a clearer copy of your PAN card." /></div>}
      <div className="fld"><label htmlFor="r-days">Link works for</label><select id="r-days" name="days" defaultValue="7"><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></div>
      {st?.err && <div className="msg err" role="alert">{st.err}</div>}
      <button className={"btn" + (fix ? "" : " primary")} type="submit" disabled={pending} style={{ justifyContent: "center" }}>{pending ? "Creating…" : "Create new link"}</button>
    </form>
  );
}

export function ApproveBox({ id, ready, n, sug, opts, v, prefix, hasDocs }: { id: number; ready: boolean; n: number; sug: string; opts: Opts; v: Record<string, string>; prefix: string; hasDocs: boolean }) {
  const [st, act, pending] = useActionState<ApproveState, FormData>(approveInvite, null);
  if (st?.empId) return (
    <div className="card stack" role="status">
      <div className="jmark ok" style={{ width: 44, height: 44 }} aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg></div>
      <h2>{st.name} is now an employee</h2>
      <div className="list">
        <div><span className="muted">Employee ID</span><b className="mono">{prefix}-{st.empId}</b></div>
        {st.pw ? <><div><span className="muted">Login ID</span><b className="mono">{st.login}</b></div><div><span className="muted">Temporary password</span><b className="mono" style={{ userSelect: "all" }}>{st.pw}</b></div></> : <div><span className="muted">Login</span><span>Not created</span></div>}
      </div>
      {st.pw && <><p className="hint" style={{ margin: 0 }}>Shown only now. They must choose a new password at first sign-in.</p>
        <div className="row"><Copy text={`Login ID: ${st.login}\nTemporary password: ${st.pw}`} label="Copy login" /></div></>}
      <div className="row"><a className="btn sm primary" href={`/employees/${st.empId}`}>Open employee</a><a className="btn sm" href="/onboarding">Joining checklist</a><a className="btn sm" href="/joiners">Back to new joiners</a></div>
    </div>
  );
  const sel = (nm: string, l: string, list: string[], blank?: string) => (
    <div className="fld"><label htmlFor={"a-" + nm}>{l}</label><select id={"a-" + nm} name={nm} defaultValue={v[nm] || ""} required={!blank}><option value="" disabled={!blank}>{blank || "Choose…"}</option>{[...new Set([...(v[nm] && !list.includes(v[nm]) ? [v[nm]] : []), ...list])].map((x) => <option key={x}>{x}</option>)}</select></div>);
  return (
    <form action={act} className="card stack">
      <input type="hidden" name="id" value={id} />
      <h2>Decision</h2>
      <div className="row between hint"><span>Sections checked</span><b className="num">{n} of 5</b></div>
      <div className="bar"><i style={{ width: `${n * 20}%`, background: "var(--ok)" }} /></div>
      <div className="fld"><label htmlFor="a-empId">Employee ID</label><input id="a-empId" name="empId" defaultValue={sug} required className="mono" /><span className="hint">{sug ? "Next free number in this category. You can change it." : "Category has no ID code. Enter the ID."}</span></div>
      {sel("designation", "Designation", opts.desig)}
      {sel("department", "Department", opts.dept)}
      {sel("category", "Category", opts.cat)}
      {sel("shift", "Shift", opts.shift, "Default shift")}
      <div className="fld"><label htmlFor="a-doj">Date of joining</label><input id="a-doj" name="doj" type="date" defaultValue={v.doj || ""} /></div>
      <div className="fld"><label htmlFor="a-rep">Reporting to (employee ID)</label><input id="a-rep" name="reportingTo" defaultValue={v.reportingTo || ""} placeholder="Optional" /><span className="hint">Defaults to the department head.</span></div>
      <label className="chk"><input type="checkbox" name="login" value="1" defaultChecked /> <span>Create a staff login with a temporary password</span></label>
      <label className="chk"><input type="checkbox" name="checklist" value="1" defaultChecked /> <span>Start the joining checklist{hasDocs ? ", with document checks ticked" : ""}</span></label>
      {st?.err && <div className="msg err" role="alert">{st.err}</div>}
      <button className="btn primary" type="submit" disabled={!ready || pending} style={{ justifyContent: "center", minHeight: 42 }}>{pending ? "Adding…" : "Approve and add employee"}</button>
      {!ready && <span className="hint">Tick all five sections as checked to approve.</span>}
    </form>
  );
}
