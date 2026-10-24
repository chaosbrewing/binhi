/**
 * Studio regression journey. Disposable test DB only; never supports remote mode.
 * No production schema or data access. Screenshots/output stay in ignored e2e/screenshots.
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
async function inspectDownload(page: Page) {
  await page.getByRole("button", { name: "Export image", exact: true }).waitFor();
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
  await page.goto(base);
  await page.getByRole("heading", { name: "Pick up where you need to work" }).waitFor();
  for (const name of ["Website Builder", "Design & Templates", "Photo Editor", "Image Compressor", "File Converter", "Form Builder"]) {
    assert.equal(await page.getByRole("link", { name, exact: !["Design & Templates", "File Converter", "Form Builder"].includes(name) }).count(), 1);
  }
  await page.screenshot({ path: `${output}/01-home.png`, fullPage: true });
  for (const slug of ["design", "convert", "forms"]) {
    await page.goto(`${base}/studio/${slug}`);
    await page.getByText("Planned, not available yet", { exact: true }).waitFor();
  }
  await page.goto(`${base}/websites`);
  await page.getByRole("heading", { name: "Your websites", exact: true }).waitFor();
  record("studio navigation, website listing and honest planned tools");
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
  page.on("request", request => { if (request.method() === "POST" && request.url().endsWith(`/api/sites/${siteId}/assets`)) mediaUploads++; });
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
  assert.equal(await page.getByLabel("Height", { exact: true }).inputValue(), "640");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.equal(await page.getByLabel("Height", { exact: true }).inputValue(), "100");
  record("crop, resize, rotate, flip, adjustments, comparison, undo and redo");
  await page.getByLabel("Draft name", { exact: true }).fill("Verified local photo");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByText("Saved in this browser · revision 1.", { exact: false }).first().waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Verified local photo", exact: true }).click();
  await page.getByRole("img", { name: "Edited preview of Verified local photo", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Width", { exact: true }).inputValue(), "150");
  assert.equal(await page.getByLabel("Crop width", { exact: true }).inputValue(), "300");
  assert.equal(await page.getByLabel("Flip horizontal").isChecked(), true);
  record("versioned browser draft survives reload and reopens full recipe");
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
  assert.equal(await page.getByLabel("Width", { exact: true }).inputValue(), "640");
  assert.equal(await page.getByLabel("Crop width", { exact: true }).inputValue(), "640");
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
  // Same browser storage, different signed-in account: list must be owner-scoped.
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(/\/signin/);
  await signup(ctx, page);
  await page.goto(`${base}/studio/photo`);
  await page.getByText("No saved drafts in this browser yet.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Verified local photo", exact: true }).count(), 0);
  const foreign = await ctx.request.get(`${base}/api/sites/${siteId}/assets`);
  assert.equal(foreign.status(), 404);
  record("account-scoped browser drafts and existing server asset ownership");
  assert.deepEqual(pageErrors, []);
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
      const login = await ctx.request.post(`${base}/api/auth/login`, { headers: { "x-binhi-request": "editor" }, data: { email, password } });
      assert.equal(login.status(), 200);
      const me = await ctx.request.get(`${base}/api/auth/me`).then(r => r.json());
      assert.equal(me.user.email, email);
      const deleted = await ctx.request.delete(`${base}/api/auth/account`, { headers: { "x-binhi-request": "editor" }, data: { password } });
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
