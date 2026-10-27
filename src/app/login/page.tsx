import { redirect } from "next/navigation";
import { dbUrl, ensureSchema } from "@/db";
import { getSettings, isSetUp } from "@/lib/settings";
import { DEMO, DEMO_ACCOUNTS, DEMO_PASSWORD, DEMO_RESET_TIME, seedDemo } from "@/lib/demo";
import { getUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import Powered from "@/components/Powered";
import { Flash, Mark } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!dbUrl()) return (
    <div className="auth"><div className="card stack"><h1>Almost there</h1>
      <p className="muted" style={{ margin: 0 }}>No database is connected to this site yet. In Vercel, open this project&apos;s <b>Storage</b> tab, connect a Neon database, then open <b>Deployments</b> and redeploy. The tables and sample data are created on the first visit after that.</p></div></div>
  );
  await ensureSchema();
  if (!(await isSetUp())) { if (DEMO) await seedDemo(); else redirect("/setup"); }
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
            {!DEMO && <p className="hint" style={{ margin: 0 }}>After {pol.lock} wrong passwords the login locks until the Master Admin unlocks it.</p>}
          </form>
        )}
      </div>
      {DEMO && (
        <div className="card stack" style={{ marginTop: 16 }}>
          <div><span className="pill p-adm">Demo</span><h2 style={{ marginTop: 8 }}>Try it as any role</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>This is a demo with a fictional institute and sample data. Pick a role to sign in. Every account uses the password <b className="mono" style={{ userSelect: "all" }}>{DEMO_PASSWORD}</b>. Changes you make are wiped every night at {DEMO_RESET_TIME}.</p></div>
          <div className="list">{DEMO_ACCOUNTS.map((a) => (
            <div key={a.login}>
              <div style={{ minWidth: 0, flex: "1 1 200px" }}><b>{a.label}</b><div className="hint">{a.note} · <span className="mono">{a.login === "ADMIN" ? "admin" : `${org.prefix}-${a.login}`}</span></div></div>
              <form action={login}><input type="hidden" name="login" value={a.login === "ADMIN" ? "admin" : `${org.prefix}-${a.login}`} /><input type="hidden" name="password" value={DEMO_PASSWORD} /><button className="btn sm primary" type="submit">Sign in</button></form>
            </div>))}</div>
        </div>
      )}
      <div style={{ marginTop: 16 }}><Powered center /></div>
    </div>
  );
}
