import { NextResponse } from "next/server";
import { DEMO, seedDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Nightly reset for the demo copy. Vercel Cron calls this with "Authorization: Bearer <CRON_SECRET>". */
export async function GET(req: Request) {
  if (!DEMO) return NextResponse.json({ error: "Not a demo deployment." }, { status: 404 });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const t = Date.now();
  const r = await seedDemo();
  return NextResponse.json({ ok: true, employees: r.employees, ms: Date.now() - t });
}
