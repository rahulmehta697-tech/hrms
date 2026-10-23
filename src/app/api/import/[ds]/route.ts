import { NextResponse } from "next/server";
import { DATASETS, dsAllowed, ctxFor } from "@/lib/datasets";
import { readUpload, normCell } from "@/lib/files";
import { apiUser, deny, sameOrigin } from "@/lib/api";
import { log } from "@/lib/audit";
import { who } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ ds: string }> }) {
  if (!sameOrigin(req)) return deny("Request blocked.");
  const u = await apiUser();
  if (!u) return deny("Sign in first.", 401);
  const { ds: key } = await params;
  const ds = DATASETS[key];
  if (!ds?.imp) return deny("This data set has no import.", 404);
  if (!(await dsAllowed(ds, u, "import"))) return deny("You don't have permission to import this data.");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return deny("Choose a file first.", 400);
  if (file.size > 4_000_000) return deny("That file is over 4 MB. Split it into smaller files.", 400);
  const commit = form.get("commit") === "1";
  const ctx = await ctxFor(u, new URLSearchParams(String(form.get("params") || "")));
  const im = ds.imp;
  let raw;
  try { raw = await readUpload(file.name, Buffer.from(await file.arrayBuffer())); }
  catch { return deny("That file could not be read. Save it as .xlsx or .csv and try again.", 400); }
  const want = im.headers.map((h) => h.toLowerCase());
  let hr = -1; const map: Record<string, number> = {};
  for (let r = 0; r < Math.min(raw.length, 15); r++) {
    const row = raw[r].map((c) => String(c ?? "").trim().toLowerCase());
    if (want.filter((h) => row.includes(h)).length >= Math.ceil(want.length / 2)) { hr = r; im.headers.forEach((h, i) => { const ix = row.indexOf(want[i]); if (ix >= 0) map[h] = ix; }); break; }
  }
  const required = im.required || [im.headers[0]];
  if (hr < 0) return NextResponse.json({ file: file.name, missing: required, rows: [], total: 0, ok: 0 });
  const missing = required.filter((h) => map[h] === undefined);
  const prep = im.prepare ? await im.prepare(ctx) : null;
  const rows = raw.slice(hr + 1).filter((r) => r.some((c) => String(c ?? "").trim() !== "")).map((r) => {
    const o: Record<string, string | number> = {};
    for (const h of im.headers) o[h] = map[h] === undefined ? "" : normCell(r[map[h]] ?? "", im.types?.[h]);
    let err = "";
    if (!missing.length) { for (const q of required) if (String(o[q] ?? "").trim() === "") { err = `${q} is required`; break; } if (!err) err = im.validate(o, prep, ctx); }
    return { o, err };
  });
  const good = rows.filter((r) => !r.err).map((r) => r.o);
  if (commit) {
    if (missing.length || !good.length) return deny("Nothing to import.", 400);
    const message = await im.commit(good, prep, ctx);
    await log(who(u), `Imported ${good.length} rows into ${ds.title(ctx)} from “${file.name}”`);
    return NextResponse.json({ done: true, message });
  }
  return NextResponse.json({ file: file.name, headers: im.headers, missing, total: rows.length, ok: good.length, rows: rows.slice(0, 300) });
}
