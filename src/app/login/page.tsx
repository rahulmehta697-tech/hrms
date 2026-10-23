import { redirect } from "next/navigation";
import { getSettings, isSetUp } from "@/lib/settings";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import { Flash, Mark } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!(await isSetUp())) redirect("/setup");
  if (await getUser()) redirect("/");
  const sp = await searchParams;
  const { org, pol } = await getSettings();
  return (
    <div className="auth">
      <div className="card">
        <div className="lg-head"><Mark org={org} big /><div><b style={{ fontFamily: "var(--f-display)", fontSize: "1.1rem", display: "block" }}>{org.name}</b><span className="hint">HR portal</span></div></div>
        {sp.forgot ? (
          <div className="stack">
            <h1>Forgot your password?</h1>
            <p className="muted" style={{ margin: 0 }}>Ask the HR office or the Master Admin to reset it. They will give you a temporary password, and you choose your own when you next sign in.</p>
            <a className="btn" href="/login" style={{ alignSelf: "flex-start" }}>Back to sign in</a>
          </div>
        ) : (
          <form action={login} className="stack">
            <h1>Sign in</h1>
            <p className="muted" style={{ margin: 0 }}>Use your employee ID and password.</p>
            <div className="fld"><label htmlFor="login">Employee ID</label><input id="login" name="login" autoComplete="username" placeholder={`${org.prefix}-F-1042`} defaultValue={sp.u || ""} required /></div>
            <div className="fld"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
            <Flash sp={sp} />
            <button className="btn primary" type="submit" style={{ justifyContent: "center" }}>Sign in</button>
            <a className="btn link" href="/login?forgot=1" style={{ alignSelf: "flex-start" }}>Forgot password?</a>
            <p className="hint" style={{ margin: 0 }}>After {pol.lock} wrong passwords the login locks until the Master Admin unlocks it.</p>
          </form>
        )}
      </div>
    </div>
  );
}
