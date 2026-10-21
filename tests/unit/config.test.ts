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
