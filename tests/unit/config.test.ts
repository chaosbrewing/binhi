import { describe, expect, it } from "vitest";
import { loadConfig, resolveHostDefaults } from "../../src/server/config.js";

describe("Replit host defaults", () => {
  it("accepts the host database and session secret without changing the input", () => {
    const env = {
      DATABASE_URL: "postgres://example.invalid/binhi",
      SESSION_SECRET: "host-session-secret-for-test-only",
      REPLIT_DEV_DOMAIN: "example.replit.dev",
      PORT: "5000",
    };
    const config = loadConfig(env);
    expect(config.databaseUrl).toBe(env.DATABASE_URL);
    expect(config.sessionSecret).toBe(env.SESSION_SECRET);
    expect(config.publicUrl).toBe("https://example.replit.dev");
    expect(config.port).toBe(5000);
    expect(env).not.toHaveProperty("BINHI_SESSION_SECRET");
  });

  it("uses the published domain in production and never falls back to a development domain", () => {
    const defaults = resolveHostDefaults({
      NODE_ENV: "production",
      REPLIT_DOMAINS: "binhi.replit.app,binhi.example.com",
      REPLIT_DEV_DOMAIN: "workspace.replit.dev",
    });
    expect(defaults.BINHI_PUBLIC_URL).toBe("https://binhi.replit.app");

    expect(() =>
      loadConfig({
        DATABASE_URL: "postgres://example.invalid/binhi",
        SESSION_SECRET: "host-session-secret-for-test-only",
        NODE_ENV: "production",
        REPLIT_DEV_DOMAIN: "workspace.replit.dev",
      }),
    ).toThrow("BINHI_PUBLIC_URL");
  });

  it("treats Replit deployments as production even when NODE_ENV is set to development", () => {
    const defaults = resolveHostDefaults({
      NODE_ENV: "development",
      REPLIT_DEPLOYMENT: "1",
      REPLIT_DOMAINS: "binhi.replit.app",
    });
    expect(defaults.NODE_ENV).toBe("production");
    expect(defaults.BINHI_PUBLIC_URL).toBe("https://binhi.replit.app");
  });

  it("can serve the built editor in the development workspace without enabling production mode", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://example.invalid/binhi",
      SESSION_SECRET: "host-session-secret-for-test-only",
      BINHI_SERVE_BUILT_CLIENT: "true",
      REPLIT_DEV_DOMAIN: "workspace.replit.dev",
    });
    expect(config.env).toBe("development");
    expect(config.serveBuiltClient).toBe(true);
  });

  it("prefers an explicit BINHI session secret", () => {
    const env = resolveHostDefaults({
      SESSION_SECRET: "host-session-secret-for-test-only",
      BINHI_SESSION_SECRET: "explicit-session-secret-for-test-only",
    });
    expect(env.BINHI_SESSION_SECRET).toBe("explicit-session-secret-for-test-only");
  });

  it("fails explicitly if neither session secret is configured", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgres://example.invalid/binhi" }))
      .toThrow("BINHI_SESSION_SECRET");
  });
});
