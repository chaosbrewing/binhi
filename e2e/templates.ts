/**
 * Template Library journey. Disposable test database only; never remote.
 *
 * Part 1 checks discovery: search, format-first filters, unavailable-format
 * honesty, URL-persisted filters, favorites (local, per account), keyboard
 * access and phone width.
 *
 * Part 2 runs the FULL user journey for EVERY template in the shipped
 * catalog (the list comes from the catalog itself, never hard-coded):
 *   thumbnail loads -> enlarged preview matches the real content -> create
 *   from template -> correct editor -> edit -> autosave -> reopen -> publish
 *   or export -> original template unchanged -> another account sees nothing.
 * A template that fails any step fails this run, so it cannot be counted.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import { getTestDatabaseUrl } from "../tests/test-database.js";
import { runMigrations } from "../src/server/db/migrate.js";
import { CATALOG, INVENTORY, type Manifest } from "../src/core/templates/library/index.js";

if (process.env.BINHI_E2E_BASE || process.argv.includes("--remote")) throw new Error("Template tests run only against a local disposable test database.");
const database = getTestDatabaseUrl();
await runMigrations(database);
const port = 4312;
const base = `http://127.0.0.1:${port}`;
const output = "e2e/screenshots/templates";
mkdirSync(output, { recursive: true });
const gbm = (existsSync("/nix/store") ? readdirSync("/nix/store") : []).filter((n) => n.includes("mesa-libgbm")).map((n) => `/nix/store/${n}/lib`).find((d) => existsSync(`${d}/libgbm.so.1`));
if (gbm) process.env.LD_LIBRARY_PATH = `${gbm}:${process.env.LD_LIBRARY_PATH ?? ""}`;
const server = spawn(process.execPath, ["--import", "tsx", "src/server/start.ts"], {
  env: { ...process.env, BINHI_DATABASE_URL: database, BINHI_PORT: String(port), BINHI_PUBLIC_URL: base, BINHI_SESSION_SECRET: "local-disposable-test-secret-only", BINHI_SERVE_BUILT_CLIENT: "true", NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += String(d); });
server.stderr.on("data", (d) => { serverLog += String(d); });

const steps: { name: string; [key: string]: unknown }[] = [];
const record = (name: string, data = {}) => { steps.push({ name, ...data }); console.log(`PASS ${name} ${JSON.stringify(data)}`); };
const password = randomUUID() + randomUUID();
const cleanup: { ctx: BrowserContext; email: string }[] = [];
const H = { "x-binhi-request": "editor" };
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let currentPage: Page | undefined;
let succeeded = false;
const journeys: { id: string; version: number; stages: string[] }[] = [];

async function signup(ctx: BrowserContext, page: Page, label: string) {
  const email = `tpl-${label}-${randomUUID()}@example.invalid`;
  await page.goto(`${base}/signup`);
  await page.getByLabel("Your name").fill(`Template ${label}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/sites\/new/);
  cleanup.push({ ctx, email });
}
async function waitForSaved(page: Page) {
  await page.locator('.save-state[data-state="unsaved"], .save-state[data-state="saving"]').first().waitFor({ timeout: 3000 }).catch(() => undefined);
  await page.locator('.save-state[data-state="saved"]').waitFor({ timeout: 20_000 });
}
const formatChip = (page: Page, label: string) => page.getByRole("group", { name: "Format" }).getByRole("button", { name: new RegExp(`^${label}`) });
const cards = (page: Page) => page.getByRole("list", { name: "Templates", exact: true });

/** The whole journey for one website template. Returns the stages it proved. */
async function siteJourney(ctx: BrowserContext, page: Page, m: Manifest): Promise<string[]> {
  const stages: string[] = [];
  const project = `E2E ${m.name}`;
  const edited = `Edited ${m.name} headline`;

  // 1. Find it by name; its thumbnail really loads.
  await page.goto(`${base}/templates?q=${encodeURIComponent(m.name)}`);
  const card = cards(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: m.name, exact: true }) });
  await card.waitFor();
  const thumb = card.locator("img");
  await thumb.waitFor();
  await page.waitForFunction((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0, await thumb.elementHandle());
  assert.ok((await thumb.getAttribute("src"))?.endsWith(`${m.id}@${m.version}.jpg`), `${m.id}: card shows its own generated thumbnail`);

  // 2. The enlarged preview is the real rendered site, in a script-free sandbox.
  await card.getByRole("button", { name: `Preview ${m.name}` }).click();
  const dialog = page.getByRole("dialog", { name: m.name });
  await dialog.waitFor();
  const iframe = dialog.locator("iframe");
  assert.equal(await iframe.getAttribute("sandbox"), "", `${m.id}: preview frame is fully sandboxed`);
  const frame = dialog.frameLocator("iframe");
  await frame.locator("h1").first().waitFor();
  assert.ok(((await frame.locator("h1").first().textContent()) ?? "").trim().length > 3, `${m.id}: preview shows real content`);
  await dialog.getByRole("button", { name: "Mobile" }).click();
  assert.equal(await iframe.evaluate((el) => (el as HTMLIFrameElement).style.width), "390px", `${m.id}: responsive preview switches to mobile width`);
  for (const label of ["Format", "Size", "Opens in", "Output", "Made by"]) await dialog.getByText(label, { exact: true }).waitFor();
  assert.ok(await dialog.getByText("Website Builder").first().isVisible());
  stages.push("preview-verified");

  // 3. Create from template -> its own project in the right editor.
  await dialog.getByLabel("Name your project").fill(project);
  await dialog.getByRole("button", { name: "Create from template" }).click();
  await page.waitForURL(/\/sites\/site_[a-z0-9]+\/edit/);
  const siteId = /site_[a-z0-9]+/.exec(page.url())![0];
  const editorFrame = page.frameLocator("iframe[title^='Canvas preview']");
  await editorFrame.locator("h1").first().waitFor({ timeout: 30_000 });

  // 4. Edit the headline, autosave, reload, reopen: nothing lost.
  const box = await editorFrame.locator("h1").first().boundingBox();
  assert.ok(box, `${m.id}: heading has a box`);
  await page.mouse.click(box.x + 20, box.y + box.height / 2);
  await page.getByRole("heading", { name: "Heading" }).first().waitFor();
  await page.locator("#c-text").fill(edited);
  await page.locator("#c-text").blur();
  await editorFrame.locator("h1", { hasText: edited }).first().waitFor();
  await waitForSaved(page);
  await page.reload();
  await editorFrame.locator("h1", { hasText: edited }).first().waitFor({ timeout: 30_000 });
  const site = await page.evaluate(async (id) => (await (await fetch(`/api/sites/${id}`, { headers: { "x-binhi-request": "editor" } })).json()).site, siteId);
  assert.equal(site.name, project);
  assert.equal(site.templateId, m.content.type === "builtin-site" ? m.content.builder : "", `${m.id}: the site records which template it came from`);
  assert.ok(site.revision >= 1, `${m.id}: edit advanced the revision`);
  stages.push("editor-verified");

  // 5. Undo/redo work on the new project.
  await page.keyboard.press("ControlOrMeta+Z");
  await waitForSaved(page);
  await page.keyboard.press("ControlOrMeta+Shift+Z");
  await editorFrame.locator("h1", { hasText: edited }).first().waitFor();
  await waitForSaved(page);

  // 6. Publish it and read the live page anonymously.
  await page.getByRole("button", { name: /Publish/ }).first().click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByText("Live", { exact: true }).first().waitFor({ timeout: 30_000 });
  const liveLink = await page.locator(".pub-url a").first().getAttribute("href");
  assert.ok(liveLink?.includes("/s/"), `${m.id}: live link present`);
  await page.keyboard.press("Escape");
  const anon = await browser!.newContext({ viewport: { width: 1280, height: 900 } });
  const live = await anon.newPage();
  const res = await live.goto(liveLink!);
  assert.equal(res?.status(), 200);
  assert.ok(((await live.locator("h1").first().textContent()) ?? "").includes(edited), `${m.id}: live site shows the edit`);
  await live.setViewportSize({ width: 390, height: 800 });
  assert.ok(await live.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${m.id}: live site has no horizontal overflow on a phone`);
  await anon.close();
  stages.push("export-verified");

  // 7. The shared template did not change, and nobody else can see the project.
  const html = await (await ctx.request.get(`${base}/api/template-library/templates/${m.id}/preview/`)).text();
  assert.ok(!html.includes(edited), `${m.id}: editing a project never changes the template`);
  await page.screenshot({ path: `${output}/${m.id.replace(/\./g, "-")}.png` });
  return stages;
}

try {
  const deadline = Date.now() + 30_000;
  while (true) {
    if (await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false)) break;
    if (Date.now() > deadline) throw new Error(`Test server failed: ${serverLog.slice(-1500)}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  currentPage = page;
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.setDefaultTimeout(20_000);
  await signup(ctx, page, "owner");

  /* ------------------------------------------------------------ discovery */
  await page.goto(`${base}/templates`);
  await page.getByRole("heading", { name: "Start with something real" }).waitFor();
  await page.getByRole("search").waitFor();
  for (const label of ["All Templates", "Social Media", "Websites", "Print", "Documents", "Presentations", "Forms", "Video", "Custom"]) await formatChip(page, label).waitFor();
  record("template library opens with search and the nine format filters");

  // Every one of the 30 categories is selectable; only categories with templates are enabled.
  const categoryOptions = await page.getByLabel("Category", { exact: true }).locator("option").count();
  assert.equal(categoryOptions, 31, "all categories plus the 'All categories' option");

  // Blank canvases create a real design.
  await page.getByRole("button", { name: /^Square/ }).click();
  await page.waitForURL(/\/studio\/design\/prj_[a-z0-9]+/);
  await page.goto(`${base}/templates`);
  record("blank canvas options start a real design project");

  // Unavailable formats are named honestly, never advertised.
  for (const [format, phrase] of [["Presentations", /no slide editor/i], ["Forms", /Form Creator is planned/i], ["Video", /no motion or video editor/i], ["Documents", /no document or PDF editor/i]] as const) {
    await formatChip(page, format).click();
    await page.getByText(new RegExp(`${format} templates are not available yet`)).waitFor();
    await page.getByText(phrase).waitFor();
    assert.equal(await cards(page).count(), 0, `${format}: no template is listed`);
  }
  record("presentation, form, video and document formats explain why they are unavailable and list nothing");

  // Search, filters, URL persistence.
  await page.goto(`${base}/templates`);
  await page.getByLabel("Search templates").fill("portfolio");
  await page.waitForURL(/q=portfolio/);
  await cards(page).getByRole("heading", { name: "Personal portfolio", exact: true }).waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await formatChip(page, "Websites").click();
  await page.waitForURL(/format=websites/);
  const websiteCount = CATALOG.filter((m) => m.format === "websites").length;
  await page.getByText(new RegExp(`${websiteCount} of ${websiteCount} templates`)).waitFor();
  await page.getByLabel("Style", { exact: true }).selectOption("minimal");
  await page.waitForURL(/style=minimal/);
  await page.reload();
  await page.waitForFunction(() => (document.querySelector('select[aria-label="Style"]') as HTMLSelectElement | null)?.value === "minimal", undefined, { timeout: 10_000 }).catch(() => undefined);
  assert.equal(await page.getByLabel("Style", { exact: true }).inputValue(), "minimal", "filters survive a reload (they live in the URL)");
  await page.getByLabel("Search templates").fill("zzzzqqq");
  await page.getByText("No templates match.").waitFor();
  record("search, format, style filters, empty state and URL persistence work");

  // Favorites are local to this browser and account.
  await page.goto(`${base}/templates?format=websites`);
  const firstCard = cards(page).getByRole("listitem").first();
  const firstName = ((await firstCard.getByRole("heading").textContent()) ?? "").trim();
  await firstCard.getByRole("button", { name: new RegExp(`^Add ${firstName} to favorites`) }).click();
  await firstCard.getByRole("button", { name: new RegExp(`^Remove ${firstName} from favorites`) }).waitFor();
  await page.goto(`${base}/templates`);
  await page.getByRole("heading", { name: "Your favorites" }).waitFor();
  await page.getByRole("list", { name: "Favorite templates" }).getByRole("heading", { name: firstName, exact: true }).waitFor();
  record("favorites persist across reloads");

  // Keyboard: Enter opens the preview, Escape closes it and returns focus.
  await page.goto(`${base}/templates?format=websites`);
  const previewBtn = page.getByRole("button", { name: /^Preview / }).first();
  await previewBtn.focus();
  const previewLabel = await previewBtn.getAttribute("aria-label");
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), previewLabel, "focus returns to the card that opened the preview");
  record("previews open from the keyboard and return focus on close");

  // Phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/templates`);
  await page.getByRole("heading", { name: "Start with something real" }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "templates page fits a phone width");
  await page.screenshot({ path: `${output}/templates-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  record("template library fits a phone width without horizontal scrolling");

  /* ------------------------------------------- full journey, every template */
  for (const m of CATALOG) {
    let stages: string[];
    if (m.editor === "website") stages = await siteJourney(ctx, page, m);
    else throw new Error(`${m.id}: no journey is implemented for editor "${m.editor}". A template cannot be counted without one.`);
    journeys.push({ id: m.id, version: m.version, stages });
    record(`template journey passed: ${m.id}`, { stages });
  }

  // Recently used shows what was created (local to this browser).
  await page.goto(`${base}/templates`);
  await page.getByRole("heading", { name: "Recently used" }).waitFor();
  record("recently used templates are listed");

  /* --------------------------------------------------------- isolation */
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page2 = await ctx2.newPage();
  await signup(ctx2, page2, "other");
  await page2.goto(`${base}/templates`);
  await page2.getByRole("heading", { name: "Start blank" }).waitFor();
  assert.equal(await page2.getByRole("heading", { name: "Your favorites" }).count(), 0, "another account does not inherit favorites");
  assert.equal(await page2.getByRole("heading", { name: "Recently used" }).count(), 0, "another account does not inherit recents");
  const sites = await ctx.request.get(`${base}/api/sites`).then((r) => r.json());
  for (const s of sites.sites) assert.equal((await ctx2.request.get(`${base}/api/sites/${s.id}`)).status(), 404, "another account cannot open a project made from a template");
  record("another account cannot see the owner's projects, favorites or recents");

  // Journey coverage must equal the catalog and the inventory claims.
  assert.deepEqual(journeys.map((j) => `${j.id}@${j.version}`).sort(), CATALOG.map((m) => `${m.id}@${m.version}`).sort(), "every catalog template ran the full journey");
  for (const e of INVENTORY.filter((x) => x.stage === "export-verified" || x.stage === "approved")) {
    assert.ok(journeys.some((j) => j.id === e.id && j.stages.includes("export-verified")), `${e.id}: inventory claims export-verified but the journey did not prove it`);
  }
  assert.deepEqual(pageErrors, [], "no uncaught browser errors");
  succeeded = true;
} finally {
  if (!succeeded) {
    console.error(serverLog.slice(-1500));
    await currentPage?.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  }
  let cleanupFailed = false;
  for (const { ctx, email } of cleanup) {
    try {
      const login = await ctx.request.post(`${base}/api/auth/login`, { headers: H, data: { email, password } });
      assert.equal(login.status(), 200);
      const deleted = await ctx.request.delete(`${base}/api/auth/account`, { headers: H, data: { password } });
      assert.equal(deleted.status(), 200);
    } catch { cleanupFailed = true; console.error("A disposable template test account could not be cleaned up."); }
  }
  if (cleanupFailed) succeeded = false;
  writeFileSync(`${output}/evidence.json`, JSON.stringify({ passed: succeeded, journeys, steps }, null, 2));
  await browser?.close();
  server.kill("SIGTERM");
}
assert.ok(succeeded, "Template journey or cleanup failed.");
console.log(`Template journey passed: ${steps.length} checks, ${journeys.length} templates`);
