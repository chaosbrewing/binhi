/**
 * BINHI Universal Icon Library journey (disposable test database only; never remote).
 *
 * Website Builder: find an icon (search by intent) → insert → customise → autosave → reopen → undo/redo →
 * preview → publish → anonymous visit of the public page.
 * Design Studio: insert → customise → duplicate/copy/paste/lock/hide/undo → autosave → reopen →
 * export PNG and JPEG (pixel-verified, no icon fonts) and SVG (vector preserved).
 * Also checks keyboard navigation of the browser and that icon data loads lazily by category.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { chromium, type BrowserContext, type Page } from "playwright";
import { getTestDatabaseUrl } from "../tests/test-database.js";
import { runMigrations } from "../src/server/db/migrate.js";

if (process.env.BINHI_E2E_BASE || process.argv.includes("--remote")) throw new Error("The icon journey runs only against a local disposable test database.");
const database = getTestDatabaseUrl();
await runMigrations(database);
const port = 4312;
const base = `http://127.0.0.1:${port}`;
const output = "e2e/screenshots/icons";
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
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
/** Automated WCAG 2.2 A/AA audit (axe-core) of one region; any violation fails the journey. */
async function audit(p: Page, selector: string, label: string) {
  await p.evaluate(`${axeSource}`);
  const result = await p.evaluate(async (sel) => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: { id: string; impact: string; help: string; nodes: { target: string[]; failureSummary?: string }[] }[]; passes: unknown[] }> } }).axe;
    const r = await axe.run({ include: [sel] }, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return { violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => `${n.target.join(" ")} :: ${(n.failureSummary ?? "").split("\n").slice(0, 2).join(" ")}`) })), passes: r.passes.length };
  }, selector);
  audits.push({ label, violations: result.violations.length, rulesPassed: result.passes });
  assert.deepEqual(result.violations, [], `axe violations in ${label}`);
}
const audits: { label: string; violations: number; rulesPassed: number }[] = [];
const steps: { name: string; [k: string]: unknown }[] = [];
const record = (name: string, data = {}) => { steps.push({ name, ...data }); console.log(`PASS ${name} ${JSON.stringify(data)}`); };
const password = randomUUID() + randomUUID();
const H = { "x-binhi-request": "editor" };
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let page: Page | undefined;
let succeeded = false;
let email = "";
let ctxRef: BrowserContext | undefined;

const waitSaved = (p: Page) => p.locator('.save-state[data-state="saved"], .design-save[data-state="saved"]').first().waitFor({ timeout: 20_000 });
async function waitDirtyThenSaved(p: Page, selector: string) {
  await p.locator(`${selector}[data-state="unsaved"], ${selector}[data-state="saving"]`).first().waitFor({ timeout: 3000 }).catch(() => undefined);
  await p.locator(`${selector}[data-state="saved"]`).waitFor({ timeout: 20_000 });
}
/** Download link → decoded pixels from the bytes the browser actually produced. */
async function readDownload(p: Page, ext: string) {
  // No nested helper functions here: tsx's name-keeping helper does not exist inside the page context.
  return p.evaluate(async (e) => {
    const anchor = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[download]")).find((a) => a.download.endsWith(`.${e}`))!;
    const blob = await (await fetch(anchor.href)).blob();
    const text = blob.type === "image/svg+xml" ? await blob.text() : null;
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, 1080, 1080);
    const centre = Array.from(ctx.getImageData(540, 540, 1, 1).data);
    const corner = Array.from(ctx.getImageData(10, 10, 1, 1).data);
    const result = { mime: blob.type, size: blob.size, text, w: img.naturalWidth, h: img.naturalHeight, centre, corner };
    URL.revokeObjectURL(url);
    return result;
  }, ext);
}

try {
  const deadline = Date.now() + 30_000;
  while (!(await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false))) {
    if (Date.now() > deadline) throw new Error(`Test server failed: ${serverLog.slice(-1500)}`);
    await new Promise((r) => setTimeout(r, 150));
  }
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  ctxRef = ctx;
  page = await ctx.newPage();
  const p = page;
  p.setDefaultTimeout(20_000);
  const pageErrors: string[] = [];
  p.on("pageerror", (e) => pageErrors.push(e.message));
  p.on("response", async (r) => { if (r.status() >= 400 && r.url().includes("/api/")) console.error(`[api ${r.status()}] ${r.request().method()} ${r.url()} -> ${(await r.text().catch(() => "")).slice(0, 400)} | req ${(r.request().postData() ?? "").slice(0, 700)}`); });
  const chunkRequests = new Set<string>();
  p.on("request", (r) => {
    const m = /\/assets\/(navigation|editing|selection|alignment|layers|typography|adjustments|effects|colors|shapes|structure|elements|media|conversion|devices|publishing|forms|communication|commerce|people|time|places|creative|nature|status)-[\w-]+\.js$/.exec(r.url());
    if (m) chunkRequests.add(m[1]!);
  });

  /* ------------------------------------------------------------ sign up + website */
  email = `icons-${randomUUID()}@example.invalid`;
  await p.goto(`${base}/signup`);
  await p.getByLabel("Your name").fill("Icon Tester");
  await p.getByLabel("Email").fill(email);
  await p.getByLabel(/^Password/).fill(password);
  await p.getByRole("button", { name: "Create account" }).click();
  await p.waitForURL(/\/sites\/new/);
  await p.getByLabel("Website name").fill("Icon library site");
  await p.getByRole("button", { name: "Create website" }).click();
  await p.waitForURL(/\/sites\/site_[a-z0-9]+\/edit/);
  const siteId = /site_[a-z0-9]+/.exec(p.url())![0];
  const frame = p.frameLocator("iframe[title^='Canvas preview']");
  await frame.locator("h1").first().waitFor({ timeout: 30_000 });
  const apiSite = () => p.evaluate(async (id) => (await (await fetch(`/api/sites/${id}`, { headers: { "x-binhi-request": "editor" } })).json()).site, siteId);

  /* -------------------------------------------------------------- icon browser */
  assert.equal(chunkRequests.size, 0, "no icon category data is downloaded before the Icons tab opens");
  await p.getByRole("button", { name: "Icons", exact: true }).click();
  const search = p.getByLabel("Search icons", { exact: true });
  await search.waitFor();
  assert.match(await p.locator(".icon-browser .help[role=status]").first().innerText(), /250 icons/);
  const firstChunks = chunkRequests.size;
  assert.ok(firstChunks >= 1 && firstChunks < 25, `only the categories on screen are fetched (${firstChunks} of 25)`);
  // keyboard: arrows move between icons
  await p.locator("button[data-icon-cell]").first().focus();
  await p.keyboard.press("ArrowRight");
  assert.equal(await p.evaluate(() => (document.activeElement as HTMLElement).getAttribute("data-icon-id")), "binhi.icon.menu");
  await p.keyboard.press("End");
  assert.ok((await p.evaluate(() => (document.activeElement as HTMLElement).getAttribute("data-icon-id")))!.startsWith("binhi.icon."));
  // intent search + categories + variant filter
  await search.fill("photo");
  await p.locator('button[data-icon-id="binhi.icon.camera"]').waitFor();
  await search.fill("remove");
  await p.locator('button[data-icon-id="binhi.icon.delete"]').waitFor();
  await search.fill("zzzzqq");
  await p.getByText(/No icons match/).waitFor();
  await search.fill("");
  await p.getByLabel("Icon category", { exact: true }).selectOption("status");
  assert.equal(await p.locator("button[data-icon-cell]").count(), 10);
  await p.getByLabel("Icon style", { exact: true }).selectOption("filled");
  assert.ok((await p.locator("button[data-icon-cell]").count()) === 0 || (await p.locator('button[data-icon-id="binhi.icon.shield"]').count()) === 1);
  await p.getByLabel("Icon style", { exact: true }).selectOption("any");
  await p.getByLabel("Icon category", { exact: true }).selectOption("");
  await audit(p, ".left-panel", "website Icons panel (light)");
  record("icon browser: lazy category data, keyboard navigation, intent search, categories and style filter", { categoriesOnOpen: firstChunks, categoriesAfterSearchesAndFilters: chunkRequests.size, of: 25 });

  /* favourites + recents persist across reloads (per browser) */
  await search.fill("camera");
  await p.getByRole("button", { name: "Add Camera to favorites" }).click();
  await p.getByRole("button", { name: /^Favorites \(1\)/ }).click();
  assert.equal(await p.locator("button[data-icon-cell]").count(), 1);
  await p.getByRole("button", { name: "All", exact: true }).click();

  /* ------------------------------------------------------------ insert + customise */
  await search.fill("photo");
  await p.locator('button[data-icon-id="binhi.icon.camera"]').click();
  await p.getByLabel("Icon size", { exact: true }).selectOption("48");
  await p.getByRole("button", { name: "Insert icon" }).click();
  const iconSvg = frame.locator('[data-icon="binhi.icon.camera"] svg');
  await iconSvg.waitFor();
  assert.equal(await iconSvg.getAttribute("width"), "48");
  record("inserted a library icon from the Icons tab; canvas shows the SVG at the chosen size");
  await p.getByRole("button", { name: "Recent" }).click();
  await p.locator('button[data-icon-id="binhi.icon.camera"]').waitFor();
  await p.getByRole("button", { name: "All", exact: true }).click();

  await p.getByLabel("Selected icon style").selectOption("duotone");
  await iconSvg.locator("[fill-opacity]").first().waitFor();
  await p.getByLabel("Selected icon stroke weight").fill("1.5");
  await p.getByLabel("Selected icon stroke weight").blur();
  await p.waitForFunction(() => document.querySelector("iframe")?.contentDocument?.querySelector('[data-icon] svg')?.getAttribute("stroke-width") === "1.5");
  await p.getByLabel("Selected icon rotation").fill("90");
  await p.getByLabel("Selected icon rotation").blur();
  await p.waitForFunction(() => /rotate\(90\)/.test(document.querySelector("iframe")?.contentDocument?.querySelector('[data-icon] svg')?.innerHTML ?? ""));
  await p.locator(".prop-group-body").getByLabel("Colour value").first().fill("#cc0000");
  await p.locator(".prop-group-body").getByLabel("Colour value").first().press("Enter");
  await p.waitForFunction(() => {
    const el = document.querySelector("iframe")?.contentDocument?.querySelector<HTMLElement>("[data-icon]");
    return !!el && getComputedStyle(el).color === "rgb(204, 0, 0)";
  });
  await p.locator("summary", { hasText: "Accessibility" }).click();
  await p.locator("#p-a11y").fill("Camera icon");
  await p.locator("#p-a11y").blur();
  await frame.locator('[data-icon="binhi.icon.camera"] svg[role="img"][aria-label="Camera icon"]').waitFor();
  await audit(p, ".prop-group-body:has(.icon-current)", "website icon properties (light)");
  record("customised style, stroke weight, rotation, colour and accessible label from the properties panel");

  /* ---------------------------------------------------------- save, reopen, undo/redo */
  await waitDirtyThenSaved(p, ".save-state");
  const saved = await apiSite();
  const icons: { props: Record<string, unknown>; style: Record<string, unknown> }[] = [];
  const collect = (n: { type: string; props: Record<string, unknown>; style: Record<string, unknown>; children?: unknown[] }) => { if (n.type === "icon") icons.push(n); (n.children ?? []).forEach((c) => collect(c as never)); };
  [...saved.document.pages.flatMap((pg: { sections: never[] }) => pg.sections), saved.document.header, saved.document.footer].filter(Boolean).forEach(collect);
  if (icons.length !== 1) console.error('DEBUG', saved.revision, Object.keys(saved), JSON.stringify(saved.document).length, JSON.stringify(saved.document).match(/.{80}"icon".{80}/g));
  assert.equal(icons.length, 1);
  assert.deepEqual(
    { icon: icons[0]!.props.icon, variant: icons[0]!.props.variant, rotation: icons[0]!.props.rotation, strokeWidth: icons[0]!.props.strokeWidth, size: icons[0]!.props.size, color: icons[0]!.style.color },
    { icon: "binhi.icon.camera", variant: "duotone", rotation: 90, strokeWidth: 1.5, size: 48, color: "#cc0000" },
  );
  await p.reload();
  await frame.locator("h1").first().waitFor({ timeout: 30_000 });
  await frame.locator('[data-icon="binhi.icon.camera"] svg[aria-label="Camera icon"]').waitFor();
  record("autosave persisted the icon; reopening the editor restores it exactly", { revision: saved.revision });

  await frame.locator('[data-icon="binhi.icon.camera"]').click();
  await p.getByLabel("Selected icon size preset").selectOption("64");
  await p.waitForFunction(() => document.querySelector("iframe")?.contentDocument?.querySelector('[data-icon] svg')?.getAttribute("width") === "64");
  await p.getByRole("button", { name: "Undo" }).click();
  await p.waitForFunction(() => document.querySelector("iframe")?.contentDocument?.querySelector('[data-icon] svg')?.getAttribute("width") === "48");
  await p.getByRole("button", { name: "Redo" }).click();
  await p.waitForFunction(() => document.querySelector("iframe")?.contentDocument?.querySelector('[data-icon] svg')?.getAttribute("width") === "64");
  await waitDirtyThenSaved(p, ".save-state");
  record("undo and redo restore the icon size");

  /* ------------------------------------------------------------------ legacy icon */
  const legacyDoc = await p.evaluate(async (id) => {
    const s = (await (await fetch(`/api/sites/${id}`, { headers: { "x-binhi-request": "editor" } })).json()).site;
    const sec = s.document.pages[0].sections[0];
    const res = await fetch(`/api/sites/${id}/ops`, { method: "POST", headers: { "x-binhi-request": "editor", "content-type": "application/json" }, body: JSON.stringify({ baseRevision: s.revision, batchId: "legacy-" + Date.now(), ops: [{ type: "insertComponent", target: { parentId: sec.id }, componentType: "icon", props: { name: "mail", size: 28 } }] }) });
    return res.status;
  }, siteId);
  assert.equal(legacyDoc, 200);
  await p.reload();
  await frame.locator("h1").first().waitFor({ timeout: 30_000 });
  assert.equal(await frame.locator(".b-icon svg").count(), 2, "a built-in (pre-library) icon still renders next to the library icon");
  record("existing built-in icon names still render");

  /* ------------------------------------------------------------ preview + publish */
  const preview = await p.evaluate(async (id) => (await fetch(`/api/sites/${id}/preview/`)).text(), siteId);
  assert.ok(preview.includes('data-icon="binhi.icon.camera"') && preview.includes('aria-label="Camera icon"'));
  await p.getByRole("button", { name: /Publish/ }).first().click();
  await p.getByRole("button", { name: "Publish now" }).click();
  await p.getByText("Live", { exact: true }).first().waitFor({ timeout: 30_000 });
  const liveLink = (await p.locator(".pub-url a").first().getAttribute("href"))!;
  await p.keyboard.press("Escape");
  const anon = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const live = await anon.newPage();
  assert.equal((await live.goto(liveLink))!.status(), 200);
  const liveIcon = live.locator('[data-icon="binhi.icon.camera"] svg');
  await liveIcon.waitFor();
  const box = await liveIcon.boundingBox();
  assert.ok(box && box.width >= 60, "published icon is visible at its size");
  assert.equal(await live.locator('[data-icon="binhi.icon.camera"]').evaluate((el) => getComputedStyle(el).color), "rgb(204, 0, 0)");
  const liveHtml = await live.content();
  assert.ok(!/<script[^>]*>[^<]*binhi\.icon/.test(liveHtml) && !liveHtml.includes("data-icon-pending"));
  assert.ok(liveHtml.length < 60_000, `published page stays small (${liveHtml.length} bytes), no icon library embedded`);
  await live.screenshot({ path: `${output}/01-live-website.png` });
  await live.setViewportSize({ width: 390, height: 800 });
  assert.ok(await live.evaluate(() => document.documentElement.scrollWidth <= 390), "no horizontal overflow on mobile");
  await anon.close();
  record("preview and published site render the icon for an anonymous visitor", { bytes: liveHtml.length });
  await p.screenshot({ path: `${output}/02-editor.png` });

  /* ================================================================ Design Studio */
  await p.goto(`${base}/studio/design`);
  await p.getByRole("button", { name: /Instagram post/ }).click();
  await p.waitForURL(/\/studio\/design\/prj_[a-z0-9]+/);
  const designId = /prj_[a-z0-9]+/.exec(p.url())![0];
  await p.getByText("1080 × 1080px", { exact: false }).first().waitFor();
  await p.getByRole("button", { name: "Icon", exact: true }).click();
  const dialog = p.getByRole("dialog", { name: "Insert an icon" });
  await dialog.getByLabel("Search icons", { exact: true }).fill("love");
  await dialog.locator('button[data-icon-id="binhi.icon.heart"]').click();
  await dialog.getByLabel("Custom icon size in pixels", { exact: true }).fill("400");
  await dialog.getByLabel("Custom colour", { exact: true }).fill("#ff0000");
  await dialog.getByLabel("Icon style", { exact: true }).selectOption("filled");
  await dialog.getByRole("button", { name: "Insert icon" }).click();
  await p.locator('.design-layer[data-layer-id] svg').waitFor();
  assert.equal(await p.locator(".layer-list .layer-row").count(), 1);
  await waitDirtyThenSaved(p, ".design-save");
  let project = (await ctx.request.get(`${base}/api/projects/${designId}`).then((r) => r.json())).project;
  assert.deepEqual(
    { type: project.document.layers[0].type, icon: project.document.layers[0].icon, variant: project.document.layers[0].variant, color: project.document.layers[0].color, width: project.document.layers[0].width },
    { type: "icon", icon: "binhi.icon.heart", variant: "filled", color: "#ff0000", width: 400 },
  );
  record("design studio: inserted a library icon as an editable vector layer");

  // ---- export PNG / JPEG: icon pixels come from the vector, centred, with no icon font
  await p.getByLabel("Export format").selectOption("image/png");
  await p.getByRole("button", { name: "Export design", exact: true }).click();
  await p.getByRole("link", { name: "Download PNG" }).waitFor();
  const png = await readDownload(p, "png");
  assert.equal(png.mime, "image/png");
  assert.deepEqual([png.w, png.h], [1080, 1080]);
  assert.ok(png.centre[0]! > 240 && png.centre[1]! < 20 && png.centre[2]! < 20, `PNG centre is the icon's red (got ${png.centre})`);
  assert.deepEqual(png.corner.slice(0, 3), [255, 255, 255], "background stays white");
  await p.getByLabel("Export format").selectOption("image/jpeg");
  await p.getByRole("button", { name: "Export design", exact: true }).click();
  await p.getByRole("link", { name: "Download JPG" }).waitFor();
  const jpg = await readDownload(p, "jpg");
  assert.equal(jpg.mime, "image/jpeg");
  assert.ok(jpg.centre[0]! > 200 && jpg.centre[1]! < 60 && jpg.centre[2]! < 60, `JPEG centre is red (got ${jpg.centre})`);
  record("PNG and JPEG exports contain the icon (pixel-verified)", { pngBytes: png.size, jpegBytes: jpg.size });

  // ---- edit: position, rotation, flip, opacity, style, stroke, gradient
  const layer = p.locator('.design-layer[data-layer-id]').first();
  await layer.click();
  await p.getByLabel("X", { exact: true }).fill("100");
  await p.getByLabel("Y", { exact: true }).fill("100");
  await p.getByLabel("Width", { exact: true }).fill("300");
  await p.getByLabel("Height", { exact: true }).fill("300");
  await p.getByLabel("Rotation°").fill("30");
  await p.getByLabel("Opacity %").fill("80");
  await p.getByRole("button", { name: "Flip horizontal" }).click();
  await p.getByRole("button", { name: "Flip vertical" }).click();
  await p.getByLabel("Stroke weight").fill("3");
  await p.locator(".design-props label.photo-field", { hasText: /^Style/ }).locator("select").selectOption("duotone");
  await p.getByRole("button", { name: "Gradient" }).click();
  await p.getByLabel("Description (alt text)").fill("A heart");
  await waitDirtyThenSaved(p, ".design-save");
  project = (await ctx.request.get(`${base}/api/projects/${designId}`).then((r) => r.json())).project;
  assert.deepEqual(
    (({ x, y, width, height, rotation, opacity, flipX, flipY, strokeWidth, variant, label }) => ({ x, y, width, height, rotation, opacity, flipX, flipY, strokeWidth, variant, label }))(project.document.layers[0]),
    { x: 100, y: 100, width: 300, height: 300, rotation: 30, opacity: 0.8, flipX: true, flipY: true, strokeWidth: 3, variant: "duotone", label: "A heart" },
  );
  assert.ok(project.document.layers[0].gradient, "gradient stored with validated colours");
  record("edited position, size, rotation, opacity, flips, stroke, style, gradient and description");

  // ---- duplicate, copy/paste, lock, hide, delete, undo/redo
  await p.getByRole("button", { name: "Duplicate" }).click();
  assert.equal(await p.locator(".layer-list .layer-row").count(), 2);
  await p.getByRole("button", { name: "Copy", exact: true }).click();
  await p.getByRole("button", { name: "Paste", exact: true }).click();
  assert.equal(await p.locator(".layer-list .layer-row").count(), 3);
  await p.getByRole("button", { name: /^Lock Heart$/ }).first().click();
  await p.getByRole("button", { name: /^Hide Heart$/ }).first().click();
  await p.getByRole("button", { name: "Delete" }).click();
  assert.equal(await p.locator(".layer-list .layer-row").count(), 2);
  await p.getByRole("button", { name: "Undo" }).click();
  assert.equal(await p.locator(".layer-list .layer-row").count(), 3);
  await p.getByRole("button", { name: "Redo" }).click();
  assert.equal(await p.locator(".layer-list .layer-row").count(), 2);
  await waitDirtyThenSaved(p, ".design-save");
  record("duplicate, copy/paste, lock, hide, delete and undo/redo work on icon layers");

  // ---- reopen
  await p.reload();
  await p.locator('.design-layer[data-layer-id] svg').first().waitFor({ state: "attached" });
  assert.equal(await p.locator(".layer-list .layer-row").count(), 2);
  assert.equal(await p.locator('.design-layer[data-layer-id] svg').count(), 2);
  assert.equal(await p.locator('.layer-list .layer-name', { hasText: "hidden" }).count(), 1, "the hidden state survived reopening");
  assert.equal(await p.locator('.layer-list .layer-name', { hasText: "locked" }).count(), 1, "the locked state survived reopening");
  record("reopening the design restores icon layers");

  // ---- SVG export keeps vectors
  await p.locator(".layer-list .layer-name").first().click();
  await p.getByRole("button", { name: "Export SVG" }).click();
  await p.getByRole("link", { name: "Download SVG" }).waitFor();
  const svg = await readDownload(p, "svg");
  assert.equal(svg.mime, "image/svg+xml");
  assert.ok(svg.text!.includes("<path") && svg.text!.includes("data-layer") && svg.text!.includes('aria-label="A heart"'));
  assert.ok(!/<script|foreignObject|onload=|javascript:/i.test(svg.text!));
  assert.ok(svg.size < 40_000, `SVG export is compact (${svg.size} bytes)`);
  record("SVG export preserves icons as vector paths", { bytes: svg.size });

  // ---- template duplication stays valid
  const tpl = await ctx.request.post(`${base}/api/projects/${designId}/duplicate`, { headers: H, data: { kind: "design-template", name: "Icon template" } });
  assert.equal(tpl.status(), 200);
  const tplDoc = (await tpl.json()).project.document;
  assert.ok(tplDoc.layers.every((l: { type: string; icon?: string }) => l.type !== "icon" || l.icon === "binhi.icon.heart"));
  await p.screenshot({ path: `${output}/03-design.png` });
  record("templates created from designs keep valid icon references");

  /* --------------------------------------------- accessibility audit + keyboard interaction of the dialog */
  await p.getByRole("button", { name: "Icon", exact: true }).focus();
  await p.keyboard.press("Enter");
  const kdialog = p.getByRole("dialog", { name: "Insert an icon" });
  await kdialog.getByLabel("Search icons", { exact: true }).waitFor();
  assert.equal(await p.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Search icons", "focus lands on the search field");
  await p.keyboard.type("heart");
  const status = kdialog.locator('.help[role="status"]');
  await p.waitForFunction(() => /\d+ icons?/.test(document.querySelector('.modal .help[role="status"]')?.textContent ?? ""));
  assert.match((await status.innerText()).trim(), /^\d+ icons?$/, "the result count is announced through a live region");
  const cell = kdialog.locator('button[data-icon-id="binhi.icon.heart"]');
  await cell.focus();
  await p.keyboard.press("Space");
  assert.equal(await cell.getAttribute("aria-pressed"), "true", "Space selects an icon");
  await kdialog.getByRole("button", { name: "Add Heart to favorites" }).focus();
  await p.keyboard.press("Enter");
  assert.equal(await kdialog.getByRole("button", { name: "Remove Heart from favorites" }).getAttribute("aria-pressed"), "true", "favourites toggle by keyboard");
  await kdialog.getByRole("button", { name: "Remove Heart from favorites" }).press("Enter"); // leave favourites as they were
  await kdialog.getByLabel("Search icons", { exact: true }).fill("");
  for (let i = 0; i < 60; i++) {
    await p.keyboard.press("Tab");
    assert.ok(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), `focus stays inside the dialog (tab ${i + 1})`);
  }
  for (let i = 0; i < 5; i++) {
    await p.keyboard.press("Shift+Tab");
    assert.ok(await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), "Shift+Tab stays inside the dialog");
  }
  await kdialog.getByLabel("Search icons", { exact: true }).fill("star");
  await kdialog.locator('button[data-icon-id="binhi.icon.star"]').click();
  await audit(p, '[role="dialog"]', "design icon dialog with a selection (light)");
  await p.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await audit(p, '[role="dialog"]', "design icon dialog with a selection (dark)");
  await p.evaluate(() => document.documentElement.removeAttribute("data-theme"));
  await p.keyboard.press("Escape");
  await kdialog.waitFor({ state: "detached" });
  assert.equal(await p.evaluate(() => document.activeElement?.textContent?.trim()), "Icon", "focus returns to the control that opened the dialog");
  await p.locator(".layer-list .layer-name").first().click();
  await audit(p, ".design-props", "design icon layer properties (light)");
  record("accessibility audit (axe, WCAG 2.2 A/AA) and keyboard interaction of the icon browser pass", { audits });

  /* ----------------------------------------------------------- phone and tablet widths */
  for (const [width, height] of [[390, 844], [820, 1180]] as const) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(200);
    // The Phase 1 design editor itself may already be wider than a tablet; the icon dialog must not add overflow.
    const baseline = await p.evaluate(() => document.documentElement.scrollWidth);
    await p.getByRole("button", { name: "Icon", exact: true }).click();
    const sheet = p.getByRole("dialog", { name: "Insert an icon" });
    await sheet.getByLabel("Search icons", { exact: true }).waitFor();
    const modalBox = await sheet.boundingBox();
    assert.ok(modalBox && modalBox.x >= 0 && modalBox.x + modalBox.width <= width + 1, `icon dialog fits a ${width}px viewport`);
    const after = await p.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(after <= Math.max(width, baseline), `the icon dialog adds no horizontal scroll at ${width}px (page ${baseline}px before, ${after}px after)`);
    if (width === 390) assert.ok(after <= width, "no horizontal scroll at phone width");
    const cell = await sheet.locator("button[data-icon-cell]").first().boundingBox();
    assert.ok(cell && cell.width >= 44 && cell.height >= 44, "icon buttons keep a 44px touch target");
    await p.screenshot({ path: `${output}/04-icon-dialog-${width}.png` });
    await p.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  record("icon dialog is usable at phone and tablet widths");

  /* ----------------------------------------- kill switch: BINHI_ICON_LIBRARY=false (a second server, same database) */
  const offPort = 4313;
  const offBase = `http://127.0.0.1:${offPort}`;
  const offServer = spawn(process.execPath, ["--import", "tsx", "src/server/start.ts"], {
    env: { ...process.env, BINHI_DATABASE_URL: database, BINHI_PORT: String(offPort), BINHI_PUBLIC_URL: offBase, BINHI_SESSION_SECRET: "local-disposable-test-secret-only", BINHI_SERVE_BUILT_CLIENT: "true", NODE_ENV: "test", BINHI_ICON_LIBRARY: "false" },
    stdio: "ignore",
  });
  try {
    const until = Date.now() + 30_000;
    while (!(await fetch(`${offBase}/api/health`).then((r) => r.ok).catch(() => false))) {
      if (Date.now() > until) throw new Error("kill-switch server did not start");
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.equal((await fetch(`${offBase}/api/health`).then((r) => r.json())).iconLibrary, false);
    await p.goto(`${offBase}/sites/${siteId}/edit`);
    await frame.locator("h1").first().waitFor({ timeout: 30_000 });
    assert.equal(await p.getByRole("button", { name: "Icons", exact: true }).count(), 0, "the Icons tab is hidden when the switch is off");
    await frame.locator('[data-icon="binhi.icon.camera"] svg').waitFor();
    await frame.locator('[data-icon="binhi.icon.camera"]').click();
    assert.equal(await p.getByRole("button", { name: /Change icon/ }).count(), 0, "no way to pick a library icon");
    if (!(await p.getByLabel("Search elements", { exact: true }).isVisible())) await p.getByRole("button", { name: "Elements", exact: true }).click();
    await p.getByLabel("Search elements", { exact: true }).fill("icon");
    const before = await frame.locator(".b-icon").count();
    await p.getByRole("button", { name: "Icon", exact: true }).click();
    await p.waitForFunction((n) => (document.querySelector("iframe")?.contentDocument?.querySelectorAll(".b-icon").length ?? 0) > n, before);
    assert.equal(await frame.locator('[data-icon="binhi.icon.camera"]').count(), 1, "existing library icon is untouched");
    await waitDirtyThenSaved(p, ".save-state");
    await p.goto(`${offBase}/studio/design/${designId}`);
    await p.locator('.design-layer[data-layer-id] svg').first().waitFor({ state: "attached" });
    assert.equal(await p.getByRole("button", { name: "Icon", exact: true }).count(), 0, "the design toolbar has no Icon button");
    assert.equal(await p.locator('.design-layer[data-layer-id] svg').count(), 2, "existing icon layers still render");
    record("kill switch hides every way to add icons but existing icon content still renders and saves");
  } finally {
    offServer.kill("SIGTERM");
  }
  await p.goto(`${base}/studio/design`);

  /* ------------------------------------------------------------ isolation + errors */
  const other = await browser.newContext();
  await other.request.post(`${base}/api/auth/signup`, { headers: H, data: { email: `icons-b-${randomUUID()}@example.invalid`, password, displayName: "Other" } });
  assert.equal((await other.request.get(`${base}/api/projects/${designId}`)).status(), 404, "another account cannot open the design");
  assert.equal((await other.request.get(`${base}/api/sites/${siteId}`)).status(), 404, "another account cannot open the site");
  const bad = await ctx.request.post(`${base}/api/projects`, { headers: H, data: { kind: "design", name: "Bad", document: { schemaVersion: 1, width: 640, height: 640, background: "#ffffff", layers: [{ id: "lyr_abcdef1234", type: "icon", icon: "binhi.icon.nope", x: 0, y: 0, width: 50, height: 50 }] } } });
  assert.equal(bad.status(), 400);
  await other.close();
  record("unknown icons are rejected and other accounts cannot reach icon content");

  assert.deepEqual(pageErrors, [], "no uncaught page errors");
  succeeded = true;
} finally {
  if (!succeeded) {
    console.error(serverLog.slice(-1200));
    await page?.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  }
  if (ctxRef && email) {
    try {
      const login = await ctxRef.request.post(`${base}/api/auth/login`, { headers: H, data: { email, password } });
      assert.equal(login.status(), 200);
      assert.equal((await ctxRef.request.delete(`${base}/api/auth/account`, { headers: H, data: { password } })).status(), 200);
    } catch {
      succeeded = false;
      console.error("The disposable icon test account could not be cleaned up.");
    }
  }
  writeFileSync(`${output}/evidence.json`, JSON.stringify({ passed: succeeded, steps, accessibilityAudits: audits }, null, 2));
  await browser?.close();
  server.kill("SIGTERM");
}
assert.ok(succeeded, "Icon journey or cleanup failed.");
console.log(`Icon journey passed: ${steps.length} checks`);
