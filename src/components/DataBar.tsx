"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Row = { o: Record<string, string | number>; err: string };
type Preview = { file: string; headers: string[]; missing: string[]; total: number; ok: number; rows: Row[] };

const I = {
  up: <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 11v2.5h11V11" /></svg>,
  xl: <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M2.5 6.5h11M2.5 10h11M6.5 2.5v11" /></svg>,
  pdf: <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 1.8h5.5L12.5 5v9.2H4z" /><path d="M9.5 1.8V5h3M6 8.5h4.5M6 11h4.5" /></svg>,
};

export default function DataBar({ ds, params = "", canImport, canExport, importLabel, exportOnly, label }: { ds: string; params?: string; canImport?: boolean; canExport?: boolean; importLabel?: string; exportOnly?: string; label?: string }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: boolean; t: string } | null>(null);
  const router = useRouter();
  if (!canImport && !canExport) return null;
  const q = params ? "&" + params : "";

  async function send(commit: boolean, f = file) {
    if (!f) return;
    setBusy(true); setMsg(null);
    const fd = new FormData(); fd.append("file", f); fd.append("params", params); if (commit) fd.append("commit", "1");
    try {
      const r = await fetch(`/api/import/${ds}`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) setMsg({ t: j.error || "Import failed." });
      else if (commit) { setMsg({ ok: true, t: j.message }); setPv(null); setFile(null); router.refresh(); }
      else setPv(j);
    } catch { setMsg({ t: "Could not reach the server. Check the connection and try again." }); }
    setBusy(false);
  }
  function open() { setPv(null); setFile(null); setMsg(null); dlg.current?.showModal(); }

  return (
    <>
      <div className="dbar">
        {label && <span className="hint" style={{ marginRight: 2 }}>{label}</span>}
        {canImport && <button className="btn sm" type="button" onClick={open}>{I.up}Import</button>}
        {canImport && canExport && <span className="sep" />}
        {canExport && <a className="btn sm" href={`/api/export/${exportOnly || ds}?format=xlsx${q}`}>{I.xl}Excel</a>}
        {canExport && <a className="btn sm" href={`/api/export/${exportOnly || ds}?format=pdf${q}`}>{I.pdf}PDF</a>}
      </div>
      {canImport && (
        <dialog ref={dlg} className="card imp" style={{ width: "min(960px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)", padding: 20, color: "var(--fg)" }}>
          <div className="row between" style={{ marginBottom: 14 }}><h2>Import {importLabel || "data"}</h2><button className="btn sm" type="button" onClick={() => dlg.current?.close()}>Close</button></div>
          {!pv ? (
            <ol>
              <li><b>Get the template.</b> <span className="muted">An Excel file with the right columns and an Instructions sheet.</span><div style={{ marginTop: 6 }}><a className="btn sm" href={`/api/template/${ds}${params ? "?" + params : ""}`}>{I.xl}Download template</a></div></li>
              <li><b>Fill it in and choose the file.</b> <span className="muted">Excel (.xlsx) or CSV, up to 4 MB. Files exported from this HRMS can be imported back.</span>
                <div className="fld" style={{ marginTop: 6, maxWidth: 420 }}><input type="file" accept=".xlsx,.csv" aria-label="File to import" onChange={(e) => { const f = e.target.files?.[0] || null; setFile(f); if (f) send(false, f); }} /></div></li>
              <li><b>Check the preview, then import.</b> <span className="muted">Rows with problems are listed and skipped; nothing is saved until you confirm.</span></li>
            </ol>
          ) : pv.missing.length ? (
            <div className="msg err">“{pv.file}” is missing these columns: <b>{pv.missing.join(", ")}</b>. Download the template and copy your data into it.</div>
          ) : !pv.total ? (
            <div className="msg err">“{pv.file}” has no data rows under the header.</div>
          ) : (
            <>
              <div className="row" style={{ marginBottom: 10 }}><b>{pv.file}</b><span className="muted num">{pv.total} rows</span><span className="pill p-ok num">{pv.ok} ready</span>{pv.total - pv.ok > 0 && <span className="pill p-bad num">{pv.total - pv.ok} with problems</span>}</div>
              <div className="tw" style={{ maxHeight: "50vh", overflow: "auto" }}>
                <table><thead><tr><th>#</th><th>Check</th>{pv.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{pv.rows.map((r, i) => <tr key={i} className={r.err ? "bad" : ""}><td className="num muted">{i + 1}</td><td style={{ minWidth: 180 }}>{r.err ? <span style={{ color: "var(--bad)", fontWeight: 600 }}>{r.err}</span> : <span className="pill p-ok">OK</span>}</td>{pv.headers.map((h) => <td key={h}>{String(r.o[h] ?? "")}</td>)}</tr>)}</tbody></table>
              </div>
              {pv.total > pv.rows.length && <p className="hint">Showing the first {pv.rows.length} of {pv.total} rows. All {pv.ok} ready rows will be imported.</p>}
            </>
          )}
          {msg && <div className={"msg " + (msg.ok ? "ok" : "err")} style={{ marginTop: 12 }}>{msg.t}</div>}
          <div className="row" style={{ marginTop: 14 }}>
            {pv && !pv.missing.length && pv.ok > 0 && <button className="btn primary" type="button" disabled={busy} onClick={() => send(true)}>{busy ? "Importing…" : `Import ${pv.ok} row${pv.ok === 1 ? "" : "s"}`}</button>}
            {pv && <button className="btn" type="button" onClick={() => { setPv(null); setFile(null); setMsg(null); }}>Choose another file</button>}
            {busy && !pv && <span className="hint">Checking the file…</span>}
          </div>
        </dialog>
      )}
    </>
  );
}
