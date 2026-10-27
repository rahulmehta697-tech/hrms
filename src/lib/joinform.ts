/** The joining form: steps, fields and checks. Shared by the joiner's phone form and the server, so both validate the same way. */

export type JField = { key: string; label: string; type?: "text" | "date" | "tel" | "email" | "textarea" | `sel:${string}`; req?: boolean; hint?: string; ph?: string; wide?: boolean; upper?: boolean };
export type JStep = { id: string; title: string; intro?: string; fields: JField[] };
export type Exp = { employer: string; role: string; from: string; to: string };
export type JDoc = { name: string; req: boolean };
export type JFile = { id: number; kind: string; fileName: string; size: number; mime: string };

export const JSTEPS: JStep[] = [
  { id: "about", title: "About you", fields: [
    { key: "fullName", label: "Full name (as on Aadhaar)", req: true, wide: true },
    { key: "dob", label: "Date of birth", type: "date", req: true },
    { key: "gender", label: "Gender", type: "sel:Female|Male|Other", req: true },
    { key: "fatherName", label: "Father's or spouse's name", req: true, wide: true },
    { key: "bloodGroup", label: "Blood group", type: "sel:A+|A-|B+|B-|AB+|AB-|O+|O-|Don't know" },
    { key: "maritalStatus", label: "Marital status", type: "sel:Single|Married|Other" },
  ] },
  { id: "contact", title: "Contact and address", fields: [
    { key: "mobile", label: "Mobile", type: "tel", req: true, ph: "10 digits" },
    { key: "email", label: "Email", type: "email" },
    { key: "address", label: "Current address", type: "textarea", req: true, wide: true, ph: "House, street, area, city, PIN" },
    { key: "permAddress", label: "Permanent address", type: "textarea", wide: true, hint: "Leave blank if it is the same as your current address." },
    { key: "emergencyName", label: "Emergency contact name", req: true },
    { key: "emergencyRelation", label: "Relation", req: true, ph: "Mother, spouse…" },
    { key: "emergencyMobile", label: "Emergency contact mobile", type: "tel", req: true },
  ] },
  { id: "ids", title: "ID, PF and bank", intro: "Used for your salary, PF and tax. Only HR can see these.", fields: [
    { key: "aadhaar", label: "Aadhaar number", req: true, wide: true, ph: "12 digits", hint: "Stored encrypted. Only the last four digits are shown after you save." },
    { key: "pan", label: "PAN", req: true, upper: true, ph: "ABCDE1234F" },
    { key: "uan", label: "PF UAN, if you have one", ph: "12 digits" },
    { key: "bankAccount", label: "Bank account number", req: true },
    { key: "ifsc", label: "IFSC", req: true, upper: true, ph: "SBIN0001234" },
    { key: "accountHolder", label: "Account holder name", req: true, wide: true },
  ] },
  { id: "edu", title: "Education and experience", fields: [
    { key: "qualification", label: "Highest qualification", req: true, ph: "MBBS, B.Sc Nursing, B.Com…" },
    { key: "institution", label: "College or university", req: true },
    { key: "qualYear", label: "Year passed", req: true, ph: "2022" },
    { key: "regCouncil", label: "Registration council, if any", ph: "State Medical Council…" },
    { key: "regNo", label: "Registration number" },
  ] },
];
/** Sections HR ticks as checked before approving. */
export const SECTIONS = ["about", "contact", "ids", "edu", "docs"] as const;
export const STEP_NAMES = ["Welcome", ...JSTEPS.map((s) => s.title), "Documents", "Check and submit"];
export const MAX_FILE = 4 * 1024 * 1024;
export const FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
/** Indian mobile: accepts +91 / 0 prefixes, returns 10 digits or "". */
export function mobile10(v: unknown) {
  let d = digits(v);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : "";
}

// Verhoeff checksum used by Aadhaar.
const VD = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const VP = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export function aadhaarOk(v: unknown) {
  const d = digits(v);
  if (!/^[2-9]\d{11}$/.test(d)) return false;
  let c = 0;
  d.split("").reverse().forEach((x, i) => { c = VD[c][VP[i % 8][Number(x)]]; });
  return c === 0;
}

const ageOn = (dob: string) => { const b = new Date(dob + "T00:00:00Z"), n = new Date(); let a = n.getUTCFullYear() - b.getUTCFullYear(); if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--; return a; };

/** Problems with one step's answers, keyed by field. `hasAadhaar` = an encrypted Aadhaar is already saved. */
export function checkStep(id: string, d: Record<string, unknown>, hasAadhaar = false): Record<string, string> {
  const step = JSTEPS.find((s) => s.id === id);
  const e: Record<string, string> = {};
  if (!step) return e;
  const v = (k: string) => String(d[k] ?? "").trim();
  for (const f of step.fields) {
    if (f.key === "aadhaar" && hasAadhaar && !v("aadhaar")) continue;
    if (f.req && !v(f.key)) e[f.key] = "Required";
    if (f.type?.startsWith("sel:") && v(f.key) && !f.type.slice(4).split("|").includes(v(f.key))) e[f.key] = "Pick from the list";
  }
  if (id === "about" && v("dob") && !e.dob) { const a = /^\d{4}-\d{2}-\d{2}$/.test(v("dob")) ? ageOn(v("dob")) : -1; if (a < 16 || a > 80) e.dob = "Check the date of birth"; }
  if (id === "contact") {
    if (v("mobile") && !mobile10(v("mobile"))) e.mobile = "Enter a 10-digit mobile number";
    if (v("emergencyMobile") && !mobile10(v("emergencyMobile"))) e.emergencyMobile = "Enter a 10-digit mobile number";
    if (v("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))) e.email = "Check the email address";
  }
  if (id === "ids") {
    if (v("aadhaar") && !aadhaarOk(v("aadhaar"))) e.aadhaar = "This is not a valid Aadhaar number";
    if (v("pan") && !/^[A-Z]{5}\d{4}[A-Z]$/.test(v("pan").toUpperCase())) e.pan = "PAN looks like ABCDE1234F";
    if (v("uan") && !/^\d{12}$/.test(digits(v("uan")))) e.uan = "UAN has 12 digits";
    if (v("bankAccount") && !/^\d{6,18}$/.test(digits(v("bankAccount")))) e.bankAccount = "6 to 18 digits";
    if (v("ifsc") && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v("ifsc").toUpperCase())) e.ifsc = "IFSC looks like SBIN0001234";
  }
  if (id === "edu") {
    if (v("qualYear") && !/^(19|20)\d{2}$/.test(v("qualYear"))) e.qualYear = "Enter a year like 2022";
    if (v("regCouncil") && !v("regNo")) e.regNo = "Add the registration number";
    const ex = (Array.isArray(d.experience) ? d.experience : []) as Exp[];
    ex.forEach((x, i) => { if ((x.employer || x.role || x.from || x.to) && !x.employer?.trim()) e[`exp${i}`] = "Add the employer's name"; });
  }
  return e;
}

/** Keep only known keys, as trimmed strings (plus the experience list). */
export function cleanData(d: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const s of JSTEPS) for (const f of s.fields) if (f.key !== "aadhaar") { const x = String(d[f.key] ?? "").trim().slice(0, f.type === "textarea" ? 400 : 120); out[f.key] = f.upper ? x.toUpperCase() : x; }
  const ex = (Array.isArray(d.experience) ? d.experience : []).slice(0, 10) as Exp[];
  out.experience = ex.map((x) => ({ employer: String(x?.employer ?? "").trim().slice(0, 120), role: String(x?.role ?? "").trim().slice(0, 80), from: String(x?.from ?? "").trim().slice(0, 20), to: String(x?.to ?? "").trim().slice(0, 20) })).filter((x) => x.employer || x.role || x.from || x.to);
  out.agree = d.agree === true;
  return out;
}
