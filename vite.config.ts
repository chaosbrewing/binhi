import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// BINHI editor client. In development the Vite dev server proxies API and
// published-site routes to the Fastify server (src/server/start.ts, port 4100).
export default defineConfig({
  plugins: [react()],
  root: here,
  base: "/",
  publicDir: path.join(here, "public"),
  build: { outDir: path.join(here, "dist", "client"), emptyOutDir: true },
  server: {
    host: true,
    port: 4173,
    proxy: {
      "/api": "http://127.0.0.1:4100",
      "/s/": "http://127.0.0.1:4100",
      "/media/": "http://127.0.0.1:4100",
    },
  },
});
