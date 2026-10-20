import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.BINHI_DATABASE_URL ?? "postgres://binhi:binhi_dev_pw@127.0.0.1:5432/binhi_dev",
  },
});
