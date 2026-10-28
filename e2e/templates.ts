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
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import { getTestDatabaseUrl } from "../tests/test-database.js";
import { runMigrations } from "../src/server/db/migrate.js";
import { CATALOG, DESIGN_CONTENT, LOCK, applyApprovals, parseDesignContent, type ApprovalRecord, type Manifest } from "../src/core/templates/library/index.js";

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
/** --quick skips the per-template journeys (and so never writes the inventory); for iterating on the page itself. */
const quick = process.argv.includes("--quick");

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
const axeSource = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
/** Run axe-core in the page. Serious and critical findings fail the journey; the rest are reported. */
async function axeCheck(page: Page, label: string, scope?: string) {
  await page.addScriptTag({ path: axeSource });
  const violations = await page.evaluate(async (selector) => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: { id: string; impact: string | null; help: string; nodes: { target: unknown[] }[] }[] }> } }).axe;
    const r = await axe.run(selector ? document.querySelector(selector) : document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  }, scope ?? null);
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  assert.deepEqual(blocking, [], `${label}: serious or critical accessibility violations`);
  return { label, minorOrModerate: violations.filter((v) => !blocking.includes(v)).map((v) => `${v.id} (${v.impact}, ${v.count})`) };
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

/** Decode a downloaded export in the page and report its real size and whether it is more than a flat fill. */
async function inspectExport(page: Page) {
  const link = page.getByRole("link", { name: /^Download (PNG|JPG|WEBP)$/ });
  await link.waitFor();
  return page.evaluate(async () => {
    const anchor = document.querySelector<HTMLAnchorElement>(".photo-actions a[download]")!;
    const blob = await (await fetch(anchor.href)).blob();
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const colors = new Set<string>();
    for (let gy = 1; gy < 24; gy++) for (let gx = 1; gx < 24; gx++) {
      const d = ctx.getImageData(Math.floor((image.width * gx) / 24), Math.floor((image.height * gy) / 24), 1, 1).data;
      colors.add(`${d[0]! >> 4},${d[1]! >> 4},${d[2]! >> 4}`);
    }
    const out = { mime: blob.type, size: blob.size, width: image.width, height: image.height, distinctColors: colors.size };
    image.close();
    return out;
  });
}

/** The whole journey for one Design Studio template. Returns the stages it proved. */
async function designJourney(ctx: BrowserContext, ctx2: BrowserContext, page: Page, m: Manifest): Promise<string[]> {
  if (m.size.kind !== "fixed" || m.content.type !== "builtin-design") throw new Error(`${m.id}: not a fixed-size design template`);
  const stages: string[] = [];
  const project = `E2E ${m.name}`;
  const template = parseDesignContent(DESIGN_CONTENT[m.content.key]).document;
  const edited = `Edited ${m.name}`;

  // 1. Find it by name; its generated thumbnail really loads.
  await page.goto(`${base}/templates?q=${encodeURIComponent(m.name)}`);
  const card = cards(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: m.name, exact: true }) });
  await card.waitFor();
  const thumb = card.locator("img");
  await page.waitForFunction((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0, await thumb.elementHandle());
  assert.ok((await thumb.getAttribute("src"))?.endsWith(`${m.id}@${m.version}.jpg`), `${m.id}: card shows its own generated thumbnail`);

  // 2. The enlarged preview is drawn from the real document by the real renderer, at full size.
  await card.getByRole("button", { name: `Preview ${m.name}` }).click();
  const dialog = page.getByRole("dialog", { name: m.name });
  const big = dialog.locator("img.tpl-preview-img");
  await big.waitFor({ timeout: 20_000 });
  await page.waitForFunction((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0, await big.elementHandle());
  const bigInfo = await big.evaluate((el) => {
    const img = el as HTMLImageElement;
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
    const colors = new Set<string>();
    for (let gy = 1; gy < 20; gy++) for (let gx = 1; gx < 20; gx++) { const d = g.getImageData(Math.floor((c.width * gx) / 20), Math.floor((c.height * gy) / 20), 1, 1).data; colors.add(`${d[0]! >> 4},${d[1]! >> 4},${d[2]! >> 4}`); }
    return { w: img.naturalWidth, h: img.naturalHeight, colors: colors.size };
  });
  assert.equal(bigInfo.w, m.size.width, `${m.id}: preview is the document's real width`);
  assert.equal(bigInfo.h, m.size.height, `${m.id}: preview is the document's real height`);
  assert.ok(bigInfo.colors >= 2, `${m.id}: preview is not a blank fill`);
  for (const label of ["Format", "Size", "Opens in", "Output", "Made by"]) await dialog.getByText(label, { exact: true }).waitFor();
  assert.ok(await dialog.getByText(`${m.size.width} × ${m.size.height} px`).first().isVisible(), `${m.id}: dimensions are shown`);
  stages.push("preview-verified");

  // 3. Create from template: its own project, in the Design Studio, with the template's layers and revision 0.
  await dialog.getByLabel("Name your project").fill(project);
  await dialog.getByRole("button", { name: "Create from template" }).click();
  await page.waitForURL(/\/studio\/design\/prj_[a-z0-9]+/);
  const projectId = /prj_[a-z0-9]+/.exec(page.url())![0];
  await page.locator(".design-stage").waitFor();
  await page.locator(".layer-list .layer-row").first().waitFor();
  assert.equal(await page.locator(".layer-list .layer-row").count(), template.layers.length, `${m.id}: every template layer is editable in the layer list`);
  const created = await page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}`, { headers: { "x-binhi-request": "editor" } })).json()).project, projectId);
  assert.equal(created.name, project);
  assert.equal(created.kind, "design");
  assert.equal(created.revision, 0, `${m.id}: a new project starts at revision 0`);
  assert.deepEqual(created.document, template, `${m.id}: the project starts as an exact copy of the template`);

  // 4. Edit a text layer, autosave, reload: nothing lost. Undo and redo work.
  const firstText = template.layers.find((l) => l.type === "text")!;
  await page.locator(".layer-row", { has: page.locator(".layer-type", { hasText: "T" }) }).first().locator(".layer-name").click();
  await page.getByLabel("Content").fill(edited);
  await page.locator('.design-save[data-state="saved"]').waitFor();
  const read = () => page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}`, { headers: { "x-binhi-request": "editor" } })).json()).project, projectId);
  const count = (doc: { layers: { text?: string }[] }) => doc.layers.filter((l) => l.text === edited).length;
  assert.equal(count((await read()).document), 1, `${m.id}: the edit was autosaved`);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.locator('.design-save[data-state="saved"]').waitFor();
  assert.equal(count((await read()).document), 0, `${m.id}: undo removed the edit and saved`);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.locator('.design-save[data-state="saved"]').waitFor();
  await page.reload();
  await page.locator(".design-stage").waitFor();
  await page.locator(".layer-list .layer-row").first().waitFor();
  const afterEdit = await read();
  assert.ok(afterEdit.revision >= 1, `${m.id}: the edit advanced the revision`);
  assert.equal(count(afterEdit.document), 1, `${m.id}: the edited text survived a reload`);
  assert.equal(afterEdit.document.layers.length, template.layers.length, `${m.id}: no layer was lost`);
  assert.ok(firstText.text.length > 0);
  stages.push("editor-verified");

  // 5. Export a PNG at the template's native size.
  await page.getByLabel("Export format", { exact: true }).selectOption("image/png");
  await page.getByRole("button", { name: "Export design", exact: true }).click();
  const png = await inspectExport(page);
  assert.equal(png.mime, "image/png");
  assert.equal(png.width, m.size.width, `${m.id}: exported width`);
  assert.equal(png.height, m.size.height, `${m.id}: exported height`);
  assert.ok(png.distinctColors >= 2, `${m.id}: the export is more than a flat fill`);
  stages.push("export-verified");

  // 6. The shared template did not change; another account cannot open the project.
  const doc = await (await ctx.request.get(`${base}/api/template-library/templates/${m.id}/document`)).json();
  assert.deepEqual(doc.document, template, `${m.id}: editing a project never changes the template`);
  assert.equal((await ctx2.request.get(`${base}/api/projects/${projectId}`)).status(), 404, `${m.id}: another account cannot open the project`);
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
  const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page2 = await ctx2.newPage();
  await signup(ctx2, page2, "other");

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
  await page.getByLabel("Colour", { exact: true }).selectOption("neutral");
  await page.waitForURL(/color=neutral/);
  await page.getByLabel("Opens in", { exact: true }).selectOption("design");
  await page.waitForURL(/editor=design/);
  await page.getByLabel("Opens in", { exact: true }).selectOption("");
  await page.getByLabel("Colour", { exact: true }).selectOption("");
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

  /* ----------------------------------------------------------- brand kits */
  const kitDoc = { schemaVersion: 1, colors: [{ name: "Primary", value: "#7c3aed" }, { name: "Accent", value: "#f97316" }, { name: "Ink", value: "#111827" }, { name: "Paper", value: "#fafaf9" }], fonts: { heading: "Lora", body: "DM Sans" }, logoAssetId: null, tagline: "" };
  const kitRes = await ctx.request.post(`${base}/api/brand-kits`, { headers: H, data: { name: "Violet kit", document: kitDoc } });
  assert.equal(kitRes.status(), 200);
  const kitId = (await kitRes.json()).kit.id as string;
  const pixel = (loc: ReturnType<Page["locator"]>) => loc.evaluate((el) => {
    const img = el as HTMLImageElement;
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d")!; g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(4, 4, 1, 1).data).slice(0, 3);
  });

  // Design: preview with and without the kit (real pixels), then create with the kit.
  await page.goto(`${base}/templates?q=${encodeURIComponent("Quote card")}`);
  await cards(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Quote card", exact: true }) }).getByRole("button", { name: "Preview Quote card" }).click();
  let dlg = page.getByRole("dialog", { name: "Quote card" });
  const bigImg = dlg.locator("img.tpl-preview-img");
  await bigImg.waitFor({ timeout: 20_000 });
  await page.waitForFunction((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0, await bigImg.elementHandle());
  assert.deepEqual(await pixel(bigImg), [0xf3, 0xef, 0xe6], "original preview shows the template's own paper colour");
  await dlg.getByLabel("Brand kit", { exact: true }).selectOption(kitId);
  await dlg.getByText(/colour and font changes/).waitFor();
  await page.waitForFunction(() => document.querySelector("img.tpl-preview-img")?.getAttribute("alt")?.includes("with Violet kit"));
  // The label now describes the image that is actually shown, so once it says "with Violet kit" the pixels must match.
  await page.waitForFunction((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0, await bigImg.elementHandle());
  assert.deepEqual(await pixel(bigImg), [0xfa, 0xfa, 0xf9], "the preview shows the kit's paper colour before anything is saved");
  await dlg.getByRole("button", { name: "Original", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("img.tpl-preview-img")?.getAttribute("alt")?.includes("with Violet kit"));
  await dlg.getByRole("button", { name: /^With Violet kit/ }).click();
  await dlg.getByLabel("Name your project").fill("Branded quote");
  await dlg.getByRole("button", { name: "Create with brand kit" }).click();
  await page.waitForURL(/\/studio\/design\/prj_[a-z0-9]+/);
  const brandedId = /prj_[a-z0-9]+/.exec(page.url())![0];
  const branded = await ctx.request.get(`${base}/api/projects/${brandedId}`).then((r) => r.json());
  assert.equal(branded.project.document.background, "#fafaf9", "kit paper colour applied");
  const byName = (n: string) => branded.project.document.layers.find((l: { name: string }) => l.name === n);
  assert.equal(byName("Accent rule").fill, "#f97316", "kit accent applied to the bound shape");
  assert.equal(byName("Quote").font, "Lora", "kit heading font applied to the bound text");
  assert.equal(byName("Divider").opacity, 0.18, "unbound properties are untouched");
  const originalDoc = await (await ctx.request.get(`${base}/api/template-library/templates/tpl.design.quote-card/document`)).json();
  assert.equal(originalDoc.document.background, "#f3efe6", "the shared template still has its own colours");
  record("design: kit previewed against the original (real pixels), then applied only to bound layers; template unchanged");

  // Website: the preview frame uses the kit, creation lands the kit as revision 1 and revision 0 stays the template.
  await page.goto(`${base}/templates?q=${encodeURIComponent("Personal portfolio")}`);
  await cards(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Personal portfolio", exact: true }) }).getByRole("button", { name: "Preview Personal portfolio" }).click();
  dlg = page.getByRole("dialog", { name: "Personal portfolio" });
  await dlg.locator("iframe").waitFor();
  await dlg.getByLabel("Brand kit", { exact: true }).selectOption(kitId);
  await page.waitForFunction(() => document.querySelector(".tpl-frame iframe")?.getAttribute("src")?.includes("kit="));
  await dlg.getByLabel("Name your project").fill("Branded portfolio");
  await dlg.getByRole("button", { name: "Create with brand kit" }).click();
  await page.waitForURL(/\/sites\/site_[a-z0-9]+\/edit/);
  const brandedSite = /site_[a-z0-9]+/.exec(page.url())![0];
  const siteNow = await ctx.request.get(`${base}/api/sites/${brandedSite}`).then((r) => r.json());
  assert.equal(siteNow.site.revision, 1);
  assert.equal(siteNow.site.document.theme.colors.primary, "#7c3aed");
  const rev0 = await ctx.request.get(`${base}/api/sites/${brandedSite}/revisions/0`).then((r) => r.json());
  assert.equal(rev0.document.theme.colors.primary, "#c2410c", "revision 0 is still the untouched template");
  const restored = await ctx.request.post(`${base}/api/sites/${brandedSite}/revisions/0/restore`, { headers: H, data: { baseRevision: 1 } });
  assert.equal(restored.status(), 200);
  assert.equal((await restored.json()).document.theme.colors.primary, "#c2410c", "restoring the first revision brings the template back");
  record("website: kit applied as revision 1; the template revision can be restored");

  // Personal templates: save, use, rename, duplicate, delete, thumbnails.
  await page.goto(`${base}/studio/design/${brandedId}`);
  await page.locator(".design-stage").waitFor();
  await page.getByLabel("Template name").fill("My saved layout");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Template \"My saved layout\" saved").waitFor();
  await page.goto(`${base}/templates`);
  const mine = page.getByRole("list", { name: "Your design templates" });
  const mineCard = mine.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "My saved layout", exact: true }) });
  await mineCard.waitFor();
  await mineCard.scrollIntoViewIfNeeded();
  await mineCard.locator("img").waitFor({ timeout: 20_000 });
  await mineCard.getByRole("button", { name: "Rename template My saved layout" }).click();
  await page.getByLabel("Template name", { exact: true }).fill("Renamed layout");
  await page.getByRole("button", { name: "Save name" }).click();
  await mine.getByRole("heading", { name: "Renamed layout", exact: true }).waitFor();
  await mine.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Renamed layout", exact: true }) }).getByRole("button", { name: "Duplicate template Renamed layout" }).click();
  await mine.getByRole("heading", { name: "Renamed layout copy", exact: true }).waitFor();
  await mine.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Renamed layout copy", exact: true }) }).getByRole("button", { name: "Delete template Renamed layout copy" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete template" }).click();
  await mine.getByRole("heading", { name: "Renamed layout copy", exact: true }).waitFor({ state: "detached" });
  await mine.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Renamed layout", exact: true }) }).getByRole("button", { name: "Use template" }).click();
  await page.waitForURL(/\/studio\/design\/prj_[a-z0-9]+/);
  const fromMine = /prj_[a-z0-9]+/.exec(page.url())![0];
  assert.notEqual(fromMine, brandedId);
  const myTemplates = await ctx.request.get(`${base}/api/projects?kind=design-template`).then((r) => r.json());
  assert.equal(myTemplates.projects.length, 1, "the template itself is unchanged and still the only one");
  assert.equal((await ctx2.request.get(`${base}/api/projects/${myTemplates.projects[0].id}`)).status(), 404, "another account cannot see it");
  record("personal templates: save, preview thumbnail, rename, duplicate, delete, use; private to the owner");

  /* ------------------------------------------------------- accessibility (axe) */
  const a11y: { label: string; minorOrModerate: string[] }[] = [];
  await page.goto(`${base}/templates`);
  await page.getByRole("heading", { name: "All templates" }).waitFor();
  await cards(page).getByRole("listitem").first().waitFor();
  a11y.push(await axeCheck(page, "templates page (browse)"));
  await page.goto(`${base}/templates?q=poster&format=print`);
  await cards(page).getByRole("listitem").first().waitFor();
  a11y.push(await axeCheck(page, "templates page (search results)"));
  await page.goto(`${base}/templates?format=presentations`);
  await page.getByText("Presentations templates are not available yet").waitFor();
  a11y.push(await axeCheck(page, "templates page (unavailable format)"));
  await page.goto(`${base}/templates?format=websites`);
  await cards(page).getByRole("listitem").first().waitFor();
  await page.getByRole("button", { name: /^Preview / }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.locator(".tpl-frame iframe").waitFor();
  a11y.push(await axeCheck(page, "preview dialog (website)", "[role=dialog]"));
  await page.keyboard.press("Escape");
  await page.goto(`${base}/templates?format=print`);
  await cards(page).getByRole("listitem").first().waitFor();
  await page.getByRole("button", { name: /^Preview / }).first().click();
  await page.locator("img.tpl-preview-img").waitFor({ timeout: 20_000 });
  a11y.push(await axeCheck(page, "preview dialog (design)", "[role=dialog]"));
  await page.keyboard.press("Escape");
  record("templates page and preview dialogs have no serious or critical accessibility violations (axe-core)", { reviewed: a11y });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/templates`);
  await page.getByRole("heading", { name: "All templates" }).waitFor();
  a11y.push(await axeCheck(page, "templates page (phone width)"));
  await page.setViewportSize({ width: 1366, height: 900 });

  /* ------------------------------------------- full journey, every template */
  // Limits this journey must respect, because the app enforces them: 30 template uses and 20 publishes per
  // account per 10 minutes, and 20 sign-ups/logins per IP per 10 minutes. The first group of templates runs on the
  // main account (recents/favorites are checked on it); each further group of 12 gets one fresh account.
  const GROUP = 12;
  let jctx = ctx;
  let jpage = page;
  let jgroup = 0;
  const dropGroupAccount = async () => {
    if (jgroup === 0) return;
    const entry = cleanup.pop()!;
    const del = await entry.ctx.request.delete(`${base}/api/auth/account`, { headers: H, data: { password } });
    assert.equal(del.status(), 200, "journey account removed");
    await jctx.close();
    jctx = ctx; jpage = page; currentPage = page;
  };
  for (const [i, m] of quick ? [] : CATALOG.entries()) {
    const group = Math.floor(i / GROUP);
    if (group !== jgroup) {
      await dropGroupAccount();
      jgroup = group;
      jctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      jpage = await jctx.newPage();
      jpage.setDefaultTimeout(20_000);
      currentPage = jpage;
      await signup(jctx, jpage, `g${group}`);
    }
    let stages: string[];
    if (m.editor === "website") stages = await siteJourney(jctx, jpage, m);
    else if (m.editor === "design") stages = await designJourney(jctx, ctx2, jpage, m);
    else throw new Error(`${m.id}: no journey is implemented for editor "${m.editor}". A template cannot be counted without one.`);
    journeys.push({ id: m.id, version: m.version, stages });
    record(`template journey passed: ${m.id}`, { stages });
  }
  await dropGroupAccount();

  // Recently used shows what was created (local to this browser).
  if (!quick) {
    await page.goto(`${base}/templates`);
    await page.getByRole("heading", { name: "Recently used" }).waitFor();
    record("recently used templates are listed");
  }

  /* --------------------------------------------------------- isolation */
  await page2.goto(`${base}/templates`);
  await page2.getByRole("heading", { name: "Start blank" }).waitFor();
  assert.equal(await page2.getByRole("heading", { name: "Your favorites" }).count(), 0, "another account does not inherit favorites");
  assert.equal(await page2.getByRole("heading", { name: "Recently used" }).count(), 0, "another account does not inherit recents");
  const sites = await ctx.request.get(`${base}/api/sites`).then((r) => r.json());
  for (const s of sites.sites) assert.equal((await ctx2.request.get(`${base}/api/sites/${s.id}`)).status(), 404, "another account cannot open a project made from a template");
  record("another account cannot see the owner's projects, favorites or recents");

  // Journey coverage must equal the catalog; the inventory is written from what was actually proven.
  if (!quick) assert.deepEqual(journeys.map((j) => `${j.id}@${j.version}`).sort(), CATALOG.map((m) => `${m.id}@${m.version}`).sort(), "every catalog template ran the full journey");
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
  if (succeeded && !quick) {
    // The machine-verifiable inventory: one entry per template, bound to the content fingerprint it was proven against.
    const stageNames = ["implemented", "preview-verified", "editor-verified", "export-verified"] as const;
    const approvals = existsSync("docs/TEMPLATE_APPROVALS.json") ? (JSON.parse(readFileSync("docs/TEMPLATE_APPROVALS.json", "utf8")) as ApprovalRecord) : { approvedBy: "", approvedAt: "", basis: "", entries: {} };
    const entries = applyApprovals(journeys.map((j) => {
      const proven = ["implemented", ...j.stages];
      const stage = [...stageNames].reverse().find((n) => proven.includes(n)) ?? "planned";
      return { id: j.id, version: j.version, contentSha256: (LOCK as Record<string, { contentSha256: string }>)[`${j.id}@${j.version}`]?.contentSha256 ?? null, stage, evidence: Object.fromEntries(proven.map((n) => [n, n === "implemented" ? "tests/unit/template-catalog.test.ts#documents-are-valid" : `e2e/templates.ts#${n}`])) };
    }), approvals);
    let commit = "unknown";
    try { commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { /* not a git checkout */ }
    const counts = Object.fromEntries(["planned", ...stageNames, "approved"].map((n) => [n, entries.filter((e) => e.stage === n).length]));
    writeFileSync("docs/TEMPLATE_INVENTORY.json", `${JSON.stringify({ generatedBy: "e2e/templates.ts", note: "Written only by a passing run of the template library journey. A stage appears here only after the browser journey proved it for that template and content fingerprint. 'approved' appears only where the founder's recorded approval (docs/TEMPLATE_APPROVALS.json) matches the content fingerprint proven here; tooling never decides it.", generatedAgainstCommit: commit, counts, entries }, null, 2)}\n`);
  }
  await browser?.close();
  server.kill("SIGTERM");
}
assert.ok(succeeded, "Template journey or cleanup failed.");
console.log(`Template journey passed: ${steps.length} checks, ${journeys.length} templates`);
