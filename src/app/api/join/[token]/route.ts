import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { inviteByToken, docsFor, filesOf } from "@/lib/joiners";
import { JSTEPS, checkStep, cleanData, aadhaarOk } from "@/lib/joinform";
import { encrypt } from "@/lib/secure";
import { log } from "@/lib/audit";

export const dynamic = "force-dynamic";
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Save answers (action "save") or send the form to HR (action "submit"). The link stops working after a submit. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { inv, open } = await inviteByToken(token);
  if (!inv || !open) return bad("This link no longer works. Ask HR for a new one.", 410);
  let body: { action?: string; step?: string; data?: Record<string, unknown> };
  try { body = await req.json(); } catch { return bad("Could not read the form."); }
  const incoming = body.data && typeof body.data === "object" ? body.data : {};
  const data: Record<string, unknown> = { ...inv.data, ...cleanData({ ...inv.data, ...incoming }) };
  const raw = String(incoming.aadhaar ?? "").replace(/\D/g, "");
  if (raw) {
    if (!aadhaarOk(raw)) return NextResponse.json({ errors: { aadhaar: "This is not a valid Aadhaar number" } }, { status: 422 });
    data.aadhaarEnc = encrypt(raw); data.aadhaarLast4 = raw.slice(-4);
  }
  const hasA = !!data.aadhaarEnc;
  if (body.action === "submit") {
    const errors: Record<string, string> = {};
    let firstStep = "";
    for (const s of JSTEPS) { const e = checkStep(s.id, data, hasA); if (Object.keys(e).length && !firstStep) firstStep = s.id; Object.assign(errors, e); }
    const have = new Set((await filesOf({ inviteId: inv.id })).map((f) => f.kind));
    const missing = (await docsFor(inv.category)).filter((d) => d.req && !have.has(d.name)).map((d) => d.name);
    if (missing.length) { errors.docs = `Upload: ${missing.join(", ")}`; firstStep ||= "docs"; }
    if (data.agree !== true) errors.agree = "Please confirm the declaration";
    if (Object.keys(errors).length) {
      await db().update(schema.joinerInvites).set({ data }).where(eq(schema.joinerInvites.id, inv.id));
      return NextResponse.json({ errors, step: firstStep }, { status: 422 });
    }
    await db().update(schema.joinerInvites).set({ data, status: "submitted", submittedAt: new Date(), tokenHash: null, checks: {},
      history: [...inv.history, { level: "Joiner", by: String(data.fullName || inv.name), action: "submitted", at: new Date().toISOString() }] }).where(eq(schema.joinerInvites.id, inv.id));
    await log(`${data.fullName || inv.name} (joining form)`, `Submitted joining form #${inv.id}`);
    return NextResponse.json({ ok: true, submitted: true });
  }
  const errors = body.step ? checkStep(body.step, data, hasA) : {};
  await db().update(schema.joinerInvites).set({ data }).where(eq(schema.joinerInvites.id, inv.id));
  return NextResponse.json({ ok: true, errors, aadhaarLast4: data.aadhaarLast4 || "" }, { status: Object.keys(errors).length ? 422 : 200 });
}
