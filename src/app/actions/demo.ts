"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { DEMO, seedDemo } from "@/lib/demo";
import { endSession } from "@/lib/auth";

export async function resetDemo() {
  await requireAdmin();
  if (!DEMO) redirect("/admin");
  await seedDemo();
  await endSession();
  redirect("/login?ok=" + encodeURIComponent("Demo data has been reset. Sign in again with any demo account."));
}
