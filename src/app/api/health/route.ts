import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbUrl, ensureSchema } from "@/db";
export const dynamic = "force-dynamic";

/** Public status check: shows what is set up, never the values. */
export async function GET() {
  const env = { database: !!dbUrl(), demoMode: process.env.DEMO_MODE === "1", cronSecret: !!process.env.CRON_SECRET, licenceKey: !!process.env.LICENSE_KEY };
  try {
    await ensureSchema();
    const r = await db().execute(sql`select (select count(*) from users) as users, (select count(*) from employees) as employees`);
    return NextResponse.json({ ok: true, db: "connected", tables: "ready", ...env, ...(r.rows[0] as object) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message).slice(0, 300), ...env }, { status: 500 });
  }
}
