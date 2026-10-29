import { describe, expect, it } from "vitest";
import { assertMigrationsAllowed } from "../../src/server/db/migrate.js";
import { checkMigrationFiles, inspectMigrationSql } from "../../scripts/check-migration-compat.mjs";

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

describe("migration compatibility check", () => {
  it("scans only incremental migrations and requires a reviewed annotation for flagged SQL", async () => {
    const results = await checkMigrationFiles();
    expect(results.map((r) => r.file)).toEqual(["0001_binhi_creative_studio.sql", "0002_nervous_carlie_cooper.sql", "0003_awesome_the_enforcers.sql"]);
    for (const result of results) {
      // Foreign keys on brand-new tables are flagged by the generic rule; the migration carries a reasoned review marker.
      expect(result.findings.length === 0 || result.reviewed).toBe(true);
    }
  });

  it.each([
    ["ALTER TABLE binhi_sites DROP COLUMN slug;", "drop"],
    ["ALTER TABLE binhi_sites RENAME COLUMN slug TO handle;", "rename"],
    ["ALTER TABLE binhi_sites ALTER COLUMN slug SET NOT NULL;", "alter-column"],
    ["ALTER TABLE binhi_sites ADD COLUMN handle text NOT NULL;", "required-column-without-default"],
    ["CREATE UNIQUE INDEX binhi_sites_handle_idx ON binhi_sites (handle);", "unique"],
    ["ALTER TABLE binhi_sites ADD CONSTRAINT valid_slug CHECK (length(slug) > 0);", "new-constraint"],
    ["DELETE FROM binhi_sites;", "data-removal"],
  ])("flags risky SQL: %s", (sql, rule) => {
    expect(inspectMigrationSql(sql).map((finding) => finding.name)).toContain(rule);
  });

  it("ignores risky-looking text in SQL comments", () => {
    expect(inspectMigrationSql("-- DROP TABLE binhi_sites;\nCREATE INDEX binhi_sites_name_idx ON binhi_sites (name);"))
      .toEqual([]);
  });

  it("does not flag a required added column that has a database default", () => {
    expect(inspectMigrationSql(
      "ALTER TABLE binhi_sites ADD COLUMN handle text NOT NULL DEFAULT '';",
    )).toEqual([]);
    expect(inspectMigrationSql(
      "ALTER TABLE binhi_sites ADD COLUMN handle text DEFAULT '' NOT NULL;",
    )).toEqual([]);
  });
});
