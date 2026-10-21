import { describe, expect, it } from "vitest";
import { assertMigrationsAllowed } from "../../src/server/db/migrate.js";

describe("migration environment guard", () => {
  it("allows local and development migration runs", () => {
    expect(() => assertMigrationsAllowed({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertMigrationsAllowed({ NODE_ENV: "test" })).not.toThrow();
  });

  it("rejects production migration runs", () => {
    expect(() => assertMigrationsAllowed({ NODE_ENV: "production" })).toThrow(
      "Replit Publish manages the production schema",
    );
    expect(() => assertMigrationsAllowed({ REPLIT_DEPLOYMENT: "1" })).toThrow(
      "Replit Publish manages the production schema",
    );
  });
});
