import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

declare global { var __hrmsPool: pg.Pool | undefined } // eslint-disable-line no-var

function pool() {
  if (!globalThis.__hrmsPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Add it in your hosting settings (see DEPLOY.md).");
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalThis.__hrmsPool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 10_000 });
  }
  return globalThis.__hrmsPool;
}

let _db: NodePgDatabase<typeof schema> | undefined;
export function db() {
  if (!_db) _db = drizzle(pool(), { schema });
  return _db;
}
export { schema };
