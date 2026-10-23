import "server-only";
import { NextResponse } from "next/server";
import { getUser, passwordExpired } from "./auth";

export async function apiUser() {
  const u = await getUser();
  if (!u || u.mustChange || (await passwordExpired(u))) return null;
  return u;
}
export const deny = (msg: string, status = 403) => NextResponse.json({ error: msg }, { status });
export function fileResponse(buf: Buffer, name: string) {
  const type = name.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "hrms";
/** Same-origin check for state-changing API calls. */
export function sameOrigin(req: Request) {
  const o = req.headers.get("origin"), h = req.headers.get("host");
  if (!o) return true;
  try { return new URL(o).host === h || new URL(o).host === req.headers.get("x-forwarded-host"); } catch { return false; }
}
