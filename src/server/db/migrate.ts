import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_FOLDER = path.resolve(here, "..", "..", "..", "migrations");

export async function runMigrations(connectionString: string): Promise<void> {
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_FOLDER, migrationsTable: "binhi_migrations" });
  } finally {
    await sql.end();
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.BINHI_DATABASE_URL;
  if (!url) {
    console.error("BINHI_DATABASE_URL is required");
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
