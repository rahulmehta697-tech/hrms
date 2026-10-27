import "server-only";
import { ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getMasters, getSettings } from "./settings";
import { DEFAULTS, MASTERS } from "./config";
import { licenceStatus } from "./license";
import type { SessionUser } from "./auth";

export type Step = { title: string; detail: string; href: string; done: boolean; optional?: boolean };

/** The Master Admin's setup checklist, shared by the checklist page and the Settings hub. */
export async function setupSteps(u: SessionUser) {
  const { org, rules } = await getSettings();
  const m = await getMasters();
  const n = (k: string) => (m[k] || []).filter((r) => r.active).length;
  const emps = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.employees).where(ne(schema.employees.status, "Exited")))[0].c);
  const logins = Number((await db().select({ c: sql<number>`count(*)` }).from(schema.users).where(ne(schema.users.role, "admin")))[0].c);
  const heads = (m.dept || []).filter((r) => r.active && String(r.data[2] || "").trim()).length;
  const basic = (m.sal || []).some((r) => r.active && r.data[4] === "Basic pay");
  const lic = await licenceStatus();
  const title = (k: string) => MASTERS.find((x) => x.kind === k)!.title;
  const master = (k: string, optional = false): Step => ({ title: title(k), detail: n(k) ? `${n(k)} active` : `Empty. Add entries or import from Excel (${MASTERS.find((x) => x.kind === k)!.hint}).`, href: `/admin/masters/${k}`, done: n(k) > 0, optional });
  const steps: Step[] = [
    { title: "Organisation profile and logo", detail: org.name === DEFAULTS.org.name ? "Still shows the placeholder name." : `${org.name}${org.logo ? ", logo uploaded" : ", no logo yet"}`, href: "/admin/institute", done: org.name !== DEFAULTS.org.name },
    ...(u.role === "admin" ? [{ title: "Licence", detail: lic.message, href: "/admin/licence", done: lic.state === "valid" || lic.state === "expiring" }] : []),
    master("cat"), master("dept"), master("desig"), master("leave"), master("shift"), master("hol"), master("src"),
    { ...master("sal"), detail: n("sal") ? `${n("sal")} active${basic ? "" : ". No component has the rule “Basic pay” yet, so PF cannot be calculated."}` : master("sal").detail },
    master("docs", true),
    { title: "Attendance rules", detail: rules.start ? `Tracking from ${rules.start}${rules.thrCat ? `, minimum ${rules.thr}% for ${rules.thrCat}` : ""}` : "Set the date attendance tracking starts.", href: "/admin/rules", done: !!rules.start },
    { title: "Approval workflows", detail: "Check who approves leave and regularisation.", href: "/admin/workflows", done: true, optional: true },
    { title: "Employees", detail: emps ? `${emps.toLocaleString("en-IN")} employees` : "Import your employee list from Excel.", href: "/employees", done: emps > 0 },
    { title: "Heads of department", detail: n("dept") ? `${heads} of ${n("dept")} departments have a head` : "Add departments first.", href: "/admin/masters/dept", done: n("dept") > 0 && heads === n("dept"), optional: true },
    ...(u.role === "admin" ? [{ title: "Logins for staff", detail: logins ? `${logins} logins created` : "Create logins once employees are in.", href: "/admin/users", done: emps > 0 && logins >= emps }] : []),
  ];
  return { steps, done: steps.filter((s) => s.done).length };
}
