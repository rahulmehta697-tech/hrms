"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePerm, who } from "@/lib/auth";
import { canActOn, nextState } from "@/lib/logic";
import { log } from "@/lib/audit";

const go = (k: "ok" | "err", m: string): never => redirect(`/approvals?${k}=${encodeURIComponent(m)}`);

export async function decide(fd: FormData) {
  const u = await requirePerm("approve");
  const kind = String(fd.get("kind")), id = Number(fd.get("id")), action = fd.get("action") === "reject" ? "reject" : "approve";
  const note = String(fd.get("note") ?? "").trim().slice(0, 300);
  if (action === "reject" && !note) go("err", "Add a short reason when rejecting, so the employee knows why.");
  const tbl = kind === "reg" ? schema.regRequests : schema.leaveRequests;
  const r = (await db().select().from(tbl).where(eq(tbl.id, id)))[0];
  if (!r || r.status !== "pending") go("err", "That request has already been decided.");
  if (!(await canActOn(u, r!.chain[r!.level], r!.employeeId))) go("err", "This request is waiting for someone else.");
  const st = nextState(r!, u.name, action, note);
  await db().update(tbl).set(st).where(eq(tbl.id, id));
  if (kind === "reg" && st.status === "approved") {
    const rr = r as typeof schema.regRequests.$inferSelect;
    await db().insert(schema.punches).values({ employeeId: rr.employeeId, date: rr.date, time: rr.time, direction: rr.direction, source: "Regularised" });
  }
  const label = kind === "reg" ? `regularisation #${id}` : `leave LV-${id}`;
  await log(who(u), `${action === "approve" ? "Approved" : "Rejected"} ${label} of ${r!.employeeId}${st.status === "pending" ? ` (now with ${r!.chain[st.level]})` : ""}${note ? `: ${note}` : ""}`);
  go("ok", st.status === "pending" ? `Approved and passed to ${r!.chain[st.level]}.` : action === "approve" ? "Approved. The employee can see it now." : "Rejected. The employee can see your reason.");
}
