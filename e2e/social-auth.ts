/**
 * Synthetic-provider browser journey. HTTPS is real locally; issuer responses are intercepted.
 * Never contacts Google/Apple, enables a console, or uses the workspace/production database.
 */
import assert from "node:assert/strict";
import https from "node:https";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HTTPMethods } from "fastify";
import { chromium } from "playwright";
import { testApp } from "../tests/helpers.js";
import { fixtureEnv, SyntheticIssuer } from "../tests/oauth-fixture.js";

if (process.env.BINHI_E2E_BASE || process.argv.includes("--remote")) throw new Error("Synthetic local journey only");
const base = "https://localhost:4317", output = "e2e/screenshots/social-auth";
mkdirSync(output, { recursive: true });
const gbm = (existsSync("/nix/store") ? readdirSync("/nix/store") : []).filter(n => n.includes("mesa-libgbm")).map(n => `/nix/store/${n}/lib`).find(d => existsSync(`${d}/libgbm.so.1`));
if (gbm) process.env.LD_LIBRARY_PATH = `${gbm}:${process.env.LD_LIBRARY_PATH ?? ""}`;
const tls = mkdtempSync(join(tmpdir(), "binhi-auth-tls-"));
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(tls, "key"), "-out", join(tls, "cert"), "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore" });
const issuer = new SyntheticIssuer();
const built = await testApp({ ...fixtureEnv(base), BINHI_SERVE_BUILT_CLIENT: "true" }, { oidcFetchImpl: issuer.fetch });
const cookieEvidence: { hasBinding: boolean; hasSession: boolean }[] = [];
const server = https.createServer({ key: readFileSync(join(tls, "key")), cert: readFileSync(join(tls, "cert")) }, async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (req.url === "/api/auth/apple/callback") {
    const names = String(req.headers.cookie ?? "").split(";").map(c => c.trim().split("=")[0]);
    cookieEvidence.push({ hasBinding: names.includes("binhi_oauth_apple"), hasSession: names.includes("binhi_session") });
  }
  try {
    const result = await built.app.inject({ method: req.method as HTTPMethods, url: req.url!, headers: req.headers, payload: Buffer.concat(chunks) });
    res.writeHead(result.statusCode, result.headers); res.end(result.rawPayload);
  } catch { res.writeHead(500); res.end("Synthetic test adapter failed"); }
});
await new Promise<void>(r => server.listen(4317, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", e => errors.push(e.message));
const steps: string[] = [];
const pass = (s: string) => { steps.push(s); console.log(`PASS ${s}`); };
const userIds = new Set<string>();
let ok = false;
let googleSubject = "browser-google";
let googleEmail = "browser-google@example.invalid";
try {
  await page.route(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/, async route => {
    const data = issuer.authorize(route.request().url(), { sub: googleSubject, email: googleEmail });
    await route.fulfill({ status: 302, headers: { location: `${base}/api/auth/google/callback?${new URLSearchParams(data)}` }, body: "" });
  });
  await page.route(/^https:\/\/appleid\.apple\.com\/auth\/authorize/, async route => {
    const data = issuer.authorize(route.request().url(), { sub: "browser-apple", email: "browser@privaterelay.appleid.com", email_verified: "true" });
    await route.fulfill({ contentType: "text/html", body: `<form method="post" action="${base}/api/auth/apple/callback"><input name="state" value="${data.state}"><input name="code" value="${data.code}"></form><script>document.forms[0].submit()</script>` });
  });
  // An unavailable provider must never look operational.
  await page.route("**/api/auth/providers", route => route.fulfill({ json: { providers: [
    { id: "google", label: "Google", available: false, reason: "Provider setup is required" },
    { id: "apple", label: "Apple", available: false, reason: "Provider setup is required" },
  ] } }));
  for (const path of ["/signin", "/signup"]) {
    await page.goto(`${base}${path}`);
    await page.getByRole("button", { name: "Continue with Google", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Continue with Google", exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "Continue with Apple", exact: true }).isDisabled(), true);
  }
  await page.screenshot({ path: `${output}/01-unavailable.png` });
  pass("signin/signup keep password forms and expose honestly disabled provider controls");
  await page.unroute("**/api/auth/providers");
  await page.goto(`${base}/signin`);
  await page.getByRole("button", { name: "Continue with Google", exact: true }).click();
  await page.waitForURL(`${base}/`);
  const getUser = async () => (await context.request.get(`${base}/api/auth/me`).then(r => r.json())).user;
  const user = await getUser(); userIds.add(user.id);
  await page.goto(`${base}/account`);
  await page.getByRole("button", { name: "Verify with Google", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Disconnect Google", exact: true }).isDisabled(), true);
  pass("Google synthetic redirect creates an OAuth-only BINHI session; last method cannot disconnect");
  await page.getByRole("button", { name: "Verify with Google", exact: true }).click();
  await page.getByText("Your identity was recently verified.").waitFor();
  await page.getByRole("button", { name: "Link Apple", exact: true }).click();
  await page.getByRole("button", { name: "Verify with Apple", exact: true }).waitFor();
  assert.equal((await getUser()).id, user.id);
  assert.ok(cookieEvidence.length && cookieEvidence.every(e => e.hasBinding && !e.hasSession), "Apple POST must carry binding but NOT the Lax session cookie");
  await page.screenshot({ path: `${output}/02-linked.png` });
  pass("Apple synthetic cross-site form_post links through its scoped Secure/None binding without the main session cookie");
  await page.getByRole("button", { name: "Verify with Apple", exact: true }).click();
  await page.getByText("Your identity was recently verified.").waitFor();
  page.once("dialog", d => void d.accept());
  await page.getByRole("button", { name: "Disconnect Apple", exact: true }).click();
  await page.getByRole("button", { name: "Link Apple", exact: true }).waitFor();
  const methods = await context.request.get(`${base}/api/auth/methods`).then(r => r.json());
  assert.equal(methods.identities.length, 1);
  pass("provider reauthentication and confirmed unlink preserve the original owner and remaining login method");
  await page.getByRole("button", { name: "Verify with Google", exact: true }).click();
  await page.getByText("Your identity was recently verified.").waitFor();
  await built.sql`update binhi_auth_grants set expires_at=now()-interval '1 minute' where user_id=${user.id}`;
  await page.getByRole("button", { name: "Delete my account…" }).click();
  page.once("dialog", d => void d.accept());
  await page.getByRole("button", { name: "Permanently delete", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await page.getByRole("button", { name: "Verify with Google", exact: true }).click();
  await page.getByText("Your identity was recently verified.").waitFor();
  await page.getByRole("button", { name: "Delete my account…" }).click();
  page.once("dialog", d => void d.accept());
  await page.getByRole("button", { name: "Permanently delete", exact: true }).click();
  await page.waitForURL(`${base}/signin`);
  assert.equal(await getUser(), null);
  pass("OAuth-only deletion requires fresh provider reauth and explicit confirmation, then revokes the session");
  await page.goto(`${base}/signup`);
  await page.getByLabel("Your name").fill("Password regression");
  await page.getByLabel("Email", { exact: true }).fill("browser-password@example.invalid");
  await page.getByLabel(/^Password/).fill("correct horse battery");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.waitForURL(/\/sites\/new/);
  const pwdUser = await getUser(); userIds.add(pwdUser.id);
  googleSubject = "browser-password-linked"; googleEmail = pwdUser.email;
  await page.goto(`${base}/account`);
  await page.getByLabel("Verify your password", { exact: true }).fill("correct horse battery");
  await page.getByRole("button", { name: "Verify password", exact: true }).click();
  await page.getByText("Your identity was recently verified.").waitFor();
  await page.getByRole("button", { name: "Link Google", exact: true }).click();
  await page.getByRole("button", { name: "Verify password", exact: true }).waitFor();
  assert.equal((await getUser()).id, pwdUser.id);
  await context.request.post(`${base}/api/auth/logout`, { headers: { "x-binhi-request": "editor" } });
  await page.goto(`${base}/signin`);
  await page.getByLabel("Email", { exact: true }).fill(pwdUser.email);
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(`${base}/`);
  assert.equal((await getUser()).id, pwdUser.id);
  pass("password signup, password reauth/linking and old password login retain the same account");
  for (const width of [390, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/account`);
    await page.getByRole("heading", { name: "Your account" }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${output}/03-account-${width}.png`, fullPage: true });
  }
  await page.goto(`${base}/signin?oauth_error=%3Cscript%3E`);
  assert.equal(await page.locator("script:not([src])").count(), 0);
  assert.deepEqual(errors, []);
  pass("account controls fit phone/tablet widths; callback text is fixed and no browser errors occur");
  ok = true;
} finally {
  writeFileSync(`${output}/evidence.json`, JSON.stringify({ passed: ok, syntheticProviders: true, realProviderJourneysVerified: false, steps, appleCookieEvidence: cookieEvidence }, null, 2));
  await browser.close();
  await new Promise<void>(r => server.close(() => r()));
  for (const id of userIds) await built.sql`delete from binhi_users where id=${id}`;
  await built.close();
  rmSync(tls, { recursive: true, force: true });
}
assert.ok(ok);
console.log(`Synthetic social auth journey passed: ${steps.length} checks (not real provider enablement)`);
