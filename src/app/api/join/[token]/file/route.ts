import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { inviteByToken, docsFor, dropFiles, sniff } from "@/lib/joiners";
import { MAX_FILE } from "@/lib/joinform";

export const dynamic = "force-dynamic";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Upload one document. A new upload for the same document replaces the old one. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { inv, open } = await inviteByToken(token);
  if (!inv || !open) return bad("This link no longer works.", 410);
  let fd: FormData;
  try { fd = await req.formData(); } catch { return bad("The upload did not arrive. Try again."); }
  const kind = String(fd.get("kind") || ""), file = fd.get("file");
  if (!(await docsFor(inv.category)).some((d) => d.name === kind)) return bad("Unknown document.");
  if (!(file instanceof File) || !file.size) return bad("Choose a file.");
  if (file.size > MAX_FILE) return bad("The file is larger than 4 MB. Take a smaller photo or compress the PDF.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime) return bad("Upload a photo (JPG, PNG) or a PDF.");
  await dropFiles(inv.id, [kind]);
  const name = (file.name || "document").replace(/[^\w.\- ]+/g, "_").slice(0, 80);
  const [row] = await db().insert(schema.files).values({ inviteId: inv.id, kind, fileName: name, mime, size: buf.length, data: buf }).returning({ id: schema.files.id });
  return NextResponse.json({ file: { id: row.id, kind, fileName: name, size: buf.length, mime } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { inv, open } = await inviteByToken(token);
  if (!inv || !open) return bad("This link no longer works.", 410);
  const id = Number(new URL(req.url).searchParams.get("id"));
  await db().delete(schema.files).where(and(eq(schema.files.id, id), eq(schema.files.inviteId, inv.id)));
  return NextResponse.json({ ok: true });
}
