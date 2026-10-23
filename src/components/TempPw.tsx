"use client";
import { useActionState } from "react";
import { resetPassword, createLogin, type TempState } from "@/app/actions/admin";

function Shown({ s, prefix }: { s: TempState; prefix: string }) {
  if (!s) return null;
  if (s.err) return <div className="msg err" style={{ marginTop: 6 }}>{s.err}</div>;
  return <div className="msg ok" style={{ marginTop: 6 }}>Temporary password for <span className="mono">{prefix}-{s.login}</span>: <b className="mono" style={{ userSelect: "all" }}>{s.pw}</b>. Share it privately; it is shown only once and must be changed at first sign-in.</div>;
}

export function ResetBtn({ id, prefix }: { id: number; prefix: string }) {
  const [s, act, busy] = useActionState(resetPassword, null);
  return <form action={act}><input type="hidden" name="id" value={id} /><button className="btn sm" type="submit" disabled={busy}>Reset password</button><Shown s={s} prefix={prefix} /></form>;
}

export function CreateLogin({ prefix, roles }: { prefix: string; roles: [string, string][] }) {
  const [s, act, busy] = useActionState(createLogin, null);
  return (
    <form action={act}>
      <div className="row" style={{ alignItems: "end" }}>
        <div className="fld" style={{ flex: "0 1 200px" }}><label htmlFor="employeeId">Employee ID</label><input id="employeeId" name="employeeId" required placeholder={`${prefix}-F-1042`} /></div>
        <div className="fld" style={{ flex: "0 1 180px" }}><label htmlFor="role">Role</label><select id="role" name="role" defaultValue="staff">{roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <button className="btn primary" type="submit" disabled={busy}>Create login</button>
      </div>
      <Shown s={s} prefix={prefix} />
    </form>
  );
}
