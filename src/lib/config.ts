/** Static definitions: master field columns, roles, permissions and the defaults used on first-run setup. */

export type Col = { key: string; label: string; type?: "text" | "num" | "date" | "time" | `sel:${string}`; required?: boolean; help?: string };
export type MasterDef = { kind: string; title: string; desc: string; cols: Col[]; hint: string };

/** New installs start with every master empty; the Master Admin fills them in (or imports them) during setup. */
export const MASTERS: MasterDef[] = [
  { kind: "cat", title: "Employee categories", desc: "Groups of staff used for leave rules, attendance thresholds and reports. The ID code starts each employee ID.",
    cols: [{ key: "name", label: "Category", required: true }, { key: "code", label: "ID code", required: true, help: "1–4 letters or digits that start this category's employee IDs, e.g. F gives F-1042." }, { key: "prob", label: "Probation (months)", type: "num" }],
    hint: "e.g. Teaching staff (T), Non-teaching staff (N), Contract (C)" },
  { kind: "dept", title: "Departments", desc: "Every employee belongs to one department. The head of department approves its requests.",
    cols: [{ key: "name", label: "Department", required: true }, { key: "type", label: "Group" }, { key: "head", label: "Head (employee ID)", help: "Employee ID of the head of department, e.g. T-0412. Fill this in after employees are added. Leave blank if none." }],
    hint: "e.g. Accounts, Admissions, Physics" },
  { kind: "desig", title: "Designations", desc: "Designations appear in employee records, payslips and reports.",
    cols: [{ key: "name", label: "Designation", required: true }, { key: "cat", label: "Category", type: "sel:@cat" }, { key: "grade", label: "Pay grade" }],
    hint: "e.g. Professor, Accountant, Driver" },
  { kind: "leave", title: "Leave types", desc: "Leave types and yearly quotas. Inactive types disappear from the leave form.",
    cols: [{ key: "code", label: "Code", required: true }, { key: "name", label: "Leave type", required: true }, { key: "quota", label: "Days per year", type: "num" }, { key: "carry", label: "Carry forward", type: "sel:No|Up to 30 days|Up to 300 days" }, { key: "apply", label: "Applies to", type: "sel:All staff|@cat" }],
    hint: "e.g. CL Casual leave 12, EL Earned leave 30" },
  { kind: "shift", title: "Shifts", desc: "Shift timings decide late marks. The first active shift is the default for employees without one.",
    cols: [{ key: "name", label: "Shift", required: true }, { key: "start", label: "Starts", type: "time" }, { key: "end", label: "Ends", type: "time" }, { key: "grace", label: "Grace (min)", type: "num" }],
    hint: "e.g. General 09:00–17:00, 15 minutes grace" },
  { kind: "hol", title: "Holidays", desc: "Holidays show on every calendar and are not counted as absence.",
    cols: [{ key: "date", label: "Date", type: "date", required: true }, { key: "name", label: "Holiday", required: true }, { key: "kind", label: "Type", type: "sel:Gazetted|Restricted|Institute" }],
    hint: "the year's holiday list" },
  { kind: "src", title: "Attendance sources", desc: "Every place punches come from. Punches from all active sources are merged into one daily record.",
    cols: [{ key: "name", label: "Source name", required: true }, { key: "kind", label: "Method", type: "sel:Biometric fingerprint|Face recognition|Mobile app, geo-fenced|RFID card|Web punch|Manual entry|File import" }, { key: "loc", label: "Where / devices" }, { key: "sync", label: "How it arrives", type: "sel:Daily file import|Real time|Every 15 min|Hourly" }],
    hint: "e.g. Main gate biometric, Face kiosk" },
  { kind: "sal", title: "Salary components", desc: "Components used in salary structures and monthly payroll inputs. The Rule column tells payroll how to treat each one.",
    cols: [{ key: "name", label: "Component", required: true }, { key: "kind", label: "Type", type: "sel:Earning|Deduction|Employer contribution", required: true }, { key: "calc", label: "Notes" }, { key: "tax", label: "Taxable", type: "sel:Yes|No" }, { key: "rule", label: "Rule", type: "sel:Fixed amount|Basic pay|Auto: employee PF|Auto: employee ESI|Auto: employer PF|Income tax (TDS)", help: "Fixed amount: paid or deducted as entered. Basic pay: the base for PF. Auto PF: 12% of basic pay, capped at 15,000 basic. Auto ESI: 0.75% employee and 3.25% employer when gross is 21,000 or less. Income tax (TDS): a fixed amount shown separately in reports." }],
    hint: "e.g. Basic pay (rule Basic pay), HRA, Provident fund (rule Auto: employee PF)" },
  { kind: "docs", title: "Onboarding checklist", desc: "Steps every new joiner goes through. “Required for” limits a step to one category.",
    cols: [{ key: "name", label: "Checklist item", required: true }, { key: "for", label: "Required for", type: "sel:All|@cat" }],
    hint: "e.g. Documents verified, ID card issued" },
  { kind: "jdocs", title: "Joining documents", desc: "Documents new joiners upload on the joining form. “Required” ones must be uploaded before they can submit.",
    cols: [{ key: "name", label: "Document", required: true }, { key: "for", label: "Asked from", type: "sel:All|@cat" }, { key: "req", label: "Required", type: "sel:Yes|No" }],
    hint: "e.g. Passport-size photo (Yes), Aadhaar card (Yes), Experience letter (No)" },
];
export const SAL_RULES = ["Fixed amount", "Basic pay", "Auto: employee PF", "Auto: employee ESI", "Auto: employer PF", "Income tax (TDS)"] as const;
export const masterDef = (kind: string) => MASTERS.find((m) => m.kind === kind);

export const ROLES = { admin: "Master Admin", hr: "HR Office", accounts: "Accounts", management: "Management", hod: "HOD", staff: "Staff" } as const;
export type Role = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as Role[];

export const PERMS = {
  masters: "Master fields & settings",
  employees: "Employee records",
  approve: "Approve requests",
  attendance: "Attendance register",
  payroll: "Run payroll",
  recruitment: "Recruitment & onboarding",
  reports: "Reports & dashboards",
  import: "Import data",
  export: "Export data (Excel / PDF)",
} as const;
export type Perm = keyof typeof PERMS;
export const PERM_KEYS = Object.keys(PERMS) as Perm[];

export const APPROVERS = ["Reporting HOD", "HR Office", "Accounts", "Management"] as const;
export const APPROVER_ROLE: Record<string, Role | "hodOf"> = { "Reporting HOD": "hodOf", "HR Office": "hr", Accounts: "accounts", Management: "management" };

export type Org = { name: string; short: string; addr: string; prefix: string; fy: string; weekoff: string; tz: string; logo: string | null; logoPng: string | null; hrPhone?: string; hrEmail?: string };
export type Policy = { min: number; complex: boolean; expiry: number; lock: number; session: number };
export type Rules = { thr: number; thrCat: string; merge: string; half: number; countOffs: boolean; start: string };
export type Flow = { key: string; title: string; chain: string[] };
export type Access = Record<Role, Perm[]>;

export const DEFAULTS = {
  org: { name: "Your Institute Name", short: "INST", addr: "City, State", prefix: "EMP", fy: "April – March", weekoff: "Sunday", tz: "Asia/Kolkata", logo: null, logoPng: null } as Org,
  pol: { min: 8, complex: true, expiry: 0, lock: 5, session: 12 } as Policy,
  rules: { thr: 75, thrCat: "", merge: "First punch in, last punch out across all sources", half: 4, countOffs: false, start: "" } as Rules,
  flows: [
    { key: "leave_short", title: "Leave, up to 3 days", chain: ["Reporting HOD"] },
    { key: "leave_long", title: "Leave, more than 3 days", chain: ["Reporting HOD", "HR Office"] },
    { key: "regularise", title: "Attendance regularisation", chain: ["Reporting HOD"] },
  ] as Flow[],
  access: {
    admin: [...PERM_KEYS],
    hr: ["employees", "approve", "attendance", "payroll", "recruitment", "reports", "export"],
    accounts: ["approve", "payroll", "reports", "export"],
    management: ["approve", "reports", "export"],
    hod: ["approve"],
    staff: [],
  } as Access,
};

export const WEEKOFF_OPTIONS = ["Sunday", "Saturday and Sunday", "Second and fourth Saturday, Sunday", "None (roster based)"];
export const STAGES = ["Applied", "Shortlisted", "Interview", "Offer", "Joining"];
export const EMP_STATUS = ["Active", "Probation", "On notice", "Exited"];
