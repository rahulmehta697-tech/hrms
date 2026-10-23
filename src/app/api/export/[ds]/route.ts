import { DATASETS, dsAllowed, ctxFor } from "@/lib/datasets";
import { getSettings } from "@/lib/settings";
import { toPdf, toXlsx } from "@/lib/files";
import { apiUser, deny, fileResponse, slug } from "@/lib/api";
import { log } from "@/lib/audit";
import { nowIn } from "@/lib/dates";
import { who } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ ds: string }> }) {
  const u = await apiUser();
  if (!u) return deny("Sign in first.", 401);
  const { ds: key } = await params;
  const ds = DATASETS[key];
  if (!ds) return deny("Unknown data set.", 404);
  if (!(await dsAllowed(ds, u, "export"))) return deny("You don't have permission to export this data.");
  const url = new URL(req.url);
  const fmt = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const ctx = await ctxFor(u, url.searchParams);
  const { org } = await getSettings();
  const title = ds.title(ctx), headers = await ds.headers(ctx), rows = await ds.rows(ctx);
  const buf = fmt === "pdf" ? toPdf(org, title, u.name, headers, rows) : await toXlsx(org, title, u.name, headers, rows);
  await log(who(u), `Exported ${title} to ${fmt === "pdf" ? "PDF" : "Excel"} (${rows.length} rows)`);
  return fileResponse(buf, `${slug(org.short)}-${ds.file}-${nowIn(org.tz).date}.${fmt}`);
}
