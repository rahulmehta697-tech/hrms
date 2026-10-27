import pg from "pg";
import path from "path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "./schema";

declare global { var __hrmsPool: pg.Pool | undefined; var __hrmsSchema: Promise<void> | undefined } // eslint-disable-line no-var

/** Accepts the variable names set by Vercel's Neon and Postgres integrations as well as our own. */
export const dbUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || "";

function pool() {
  if (!globalThis.__hrmsPool) {
    const url = dbUrl();
    if (!url) throw new Error("No database is connected. In Vercel, open Storage and connect a Neon database to this project (it adds DATABASE_URL), then redeploy.");
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

/** Creates or updates the tables if the build couldn't (for example, the database was connected after the first build). Runs once per server. */
export function ensureSchema() {
  if (!globalThis.__hrmsSchema) {
    globalThis.__hrmsSchema = (async () => {
      // Applying migrations is safe to repeat: already-applied ones are skipped.
      await migrate(db(), { migrationsFolder: path.join(process.cwd(), "drizzle") });
    })().catch((e) => { globalThis.__hrmsSchema = undefined; throw e; });
  }
  return globalThis.__hrmsSchema;
}
export { schema };
