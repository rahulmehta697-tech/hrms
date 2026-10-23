export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const pad = (n: number | string) => String(n).padStart(2, "0");

/** Today's date (YYYY-MM-DD) and time (HH:MM) in the institute's time zone. */
export function nowIn(tz = "Asia/Kolkata") {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function fd(s?: string | null, withYear = true) {
  if (!s) return "";
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? " " + y : ""}`;
}
export function fdt(d?: Date | string | null, tz = "Asia/Kolkata") {
  if (!d) return "Never";
  return new Intl.DateTimeFormat("en-IN", { timeZone: tz, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));
}
export const monthLabel = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${["January","February","March","April","May","June","July","August","September","October","November","December"][m - 1]} ${y}`; };
export const daysInMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
export const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const dow = (s: string) => new Date(s + "T00:00:00Z").getUTCDay();
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
export const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const prevMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };

/** Is this date a weekly off under the institute's setting? */
export function isWeeklyOff(s: string, setting: string) {
  const d = dow(s);
  if (setting === "Sunday") return d === 0;
  if (setting === "Saturday and Sunday") return d === 0 || d === 6;
  if (setting.startsWith("Second and fourth")) { const n = Math.ceil(Number(s.slice(8)) / 7); return d === 0 || (d === 6 && (n === 2 || n === 4)); }
  return false;
}
