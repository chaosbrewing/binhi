import { z } from "zod";

const Env = z.object({
  BINHI_DATABASE_URL: z.string().min(1, "BINHI_DATABASE_URL (or DATABASE_URL) is required"),
  BINHI_SESSION_SECRET: z.string().min(16, "BINHI_SESSION_SECRET must be at least 16 characters"),
  BINHI_PUBLIC_URL: z.string().url(),
  BINHI_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  BINHI_MEDIA_STORAGE: z.enum(["postgres", "disk"]).default("postgres"),
  BINHI_MEDIA_DIR: z.string().optional(),
  BINHI_ALLOW_SIGNUP: z
    .string()
    .optional()
    .transform((v) => v === undefined || v === "true" || v === "1"),
  BINHI_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024),
});

export type Config = {
  databaseUrl: string;
  sessionSecret: string;
  publicUrl: string;
  port: number;
  env: "development" | "test" | "production";
  mediaStorage: "postgres" | "disk";
  mediaDir?: string;
  allowSignup: boolean;
  maxUploadBytes: number;
  /** Internal URL the server uses to verify its own published pages (defaults to publicUrl). */
  verifyBaseUrl: string;
};

/**
 * Resolve host-provided defaults before validation so a Replit deployment needs
 * a session secret (BINHI_SESSION_SECRET or the host's SESSION_SECRET):
 * - database: BINHI_DATABASE_URL, else the host's DATABASE_URL (Replit's dev or
 *   production database — they are different values in each environment);
 * - port: BINHI_PORT, else the host's PORT;
 * - public URL: BINHI_PUBLIC_URL, else https://<REPLIT_DOMAINS first entry>
 *   (deployments), else https://<REPLIT_DEV_DOMAIN> (workspace), else localhost.
 */
export function resolveHostDefaults(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  if (!out.BINHI_DATABASE_URL && out.DATABASE_URL) out.BINHI_DATABASE_URL = out.DATABASE_URL;
  if (!out.BINHI_SESSION_SECRET && out.SESSION_SECRET) out.BINHI_SESSION_SECRET = out.SESSION_SECRET;
  if (!out.BINHI_PORT && out.PORT) out.BINHI_PORT = out.PORT;
  if (!out.BINHI_PUBLIC_URL) {
    const deployed = out.REPLIT_DOMAINS?.split(",")[0]?.trim();
    const dev = out.REPLIT_DEV_DOMAIN?.trim();
    if (deployed) out.BINHI_PUBLIC_URL = `https://${deployed}`;
    else if (dev) out.BINHI_PUBLIC_URL = `https://${dev}`;
    else out.BINHI_PUBLIC_URL = `http://127.0.0.1:${out.BINHI_PORT ?? 4100}`;
  }
  if (!out.NODE_ENV && out.REPLIT_DEPLOYMENT) out.NODE_ENV = "production";
  return out;
}

export function loadConfig(rawEnv: NodeJS.ProcessEnv = process.env): Config {
  const env = resolveHostDefaults(rawEnv);
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`BINHI configuration error: ${msg}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === "production" && e.BINHI_SESSION_SECRET === "change-me") {
    throw new Error("BINHI_SESSION_SECRET must be changed from the example value in production");
  }
  if (e.BINHI_MEDIA_STORAGE === "disk" && !e.BINHI_MEDIA_DIR) {
    throw new Error("BINHI_MEDIA_DIR is required when BINHI_MEDIA_STORAGE=disk");
  }
  return {
    databaseUrl: e.BINHI_DATABASE_URL,
    sessionSecret: e.BINHI_SESSION_SECRET,
    publicUrl: e.BINHI_PUBLIC_URL.replace(/\/$/, ""),
    port: e.BINHI_PORT,
    env: e.NODE_ENV,
    mediaStorage: e.BINHI_MEDIA_STORAGE,
    mediaDir: e.BINHI_MEDIA_DIR,
    allowSignup: e.BINHI_ALLOW_SIGNUP,
    maxUploadBytes: e.BINHI_MAX_UPLOAD_BYTES,
    verifyBaseUrl: (env.BINHI_VERIFY_BASE_URL ?? e.BINHI_PUBLIC_URL).replace(/\/$/, ""),
  };
}
