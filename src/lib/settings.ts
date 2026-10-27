import { cache } from "react";
import { eq, asc } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import { DEFAULTS, MASTERS, type Org, type Policy, type Rules, type Flow, type Access } from "./config";

type SettingMap = { org: Org; pol: Policy; rules: Rules; flows: Flow[]; access: Access };

export const getSettings = cache(async (): Promise<SettingMap> => {
  await ensureSchema();
  const rows = await db().select().from(schema.settings);
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<SettingMap>;
  return {
    org: { ...DEFAULTS.org, ...(m.org || {}) },
    pol: { ...DEFAULTS.pol, ...(m.pol || {}) },
    rules: { ...DEFAULTS.rules, ...(m.rules || {}) },
    flows: DEFAULTS.flows.map((f) => (m.flows || []).find((x) => x.key === f.key) || f),
    access: { ...DEFAULTS.access, ...(m.access || {}), admin: DEFAULTS.access.admin },
  };
});

export async function saveSetting<K extends keyof SettingMap>(key: K, value: SettingMap[K]) {
  await db().insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

export type MasterRow = { id: number; data: (string | number)[]; active: boolean };

export const getMasters = cache(async (): Promise<Record<string, MasterRow[]>> => {
  const rows = await db().select().from(schema.masters).orderBy(asc(schema.masters.sort), asc(schema.masters.id));
  const out: Record<string, MasterRow[]> = Object.fromEntries(MASTERS.map((m) => [m.kind, []]));
  for (const r of rows) (out[r.kind] ||= []).push({ id: r.id, data: r.data, active: r.active });
  return out;
});

/** Active values of one master's first column (or another column). */
export async function activeList(kind: string, col = 0) {
  const m = await getMasters();
  return (m[kind] || []).filter((r) => r.active).map((r) => String(r.data[col]));
}
export async function activeRows(kind: string) {
  const m = await getMasters();
  return (m[kind] || []).filter((r) => r.active);
}

export async function isSetUp() {
  await ensureSchema();
  const r = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "admin")).limit(1);
  return r.length > 0;
}
export { eq };
