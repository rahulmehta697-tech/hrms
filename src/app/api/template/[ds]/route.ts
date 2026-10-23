import { DATASETS, dsAllowed, ctxFor } from "@/lib/datasets";
import { getSettings } from "@/lib/settings";
import { template } from "@/lib/files";
import { apiUser, deny, fileResponse, slug } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ ds: string }> }) {
  const u = await apiUser();
  if (!u) return deny("Sign in first.", 401);
  const { ds: key } = await params;
  const ds = DATASETS[key];
  if (!ds?.imp) return deny("This data set has no import.", 404);
  if (!(await dsAllowed(ds, u, "import"))) return deny("You don't have permission to import this data.");
  const { org } = await getSettings();
  const ctx = await ctxFor(u, new URL(req.url).searchParams);
  const buf = await template(org, ds.title(ctx), ds.imp.headers, ds.imp.help, ds.imp.required || []);
  return fileResponse(buf, `${slug(org.short)}-${ds.file}-import-template.xlsx`);
}
