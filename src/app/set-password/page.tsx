import { redirect } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { getUser, passwordExpired, pwRuleText } from "@/lib/auth";
import { setPassword, logout } from "@/app/actions/auth";
import { Flash, Mark } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await getUser();
  if (!u) redirect("/login");
  const expired = await passwordExpired(u);
  if (!u.mustChange && !expired) redirect("/");
  const sp = await searchParams;
  const { org, pol } = await getSettings();
  return (
    <div className="auth">
      <div className="card">
        <div className="lg-head"><Mark org={org} big /><div><b style={{ fontFamily: "var(--f-display)", fontSize: "1.1rem", display: "block" }}>{org.name}</b><span className="hint">HR portal</span></div></div>
        <form action={setPassword} className="stack">
          <h1>Set your password</h1>
          <p className="muted" style={{ margin: 0 }}>Hi {u.name}, {expired && !u.mustChange ? "your password has expired." : "you signed in with a temporary password."} Choose your own to continue.</p>
          <div className="fld"><label htmlFor="new">New password</label><input id="new" name="new" type="password" required autoComplete="new-password" /></div>
          <div className="fld"><label htmlFor="confirm">Confirm new password</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" /></div>
          <p className="hint" style={{ margin: 0 }}>{pwRuleText(pol)}</p>
          <Flash sp={sp} />
          <button className="btn primary" type="submit" style={{ justifyContent: "center" }}>Save and continue</button>
        </form>
        <form action={logout} style={{ marginTop: 10 }}><button className="btn link" type="submit">Sign out</button></form>
      </div>
    </div>
  );
}
