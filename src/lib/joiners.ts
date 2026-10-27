import "server-only";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { and, eq, inArray, like } from "drizzle-orm";
import { db, schema } from "@/db";
import { activeRows } from "./settings";
import { sha256 } from "./secure";
import type { JDoc, JFile } from "./joinform";

export type Invite = typeof schema.joinerInvites.$inferSelect;
export const OPEN_STATES = ["sent", "opened", "corrections"] as const;

export const newToken = () => randomBytes(15).toString("base64url");

/** What HR sees: the stored status, or "expired" when an open link has run out. */
export function shownStatus(i: Pick<Invite, "status" | "expiresAt">) {
  return (OPEN_STATES as readonly string[]).includes(i.status) && i.expiresAt.getTime() < Date.now() ? "expired" : i.status;
}
export const STATUS_LABEL: Record<string, [string, string]> = {
  sent: ["Not opened", "p-mute"], opened: ["Opened", "p-info"], corrections: ["Corrections asked", "p-warn"], submitted: ["Submitted · verify", "p-warn"],
  accepted: ["Employee", "p-ok"], rejected: ["Rejected", "p-bad"], cancelled: ["Cancelled", "p-mute"], expired: ["Expired", "p-mute"],
};

/** The invite behind a link, and whether the form can still be filled. */
export async function inviteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return { inv: null, open: false };
  const inv = (await db().select().from(schema.joinerInvites).where(eq(schema.joinerInvites.tokenHash, sha256(token))))[0] || null;
  return { inv, open: !!inv && shownStatus(inv) !== "expired" && (OPEN_STATES as readonly string[]).includes(inv.status) };
}

export async function docsFor(category: string): Promise<JDoc[]> {
  return (await activeRows("jdocs")).filter((r) => !r.data[1] || r.data[1] === "All" || r.data[1] === category).map((r) => ({ name: String(r.data[0]), req: r.data[2] !== "No" }));
}
export async function filesOf(where: { inviteId?: number; employeeId?: string }): Promise<JFile[]> {
  const f = schema.files;
  return db().select({ id: f.id, kind: f.kind, fileName: f.fileName, size: f.size, mime: f.mime }).from(f)
    .where(where.inviteId ? eq(f.inviteId, where.inviteId) : eq(f.employeeId, where.employeeId || "")).orderBy(f.id);
}

/** Next free employee ID in a category, e.g. N-0327. */
export async function suggestId(category: string) {
  const cat = (await activeRows("cat")).find((r) => String(r.data[0]) === category);
  const code = String(cat?.data[1] || "").toUpperCase();
  if (!code) return "";
  const ids = await db().select({ id: schema.employees.id }).from(schema.employees).where(like(schema.employees.id, `${code}-%`));
  let max = 0, width = 4;
  for (const { id } of ids) { const n = id.slice(code.length + 1); if (/^\d+$/.test(n)) { max = Math.max(max, Number(n)); width = Math.max(width, n.length); } }
  return `${code}-${String(max + 1).padStart(width, "0")}`;
}

export async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = (h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  return `${proto}://${host}`;
}

export async function countToVerify() {
  return (await db().select({ id: schema.joinerInvites.id }).from(schema.joinerInvites).where(eq(schema.joinerInvites.status, "submitted"))).length;
}
export async function dropFiles(inviteId: number, kinds?: string[]) {
  const f = schema.files;
  await db().delete(f).where(kinds ? and(eq(f.inviteId, inviteId), inArray(f.kind, kinds)) : eq(f.inviteId, inviteId));
}

/** Check the first bytes so only real images and PDFs are stored. */
export function sniff(b: Buffer) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (b.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return "";
}
