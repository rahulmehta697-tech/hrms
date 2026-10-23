"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BulkLogins({ count }: { count: number }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok?: boolean; t: string } | null>(null);
  const router = useRouter();
  async function run() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/logins", { method: "POST" });
      if (!r.ok) { setMsg({ t: (await r.json()).error || "Could not create logins." }); setBusy(false); return; }
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "")?.[1] || "new-logins.xlsx";
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      const made = r.headers.get("X-Created"), left = Number(r.headers.get("X-Remaining") || 0);
      setMsg({ ok: true, t: `${made} logins created. ${name} has their temporary passwords; keep it safe and delete it after sharing.${left ? ` ${left} employees still need a login; press the button again for the next batch.` : ""}` });
      router.refresh();
    } catch { setMsg({ t: "Could not reach the server." }); }
    setBusy(false);
  }
  return (
    <div className="stack">
      <div className="row between"><div><h2>{count} employees have no login yet</h2><p className="hint" style={{ margin: "4px 0 0" }}>Creates logins in batches of up to 200 (heads of department get the HOD role) and downloads an Excel file of their temporary passwords. That file is the only copy.</p></div>
        <button className="btn primary" type="button" onClick={run} disabled={busy}>{busy ? "Creating…" : `Create ${Math.min(count, 200)} logins`}</button></div>
      {msg && <div className={"msg " + (msg.ok ? "ok" : "err")}>{msg.t}</div>}
    </div>
  );
}
