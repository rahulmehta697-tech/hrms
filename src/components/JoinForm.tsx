"use client";
import { useRef, useState } from "react";
import { JSTEPS, STEP_NAMES, MAX_FILE, checkStep, type Exp, type JDoc, type JFile, type JField } from "@/lib/joinform";

type Props = {
  token: string; first: string; org: string; note: string;
  role: { designation: string; department: string; joinDate: string; expires: string };
  initial: Record<string, unknown>; docs: JDoc[]; files: JFile[];
};
const LAST = JSTEPS.length + 2; // review step index
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Shrink large photos on the phone before upload, so uploads are quick and small. */
async function shrink(f: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 500_000) return f;
  try {
    const img = await createImageBitmap(f);
    const s = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    return out && out.size < f.size ? out : f;
  } catch { return f; }
}

export default function JoinForm({ token, first, org, note, role, initial, docs, files: initFiles }: Props) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Record<string, unknown>>({ ...initial, aadhaar: "", experience: (initial.experience as Exp[])?.length ? initial.experience : [{ employer: "", role: "", from: "", to: "" }] });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [files, setFiles] = useState<JFile[]>(initFiles);
  const [last4, setLast4] = useState(String(initial.aadhaarLast4 || ""));
  const [saved, setSaved] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const fail = (e: Record<string, string>) => { setErr(e); setTimeout(() => (document.querySelector('[aria-invalid="true"]') as HTMLElement | null)?.focus(), 0); };
  const set = (k: string, v: unknown) => { setD((x) => ({ ...x, [k]: v })); setErr((e) => { const n = { ...e }; delete n[k]; return n; }); };
  const go = (n: number) => { setStep(n); setMsg(""); setErr({}); setTimeout(() => { top.current?.scrollTo?.({ top: 0 }); window.scrollTo({ top: 0 }); }, 0); };
  const api = async (action: string, stepId?: string) => {
    const r = await fetch(`/api/join/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, step: stepId, data: d }) });
    const j = await r.json().catch(() => ({ error: "No reply from the server. Check your internet and try again." }));
    return { status: r.status, ...j } as { status: number; ok?: boolean; error?: string; errors?: Record<string, string>; step?: string; aadhaarLast4?: string; submitted?: boolean };
  };

  const sid = step >= 1 && step <= JSTEPS.length ? JSTEPS[step - 1].id : "";
  async function next() {
    setMsg("");
    if (step === 0) return go(1);
    if (sid) {
      const local = checkStep(sid, d, !!last4);
      if (Object.keys(local).length) { fail(local); setMsg("Please fix the highlighted fields."); return; }
      setBusy("save");
      const r = await api("save", sid);
      setBusy("");
      if (r.status === 410) { setMsg(r.error || "This link no longer works."); return; }
      if (r.errors && Object.keys(r.errors).length) { fail(r.errors); setMsg("Please fix the highlighted fields."); return; }
      if (r.error) { setMsg(r.error); return; }
      if (r.aadhaarLast4) { setLast4(r.aadhaarLast4); setD((x) => ({ ...x, aadhaar: "" })); }
      setSaved(true);
      return go(step + 1);
    }
    if (step === JSTEPS.length + 1) {
      const missing = docs.filter((x) => x.req && !files.some((f) => f.kind === x.name));
      if (missing.length) { setMsg(`Upload these first: ${missing.map((m) => m.name).join(", ")}.`); return; }
      return go(step + 1);
    }
    if (step === LAST) {
      if (d.agree !== true) { setErr({ agree: "Please confirm" }); setMsg("Tick the declaration to submit."); return; }
      setBusy("submit");
      const r = await api("submit");
      setBusy("");
      if (r.submitted) return go(LAST + 1);
      if (r.errors) {
        setErr(r.errors);
        const at = r.step === "docs" ? JSTEPS.length + 1 : JSTEPS.findIndex((s) => s.id === r.step) + 1;
        setMsg(`Something is missing${at > 0 ? ` in “${STEP_NAMES[at]}”` : ""}. ${r.errors.docs || "Open that step to fix it."}`);
        return;
      }
      setMsg(r.error || "Could not submit. Try again.");
    }
  }

  async function upload(kind: string, f?: File | null) {
    if (!f) return;
    setMsg(""); setBusy(kind);
    try {
      const b = await shrink(f);
      if (b.size > MAX_FILE) { setMsg(`${kind}: the file is larger than 4 MB. Take a smaller photo or compress the PDF.`); return; }
      const fd = new FormData();
      fd.append("kind", kind); fd.append("file", b, b === f ? f.name : f.name.replace(/\.\w+$/, "") + ".jpg");
      const r = await fetch(`/api/join/${token}/file`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({ error: "Upload failed. Try again." }));
      if (!r.ok) { setMsg(`${kind}: ${j.error}`); return; }
      setFiles((x) => [...x.filter((y) => y.kind !== kind), j.file]);
    } finally { setBusy(""); }
  }
  async function remove(id: number) {
    setBusy("rm" + id);
    await fetch(`/api/join/${token}/file?id=${id}`, { method: "DELETE" });
    setFiles((x) => x.filter((y) => y.id !== id)); setBusy("");
  }

  const field = (f: JField) => {
    const v = String(d[f.key] ?? "");
    const id = "j-" + f.key, e = err[f.key];
    const common = { id, "aria-invalid": !!e || undefined, "aria-describedby": e || f.hint ? id + "-h" : undefined };
    const ph = f.key === "aadhaar" && last4 ? `Saved: •••• •••• ${last4}. Type again only to change it.` : f.ph;
    return (
      <div className={"fld" + (f.wide ? " wide" : "")} key={f.key}>
        <label htmlFor={id}>{f.label}{f.req ? "" : <span className="hint"> (optional)</span>}</label>
        {f.type === "textarea" ? <textarea {...common} value={v} placeholder={ph} onChange={(x) => set(f.key, x.target.value)} />
          : f.type?.startsWith("sel:") ? <select {...common} value={v} onChange={(x) => set(f.key, x.target.value)}><option value="">Choose…</option>{f.type.slice(4).split("|").map((o) => <option key={o}>{o}</option>)}</select>
          : <input {...common} type={f.type === "tel" ? "tel" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text"} inputMode={["aadhaar", "uan", "bankAccount", "qualYear"].includes(f.key) || f.type === "tel" ? "numeric" : undefined}
              autoComplete={f.key === "fullName" ? "name" : f.key === "mobile" ? "tel" : f.key === "email" ? "email" : "off"} value={v} placeholder={ph}
              style={f.upper ? { textTransform: "uppercase" } : undefined} onChange={(x) => set(f.key, x.target.value)} />}
        {(e || f.hint) && <span id={id + "-h"} className={e ? "ferr" : "hint"}>{e || f.hint}</span>}
      </div>
    );
  };

  const exp = (d.experience as Exp[]) || [];
  const setExp = (i: number, k: keyof Exp, v: string) => set("experience", exp.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const show = (k: string) => String(d[k] ?? "").trim() || "—";
  const sum: [string, number, string][] = [
    ["About you", 1, [show("fullName"), d.dob ? new Date(String(d.dob) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "", show("gender"), String(d.bloodGroup || "")].filter((x) => x && x !== "—").join(" · ")],
    ["Contact and address", 2, `${show("mobile")} · ${show("address")} · Emergency: ${show("emergencyName")}`],
    ["ID, PF and bank", 3, `Aadhaar ${last4 ? "••" + last4 : "missing"} · PAN ${show("pan")} · A/c ••${String(d.bankAccount || "").slice(-4) || "—"}`],
    ["Education and experience", 4, `${show("qualification")} ${String(d.qualYear || "")}${d.regNo ? " · " + d.regNo : ""} · ${exp.filter((x) => x.employer).length} previous job(s)`],
    ["Documents", JSTEPS.length + 1, `${files.length} uploaded${docs.some((x) => x.req && !files.some((f) => f.kind === x.name)) ? " · some required ones missing" : ""}`],
  ];

  return (
    <>
      {step >= 1 && step <= LAST && <div className="jprog"><div className="row between"><span className="hint">Step {step} of {LAST}</span><b>{STEP_NAMES[step]}</b></div><div className="bar"><i style={{ width: `${(step / LAST) * 100}%` }} /></div></div>}
      <div className="jbody stack" ref={top}>
        {step === 0 && <>
          <h1>Welcome, {first}</h1>
          <p className="muted">Please fill in your details before you join {org}. HR will check them and then add you as an employee.</p>
          {note && <div className="msg err" role="alert"><b>HR asked for corrections:</b> {note}</div>}
          <div className="card list">
            <div><span className="muted">Role</span><b>{role.designation}</b></div>
            <div><span className="muted">Department</span><b>{role.department}</b></div>
            {role.joinDate && <div><span className="muted">Joining on</span><b>{role.joinDate}</b></div>}
          </div>
          {docs.length > 0 && <div><h2>Keep these ready</h2><ul className="jlist">{docs.map((x) => <li key={x.name}>{x.name}{x.req ? "" : " (if you have it)"}</li>)}</ul></div>}
          <p className="hint">Takes about 10 minutes. Your answers are saved at every step, so you can close this page and come back to the same link until {role.expires}. You can submit only once.</p>
        </>}

        {sid && <>
          <h2>{JSTEPS[step - 1].title}</h2>
          {JSTEPS[step - 1].intro && <p className="muted">{JSTEPS[step - 1].intro}</p>}
          <div className="f jf">{JSTEPS[step - 1].fields.map(field)}</div>
          {sid === "edu" && <div className="stack">
            <h2>Previous jobs</h2>
            <p className="hint" style={{ margin: 0 }}>Leave blank if this is your first job.</p>
            {exp.map((x, i) => (
              <fieldset className="jexp" key={i}><legend className="hint">Job {i + 1}</legend>
                <div className="f jf">
                  <div className="fld wide"><label htmlFor={`e${i}a`}>Employer</label><input id={`e${i}a`} value={x.employer} onChange={(v) => setExp(i, "employer", v.target.value)} />{err[`exp${i}`] && <span className="ferr">{err[`exp${i}`]}</span>}</div>
                  <div className="fld wide"><label htmlFor={`e${i}b`}>Role</label><input id={`e${i}b`} value={x.role} onChange={(v) => setExp(i, "role", v.target.value)} /></div>
                  <div className="fld"><label htmlFor={`e${i}c`}>From</label><input id={`e${i}c`} placeholder="Aug 2022" value={x.from} onChange={(v) => setExp(i, "from", v.target.value)} /></div>
                  <div className="fld"><label htmlFor={`e${i}d`}>To</label><input id={`e${i}d`} placeholder="Oct 2026" value={x.to} onChange={(v) => setExp(i, "to", v.target.value)} /></div>
                </div>
                {exp.length > 1 && <button type="button" className="btn link" onClick={() => set("experience", exp.filter((_, j) => j !== i))}>Remove this job</button>}
              </fieldset>))}
            {exp.length < 10 && <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => set("experience", [...exp, { employer: "", role: "", from: "", to: "" }])}>Add another job</button>}
          </div>}
        </>}

        {step === JSTEPS.length + 1 && <>
          <h2>Upload documents</h2>
          <p className="muted">A photo or PDF, up to 4 MB each. On a phone you can take a photo straight away.</p>
          {!docs.length && <p className="hint">HR has not asked for any documents. Continue.</p>}
          {docs.map((x) => { const f = files.find((y) => y.kind === x.name); const id = "up-" + x.name.replace(/\W+/g, "-"); return (
            <div className={"jdoc" + (f ? " done" : "")} key={x.name}>
              <div className="ic" aria-hidden="true">{f ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg>}</div>
              <div className="t"><b>{x.name}</b><small>{busy === x.name ? "Uploading…" : f ? `${f.fileName} · ${kb(f.size)}` : x.req ? "Required" : "Optional"}</small>
                {f && <button type="button" className="btn link" style={{ padding: 0 }} aria-label={`Remove ${x.name}`} disabled={!!busy} onClick={() => remove(f.id)}>Remove</button>}</div>
              <label className="btn sm" htmlFor={id}>{f ? "Replace" : "Upload"}</label>
              <input id={id} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr" disabled={!!busy} onChange={(e) => { upload(x.name, e.target.files?.[0]); e.target.value = ""; }} />
            </div>); })}
        </>}

        {step === LAST && <>
          <h2>Check and submit</h2>
          <p className="muted">You can submit only once. Check everything before you press Submit.</p>
          {sum.map(([t, n, s]) => <div className="card jsum" key={t}><div className="row between"><b>{t}</b><button type="button" className="btn link" onClick={() => go(n)}>Edit</button></div><span className="muted">{s}</span></div>)}
          <label className="chk"><input type="checkbox" checked={d.agree === true} onChange={(e) => set("agree", e.target.checked)} aria-invalid={!!err.agree || undefined} />
            <span>I confirm these details and documents are true and complete, and I agree that {org} may keep them for my employment records.</span></label>
        </>}

        {step === LAST + 1 && <div className="stack jdone">
          <div className="jmark ok" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg></div>
          <h1>Thank you, {first}</h1>
          <p className="muted">Your details have reached the HR office. They will check them and contact you{role.joinDate ? ` before ${role.joinDate}` : ""}.</p>
          <p className="hint">This link has now been used and won&apos;t open the form again. If something needs fixing, HR will send you a new link.</p>
        </div>}

      </div>
      {step <= LAST && <div className="jfoot">
        {msg && <div className="msg err" role="alert" style={{ flexBasis: "100%" }}>{msg}</div>}
        {step >= 1 && <button type="button" className="btn" onClick={() => go(step - 1)} disabled={!!busy}>Back</button>}
        <button type="button" className="btn primary" onClick={next} disabled={!!busy}>{busy === "save" ? "Saving…" : busy === "submit" ? "Submitting…" : step === 0 ? "Start" : step === LAST ? "Submit" : sid ? "Save and continue" : "Continue"}</button>
      </div>}
      {saved && step >= 1 && step <= LAST && <p className="hint" style={{ textAlign: "center", margin: "6px 0 0" }} role="status">Your answers are saved.</p>}
    </>
  );
}
