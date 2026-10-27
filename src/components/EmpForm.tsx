import { saveEmployee } from "@/app/actions/hr";
import { EMP_STATUS } from "@/lib/config";
import { EMP_EXTRA, GENDERS, MARITAL, type EmpExtra } from "@/lib/empfields";

type E = { id?: string; name?: string; designation?: string; department?: string; category?: string; doj?: string | null; status?: string; shift?: string | null; mobile?: string | null; email?: string | null; pan?: string | null; uan?: string | null; bankAccount?: string | null; ifsc?: string | null; aadhaarLast4?: string | null } & Partial<Record<EmpExtra["key"], string | null>>;

export default function EmpForm({ e, opts, isNew, prefix }: { e: E; opts: { desig: string[]; dept: string[]; cat: string[]; shift: string[] }; isNew: boolean; prefix: string }) {
  const sel = (name: keyof E, list: string[], label: string, blank?: string) => (
    <div className="fld"><label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={(e[name] as string) || ""} required={!blank}>
        {blank ? <option value="">{blank}</option> : <option value="" disabled>Choose…</option>}
        {[...new Set([...(e[name] && !list.includes(e[name] as string) ? [e[name] as string] : []), ...list])].map((x) => <option key={x}>{x}</option>)}
      </select></div>
  );
  const inp = (name: keyof E, label: string, type = "text", extra: Record<string, unknown> = {}) => (
    <div className="fld"><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} defaultValue={(e[name] as string) || ""} {...extra} /></div>
  );
  return (
    <form action={saveEmployee} className="card stack">
      <input type="hidden" name="isNew" value={isNew ? "1" : "0"} />
      <div className="f">
        <div className="fld"><label htmlFor="id">Employee ID</label><input id="id" name="id" defaultValue={e.id || ""} readOnly={!isNew} required placeholder="F-1042" /><span className="hint">Login ID will be {prefix}-{e.id || "F-1042"}.</span></div>
        {inp("name", "Full name", "text", { required: true })}
        {sel("designation", opts.desig, "Designation")}
        {sel("department", opts.dept, "Department")}
        {sel("category", opts.cat, "Category")}
        {inp("doj", "Date of joining", "date")}
        {sel("status", EMP_STATUS, "Status")}
        {sel("shift", opts.shift, "Shift", "Default shift")}
        {inp("mobile", "Mobile", "tel")}
        {inp("email", "Email", "email")}
        {inp("pan", "PAN")}
        {inp("uan", "PF UAN")}
        {inp("bankAccount", "Bank account number")}
        {inp("ifsc", "IFSC")}
      </div>
      <h2 style={{ marginTop: 8 }}>Personal file</h2>
      <div className="f">
        <div className="fld"><label htmlFor="aadhaar">Aadhaar</label><input id="aadhaar" name="aadhaar" inputMode="numeric" autoComplete="off" placeholder={e.aadhaarLast4 ? `Saved: •••• •••• ${e.aadhaarLast4}` : "12 digits"} /><span className="hint">{e.aadhaarLast4 ? "Leave blank to keep the saved number." : "Stored encrypted."}</span></div>
        {EMP_EXTRA.map((x) => x.key === "gender" || x.key === "maritalStatus"
          ? <div className="fld" key={x.key}><label htmlFor={x.key}>{x.header}</label><select id={x.key} name={x.key} defaultValue={String(e[x.key] || "")}><option value="">Not given</option>{(x.key === "gender" ? GENDERS : MARITAL).map((o) => <option key={o}>{o}</option>)}</select></div>
          : <div className={"fld" + (x.wide ? " wide" : "")} key={x.key}><label htmlFor={x.key}>{x.header}</label>{x.wide ? <textarea id={x.key} name={x.key} defaultValue={String(e[x.key] || "")} /> : <input id={x.key} name={x.key} type={x.date ? "date" : "text"} defaultValue={String(e[x.key] || "")} />}</div>)}
      </div>
      <div><button className="btn primary" type="submit">{isNew ? "Add employee" : "Save changes"}</button></div>
    </form>
  );
}
