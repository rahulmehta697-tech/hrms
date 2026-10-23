import type { Org } from "@/lib/config";

export function Mark({ org, big }: { org: Org; big?: boolean }) {
  const ini = (org.short || org.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "LOGO";
  return <div className={"mark" + (org.logo ? " img" : "")} style={big ? { width: 52, height: 52 } : undefined}>{org.logo ? <img src={org.logo} alt="" /> : ini}</div>;
}

export function Head({ title, sub, tag, children }: { title: string; sub?: React.ReactNode; tag?: string; children?: React.ReactNode }) {
  return (
    <div className="head">
      <div>{tag && <span className="pill p-adm">{tag}</span>}<h1 style={tag ? { marginTop: 6 } : undefined}>{title}</h1>{sub && <p>{sub}</p>}</div>
      {children}
    </div>
  );
}

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = typeof sp.ok === "string" ? sp.ok : "", err = typeof sp.err === "string" ? sp.err : "";
  if (!ok && !err) return null;
  return <div className={"msg " + (err ? "err" : "ok")} role={err ? "alert" : "status"}>{err || ok}</div>;
}

const PILL: Record<string, string> = { approved: "p-ok", pending: "p-warn", rejected: "p-bad", cancelled: "p-mute", Present: "p-ok", Late: "p-warn", "Half day": "p-warn", "On leave": "p-info", Holiday: "p-mute", "Weekly off": "p-mute", Absent: "p-bad", "Not punched": "p-mute", "Not tracked": "p-mute", Upcoming: "p-mute", Active: "p-ok", Locked: "p-bad", Disabled: "p-mute", Probation: "p-info", "On notice": "p-warn", Exited: "p-mute", Open: "p-ok", Closed: "p-mute" };
const LABEL: Record<string, string> = { approved: "Approved", pending: "Awaiting approval", rejected: "Rejected", cancelled: "Cancelled" };
export function Pill({ s, cls }: { s: string; cls?: string }) {
  return <span className={"pill " + (cls || PILL[s] || "p-mute")}>{LABEL[s] || s}</span>;
}

export function Stat({ n, label }: { n: React.ReactNode; label: string }) {
  return <div className="card stat"><b>{n}</b><small>{label}</small></div>;
}

export function Pager({ page, total, size, href }: { page: number; total: number; size: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <p className="hint" style={{ marginTop: 10 }}>{total} shown</p>;
  return (
    <div className="pager">
      <span className="hint num">{(page - 1) * size + 1}–{Math.min(total, page * size)} of {total}</span>
      {page > 1 && <a className="btn sm" href={href(page - 1)}>Previous</a>}
      {page < pages && <a className="btn sm" href={href(page + 1)}>Next</a>}
    </div>
  );
}

/** Confirm-before-submit without browser dialogs. */
export function Confirm({ label, confirm, action, danger = true, children }: { label: string; confirm: string; action: (fd: FormData) => Promise<void>; danger?: boolean; children?: React.ReactNode }) {
  return (
    <details className="confirm">
      <summary className={"btn sm" + (danger ? " danger" : "")}>{label}</summary>
      <div><form action={action}>{children}<button className={"btn sm" + (danger ? " danger" : " primary")} type="submit">{confirm}</button></form></div>
    </details>
  );
}

export const Ico = {
  up: <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 11v2.5h11V11" /></svg>,
  xl: <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M2.5 6.5h11M2.5 10h11M6.5 2.5v11" /></svg>,
  pdf: <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 1.8h5.5L12.5 5v9.2H4z" /><path d="M9.5 1.8V5h3M6 8.5h4.5M6 11h4.5" /></svg>,
};
