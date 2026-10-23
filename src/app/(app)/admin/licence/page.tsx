import { requireAdmin } from "@/lib/auth";
import { licenceStatus } from "@/lib/license";
import { PRODUCT } from "@/lib/product";
import { fd } from "@/lib/dates";
import { removeLicence, saveLicence } from "@/app/actions/admin";
import { Confirm, Flash, Head, Stat } from "@/components/ui";

const PILL = { valid: ["p-ok", "Valid"], expiring: ["p-warn", "Expiring soon"], grace: ["p-bad", "Expired, in grace period"], expired: ["p-bad", "Expired"], none: ["p-mute", "Demo mode"], invalid: ["p-bad", "Invalid key"] } as const;

export default async function LicencePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await licenceStatus();
  const [cls, label] = PILL[s.state];
  return (
    <>
      <Head tag="Settings" title="Licence" sub={`This copy of ${PRODUCT.name} runs under a licence key issued by your vendor. Paste a new key here to renew or upgrade.`} />
      <Flash sp={sp} />
      <div className="grid g4">
        <div className="card stat"><b><span className={"pill " + cls} style={{ fontSize: ".9rem" }}>{label}</span></b><small>status</small></div>
        <Stat n={s.lic ? fd(s.lic.x) : "—"} label="expires on" />
        <Stat n={`${s.employees.toLocaleString("en-IN")} / ${Number.isFinite(s.limit) ? s.limit.toLocaleString("en-IN") : "∞"}`} label="employees used / allowed" />
        <Stat n={s.lic?.id || "—"} label="licence ID" />
      </div>
      <div className={"msg " + (s.state === "valid" ? "ok" : "err")}>{s.message}</div>
      {s.lic && <div className="card"><h2>Licence details</h2><div className="list">
        <div><span className="muted">Licensed to</span><span>{s.lic.c}</span></div>
        <div><span className="muted">Issued on</span><span>{fd(s.lic.i)}</span></div>
        <div><span className="muted">Grace period after expiry</span><span>{s.lic.g ?? 15} days</span></div>
      </div></div>}
      <form action={saveLicence} className="card stack">
        <h2>{s.key ? "Replace the licence key" : "Enter a licence key"}</h2>
        <div className="fld"><label htmlFor="key">Licence key</label><textarea id="key" name="key" required placeholder="HRMS1.…" style={{ fontFamily: "var(--f-mono)", minHeight: 90 }} /></div>
        <div><button className="btn primary" type="submit">Check and save</button></div>
        {PRODUCT.support && <p className="hint" style={{ margin: 0 }}>Need a key or a renewal? Contact {PRODUCT.support}.</p>}
      </form>
      {s.key && <div><Confirm label="Remove the stored key" confirm="Remove the licence key" action={removeLicence} /></div>}
    </>
  );
}
