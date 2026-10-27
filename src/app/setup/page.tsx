import { redirect } from "next/navigation";
import { ensureSchema } from "@/db";
import { isSetUp } from "@/lib/settings";
import { DEMO } from "@/lib/demo";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { runSetup } from "@/app/actions/auth";
import Powered from "@/components/Powered";
import { Flash } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SetupPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await ensureSchema();
  if (DEMO || (await isSetUp())) redirect("/login");
  const sp = await searchParams;
  const recovery = Number((await db().select({ n: sql<number>`count(*)` }).from(schema.settings))[0].n) > 0;
  return (
    <div className="auth" style={{ maxWidth: 560 }}>
      <div className="card">
        <form action={runSetup} className="stack">
          <span className="pill p-adm" style={{ alignSelf: "flex-start" }}>First-run setup</span>
          <h1>{recovery ? "Recreate the Master Admin login" : "Set up your HRMS"}</h1>
          <p className="muted" style={{ margin: 0 }}>{recovery ? "There is no Master Admin login. All institute data and settings are kept; this only creates a new Master Admin." : "This page appears only once. It creates the organisation profile and the Master Admin login. All master fields start empty; you fill them in next."}</p>
          <div className="fld"><label htmlFor="key">Setup key</label><input id="key" name="key" type="password" required autoComplete="off" /><span className="hint">The SETUP_KEY value from your hosting settings. It stops anyone else from claiming this page.</span></div>
          {!recovery && <>
          <div className="fld"><label htmlFor="name">Organisation name</label><input id="name" name="name" required /></div>
          <div className="f">
            <div className="fld"><label htmlFor="short">Short name</label><input id="short" name="short" maxLength={12} placeholder="e.g. GEIMS" /></div>
            <div className="fld"><label htmlFor="prefix">Employee ID prefix</label><input id="prefix" name="prefix" maxLength={8} defaultValue="EMP" /><span className="hint">Login IDs become PREFIX-F-1042.</span></div>
          </div>
          <div className="fld"><label htmlFor="addr">City / address line</label><input id="addr" name="addr" /></div>
          </>}
          <h2 style={{ marginTop: 8 }}>Master Admin password</h2>
          <p className="hint" style={{ margin: 0 }}>The Master Admin signs in with the login ID <b className="mono">admin</b>. At least 8 characters, with a letter, a number and a symbol.</p>
          <div className="f">
            <div className="fld"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="new-password" /></div>
            <div className="fld"><label htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" required autoComplete="new-password" /></div>
          </div>
          <Flash sp={sp} />
          <button className="btn primary" type="submit" style={{ justifyContent: "center" }}>{recovery ? "Create Master Admin" : "Complete setup"}</button>
        </form>
      </div>
      <div style={{ marginTop: 16 }}><Powered center /></div>
    </div>
  );
}
