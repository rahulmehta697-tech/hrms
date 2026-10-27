import "server-only";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { DEFAULTS } from "./config";
import { addDays, daysInMonth, dow, hm, nowIn, pad, prevMonth } from "./dates";
import type { PayLine, Step } from "@/db/schema";

/** Demo mode is switched on per deployment with DEMO_MODE=1. Never set it on a customer's copy. */
export const DEMO = process.env.DEMO_MODE === "1";
export const DEMO_PASSWORD = "Demo@1234";
export const DEMO_RESET_TIME = "2:00 AM IST";

/** The showcase logins listed on the sign-in page. Their passwords and status can't be changed in demo mode. */
export const DEMO_ACCOUNTS = [
  { login: "ADMIN", label: "Master Admin", note: "Settings, masters, users, licence, imports" },
  { login: "A-0101", label: "HR Office", note: "Employees, attendance, leave, payroll, hiring" },
  { login: "F-0001", label: "Head of department", note: "Approvals and team attendance" },
  { login: "A-0102", label: "Accounts", note: "Payroll approval and reports" },
  { login: "F-0104", label: "Staff", note: "Leave, attendance, payslips" },
];
export const isShowcase = (login: string) => DEMO && DEMO_ACCOUNTS.some((a) => a.login === login.toUpperCase());

/* ---------------- deterministic random ---------------- */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FIRST_F = ["Neha", "Priya", "Kavya", "Sunita", "Pooja", "Anita", "Shalini", "Rekha", "Nisha", "Geeta", "Lata", "Meera", "Ritu", "Swati", "Deepa", "Anjali", "Isha", "Kiran", "Sonia", "Megha"];
const FIRST_M = ["Arjun", "Vikas", "Aman", "Rajesh", "Deepak", "Manoj", "Gaurav", "Saurabh", "Harish", "Ravi", "Pankaj", "Ashish", "Rohit", "Sunil", "Mohit", "Sahil", "Tushar", "Ankit", "Rakesh", "Vinod"];
const LAST = ["Rawat", "Negi", "Bisht", "Joshi", "Pant", "Bhatt", "Uniyal", "Thapliyal", "Nautiyal", "Semwal", "Dobhal", "Chauhan", "Panwar", "Rana", "Kandari", "Gusain", "Bahuguna", "Dimri", "Badoni", "Kothari", "Sharma", "Verma", "Gupta", "Mehta", "Iyer", "Nair", "Reddy", "Das", "Singh", "Khan"];

const DEPTS: [string, string][] = [["General Medicine", "Clinical"], ["General Surgery", "Clinical"], ["Paediatrics", "Clinical"], ["Obstetrics & Gynaecology", "Clinical"], ["Anaesthesiology", "Clinical"], ["Anatomy", "Academic"], ["Physiology", "Academic"], ["Pathology", "Academic"], ["Nursing Services", "Nursing"], ["Central Lab", "Support"], ["Operation Theatre", "Support"], ["Administration", "Administrative"], ["Accounts", "Administrative"], ["Human Resources", "Administrative"], ["Housekeeping", "Support"]];
const CATS: [string, string, number][] = [["Teaching faculty", "F", 12], ["Residents", "R", 0], ["Nursing", "N", 6], ["Paramedical", "P", 6], ["Administration", "A", 6], ["Support services", "S", 3]];
const DESIG: [string, string, string][] = [["Professor & Head", "Teaching faculty", "L14"], ["Professor", "Teaching faculty", "L13A"], ["Associate Professor", "Teaching faculty", "L13"], ["Assistant Professor", "Teaching faculty", "L12"], ["Senior Resident", "Residents", "SR"], ["Junior Resident", "Residents", "JR"], ["Nursing Superintendent", "Nursing", "N-5"], ["Nursing Sister", "Nursing", "N-3"], ["Staff Nurse", "Nursing", "N-2"], ["Lab Technician", "Paramedical", "T-2"], ["OT Technician", "Paramedical", "T-2"], ["Administrative Officer", "Administration", "A-4"], ["HR Executive", "Administration", "A-2"], ["Accounts Officer", "Administration", "A-3"], ["Office Assistant", "Administration", "A-1"], ["Ward Attendant", "Support services", "S-1"], ["Housekeeping Staff", "Support services", "S-1"]];
const PAY: Record<string, [number, number]> = { "Professor & Head": [175000, 20000], Professor: [160000, 15000], "Associate Professor": [130000, 15000], "Assistant Professor": [95000, 12000], "Senior Resident": [78000, 4000], "Junior Resident": [56000, 3000], "Nursing Superintendent": [60000, 6000], "Nursing Sister": [34000, 4000], "Staff Nurse": [22000, 4000], "Lab Technician": [20000, 3000], "OT Technician": [20000, 3000], "Administrative Officer": [52000, 6000], "HR Executive": [30000, 4000], "Accounts Officer": [42000, 5000], "Office Assistant": [16000, 2000], "Ward Attendant": [13000, 1500], "Housekeeping Staff": [12500, 1500] };
const HOLIDAYS: [string, string][] = [["01-26", "Republic Day"], ["03-04", "Holi"], ["03-21", "Id-ul-Fitr"], ["04-03", "Good Friday"], ["05-01", "Labour Day"], ["08-15", "Independence Day"], ["10-02", "Gandhi Jayanti"], ["10-20", "Dussehra"], ["11-08", "Diwali"], ["11-24", "Guru Nanak Jayanti"], ["12-25", "Christmas"]];

type Emp = typeof schema.employees.$inferInsert;
type Plan = { id: string; name: string; desig: string; dept: string; cat: string; shift?: string };

function people(): Plan[] {
  const r = rng(20261027);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const used = new Set<string>();
  const nm = (dr: boolean) => { for (;;) { const n = `${dr ? "Dr. " : ""}${pick(r() < 0.5 ? FIRST_F : FIRST_M)} ${pick(LAST)}`; if (!used.has(n)) { used.add(n); return n; } } };
  // Fixed showcase people first, so their logins are always the same.
  const fixed: Plan[] = [
    { id: "F-0001", name: "Dr. S. K. Bisht", desig: "Professor & Head", dept: "General Medicine", cat: "Teaching faculty" },
    { id: "F-0104", name: "Dr. Neha Rawat", desig: "Assistant Professor", dept: "General Medicine", cat: "Teaching faculty" },
    { id: "A-0101", name: "Pooja Kothari", desig: "HR Executive", dept: "Human Resources", cat: "Administration" },
    { id: "A-0102", name: "Deepak Badoni", desig: "Accounts Officer", dept: "Accounts", cat: "Administration" },
  ];
  fixed.forEach((f) => used.add(f.name));
  const out = [...fixed];
  let fN = 2, rN = 201, nN = 301, pN = 401, aN = 103, sN = 501;
  const add = (cat: string, desig: string, dept: string, n: number, shift?: string) => {
    for (let i = 0; i < n; i++) {
      const code = CATS.find((c) => c[0] === cat)![1];
      const num = code === "F" ? fN++ : code === "R" ? rN++ : code === "N" ? nN++ : code === "P" ? pN++ : code === "A" ? aN++ : sN++;
      out.push({ id: `${code}-${String(num).padStart(4, "0")}`, name: nm(code === "F" || code === "R"), desig, dept, cat, shift });
    }
  };
  for (const [d, t] of DEPTS) if (t === "Clinical" || t === "Academic") {
    if (d !== "General Medicine") add("Teaching faculty", "Professor & Head", d, 1);
    add("Teaching faculty", "Associate Professor", d, 1);
    add("Teaching faculty", "Assistant Professor", d, d === "General Medicine" ? 2 : 1);
    if (t === "Clinical") { add("Residents", "Senior Resident", d, 2); add("Residents", "Junior Resident", d, 3); }
  }
  add("Nursing", "Nursing Superintendent", "Nursing Services", 1);
  add("Nursing", "Nursing Sister", "Nursing Services", 4);
  add("Nursing", "Staff Nurse", "Nursing Services", 14, "Ward morning");
  add("Nursing", "Staff Nurse", "Nursing Services", 6, "Ward evening");
  add("Paramedical", "Lab Technician", "Central Lab", 6);
  add("Paramedical", "OT Technician", "Operation Theatre", 5);
  add("Administration", "Administrative Officer", "Administration", 1);
  add("Administration", "Office Assistant", "Administration", 4);
  add("Administration", "Accounts Officer", "Accounts", 1);
  add("Administration", "Office Assistant", "Accounts", 2);
  add("Administration", "HR Executive", "Human Resources", 1);
  add("Support services", "Ward Attendant", "Housekeeping", 8);
  add("Support services", "Housekeeping Staff", "Housekeeping", 6);
  return out;
}

const TABLES = ["sessions", "users", "employees", "punches", "leave_requests", "reg_requests", "leave_opening", "salary_structure", "pay_inputs", "payroll_runs", "payroll_lines", "requisitions", "candidates", "joiners", "audit", "masters", "settings"];

/** Wipes the database and fills it with a realistic sample institute. Dates are relative to today, so the demo always looks current. */
export async function seedDemo() {
  const tz = "Asia/Kolkata";
  const today = nowIn(tz).date;
  const year = Number(today.slice(0, 4));
  const thisM = today.slice(0, 7), lastM = prevMonth(thisM), startM = prevMonth(lastM);
  const start = `${startM}-01`;
  const r = rng(Number(today.replace(/-/g, "")));
  const ppl = people();
  const pw = await bcrypt.hash(DEMO_PASSWORD, 10);
  const holSet = new Set<string>();
  const holRows = [year, year + 1].flatMap((y) => HOLIDAYS.map(([md, n]) => { holSet.add(`${y}-${md}`); return [`${y}-${md}`, n, "Gazetted"] as (string | number)[]; }));
  const isOff = (d: string) => dow(d) === 0 || holSet.has(d);
  const headOf: Record<string, string> = { "General Medicine": "F-0001" };
  for (const p of ppl) if (p.desig === "Professor & Head" && !headOf[p.dept]) headOf[p.dept] = p.id;
  const firstOf = (dept: string, desig: string) => ppl.find((p) => p.dept === dept && p.desig === desig)?.id || "";
  headOf["Nursing Services"] = firstOf("Nursing Services", "Nursing Superintendent");
  headOf["Administration"] = firstOf("Administration", "Administrative Officer");
  headOf["Human Resources"] = "A-0101";
  headOf["Accounts"] = "A-0102";
  headOf["Central Lab"] = headOf["Pathology"];
  headOf["Operation Theatre"] = headOf["Anaesthesiology"];
  headOf["Housekeeping"] = headOf["Administration"];

  await db().transaction(async (tx) => {
    await tx.execute(sql.raw(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY`));

    /* settings */
    const org = { ...DEFAULTS.org, name: "Demo Institute of Medical Sciences", short: "DIMS", addr: "Sample City, India", prefix: "DIMS" };
    const settings = { ...DEFAULTS, org, pol: { ...DEFAULTS.pol, lock: 10 }, rules: { ...DEFAULTS.rules, thrCat: "Teaching faculty", start } };
    for (const [k, v] of Object.entries(settings)) await tx.insert(schema.settings).values({ key: k, value: v });

    /* masters */
    const M: [string, (string | number)[][]][] = [
      ["cat", CATS.map((c) => [c[0], c[1], c[2]])],
      ["dept", DEPTS.map(([d, t]) => [d, t, headOf[d] || ""])],
      ["desig", DESIG.map((d) => [...d])],
      ["leave", [["CL", "Casual leave", 12, "No", "All staff"], ["EL", "Earned leave", 30, "Up to 300 days", "All staff"], ["SL", "Sick leave", 10, "Up to 30 days", "All staff"], ["CO", "Comp off", 0, "No", "All staff"], ["DL", "Duty / academic leave", 7, "No", "Teaching faculty"]]],
      ["shift", [["General", "08:30", "16:30", 15], ["Ward morning", "08:00", "14:00", 10], ["Ward evening", "14:00", "20:00", 10]]],
      ["hol", holRows],
      ["src", [["Govt. biometric (AEBAS)", "Biometric fingerprint", "Academic block, 4 devices", "Daily file import"], ["Face kiosks", "Face recognition", "Main gate and hospital block", "Daily file import"], ["Ward RFID readers", "RFID card", "Ward entrances", "Daily file import"], ["Regularised", "Manual entry", "Approved regularisation requests", "Real time"]]],
      ["sal", [["Basic pay", "Earning", "Per pay grade", "Yes", "Basic pay"], ["House rent allowance", "Earning", "", "Yes", "Fixed amount"], ["Special allowance", "Earning", "", "Yes", "Fixed amount"], ["Night duty allowance", "Earning", "From roster", "Yes", "Fixed amount"], ["Provident fund", "Deduction", "", "No", "Auto: employee PF"], ["ESI", "Deduction", "", "No", "Auto: employee ESI"], ["Income tax (TDS)", "Deduction", "Monthly estimate", "No", "Income tax (TDS)"], ["Salary advance recovery", "Deduction", "", "No", "Fixed amount"], ["Employer PF", "Employer contribution", "", "No", "Auto: employer PF"]]],
      ["docs", [["Offer letter accepted", "All"], ["Degrees, experience and ID verified", "All"], ["Medical Council registration checked", "Teaching faculty"], ["Medical Council registration checked (resident)", "Residents"], ["Nursing Council registration checked", "Nursing"], ["Enrolled on biometric and face kiosk", "All"], ["Portal login issued", "All"], ["Bank account and PF UAN linked", "All"], ["Department induction completed", "All"]]],
    ];
    for (const [kind, rows] of M) await tx.insert(schema.masters).values(rows.map((data, i) => ({ kind, data, sort: i })));

    /* employees */
    const emps: Emp[] = ppl.map((p, i) => {
      const y = 2012 + Math.floor(r() * 13), m = 1 + Math.floor(r() * 12);
      const doj = p.id === "F-0104" ? "2023-08-14" : `${y}-${pad(m)}-${pad(1 + Math.floor(r() * 27))}`;
      return { id: p.id, name: p.name, designation: p.desig, department: p.dept, category: p.cat, doj, status: i > 6 && r() < 0.05 ? "Probation" : "Active", shift: p.shift || null, mobile: `98${String(10000000 + Math.floor(r() * 89999999))}`, email: `${p.name.replace(/^Dr\.\s*/, "").toLowerCase().replace(/[^a-z]+/g, ".")}@dims.example`, pan: null, uan: `1012${String(Math.floor(r() * 1e8)).padStart(8, "0")}`, bankAccount: i % 37 === 9 ? null : `3000${String(Math.floor(r() * 1e8)).padStart(8, "0")}`, ifsc: "SBIN0001234" };
    });
    emps.push({ id: "S-0599", name: "Ramesh Kumar", designation: "Ward Attendant", department: "Housekeeping", category: "Support services", doj: "2016-03-01", status: "Exited", shift: null, mobile: null, email: null });
    await tx.insert(schema.employees).values(emps);

    /* logins: everyone uses the demo password */
    const role = (id: string) => (id === "A-0101" ? "hr" : id === "A-0102" ? "accounts" : Object.values(headOf).includes(id) ? "hod" : "staff");
    const users = [{ login: "ADMIN", employeeId: null, name: "Master Admin", role: "admin", passwordHash: pw, mustChange: false }, ...emps.filter((e) => e.status !== "Exited").map((e) => ({ login: e.id.toUpperCase(), employeeId: e.id, name: e.name, role: role(e.id), passwordHash: pw, mustChange: false }))];
    await tx.insert(schema.users).values(users);

    /* leave: past approved, upcoming and pending in every state */
    const at = (d: string) => new Date(d + "T09:00:00+05:30").toISOString();
    const leaves: (typeof schema.leaveRequests.$inferInsert)[] = [];
    const weekdaysBetween = (a: string, b: string) => { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (!isOff(d)) n++; return n; };
    const working = (d: string, back: number) => { let x = d; for (let i = 0; i < back;) { x = addDays(x, -1); if (!isOff(x)) i++; } return x; };
    const approvedBy = (lvl: string, by: string, d: string): Step => ({ level: lvl, by, action: "approve", at: at(d) });
    const L = (eid: string, type: string, from: string, to: string, status: string, reason: string, chain: string[], level: number, history: Step[], applied: string, cover = "") =>
      leaves.push({ employeeId: eid, type, fromDate: from, toDate: to, days: weekdaysBetween(from, to), reason, cover, status, chain, level, history, appliedAt: new Date(at(applied)) });
    for (let i = 0; i < 26; i++) {
      const p = ppl[8 + Math.floor(r() * (ppl.length - 8))];
      const from = working(today, 3 + Math.floor(r() * 35)), len = r() < 0.7 ? 0 : 1 + Math.floor(r() * 2);
      const to = addDays(from, len);
      if (leaves.some((l) => l.employeeId === p.id)) continue;
      L(p.id, r() < 0.6 ? "CL" : r() < 0.6 ? "SL" : "EL", from, to, "approved", ["Personal work", "Fever", "Family function", "Child's school event", "Medical appointment"][Math.floor(r() * 5)], ["Reporting HOD"], 1, [approvedBy("Reporting HOD", "Head of department", addDays(from, -2))], addDays(from, -4));
    }
    const gm = ppl.filter((p) => p.dept === "General Medicine" && !["F-0001", "F-0104"].includes(p.id));
    L("F-0104", "CL", working(today, 9), working(today, 9), "approved", "Personal work", ["Reporting HOD"], 1, [approvedBy("Reporting HOD", "Dr. S. K. Bisht", working(today, 11))], working(today, 12));
    L("F-0104", "EL", addDays(today, 18), addDays(today, 21), "pending", "Travelling home for a family wedding", ["Reporting HOD", "HR Office"], 0, [], today, "Dr. " + gm[0].name.replace(/^Dr\.\s*/, ""));
    L(gm[0].id, "EL", addDays(today, 4), addDays(today, 8), "pending", "Family function out of town", ["Reporting HOD", "HR Office"], 0, [], addDays(today, -1), "Dr. Neha Rawat");
    L(gm[1].id, "CO", addDays(today, 2), addDays(today, 2), "pending", "Against night duty last Sunday", ["Reporting HOD"], 0, [], addDays(today, -1));
    L(gm[2].id, "DL", addDays(today, 10), addDays(today, 12), "pending", "Paper presentation at the state conference", ["Reporting HOD"], 0, [], today);
    L(gm[3].id, "SL", working(today, 6), working(today, 5), "rejected", "Not well", ["Reporting HOD"], 0, [{ level: "Reporting HOD", by: "Dr. S. K. Bisht", action: "reject", at: at(working(today, 7)), note: "Please attach a medical certificate and apply again." }], working(today, 8));
    const nurse = ppl.find((p) => p.desig === "Staff Nurse")!;
    L(nurse.id, "EL", addDays(today, 6), addDays(today, 11), "pending", "Annual leave", ["Reporting HOD", "HR Office"], 1, [approvedBy("Reporting HOD", "Nursing Superintendent", today)], addDays(today, -2), "Ward 3 roster adjusted");
    await tx.insert(schema.leaveRequests).values(leaves);
    const onLeave = new Set<string>();
    for (const l of leaves) if (l.status === "approved") for (let d = l.fromDate; d <= l.toDate; d = addDays(d, 1)) onLeave.add(l.employeeId + "|" + d);

    /* punches from several sources */
    const shifts: Record<string, number> = { General: 510, "Ward morning": 480, "Ward evening": 840 };
    const srcFor = (p: Plan, i: number) => (p.cat === "Teaching faculty" || p.cat === "Residents" ? (i % 3 ? "Govt. biometric (AEBAS)" : "Face kiosks") : p.cat === "Nursing" ? (i % 4 ? "Ward RFID readers" : "Face kiosks") : "Face kiosks");
    const nowMin = (() => { const [h, m] = nowIn(tz).time.split(":").map(Number); return h * 60 + m; })();
    const punches: (typeof schema.punches.$inferInsert)[] = [];
    const absentSet = new Set<string>();
    ppl.forEach((p, pi) => {
      const reliable = r(); // a few habitual latecomers and a couple of low-attendance faculty
      for (let d = start, i = 0; d <= today; d = addDays(d, 1), i++) {
        if (isOff(d) || onLeave.has(p.id + "|" + d)) continue;
        const absentP = reliable < 0.06 ? 0.3 : 0.03;
        if (r() < absentP && !(p.id === "F-0104" && d === today)) { absentSet.add(p.id + "|" + d); continue; }
        const st = shifts[p.shift || "General"];
        const lateP = reliable > 0.85 ? 0.35 : 0.06;
        const inM = st - 25 + Math.floor(r() * 30) + (r() < lateP ? 20 + Math.floor(r() * 35) : 0);
        const len = (p.shift ? 360 : 480) + Math.floor(r() * 40) - 10;
        if (d === today && inM > nowMin) continue;
        punches.push({ employeeId: p.id, date: d, time: hm(inM), direction: "In", source: srcFor(p, i + pi) });
        if (r() < 0.12) punches.push({ employeeId: p.id, date: d, time: hm(inM + 2), direction: "In", source: "Face kiosks" });
        if (d !== today || inM + len < nowMin) { if (r() > 0.03) punches.push({ employeeId: p.id, date: d, time: hm(Math.min(inM + len, 1435)), direction: "Out", source: srcFor(p, i + pi + 1) }); }
      }
    });
    for (let i = 0; i < punches.length; i += 2000) await tx.insert(schema.punches).values(punches.slice(i, i + 2000));

    /* regularisation requests */
    const missed = [...absentSet].filter((k) => k.split("|")[1] >= addDays(today, -10)).slice(0, 4);
    if (missed.length) await tx.insert(schema.regRequests).values(missed.map((k, i) => { const [eid, d] = k.split("|"); return { employeeId: eid, date: d, time: i % 2 ? "08:40" : "16:35", direction: i % 2 ? "In" : "Out", reason: ["Face kiosk at the main gate was down", "Forgot to punch out after evening rounds", "Biometric did not read my fingerprint", "Was on duty at the outreach camp"][i % 4], status: "pending", chain: ["Reporting HOD"], level: 0, history: [] }; }));
    const neha = punches.filter((p) => p.employeeId === "F-0104" && p.date < today).map((p) => p.date);
    if (neha.length) await tx.insert(schema.regRequests).values({ employeeId: "F-0104", date: neha[neha.length - 3], time: "16:45", direction: "Out", reason: "Forgot to punch out", status: "approved", chain: ["Reporting HOD"], level: 1, history: [approvedBy("Reporting HOD", "Dr. S. K. Bisht", today)] });

    /* opening balances */
    const ly = Number(today.slice(5, 7)) >= 4 ? year : year - 1;
    await tx.insert(schema.leaveOpening).values(ppl.map((p) => ({ employeeId: p.id, type: "EL", year: ly, opening: 5 + Math.floor(r() * 40) })));

    /* salary structures */
    const struct: (typeof schema.salaryStructure.$inferInsert)[] = [];
    for (const p of ppl) {
      const [base, spread] = PAY[p.desig];
      const gross = Math.round((base + Math.floor(r() * spread)) / 100) * 100;
      const basic = Math.round(gross * 0.5 / 100) * 100, hra = Math.round(gross * 0.2 / 100) * 100;
      struct.push({ employeeId: p.id, component: "Basic pay", amount: basic }, { employeeId: p.id, component: "House rent allowance", amount: hra }, { employeeId: p.id, component: "Special allowance", amount: gross - basic - hra }, { employeeId: p.id, component: "Provident fund", amount: 1 }, { employeeId: p.id, component: "Employer PF", amount: 1 });
      if (gross <= 21000) struct.push({ employeeId: p.id, component: "ESI", amount: 1 });
      const tds = gross * 12 > 1275000 ? Math.round(((gross * 12 - 1200000) * 0.12) / 12 / 100) * 100 : 0;
      if (tds) struct.push({ employeeId: p.id, component: "Income tax (TDS)", amount: tds });
    }
    await tx.insert(schema.salaryStructure).values(struct);

    /* payroll: last month closed and released, this month with inputs */
    const kind: Record<string, string> = { "Basic pay": "E", "House rent allowance": "E", "Special allowance": "E", "Night duty allowance": "E", "Income tax (TDS)": "D", "Salary advance recovery": "D" };
    const inputs: (typeof schema.payInputs.$inferInsert)[] = [];
    const lastIn = [[ppl[40].id, "Night duty allowance", 3000, "6 night duties"], [ppl[41].id, "Night duty allowance", 2500, "5 night duties"], [ppl[60].id, "LOP days", 2, "Unapproved absence"], [ppl[70].id, "Salary advance recovery", 2000, "Advance instalment 3 of 5"]] as const;
    const thisIn = [[ppl[40].id, "Night duty allowance", 3500, "7 night duties"], [ppl[45].id, "Night duty allowance", 2000, "4 night duties"], [ppl[70].id, "Salary advance recovery", 2000, "Advance instalment 4 of 5"], ["F-0104", "Special allowance", 4000, "Arrears for extra OPD duties"], [ppl[90].id, "LOP days", 1, "Unapproved absence"]] as const;
    for (const [e, c, a, rm] of lastIn) inputs.push({ month: lastM, employeeId: e, component: c, amount: a, remarks: rm });
    for (const [e, c, a, rm] of thisIn) inputs.push({ month: thisM, employeeId: e, component: c, amount: a, remarks: rm });
    await tx.insert(schema.payInputs).values(inputs);
    const days = daysInMonth(lastM), lines: { month: string; employeeId: string; data: PayLine }[] = [];
    for (const p of ppl) {
      const st = struct.filter((s) => s.employeeId === p.id), inp = inputs.filter((i) => i.month === lastM && i.employeeId === p.id);
      const lop = inp.filter((i) => i.component === "LOP days").reduce((s, i) => s + Number(i.amount), 0), f = (days - lop) / days;
      const earnings: [string, number][] = st.filter((s) => kind[s.component] === "E").map((s) => [s.component, Math.round(Number(s.amount) * f)]);
      for (const i of inp) if (kind[i.component] === "E") earnings.push([i.component, Number(i.amount)]);
      const gross = earnings.reduce((s, x) => s + x[1], 0), basic = earnings.find((x) => x[0] === "Basic pay")![1];
      const pf = Math.round(Math.min(basic, 15000) * 0.12);
      const deductions: [string, number][] = [["Provident fund", pf]];
      if (st.some((s) => s.component === "ESI") && gross <= 21000) deductions.push(["ESI", Math.ceil(gross * 0.0075)]);
      for (const s of st) if (kind[s.component] === "D") deductions.push([s.component, Number(s.amount)]);
      for (const i of inp) if (kind[i.component] === "D") deductions.push([i.component, Number(i.amount)]);
      const employer: [string, number][] = [["Employer PF", pf]];
      if (deductions.some((d) => d[0] === "ESI")) employer.push(["Employer ESI", Math.ceil(gross * 0.0325)]);
      const ded = deductions.reduce((s, x) => s + x[1], 0);
      lines.push({ month: lastM, employeeId: p.id, data: { earnings, deductions, employer, gross, ded, net: gross - ded, paidDays: days - lop, days, lop } });
    }
    await tx.insert(schema.payrollLines).values(lines);
    const closeAt = (n: number) => new Date(`${thisM}-0${n}T11:00:00+05:30`).toISOString();
    await tx.insert(schema.payrollRuns).values({ month: lastM, step: 4, history: [{ level: "Not started", by: "Pooja Kothari", action: "computed", at: closeAt(1) }, { level: "Computed", by: "Pooja Kothari", action: "hr reviewed", at: closeAt(1) }, { level: "HR reviewed", by: "Deepak Badoni", action: "accounts approved", at: closeAt(2) }, { level: "Accounts approved", by: "Pooja Kothari", action: "closed and released", at: closeAt(3) }] });

    /* recruitment */
    await tx.insert(schema.requisitions).values([
      { id: "RQ-101", title: "Associate Professor", department: "Pathology", posts: 1, note: "Fills a regulatory faculty shortfall" },
      { id: "RQ-102", title: "Senior Resident", department: "Anaesthesiology", posts: 3, note: "Replacing tenure completions" },
      { id: "RQ-103", title: "Staff Nurse", department: "Nursing Services", posts: 12, note: "New 40-bed ward" },
      { id: "RQ-104", title: "Lab Technician", department: "Central Lab", posts: 2, note: "Evening shift for the central lab" },
      { id: "RQ-100", title: "Office Assistant", department: "Accounts", posts: 1, note: "Replacement", status: "Closed" },
    ]);
    const C = (req: string, name: string, details: string, stage: number) => ({ requisitionId: req, name, details, mobile: `97${String(10000000 + Math.floor(r() * 89999999))}`, stage });
    await tx.insert(schema.candidates).values([
      C("RQ-101", "Dr. Ankit Bahuguna", "MD Pathology · 6 yrs as Asst. Prof", 2), C("RQ-101", "Dr. Swati Dimri", "DNB · 5 yrs", 2), C("RQ-101", "Dr. R. P. Semwal", "MD · 7 yrs", 1), C("RQ-101", "Dr. Farah Siddiqui", "MD · 4 yrs 8 mo (short of 5)", -1),
      C("RQ-102", "Dr. Mohit Kandari", "MD Anaesthesia 2025", 4), C("RQ-102", "Dr. Ritu Badoni", "DNB 2026", 3), C("RQ-102", "Dr. Sahil Gusain", "MD 2026", 2), C("RQ-102", "Dr. Nidhi Pant", "MD 2025", 1), C("RQ-102", "Dr. Tushar Rana", "MD 2026", 0),
      C("RQ-103", "Kiran Rawat", "B.Sc Nursing · 2 yrs ICU", 4), C("RQ-103", "Deepa Negi", "GNM · fresher", 3), C("RQ-103", "Anjali Bhatt", "B.Sc Nursing · 1 yr", 2), C("RQ-103", "Sonia Chauhan", "GNM · 3 yrs ward", 1), C("RQ-103", "Meenakshi Joshi", "B.Sc Nursing · fresher", 0), C("RQ-103", "Priyanka Rana", "GNM · 1 yr", 0), C("RQ-103", "Ritu Thapa", "B.Sc Nursing · 4 yrs", 1),
      C("RQ-104", "Rakesh Panwar", "DMLT · 4 yrs", 2), C("RQ-104", "Vinod Kothari", "B.Sc MLT", 1), C("RQ-104", "Hemant Bisht", "DMLT · 2 yrs", 0),
    ]);
    const docs = (n: number, kindIdx: string) => Object.fromEntries((M.find((m) => m[0] === "docs")![1] as string[][]).filter((d) => d[1] === "All" || d[1] === kindIdx).slice(0, n).map((d) => [d[0], true]));
    await tx.insert(schema.joiners).values([
      { name: "Dr. Mohit Kandari", roleText: "Senior Resident · Anaesthesiology", kind: "Residents", joinDate: addDays(today, 6), done: docs(3, "Residents") },
      { name: "Kiran Rawat", roleText: "Staff Nurse · Nursing Services", kind: "Nursing", joinDate: addDays(today, 4), done: docs(5, "Nursing") },
      { name: "Dr. Isha Nautiyal", roleText: "Assistant Professor · Physiology", kind: "Teaching faculty", joinDate: addDays(today, -5), done: docs(8, "Teaching faculty") },
    ]);

    /* a believable change log */
    const A = (d: string, t: string, w: string, x: string) => ({ at: new Date(`${d}T${t}:00+05:30`), who: w, action: x });
    await tx.insert(schema.audit).values([
      A(`${startM}-01`, "10:05", "Master Admin (ADMIN)", "Completed first-run setup"),
      A(`${startM}-01`, "10:40", "Master Admin (ADMIN)", "Imported 15 rows into Departments from “departments.xlsx”"),
      A(`${startM}-01`, "11:20", "Master Admin (ADMIN)", `Imported ${ppl.length + 1} rows into Employee master from “staff-list.xlsx”`),
      A(`${startM}-02`, "09:15", "Master Admin (ADMIN)", `Created ${ppl.length} logins and downloaded their temporary passwords`),
      A(`${thisM}-03`, "11:00", "Pooja Kothari (A-0101)", `Payroll ${lastM}: Closed and released`),
      A(addDays(today, -1), "10:12", "Pooja Kothari (A-0101)", "Imported 1,204 rows into Attendance punches from “aebas-daily.xlsx”"),
      A(today, "09:02", "Dr. S. K. Bisht (F-0001)", "Signed in"),
    ]);
  });
  return { employees: ppl.length, punches: true };
}
