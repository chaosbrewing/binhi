const DEFAULT_TEST_DATABASE_URL = "postgres://binhi:binhi_dev_pw@127.0.0.1:5432/binhi_test";
const TEST_DATABASE_NAME = /(?:^|[_-])(test|testing|e2e|disposable)(?:[_-]|$)/i;

function databaseIdentity(rawUrl: string): string {
  const url = new URL(rawUrl);
  const hostname = url.hostname.toLowerCase();
  const normalizedHost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) ? "loopback" : hostname;
  return `postgres://${normalizedHost}:${url.port || "5432"}${decodeURIComponent(url.pathname)}`;
}

/**
 * Return the dedicated database used by destructive tests.
 *
 * These tests truncate their target, so require a clearly test-named database
 * and reject any database that resolves to the app's configured database.
 */
export function getTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === "production" || env.REPLIT_DEPLOYMENT) {
    throw new Error("Refusing destructive tests in a production runtime.");
  }

  const rawUrl = env.BINHI_TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error("BINHI_TEST_DATABASE_URL must be a valid PostgreSQL URL for a disposable test database.");
  }

  if (target.protocol !== "postgres:" && target.protocol !== "postgresql:") {
    throw new Error("BINHI_TEST_DATABASE_URL must use the postgres:// or postgresql:// protocol.");
  }

  const databaseName = decodeURIComponent(target.pathname.replace(/^\/+/, ""));
  if (!TEST_DATABASE_NAME.test(databaseName)) {
    throw new Error("Refusing destructive tests: the database name must clearly identify a test/e2e database.");
  }

  const targetIdentity = databaseIdentity(rawUrl);
  for (const [label, appUrl] of [
    ["BINHI_DATABASE_URL", env.BINHI_DATABASE_URL],
    ["DATABASE_URL", env.DATABASE_URL],
  ] as const) {
    if (appUrl && databaseIdentity(appUrl) === targetIdentity) {
      throw new Error(`Refusing destructive tests: BINHI_TEST_DATABASE_URL points to the app database configured by ${label}.`);
    }
  }

  return rawUrl;
}
