import { config as loadDotenv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { buildApp } from "./app.js";
import { runMigrations } from "./db/migrate.js";

const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, "..", "..", ".env") });

async function main() {
  const config = loadConfig();
  if (config.env === "production") {
    console.info("Skipping startup migrations in production; Replit Publish manages the production schema.");
  } else {
    await runMigrations(config.databaseUrl);
  }
  const binhi = await buildApp({ config });
  const address = await binhi.app.listen({ port: config.port, host: "0.0.0.0" });
  binhi.app.log.info(`BINHI listening on ${address} (public URL ${config.publicUrl})`);
  const shutdown = async () => {
    await binhi.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
