import { describe, expect, it } from "vitest";
import { getTestDatabaseUrl } from "../test-database.js";

describe("test database safety", () => {
  it("uses an isolated local test database by default", () => {
    expect(getTestDatabaseUrl({})).toContain("/binhi_test");
  });

  it("accepts a separately named disposable database", () => {
    const url = "postgres://test-user:pw@db.example:5432/binhi_e2e";
    expect(getTestDatabaseUrl({ BINHI_TEST_DATABASE_URL: url })).toBe(url);
  });

  it("rejects a target that is not clearly a test database", () => {
    expect(() => getTestDatabaseUrl({
      BINHI_TEST_DATABASE_URL: "postgres://test-user:pw@db.example:5432/binhi",
    })).toThrow(/database name must clearly identify a test\/e2e database/);
  });

  it("refuses to run destructive tests in a production runtime", () => {
    expect(() => getTestDatabaseUrl({ NODE_ENV: "production" })).toThrow(/production runtime/);
    expect(() => getTestDatabaseUrl({ REPLIT_DEPLOYMENT: "true" })).toThrow(/production runtime/);
  });

  it("rejects the workspace/app database even when its name looks like a test database", () => {
    const url = "postgres://app-user:pw@db.example:5432/binhi_test";
    expect(() => getTestDatabaseUrl({
      BINHI_TEST_DATABASE_URL: url,
      DATABASE_URL: "postgres://other-user:other-pw@db.example:5432/binhi_test",
    })).toThrow(/points to the app database configured by DATABASE_URL/);
  });

  it("treats localhost and 127.0.0.1 as the same database host", () => {
    expect(() => getTestDatabaseUrl({
      BINHI_TEST_DATABASE_URL: "postgres://tester:pw@127.0.0.1:5432/binhi_test",
      BINHI_DATABASE_URL: "postgres://app:pw@localhost/binhi_test",
    })).toThrow(/points to the app database configured by BINHI_DATABASE_URL/);
  });
});
