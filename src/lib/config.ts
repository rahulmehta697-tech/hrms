/** Static definitions: master field columns, roles, permissions and the defaults used on first-run setup. */

export type Col = { key: string; label: string; type?: "text" | "num" | "date" | "time" | `sel:${string}`; required?: boolean; help?: string };
export type MasterDef = { kind: string; title: string; desc: string; cols: Col[]; seed: (string | number)[][] };

export const MASTERS: MasterDef[] = [
  { kind: "dept", title: "Departments", desc: "Every employee belongs to one department. The head of department approves requests for it.",
    cols: [{ key: "name", label: "Department", required: true }, { key: "type", label: "Type", type: "sel:Academic|Clinical|Nursing|Support|Administrative" }, { key: "head", label: "Head (employee ID)", help: "Employee ID of the head of department, e.g. F-0412. Leave blank if none." }],
    seed: [["General Medicine", "Clinical", ""], ["General Surgery", "Clinical", ""], ["Anatomy", "Academic", ""], ["Physiology", "Academic", ""], ["Biochemistry", "Academic", ""], ["Pathology", "Academic", ""], ["Pharmacology", "Academic", ""], ["Microbiology", "Academic", ""], ["Community Medicine", "Academic", ""], ["Paediatrics", "Clinical", ""], ["Obstetrics & Gynaecology", "Clinical", ""], ["Orthopaedics", "Clinical", ""], ["Anaesthesiology", "Clinical", ""], ["Radiodiagnosis", "Clinical", ""], ["Emergency Medicine", "Clinical", ""], ["Nursing Services", "Nursing", ""], ["Central Lab", "Support", ""], ["Operation Theatre", "Support", ""], ["Pharmacy", "Support", ""], ["Administration", "Administrative", ""], ["Accounts", "Administrative", ""], ["HR", "Administrative", ""], ["Housekeeping", "Support", ""], ["Security", "Support", ""]] },
  { kind: "desig", title: "Designations", desc: "Designations appear in employee records, payslips and reports.",
    cols: [{ key: "name", label: "Designation", required: true }, { key: "cat", label: "Category", type: "sel:@cat" }, { key: "grade", label: "Pay grade" }],
    seed: [["Professor", "Teaching faculty", ""], ["Professor & Head", "Teaching faculty", ""], ["Associate Professor", "Teaching faculty", ""], ["Assistant Professor", "Teaching faculty", ""], ["Tutor / Demonstrator", "Teaching faculty", ""], ["Senior Resident", "Residents", ""], ["Junior Resident", "Residents", ""], ["Staff Nurse", "Nursing", ""], ["Nursing Sister", "Nursing", ""], ["Ward In-charge", "Nursing", ""], ["Lab Technician", "Paramedical", ""], ["OT Technician", "Paramedical", ""], ["Radiographer", "Paramedical", ""], ["Pharmacist", "Paramedical", ""], ["Office Assistant", "Administration", ""], ["Accounts Executive", "Administration", ""], ["HR Executive", "Administration", ""], ["Ward Attendant", "Support services", ""], ["Housekeeping Staff", "Support services", ""], ["Security Guard", "Support services", ""]] },
  { kind: "cat", title: "Employee categories", desc: "Categories group staff for leave rules, attendance thresholds and reports. The ID code starts each employee ID.",
    cols: [{ key: "name", label: "Category", required: true }, { key: "code", label: "ID code", required: true }, { key: "prob", label: "Probation (months)", type: "num" }],
    seed: [["Teaching faculty", "F", 12], ["Residents", "R", 0], ["Nursing", "N", 6], ["Paramedical", "P", 6], ["Administration", "A", 6], ["Support services", "S", 3]] },
  { kind: "leave", title: "Leave types", desc: "Leave types and yearly quotas. Inactive types disappear from the leave form.",
    cols: [{ key: "code", label: "Code", required: true }, { key: "name", label: "Leave type", required: true }, { key: "quota", label: "Days per year", type: "num" }, { key: "carry", label: "Carry forward", type: "sel:No|Up to 30 days|Up to 300 days" }, { key: "apply", label: "Applies to", type: "sel:All staff|@cat" }],
    seed: [["CL", "Casual leave", 12, "No", "All staff"], ["EL", "Earned leave", 30, "Up to 300 days", "All staff"], ["SL", "Sick leave", 10, "Up to 30 days", "All staff"], ["CO", "Comp off", 0, "No", "All staff"], ["DL", "Duty / academic leave", 7, "No", "Teaching faculty"]] },
  { kind: "src", title: "Attendance sources", desc: "Every place punches come from. Punches from all active sources are merged into one daily record.",
    cols: [{ key: "name", label: "Source name", required: true }, { key: "kind", label: "Method", type: "sel:Biometric fingerprint|Face recognition|Mobile app, geo-fenced|RFID card|Web punch|Manual entry|File import" }, { key: "loc", label: "Where / devices" }, { key: "sync", label: "How it arrives", type: "sel:Daily file import|Real time|Every 15 min|Hourly" }],
    seed: [["Govt. biometric (AEBAS)", "Biometric fingerprint", "", "Daily file import"], ["Face kiosks", "Face recognition", "", "Daily file import"], ["RFID readers", "RFID card", "", "Daily file import"], ["Regularised", "Manual entry", "Approved regularisation requests", "Real time"]] },
  { kind: "shift", title: "Shifts", desc: "Shift timings decide late marks. The first active shift is the default for employees without one.",
    cols: [{ key: "name", label: "Shift", required: true }, { key: "start", label: "Starts", type: "time" }, { key: "end", label: "Ends", type: "time" }, { key: "grace", label: "Grace (min)", type: "num" }],
    seed: [["General", "08:30", "16:30", 15], ["Ward morning", "08:00", "14:00", 10], ["Ward evening", "14:00", "20:00", 10], ["Night", "20:00", "08:00", 10]] },
  { kind: "hol", title: "Holidays", desc: "Holidays show on every calendar and are excluded from attendance.",
    cols: [{ key: "date", label: "Date", type: "date", required: true }, { key: "name", label: "Holiday", required: true }, { key: "kind", label: "Type", type: "sel:Gazetted|Restricted|Institute" }],
    seed: [["2026-01-26", "Republic Day", "Gazetted"], ["2026-08-15", "Independence Day", "Gazetted"], ["2026-10-02", "Gandhi Jayanti", "Gazetted"], ["2026-12-25", "Christmas", "Gazetted"]] },
  { kind: "sal", title: "Salary components", desc: "Components used in salary structures and monthly payroll inputs. Names marked in the guide have built-in rules.",
    cols: [{ key: "name", label: "Component", required: true }, { key: "kind", label: "Type", type: "sel:Earning|Deduction|Employer contribution" }, { key: "calc", label: "Notes" }, { key: "tax", label: "Taxable", type: "sel:Yes|No" }],
    seed: [["Basic pay", "Earning", "Per pay grade", "Yes"], ["House rent allowance", "Earning", "", "Yes"], ["Non-practising allowance", "Earning", "Doctors only", "Yes"], ["Special allowance", "Earning", "", "Yes"], ["Provident fund", "Deduction", "Auto: 12% of basic, capped at 15,000", "No"], ["ESI", "Deduction", "Auto: 0.75% of gross when gross is 21,000 or less", "No"], ["Income tax (TDS)", "Deduction", "Monthly amount from structure or inputs", "No"], ["Salary advance recovery", "Deduction", "", "No"], ["Employer PF", "Employer contribution", "Auto: 12% of basic, capped", "No"]] },
  { kind: "docs", title: "Onboarding checklist", desc: "Steps every new joiner goes through. “Required for” limits a step to one kind of staff.",
    cols: [{ key: "name", label: "Checklist item", required: true }, { key: "for", label: "Required for", type: "sel:All|Doctors|Nursing|Paramedical" }],
    seed: [["Offer letter accepted", "All"], ["Degrees, experience and ID verified", "All"], ["Medical Council registration checked", "Doctors"], ["Nursing Council registration checked", "Nursing"], ["Paramedical council registration checked", "Paramedical"], ["Enrolled on attendance devices", "All"], ["Employee record and portal login created", "All"], ["Bank account and PF UAN linked", "All"], ["Department induction completed", "All"]] },
];
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

export type Org = { name: string; short: string; addr: string; prefix: string; fy: string; weekoff: string; tz: string; logo: string | null; logoPng: string | null };
export type Policy = { min: number; complex: boolean; expiry: number; lock: number; session: number };
export type Rules = { thr: number; thrCat: string; merge: string; half: number; countOffs: boolean; start: string };
export type Flow = { key: string; title: string; chain: string[] };
export type Access = Record<Role, Perm[]>;

export const DEFAULTS = {
  org: { name: "Your Institute Name", short: "INST", addr: "City, State", prefix: "EMP", fy: "April – March", weekoff: "Sunday", tz: "Asia/Kolkata", logo: null, logoPng: null } as Org,
  pol: { min: 8, complex: true, expiry: 0, lock: 5, session: 12 } as Policy,
  rules: { thr: 75, thrCat: "Teaching faculty", merge: "First punch in, last punch out across all sources", half: 4, countOffs: false, start: "" } as Rules,
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
