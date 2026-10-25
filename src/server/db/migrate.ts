import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolveHostDefaults } from "../config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_FOLDER = path.resolve(here, "..", "..", "..", "migrations");

export function assertMigrationsAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === "production" || env.REPLIT_DEPLOYMENT) {
    throw new Error("Refusing to run BINHI migrations in production; Replit Publish manages the production schema.");
  }
}

export async function runMigrations(connectionString: string): Promise<void> {
  assertMigrationsAllowed();
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER, migrationsTable: "binhi_migrations" });
  } finally {
    await sql.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  loadDotenv({ path: path.resolve(here, "..", "..", "..", ".env") });
  const env = resolveHostDefaults(process.env);
  const url = env.BINHI_DATABASE_URL;
  if (!url) {
    console.error("BINHI_DATABASE_URL (or DATABASE_URL) is required");
    process.exit(1);
  }
  runMigrations(url).then(
    () => console.log("BINHI migrations applied."),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
