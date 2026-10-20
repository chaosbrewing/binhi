import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(connectionString: string) {
  const sql = postgres(connectionString, { max: 10, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  return { db, sql };
}
export type Db = ReturnType<typeof createDb>["db"];
export type Sql = ReturnType<typeof createDb>["sql"];

export { schema };
