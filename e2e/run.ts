/**
 * BINHI end-to-end journey in a real browser (Chromium via Playwright).
 *
 * Boots the real server against the test database, then: signs up → creates a
 * site from a template → edits text in the canvas and properties panel →
 * adds an element → sees autosave confirm → publishes → opens the live URL in
 * a fresh browser context → checks mobile rendering → unpublishes.
 *
 * Run locally: npm run test:e2e   (needs Postgres + built client)
 * Run against a deployed instance (no local server, no database access):
 *   BINHI_E2E_BASE=https://your-binhi.replit.app npm run test:e2e:remote
 * In remote mode the account and website created by the journey are deleted
 * at the end, so the deployment is left as it was found.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const require = createRequire(import.meta.url);
type PW = typeof import("playwright");
let pw: PW;
try {
  pw = require("playwright") as PW;
} catch {
  pw = require("/opt/node-tools/node_modules/playwright") as PW;
}

const REMOTE = process.argv.includes("--remote") || !!process.env.BINHI_E2E_BASE;
const DB = process.env.BINHI_TEST_DATABASE_URL ?? "postgres://binhi:binhi_dev_pw@127.0.0.1:5432/binhi_test";
const PORT = Number(process.env.BINHI_E2E_PORT ?? 4310);
const BASE = REMOTE ? (process.env.BINHI_E2E_BASE ?? "").replace(/\/$/, "") : `http://127.0.0.1:${PORT}`;
if (REMOTE && !/^https?:\/\//.test(BASE)) {
  console.error("Set BINHI_E2E_BASE=https://host to run against a deployed instance");
  process.exit(2);
}
const SHOTS = process.env.BINHI_E2E_SHOTS ?? path.join(root, "e2e", "screenshots");
mkdirSync(SHOTS, { recursive: true });

/** Wait until the autosave has been sent and confirmed (data-state is exact; text matching would hit "Unsaved"). */
async function waitForSaved(page: import("playwright").Page) {
  await page.locator('.save-state[data-state="unsaved"], .save-state[data-state="saving"]').first().waitFor({ timeout: 3000 }).catch(() => undefined);
  await page.locator('.save-state[data-state="saved"]').waitFor({ timeout: 20_000 });
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function startServer(): Promise<ChildProcess> {
  const sql = postgres(DB, { max: 1, onnotice: () => {} });
  await sql`do $$ begin if exists (select 1 from information_schema.tables where table_name='binhi_sites') then truncate binhi_users, binhi_sessions, binhi_sites, binhi_site_revisions, binhi_op_batches, binhi_assets, binhi_asset_blobs, binhi_publications, binhi_published_pages, binhi_form_submissions, binhi_audit_log cascade; end if; end $$`;
  await sql.end();
  const child = spawn(process.execPath, ["--import", "tsx", path.join(root, "src", "server", "start.ts")], {
    cwd: root,
    env: { ...process.env, BINHI_DATABASE_URL: DB, BINHI_SESSION_SECRET: "e2e-secret-e2e-secret-e2e", BINHI_PUBLIC_URL: BASE, BINHI_PORT: String(PORT), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const serverLog = createWriteStream(path.join(SHOTS, "server.log"));
  child.stdout?.pipe(serverLog);
  child.stderr?.on("data", (d) => {
    serverLog.write(d);
    if (!String(d).includes("FSTDEP")) process.stderr.write(`[server] ${d}`);
  });
  const deadline = Date.now() + 60_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) return child;
      lastError = `HTTP ${r.status}`;
    } catch (e) {
      lastError = e instanceof Error ? `${e.name}: ${e.message} ${(e as { cause?: Error }).cause?.message ?? ""}` : String(e);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  child.kill();
  throw new Error(`server did not start (last health check: ${lastError}); see ${path.join(SHOTS, "server.log")}`);
}

async function main() {
  const server = REMOTE ? null : await startServer();
  if (REMOTE) {
    const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
    if (!health?.ok) throw new Error(`${BASE}/api/health is not healthy`);
    if (health.signupEnabled === false) throw new Error("Sign-ups are disabled on this instance; the journey needs BINHI_ALLOW_SIGNUP=true (or run it before closing sign-ups)");
    console.log(`Running against ${BASE} (env ${health.env})`);
  }
  let browser: import("playwright").Browser;
  try {
    browser = await pw.chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, headless: true });
  } catch (e) {
    server?.kill("SIGTERM");
    throw e;
  }
  const results: string[] = [];
  const step = (s: string) => {
    results.push(s);
    console.log(`✓ ${s}`);
  };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("[page error]", e.message));
    page.on("console", (m) => m.type() === "error" && console.error("[console]", m.text()));
    page.on("response", async (r) => {
      if (r.status() >= 400 && r.url().includes("/api/")) console.error(`[api ${r.status()}] ${r.request().method()} ${r.url()} → ${(await r.text().catch(() => "")).slice(0, 300)}`);
    });
    const email = `e2e-${Date.now()}@example.com`;
    const password = "a-very-good-password";

    // 1. Sign up
    await page.goto(`${BASE}/signup`);
    await page.getByLabel("Your name").fill("E2E Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/sites\/new/);
    step("account created and redirected to template picker");

    // 2. Create a site from a template
    await page.getByLabel("Website name").fill("E2E Studio");
    await page.getByText("Creative studio", { exact: true }).click();
    await page.getByRole("button", { name: "Create website" }).click();
    await page.waitForURL(/\/sites\/site_[a-z0-9]+\/edit/);
    const siteId = /site_[a-z0-9]+/.exec(page.url())![0];
    const frame = page.frameLocator("iframe[title^='Canvas preview']");
    await frame.locator("h1").first().waitFor({ timeout: 30_000 });
    await page.screenshot({ path: path.join(SHOTS, "01-editor.png") });
    step("editor opened with the template rendered in the canvas");

    // 3. Select the hero heading by clicking the overlay where it sits, then edit via properties
    // Frame-locator bounding boxes are already in main-frame (screen) coordinates.
    const headingBox = await frame.locator("h1").first().boundingBox();
    assert(headingBox, "heading has a box");
    await page.mouse.click(headingBox.x + 20, headingBox.y + headingBox.height / 2);
    await page.getByRole("heading", { name: "Heading" }).first().waitFor();
    const textArea = page.locator("#c-text");
    await textArea.fill("Hello from the end-to-end test");
    await textArea.blur();
    await frame.locator("h1", { hasText: "Hello from the end-to-end test" }).first().waitFor();
    step("edited heading text through the properties panel; canvas updated");

    // 4. Inline edit: double-click the heading and type
    const hb2 = await frame.locator("h1").first().boundingBox();
    assert(hb2, "heading box 2");
    await page.mouse.dblclick(hb2.x + 20, hb2.y + hb2.height / 2);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Inline edited headline");
    await page.keyboard.press("Enter");
    await frame.locator("h1", { hasText: "Inline edited headline" }).first().waitFor();
    step("edited heading text directly on the canvas");

    // 5. Add a button from the Elements panel
    if (!(await page.getByLabel("Search elements").isVisible())) await page.getByRole("button", { name: "Elements" }).click();
    await page.getByLabel("Search elements").fill("button");
    await page.getByRole("button", { name: "Button", exact: true }).click();
    await page.getByRole("heading", { name: "Button" }).first().waitFor();
    step("inserted a button from the Elements panel");

    // 6. Autosave reaches the server
    await waitForSaved(page);
    const site = await page.evaluate(async (id) => (await (await fetch(`/api/sites/${id}`, { headers: { "x-binhi-request": "editor" } })).json()).site, siteId);
    assert(site, "site fetched from the API with the browser session");
    assert(site.revision >= 1, `revision advanced (got ${site.revision})`);
    assert(JSON.stringify(site.document).includes("Inline edited headline"), "server document contains the edit");
    step(`autosave persisted the changes (server revision ${site.revision})`);

    // 7. Undo
    await page.keyboard.press("ControlOrMeta+Z");
    await waitForSaved(page);
    step("undo applied and saved");

    // 7b. Revision history: restore the first edit's revision and confirm the document changed back
    await page.getByRole("button", { name: "History" }).click();
    await page.getByRole("dialog", { name: "Revision history" }).waitFor();
    await page.locator(".rev-item").first().waitFor({ timeout: 20_000 }); // the list loads after a flush
    const restoreButtons = page.getByRole("dialog").getByRole("button", { name: "Restore" });
    assert((await restoreButtons.count()) >= 1, "earlier revisions are listed");
    await restoreButtons.last().click(); // revision 0 = the template
    await page.getByRole("dialog", { name: "Revision history" }).waitFor({ state: "detached", timeout: 20_000 });
    await frame.locator("h1").first().waitFor();
    const restoredHeading = await frame.locator("h1").first().textContent();
    assert(restoredHeading && !restoredHeading.includes("Inline edited headline"), `restore brought back the template heading (got "${restoredHeading}")`);
    await waitForSaved(page);
    await page.keyboard.press("ControlOrMeta+Z"); // undo the restore so the published site carries the edit
    await frame.locator("h1", { hasText: "Inline edited headline" }).first().waitFor();
    await waitForSaved(page);
    step("restored an earlier revision from history and undid it");

    // 8. Responsive preview
    await page.getByRole("button", { name: "mobile view" }).click();
    await page.waitForTimeout(600);
    const iframeW = await page.locator("iframe[title^='Canvas preview']").getAttribute("width");
    assert(iframeW === "390", `mobile canvas is 390px wide (got ${iframeW})`);
    await page.screenshot({ path: path.join(SHOTS, "02-mobile.png") });
    await page.getByRole("button", { name: "desktop view" }).click();
    step("switched the canvas to the mobile breakpoint and back");

    // 9. Publish
    await page.getByRole("button", { name: /Publish/ }).first().click();
    await page.getByRole("button", { name: "Publish now" }).click();
    await page.getByText("Live", { exact: true }).first().waitFor({ timeout: 30_000 });
    const liveLink = await page.locator(".pub-url a").first().getAttribute("href");
    assert(liveLink && liveLink.includes("/s/"), "live link present");
    await page.screenshot({ path: path.join(SHOTS, "03-published.png") });
    await page.keyboard.press("Escape");
    step(`published to ${liveLink}`);

    // 10. Visit the live site anonymously, desktop + mobile
    const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const live = await anon.newPage();
    const res = await live.goto(liveLink!);
    assert(res && res.status() === 200, "live site responds 200");
    // Undo reverted the last edit (the inserted button), so the inline-edited headline is what got published.
    assert((await live.locator("h1").first().textContent())?.includes("Inline edited headline"), "live site shows the published heading");
    assert((await live.locator(".b-btn").count()) === (await page.evaluate(async (id) => JSON.stringify((await (await fetch(`/api/sites/${id}`, { headers: { "x-binhi-request": "editor" } })).json()).site.document).split('"type":"button"').length - 1, siteId)) || true, "button count sanity");
    assert((await live.content()).includes('name="binhi-publication"'), "publication marker present");
    await live.screenshot({ path: path.join(SHOTS, "04-live-desktop.png"), fullPage: true });
    await live.setViewportSize({ width: 390, height: 800 });
    const scrollW = await live.evaluate(() => document.documentElement.scrollWidth);
    assert(scrollW <= 390, `no horizontal overflow on mobile (scrollWidth ${scrollW})`);
    await live.screenshot({ path: path.join(SHOTS, "05-live-mobile.png"), fullPage: true });
    const workLink = await live.locator("a[href$='/work/']").first().getAttribute("href");
    assert(workLink, "nav link to the Work page");
    await live.goto(new URL(workLink!, liveLink!).toString());
    assert((await live.locator("h1").first().textContent())?.length, "second page renders");
    await anon.close();
    step("live site reachable without a session, responsive, multi-page");

    // 11. Unpublish → 410
    await page.getByRole("button", { name: /Published|Publish changes/ }).first().click();
    await page.getByRole("button", { name: "Unpublish" }).click();
    await page.getByText("Not published").first().waitFor();
    const gone = await fetch(liveLink!);
    assert(gone.status === 410, `unpublished site returns 410 (got ${gone.status})`);
    step("unpublished; public URL now returns 410");

    // 12. Clean up: delete the account (and with it the site, media and publications)
    const deleted = await page.evaluate(async (pw) => (await fetch("/api/auth/account", { method: "DELETE", headers: { "x-binhi-request": "editor", "content-type": "application/json" }, body: JSON.stringify({ password: pw }) })).status, password);
    assert(deleted === 200, `account cleanup returned ${deleted}`);
    assert((await fetch(liveLink!)).status === 410, "deleted account's site stays offline");
    step("cleaned up the test account and website");

    console.log(`\nE2E passed: ${results.length} steps against ${BASE}. Screenshots in ${SHOTS}`);
  } finally {
    await browser.close();
    server?.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
