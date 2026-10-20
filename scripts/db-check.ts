/**
 * Prints which database this environment would use, without secrets.
 * Run in the Replit workspace shell and in a deployment shell to confirm the
 * development and production databases are different.
 *   npm run db:check
 */
import { config as loadDotenv } from "dotenv";
import postgres from "postgres";
import { resolveHostDefaults } from "../src/server/config.js";

loadDotenv();
const env = resolveHostDefaults(process.env);
const url = env.BINHI_DATABASE_URL;
if (!url) {
  console.error("No BINHI_DATABASE_URL or DATABASE_URL in this environment.");
  process.exit(1);
}
const u = new URL(url);
console.log(`environment : ${env.NODE_ENV ?? "development"}${env.REPLIT_DEPLOYMENT ? " (Replit deployment)" : env.REPLIT_DEV_DOMAIN ? " (Replit workspace)" : ""}`);
console.log(`public URL  : ${env.BINHI_PUBLIC_URL}`);
console.log(`db host     : ${u.hostname}`);
console.log(`db name     : ${u.pathname.replace(/^\//, "")}`);
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const [{ now }] = await sql`select now()`;
  const [{ n }] = await sql`select count(*)::int as n from information_schema.tables where table_name like 'binhi_%'`;
  const migrated = (await sql`select to_regclass('drizzle.binhi_migrations') as r`)[0]?.r;
  console.log(`connected   : yes (${now})`);
  console.log(`binhi tables: ${n}${migrated ? "" : " — migrations not applied yet (the server applies them at startup)"}`);
} finally {
  await sql.end();
}
