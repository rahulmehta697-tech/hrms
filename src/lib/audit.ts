import { db, schema } from "@/db";
export async function log(who: string, action: string) {
  await db().insert(schema.audit).values({ who, action: action.slice(0, 1000) });
}
