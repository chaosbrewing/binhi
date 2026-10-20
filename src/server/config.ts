import { z } from "zod";

const Env = z.object({
  BINHI_DATABASE_URL: z.string().min(1, "BINHI_DATABASE_URL is required"),
  BINHI_SESSION_SECRET: z.string().min(16, "BINHI_SESSION_SECRET must be at least 16 characters"),
  BINHI_PUBLIC_URL: z.string().url().default("http://127.0.0.1:4100"),
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
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
