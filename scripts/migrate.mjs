// Applies database migrations from ./drizzle. Runs automatically before every build.
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.warn("[migrate] DATABASE_URL is not set, skipping migrations.");
  process.exit(0);
}
const local = /localhost|127\.0\.0\.1/.test(url);
const pool = new pg.Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("[migrate] Database is up to date.");
} catch (e) {
  console.error("[migrate] Migration failed:", e);
  process.exit(1);
} finally {
  await pool.end();
}
