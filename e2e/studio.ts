/**
 * Creative studio regression journey (Phase 1). Disposable test DB only;
 * never supports remote mode. No production schema or data access.
 * Screenshots/output stay in ignored e2e/screenshots.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { randomUUID } from "node:crypto";
import { getTestDatabaseUrl } from "../tests/test-database.js";
import { runMigrations } from "../src/server/db/migrate.js";
import { inspectRaster, PHOTO_LIMITS } from "../src/core/media/photo.js";

if (process.env.BINHI_E2E_BASE || process.argv.includes("--remote")) throw new Error("Studio tests run only against a local disposable test database.");
const database = getTestDatabaseUrl();
await runMigrations(database);
const port = 4311;
const base = `http://127.0.0.1:${port}`;
const output = "e2e/screenshots/studio";
mkdirSync(output, { recursive: true });
const gbm = (existsSync("/nix/store") ? readdirSync("/nix/store") : []).filter(name => name.includes("mesa-libgbm"))
  .map(name => `/nix/store/${name}/lib`).find(dir => existsSync(`${dir}/libgbm.so.1`));
if (gbm) process.env.LD_LIBRARY_PATH = `${gbm}:${process.env.LD_LIBRARY_PATH ?? ""}`;
const server = spawn(process.execPath, ["--import", "tsx", "src/server/start.ts"], {
  env: { ...process.env, BINHI_DATABASE_URL: database, BINHI_PORT: String(port),
    BINHI_PUBLIC_URL: base, BINHI_SESSION_SECRET: "local-disposable-test-secret-only",
    BINHI_SERVE_BUILT_CLIENT: "true", NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", data => { serverLog += String(data); });
server.stderr.on("data", data => { serverLog += String(data); });
const steps: { name: string; [key: string]: unknown }[] = [];
const record = (name: string, data = {}) => { steps.push({ name, ...data }); console.log(`PASS ${name} ${JSON.stringify(data)}`); };
const password = randomUUID() + randomUUID();
const cleanup: { ctx: BrowserContext; email: string }[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let currentPage: Page | undefined;
let succeeded = false;
const H = { "x-binhi-request": "editor" };

/** Poll a field until React has committed the expected value (controlled inputs update in an effect). */
async function expectValue(page: Page, label: string, value: string) {
  const locator = page.getByLabel(label, { exact: true });
  const deadline = Date.now() + 5000;
  let actual = await locator.inputValue();
  while (actual !== value && Date.now() < deadline) {
    await page.waitForTimeout(50);
    actual = await locator.inputValue();
  }
  assert.equal(actual, value, label);
}
async function signup(ctx: BrowserContext, page: Page) {
  const email = `studio-${randomUUID()}@example.invalid`;
  await page.goto(`${base}/signup`);
  await page.getByLabel("Your name").fill("Studio Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/sites\/new/);
  cleanup.push({ ctx, email });
}
async function inspectDownload(page: Page, button = "Export image") {
  await page.getByRole("button", { name: button, exact: true }).waitFor();
  const link = page.getByRole("link", { name: /^Download (PNG|JPG|WEBP)$/ });
  await link.waitFor();
  const result = await page.evaluate(async () => {
    const anchor = document.querySelector<HTMLAnchorElement>(".photo-actions a[download]")!;
    const blob = await (await fetch(anchor.href)).blob();
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const result = { mime: blob.type, size: blob.size, width: image.width, height: image.height,
      topLeft: Array.from(ctx.getImageData(10, 10, 1, 1).data),
      center: Array.from(ctx.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data),
      bottomRight: Array.from(ctx.getImageData(image.width - 10, image.height - 10, 1, 1).data),
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
    image.close();
    return result;
  });
  const actual = inspectRaster(new Uint8Array(result.bytes));
  assert.equal(actual.mimeType, result.mime);
  assert.equal(actual.width, result.width);
  assert.equal(actual.height, result.height);
  return result;
}
try {
  const deadline = Date.now() + 30000;
  while (true) {
    if (await fetch(`${base}/api/health`).then(r => r.ok).catch(() => false)) break;
    if (Date.now() > deadline) throw new Error(`Test server failed: ${serverLog.slice(-1500)}`);
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  currentPage = page;
  const pageErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.setDefaultTimeout(20000);
  await signup(ctx, page);
  await page.getByLabel("Website name").fill("Studio owned destination");
  await page.getByRole("button", { name: "Create website" }).click();
  await page.waitForURL(/\/sites\/site_[a-z0-9]+\/edit/);
  const siteId = /site_[a-z0-9]+/.exec(page.url())![0];

  /* ---------------------------------------------------------------- dashboard */
  await page.goto(base);
  await page.getByRole("heading", { name: "Pick up where you need to work" }).waitFor();
  const destinations = ["My Projects", "Website Builder", "Design Studio", "Photo Editor", "Image Compressor", "File Converter, planned, not available yet", "Form Builder, planned, not available yet", "Templates", "Brand Kits", "Asset Library"];
  for (const name of destinations) assert.equal(await page.locator(".studio-module-grid").getByRole("link", { name, exact: true }).count(), 1, name);
  assert.equal(await page.locator(".studio-module .module-available").count(), 8);
  assert.equal(await page.locator(".studio-module .module-soon").count(), 2);
  await page.getByRole("link", { name: "Studio owned destination" }).waitFor();
  await page.screenshot({ path: `${output}/01-home.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "dashboard fits a phone width");
  await page.setViewportSize({ width: 1366, height: 900 });
  for (const slug of ["convert", "forms"]) {
    await page.goto(`${base}/studio/${slug}`);
    await page.getByText("Planned, not available yet", { exact: true }).waitFor();
  }
  await page.goto(`${base}/websites`);
  await page.getByRole("heading", { name: "Your websites", exact: true }).waitFor();
  record("dashboard lists ten destinations with honest availability; planned tools stay planned");

  /* -------------------------------------------------------------------- photo */
  await page.goto(`${base}/studio/photo`);
  const input = page.getByLabel("Choose a PNG, JPEG or static WebP image");
  await input.setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg onload='alert(1)'></svg>") });
  await page.getByRole("alert").filter({ hasText: "Unsupported" }).waitFor();
  await input.setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(PHOTO_LIMITS.inputBytes + 1) });
  await page.getByRole("alert").filter({ hasText: "8 MiB" }).waitFor();
  record("unsafe types and oversized input rejected before decode");
  const fixture = await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 640; c.height = 480;
    const ctx = c.getContext("2d")!;
    const data = ctx.createImageData(640, 480);
    let seed = 12345;
    for (let y = 0; y < 480; y++) for (let x = 0; x < 640; x++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const i = (y * 640 + x) * 4;
      data.data[i] = x < 320 ? 180 + (seed >>> 26) : 20;
      data.data[i + 1] = y < 240 ? 40 : 120 + (seed >>> 25);
      data.data[i + 2] = x >= 320 ? 180 : 20;
      data.data[i + 3] = x > 600 && y > 440 ? 0 : 255;
    }
    ctx.putImageData(data, 0, 0);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  const source = Buffer.from(fixture, "base64");
  let mediaUploads = 0;
  let libraryUploads = 0;
  page.on("request", request => {
    if (request.method() !== "POST") return;
    if (request.url().endsWith(`/api/sites/${siteId}/assets`)) mediaUploads++;
    if (request.url().endsWith("/api/library")) libraryUploads++;
  });
  await input.setInputFiles({ name: "Source.png", mimeType: "image/png", buffer: source });
  await page.getByRole("img", { name: "Edited preview of Source", exact: true }).waitFor();
  await page.getByLabel("Crop width", { exact: true }).fill("300");
  await page.getByLabel("Crop height", { exact: true }).fill("200");
  await page.getByLabel("Left (x)", { exact: true }).fill("20");
  await page.getByLabel("Top (y)", { exact: true }).fill("30");
  await page.getByRole("button", { name: "90°", exact: true }).click();
  await page.getByLabel("Flip horizontal", { exact: true }).check();
  await page.getByLabel("Flip vertical", { exact: true }).check();
  await page.getByLabel("Brightness", { exact: true }).fill("120");
  await page.getByLabel("Contrast", { exact: true }).fill("110");
  await page.getByLabel("Saturation", { exact: true }).fill("80");
  await page.getByLabel("Width", { exact: true }).fill("150");
  await page.getByLabel("Height", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Compare original" }).click();
  await page.getByRole("img", { name: "Original preview of Source" }).waitFor();
  await page.getByRole("button", { name: "Viewing original" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expectValue(page, "Height", "640");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expectValue(page, "Height", "100");
  assert.equal(libraryUploads, 0, "editing must not upload anything");
  record("crop, resize, rotate, flip, adjustments, comparison, undo and redo — nothing uploaded");
  await page.getByLabel("Project name", { exact: true }).fill("Verified photo");
  await page.getByRole("button", { name: "Save to projects", exact: true }).click();
  await page.getByText("Saved to your projects · revision 0", { exact: false }).first().waitFor();
  await page.waitForURL(/\/studio\/photo\/prj_[a-z0-9]+/);
  const photoProjectId = /prj_[a-z0-9]+/.exec(page.url())![0];
  assert.equal(libraryUploads, 1, "the original is uploaded exactly once, privately");
  await page.reload();
  await page.getByRole("img", { name: "Edited preview of Verified photo", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Width", { exact: true }).inputValue(), "150");
  assert.equal(await page.getByLabel("Crop width", { exact: true }).inputValue(), "300");
  assert.equal(await page.getByLabel("Flip horizontal").isChecked(), true);
  const library = await ctx.request.get(`${base}/api/library`).then(r => r.json());
  assert.equal(library.assets.length, 1);
  assert.equal(library.assets[0].origin, "photo-original");
  assert.deepEqual(library.assets[0].usedBy.map((u: { id: string }) => u.id), [photoProjectId]);
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(`${base}${library.assets[0].url}`)).status(), 401);
  await anonymous.close();
  await page.getByLabel("Brightness", { exact: true }).fill("90");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved to your projects · revision 1", { exact: false }).first().waitFor();
  assert.equal(libraryUploads, 1, "re-saving reuses the stored original");
  record("photo project saved privately, reopened from the server with its full recipe, re-saved without re-upload");
  await page.getByLabel("Brightness", { exact: true }).fill("120");
  await page.getByLabel("Export format", { exact: true }).selectOption("image/png");
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const png = await inspectDownload(page);
  assert.equal(png.width, 150); assert.equal(png.height, 100); assert.equal(png.mime, "image/png");
  assert.equal(mediaUploads, 0, "Local editing/export must not upload media");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG", exact: true }).click();
  const download = await downloadEvent;
  await download.saveAs(`${output}/verified.png`);
  assert.equal(readFileSync(`${output}/verified.png`).length, png.size);
  record("verified PNG output and real download", { bytes: png.size, width: png.width, height: png.height, uploads: mediaUploads });
  await page.getByLabel("Export format", { exact: true }).selectOption("image/jpeg");
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const jpeg = await inspectDownload(page);
  assert.equal(jpeg.mime, "image/jpeg"); assert.equal(jpeg.width, 150);
  await page.getByLabel("Export format", { exact: true }).selectOption("image/webp");
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const webp = await inspectDownload(page);
  assert.equal(webp.mime, "image/webp");
  assert.equal(webp.width, 150); assert.equal(webp.height, 100);
  record("verified JPEG and WebP export bytes", { jpegBytes: jpeg.size, webpBytes: webp.size });
  page.once("dialog", dialog => void dialog.accept());
  await page.getByLabel("Destination website", { exact: true }).selectOption(siteId);
  await page.getByRole("button", { name: "Save export to website", exact: true }).click();
  await page.getByText("Export saved to your website media library.", { exact: false }).first().waitFor();
  assert.equal(mediaUploads, 1);
  const assets = await ctx.request.get(`${base}/api/sites/${siteId}/assets`).then(r => r.json());
  assert.equal(assets.assets.length, 1); assert.equal(assets.assets[0].mimeType, "image/webp");
  record("explicit exported-copy upload reused existing owned website media");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expectValue(page, "Width", "640");
  await expectValue(page, "Crop width", "640");
  assert.equal(await page.getByLabel("Flip horizontal").isChecked(), false);
  record("reset preserves immutable source");
  await page.getByLabel("Export format", { exact: true }).selectOption("image/png");
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const transparent = await inspectDownload(page);
  assert.equal(transparent.bottomRight[3], 0);
  await page.getByLabel("Flip horizontal", { exact: true }).check();
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const flipped = await inspectDownload(page);
  assert.ok(flipped.topLeft[2]! > flipped.topLeft[0]!);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByLabel("Flip vertical", { exact: true }).check();
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const flippedY = await inspectDownload(page);
  assert.ok(flippedY.topLeft[1]! > 80);
  await page.getByLabel("Brightness", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const dark = await inspectDownload(page);
  assert.deepEqual(dark.topLeft, [0, 0, 0, 255]);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "90°", exact: true }).click();
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const rotated = await inspectDownload(page);
  assert.equal(rotated.width, 480); assert.equal(rotated.height, 640);
  assert.ok(rotated.topLeft[1]! > 80);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByLabel("Export format", { exact: true }).selectOption("image/jpeg");
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const white = await inspectDownload(page);
  assert.ok(white.bottomRight.slice(0, 3).every(value => value >= 250));
  record("rendered pixels verify flips, rotation, adjustments, PNG alpha and JPEG white flattening");
  await page.goto(`${base}/studio/compress`);
  await page.getByLabel("Choose a PNG, JPEG or static WebP image").setInputFiles({ name: "Compress.png", mimeType: "image/png", buffer: source });
  await page.getByRole("img", { name: "Edited preview of Compress" }).waitFor();
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const compressed = await inspectDownload(page);
  assert.equal(compressed.width, 640); assert.equal(compressed.height, 480);
  assert.ok(compressed.size < source.length);
  await page.getByText(/% smaller against the original file/).waitFor();
  record("compressor shows a genuinely smaller encoded file", { originalBytes: source.length, outputBytes: compressed.size });
  for (const encoded of [jpeg, webp]) {
    const name = encoded.mime === "image/jpeg" ? "Reload-JPEG" : "Reload-WebP";
    await page.getByLabel("Choose a PNG, JPEG or static WebP image").setInputFiles({
      name: `${name}.${encoded.mime === "image/jpeg" ? "jpg" : "webp"}`, mimeType: encoded.mime, buffer: Buffer.from(encoded.bytes),
    });
    await page.getByRole("img", { name: `Edited preview of ${name}`, exact: true }).waitFor();
    await page.getByText(`Original 150 × 100`, { exact: false }).waitFor();
  }
  record("JPEG and static WebP inputs decode successfully");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/02-photo-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: `${output}/03-photo-desktop.png`, fullPage: true });
  record("mobile and desktop photo layout");

  /* ------------------------------------------------------------------ library */
  await page.goto(`${base}/library`);
  await page.getByRole("heading", { name: "Your private images" }).waitFor();
  await page.getByRole("button", { name: /Verified-photo\.png.*1 use/ }).click();
  await page.getByRole("dialog").getByText("Verified photo").waitFor();
  await page.getByLabel("Alt text").fill("A test gradient");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByText("Details saved").waitFor();
  page.once("dialog", dialog => void dialog.accept());
  await page.getByLabel("Copy to a website's media (becomes public)").selectOption(siteId);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await page.getByText("Copied to the website's media library").waitFor();
  const siteAssets = await ctx.request.get(`${base}/api/sites/${siteId}/assets`).then(r => r.json());
  assert.equal(siteAssets.assets.length, 2);
  assert.equal(siteAssets.assets[0].folder, "From asset library");
  assert.equal((await ctx.request.get(`${base}${siteAssets.assets[0].url}`)).status(), 200);
  await page.keyboard.press("Escape");
  await page.getByLabel("Add PNG, JPEG or static WebP images to your library").setInputFiles([
    { name: "Alpha-unused.png", mimeType: "image/png", buffer: source },
    { name: "Zulu-unused.png", mimeType: "image/png", buffer: source },
  ]);
  await page.getByText("2 files added to your library", { exact: false }).waitFor();
  await page.getByLabel("Find an image").fill("test gradient");
  await page.getByRole("button", { name: /Verified-photo\.png/ }).waitFor();
  assert.equal(await page.getByRole("list", { name: "Library files" }).getByRole("listitem").count(), 1);
  await page.getByLabel("Find an image").fill("no-such-library-match");
  await page.getByRole("heading", { name: "No matching images" }).waitFor();
  await page.getByLabel("Find an image").fill("");
  await page.getByLabel("Usage").selectOption("unused");
  const unusedCards = page.getByRole("list", { name: "Library files" }).getByRole("listitem");
  await unusedCards.nth(1).waitFor();
  assert.equal(await unusedCards.count(), 2);
  await page.getByLabel("Sort by").selectOption("name-desc");
  const namesDesc = (await page.locator('ul[aria-label="Library files"] strong').allTextContents()).map((name) => name.trim());
  assert.deepEqual(namesDesc.slice(0, 2), ["Zulu-unused.png", "Alpha-unused.png"]);
  await page.getByLabel("Sort by").selectOption("name-asc");
  const namesAsc = (await page.locator('ul[aria-label="Library files"] strong').allTextContents()).map((name) => name.trim());
  assert.deepEqual(namesAsc.slice(0, 2), ["Alpha-unused.png", "Zulu-unused.png"]);
  await page.getByLabel("Find an image").fill("alpha");
  await page.getByRole("button", { name: /Alpha-unused\.png/ }).waitFor();
  await page.goto(`${base}/studio/design`);
  await page.getByRole("heading", { name: "Start a fixed-size design" }).waitFor();
  await page.goto(`${base}/library`);
  await page.getByRole("heading", { name: "Your private images" }).waitFor();
  await page.getByRole("button", { name: /Verified-photo\.png/ }).waitFor();
  assert.equal(await page.getByLabel("Find an image").inputValue(), "");
  assert.equal(await page.getByLabel("Usage").inputValue(), "all");
  assert.equal(await page.getByLabel("Sort by").inputValue(), "newest");
  record("asset library search, usage filters and sorting work; controls reset after navigation");
  await page.screenshot({ path: `${output}/04-library.png`, fullPage: true });
  record("asset library shows usage, edits metadata and copies to public website media only on request");

  /* ------------------------------------------------------------------- design */
  await page.goto(`${base}/studio/design`);
  await page.getByRole("button", { name: /Instagram post/ }).click();
  await page.waitForURL(/\/studio\/design\/prj_[a-z0-9]+/);
  const designId = /prj_[a-z0-9]+/.exec(page.url())![0];
  await page.getByText("1080 × 1080px", { exact: false }).first().waitFor();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Content").fill("Hello BINHI");
  await page.getByLabel("Colour", { exact: true }).fill("#ff0000");
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await page.getByLabel("Fill", { exact: true }).fill("#0000ff");
  await page.getByLabel("X", { exact: true }).fill("0");
  await page.getByLabel("Y", { exact: true }).fill("0");
  await page.getByLabel("Width", { exact: true }).fill("200");
  await page.getByLabel("Height", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Image", exact: true }).click();
  await page.getByRole("dialog", { name: "Add an image" }).getByRole("button", { name: /Use Verified-photo/ }).click();
  await page.locator('.design-save[data-state="saved"]').waitFor();
  assert.equal(await page.locator(".layer-list .layer-row").count(), 3);
  const saved = await ctx.request.get(`${base}/api/projects/${designId}`).then(r => r.json());
  assert.equal(saved.project.document.layers.length, 3);
  assert.equal(saved.project.document.layers[0].text, "Hello BINHI");
  assert.ok(saved.project.revision >= 1);
  // Drag the rectangle: select it in the layer list, then drag it on the artboard.
  await page.getByRole("button", { name: /^▭/ }).click();
  const rect = page.locator('.design-layer[data-layer-id]').nth(1);
  const box = (await rect.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 6 });
  await page.mouse.up();
  await page.locator('.design-save[data-state="saved"]').waitFor();
  const moved = await ctx.request.get(`${base}/api/projects/${designId}`).then(r => r.json());
  const rectLayer = moved.project.document.layers.find((l: { type: string }) => l.type === "rect");
  assert.ok(rectLayer.x > 100 && rectLayer.y > 50, `rectangle moved to ${rectLayer.x},${rectLayer.y}`);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.locator('.design-save[data-state="saved"]').waitFor();
  const undone = await ctx.request.get(`${base}/api/projects/${designId}`).then(r => r.json());
  assert.equal(undone.project.document.layers.find((l: { type: string }) => l.type === "rect").x, 0);
  record("design editor adds text, shape and library image, autosaves with revisions, drags and undoes");
  await page.getByRole("button", { name: "Export design", exact: true }).click();
  const designPng = await inspectDownload(page, "Export design");
  assert.equal(designPng.width, 1080); assert.equal(designPng.height, 1080); assert.equal(designPng.mime, "image/png");
  assert.deepEqual(designPng.topLeft.slice(0, 3), [0, 0, 255], "blue rectangle at the top-left corner");
  await page.getByLabel("Export format", { exact: true }).selectOption("image/jpeg");
  await page.getByRole("button", { name: "Export design", exact: true }).click();
  const designJpeg = await inspectDownload(page, "Export design");
  assert.equal(designJpeg.mime, "image/jpeg");
  record("design exports verified PNG and JPEG at native size", { pngBytes: designPng.size, jpegBytes: designJpeg.size });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".design-stage").waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "design editor fits a phone width");
  await page.screenshot({ path: `${output}/06-design-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.getByLabel("Template name").fill("Promo template");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Template \"Promo template\" saved").waitFor();
  await page.screenshot({ path: `${output}/05-design.png` });
  await page.goto(`${base}/templates`);
  await page.getByRole("heading", { name: "Promo template" }).waitFor();
  assert.ok((await page.getByRole("list", { name: "Templates", exact: true }).getByRole("listitem").count()) >= 6, "the six website starters are listed in the template library");
  await page.getByRole("button", { name: "Use template" }).click();
  await page.waitForURL(/\/studio\/design\/prj_[a-z0-9]+/);
  assert.notEqual(/prj_[a-z0-9]+/.exec(page.url())![0], designId);
  await page.locator(".layer-list .layer-row").nth(2).waitFor();
  assert.equal(await page.locator(".layer-list .layer-row").count(), 3);
  record("designs become editable templates that start new designs");

  /* --------------------------------------------------------------- brand kits */
  await page.goto(`${base}/brand-kits`);
  await page.getByLabel("Kit name").fill("Chaos kit");
  await page.getByLabel("Colour 1 hex").fill("#123456");
  await page.getByLabel("Heading font").selectOption("Playfair Display");
  await page.getByLabel("Tagline").fill("Complexity, Simplified.");
  await page.getByRole("button", { name: "Choose logo" }).click();
  await page.getByRole("dialog", { name: "Choose a logo" }).getByRole("button", { name: /Use Verified-photo/ }).click();
  await page.getByRole("button", { name: "Create brand kit" }).click();
  await page.getByText("Brand kit created").waitFor();
  await page.getByRole("list", { name: "Brand kits" }).getByRole("heading", { name: "Chaos kit" }).waitFor();
  const siteBefore = await ctx.request.get(`${base}/api/sites/${siteId}`).then(r => r.json());
  page.once("dialog", dialog => void dialog.accept());
  await page.getByLabel("Website to apply Chaos kit to").selectOption(siteId);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.getByText(/Applied to Studio owned destination/).waitFor();
  const siteAfter = await ctx.request.get(`${base}/api/sites/${siteId}`).then(r => r.json());
  assert.equal(siteAfter.site.revision, siteBefore.site.revision + 1);
  assert.equal(siteAfter.site.document.theme.colors.primary, "#123456");
  assert.equal(siteAfter.site.document.theme.fonts.heading, "Playfair Display");
  await page.goto(`${base}/studio/design/${designId}`);
  await page.getByLabel("Brand kit").selectOption({ label: "Chaos kit" });
  await page.getByRole("button", { name: /^▭/ }).click();
  await page.getByRole("button", { name: "Apply Primary" }).click();
  await page.locator('.design-save[data-state="saved"]').waitFor();
  const recoloured = await ctx.request.get(`${base}/api/projects/${designId}`).then(r => r.json());
  assert.equal(recoloured.project.document.layers.find((l: { type: string }) => l.type === "rect").fill, "#123456");
  record("brand kit created with a library logo, applied to a website theme as a revision and to a design layer");

  /* -------------------------------------------------------------- my projects */
  await page.goto(`${base}/projects`);
  await page.getByRole("heading", { name: "Everything you are working on" }).waitFor();
  const projectCards = page.getByRole("list", { name: "Projects" }).getByRole("listitem");
  await projectCards.nth(4).waitFor();
  assert.equal(await projectCards.count(), 5, "1 website + 1 photo + 2 designs + 1 template");
  await page.getByLabel("Find a project").fill("studio-owned-destination");
  await page.getByRole("list", { name: "Projects" }).getByRole("heading", { name: "Studio owned destination" }).waitFor();
  assert.equal(await page.getByRole("list", { name: "Projects" }).getByRole("listitem").count(), 1);
  await page.getByLabel("Find a project").fill("no-such-project-match");
  await page.getByRole("heading", { name: "No matching projects" }).waitFor();
  await page.getByLabel("Find a project").fill("");
  await projectCards.nth(4).waitFor();
  await page.getByLabel("Sort by").selectOption("name-asc");
  const projectNamesAsc = (await page.locator('ul[aria-label="Projects"] h2').allTextContents()).map((name) => name.trim());
  const expectedProjectNamesAsc = [...projectNamesAsc].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  assert.deepEqual(projectNamesAsc, expectedProjectNamesAsc);
  await page.getByLabel("Sort by").selectOption("name-desc");
  const projectNamesDesc = (await page.locator('ul[aria-label="Projects"] h2').allTextContents()).map((name) => name.trim());
  assert.deepEqual(projectNamesDesc, [...expectedProjectNamesAsc].reverse());
  record("project search, empty-state and sort controls narrow and reorder results");
  await page.getByRole("tab", { name: /^Templates/ }).click();
  await projectCards.nth(1).waitFor({ state: "detached" });
  assert.equal(await projectCards.count(), 1);
  await page.getByRole("tab", { name: /^Photos/ }).click();
  await page.getByRole("button", { name: "Delete Verified photo" }).click();
  await page.getByRole("button", { name: "Delete project" }).click();
  await page.getByText("was deleted").waitFor();
  const libraryAfter = await ctx.request.get(`${base}/api/library`).then(r => r.json());
  const original = libraryAfter.assets.find((asset: { id: string }) => asset.id === library.assets[0].id);
  assert.ok(original, "the original stays in the library");
  assert.ok(!original.usedBy.some((u: { id: string }) => u.id === photoProjectId));
  record("My Projects merges websites and creative projects; deleting a project keeps its library original");
  assert.deepEqual(pageErrors, []);

  /* ---------------------------------------------------------------- isolation */
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(/\/signin/);
  await signup(ctx, page);
  await page.goto(`${base}/projects`);
  await page.getByRole("heading", { name: "Nothing planted yet" }).waitFor();
  for (const url of [`/api/projects/${designId}`, `/api/library/${library.assets[0].id}/file`, `/api/sites/${siteId}/assets`]) {
    assert.equal((await ctx.request.get(`${base}${url}`)).status(), 404, url);
  }
  assert.equal((await ctx.request.get(`${base}/api/brand-kits`).then(r => r.json())).kits.length, 0);
  record("projects, private files, media and brand kits are invisible to another account");
  succeeded = true;
} finally {
  if (!succeeded) {
    console.error(serverLog.slice(-1200));
    await currentPage?.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  }
  // API deletes only accounts created by this journey; never truncates an app database.
  let cleanupFailed = false;
  for (const { ctx, email } of cleanup) {
    try {
      const login = await ctx.request.post(`${base}/api/auth/login`, { headers: H, data: { email, password } });
      assert.equal(login.status(), 200);
      const me = await ctx.request.get(`${base}/api/auth/me`).then(r => r.json());
      assert.equal(me.user.email, email);
      const deleted = await ctx.request.delete(`${base}/api/auth/account`, { headers: H, data: { password } });
      assert.equal(deleted.status(), 200);
    } catch { cleanupFailed = true; console.error("A disposable studio test account could not be cleaned up."); }
  }
  if (cleanupFailed) succeeded = false;
  writeFileSync(`${output}/evidence.json`, JSON.stringify({ passed: succeeded, steps }, null, 2));
  await browser?.close();
  server.kill("SIGTERM");
}
assert.ok(succeeded, "Studio journey or cleanup failed.");
console.log(`Studio journey passed: ${steps.length} checks`);
