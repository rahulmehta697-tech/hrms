import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { apiUser, deny } from "@/lib/api";
import { can } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** A stored document. HR (employee records permission) can open any; staff can open their own. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await apiUser();
  if (!u) return deny("Sign in first.", 401);
  const f = (await db().select().from(schema.files).where(eq(schema.files.id, Number((await params).id))))[0];
  if (!f) return deny("File not found.", 404);
  const own = !!f.employeeId && f.employeeId.toUpperCase() === u.employeeId?.toUpperCase();
  if (!own && !(await can(u, "employees"))) return deny("You can't open this file.");
  const dl = new URL(req.url).searchParams.get("dl") === "1";
  return new Response(new Uint8Array(f.data), { headers: {
    "content-type": f.mime, "content-length": String(f.size), "cache-control": "private, no-store",
    "content-disposition": `${dl ? "attachment" : "inline"}; filename="${f.fileName.replace(/"/g, "")}"`,
    "x-content-type-options": "nosniff", ...(f.mime.startsWith("image/") ? { "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" } : {}),
  } });
}
