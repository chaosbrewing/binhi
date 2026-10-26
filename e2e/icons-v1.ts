/** Canonical S/L/C/O browser and export journey. Disposable local database only. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, type BrowserContext } from "playwright";
import { getTestDatabaseUrl } from "../tests/test-database.js";
import { runMigrations } from "../src/server/db/migrate.js";
import { getIcon } from "../src/core/icons/registry.js";

if (process.env.BINHI_E2E_BASE || process.argv.includes("--remote")) throw new Error("Local disposable database only");
const database = getTestDatabaseUrl();
await runMigrations(database);
const base = "http://127.0.0.1:4314";
const output = "e2e/screenshots/icons-v1";
mkdirSync(output, { recursive: true });
const gbm = (existsSync("/nix/store") ? readdirSync("/nix/store") : []).filter(n => n.includes("mesa-libgbm")).map(n => `/nix/store/${n}/lib`).find(d => existsSync(`${d}/libgbm.so.1`));
if (gbm) process.env.LD_LIBRARY_PATH = `${gbm}:${process.env.LD_LIBRARY_PATH ?? ""}`;
const server = spawn(process.execPath, ["--import", "tsx", "src/server/start.ts"], {
  env: { ...process.env, NODE_ENV: "test", BINHI_DATABASE_URL: database, BINHI_PORT: "4314",
    BINHI_PUBLIC_URL: base, BINHI_SESSION_SECRET: "isolated-v1-test-only", BINHI_SERVE_BUILT_CLIENT: "true" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", d => { logs += d; });
server.stderr.on("data", d => { logs += d; });
const H = { "x-binhi-request": "editor" };
const password = randomUUID() + randomUUID();
const email = `canonical-${randomUUID()}@example.invalid`;
const aliases = ["ICN-001", "ICN-003", "ICN-035", "ICN-007"];
const steps: string[] = [];
const exports: unknown[] = [];
const pass = (s: string) => { steps.push(s); console.log(`PASS ${s}`); };
let ctx: BrowserContext | undefined;
let registered = false;
let ok = false;
const browser = await chromium.launch({ headless: true });
try {
  const deadline = Date.now() + 30_000;
  while (!(await fetch(`${base}/api/health`).then(r => r.ok).catch(() => false))) {
    if (Date.now() > deadline) throw new Error(`Test server failed: ${logs.slice(-1000)}`);
    await new Promise(r => setTimeout(r, 150));
  }
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const signup = await ctx.request.post(`${base}/api/auth/signup`, { headers: H, data: { email, password, displayName: "Canonical reviewer" } });
  assert.equal(signup.status(), 200);
  registered = true;
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${base}/studio/design`);
  await page.getByRole("button", { name: /Instagram post/ }).click();
  await page.waitForURL(/\/studio\/design\/prj_[a-z0-9]+/);
  const id = /prj_[a-z0-9]+/.exec(page.url())![0];
  for (const [index, alias] of aliases.entries()) {
    const d = getIcon(alias)!;
    await page.getByRole("button", { name: "Icon", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Insert an icon" });
    await dialog.getByLabel("Search icons", { exact: true }).fill(alias);
    await dialog.locator(`button[data-icon-id="${d.id}"]`).click();
    await dialog.getByRole("button", { name: `Add ${d.name} to favorites` }).click();
    await dialog.getByLabel("Custom icon size in pixels").fill("240");
    await dialog.getByLabel("Custom colour", { exact: true }).fill("#164e63");
    if (d.variants.includes("duotone")) await dialog.getByLabel("Icon style", { exact: true }).selectOption("duotone");
    await dialog.getByRole("button", { name: "Insert icon", exact: true }).click();
    await page.getByLabel("X", { exact: true }).fill(String(index % 2 ? 540 : 140));
    await page.getByLabel("Y", { exact: true }).fill(String(index < 2 ? 140 : 540));
    await page.getByLabel("Stroke weight", { exact: true }).fill("1.5");
    await page.locator('.design-save[data-state="saved"]').waitFor();
    pass(`${alias} (${d.classification}) searched, favorited, inserted and customized through the shared picker`);
  }
  let project = (await ctx.request.get(`${base}/api/projects/${id}`).then(r => r.json())).project;
  assert.deepEqual(project.document.layers.map((l: { icon: string }) => l.icon), aliases.map(a => getIcon(a)!.id));
  await page.reload();
  await page.locator(".design-layer svg").nth(3).waitFor();
  await page.getByRole("button", { name: "Icon", exact: true }).click();
  const favorites = page.getByRole("dialog", { name: "Insert an icon" });
  await favorites.getByRole("button", { name: /^Favorites \(4\)/ }).click();
  assert.equal(await favorites.locator("button[data-icon-cell]").count(), 4);
  await page.keyboard.press("Escape");
  pass("canonical persistent ids, settings and favorites survive save/reopen");
  await page.goto(`${base}/brand-kits`);
  await page.getByLabel("Kit name").fill("Canonical kit");
  await page.getByLabel("Colour 1 hex").fill("#164e63");
  await page.getByRole("button", { name: "Create brand kit" }).click();
  await page.getByText("Brand kit created").waitFor();
  await page.goto(`${base}/studio/design/${id}`);
  await page.getByLabel("Brand kit").selectOption({ label: "Canonical kit" });
  await page.locator(".layer-list .layer-name").first().click();
  await page.getByRole("button", { name: "Apply Primary", exact: true }).click();
  await page.getByLabel("Rotation°").fill("30");
  await page.getByLabel("Rotation°").blur();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.getByLabel("Rotation°").inputValue(), "0");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  assert.equal(await page.getByLabel("Rotation°").inputValue(), "30");
  await page.locator('.design-save[data-state="saved"]').waitFor();
  pass("brand-kit colour and undo/redo work on the original-drawing layer");
  await page.screenshot({ path: `${output}/canonical-design.png` });

  for (const [format, extension] of [["image/png", "png"], ["image/jpeg", "jpg"], ["image/svg+xml", "svg"]]) {
    if (extension === "svg") await page.getByRole("button", { name: "Export SVG", exact: true }).click();
    else {
      await page.getByLabel("Export format").selectOption(format!);
      await page.getByRole("button", { name: "Export design", exact: true }).click();
    }
    await page.locator(`a[download$=".${extension}"]`).waitFor();
    const result = await page.evaluate(async ext => {
      const a = document.querySelector<HTMLAnchorElement>(`a[download$=".${ext}"]`)!;
      const blob = await (await fetch(a.href)).blob();
      const image = new Image();
      image.src = URL.createObjectURL(blob);
      try {
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const c = canvas.getContext("2d")!;
        c.drawImage(image, 0, 0);
        const ink = [];
        for (const [x, y] of [[140, 140], [540, 140], [140, 540], [540, 540]]) {
          const bytes = c.getImageData(x!, y!, 240, 240).data;
          let n = 0;
          for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3]! > 0 && bytes[i]! < 180) n++;
          ink.push(n);
        }
        return { mime: blob.type, size: blob.size, width: image.naturalWidth, height: image.naturalHeight, ink,
          svg: ext === "svg" ? await blob.text() : null };
      } finally { URL.revokeObjectURL(image.src); }
    }, extension);
    assert.equal(result.mime, format);
    assert.deepEqual([result.width, result.height], [1080, 1080]);
    assert.ok(result.ink.every(n => n > 100), `Every S/L/C/O glyph must export pixels: ${result.ink}`);
    if (extension === "svg") {
      assert.ok(result.svg?.includes("<path"));
      assert.ok(!result.svg?.includes("<use") && !result.svg?.includes("<image"), "vectors, not external references or embedded raster");
    }
    exports.push({ ...result, svg: undefined });
  }
  pass("PNG/JPEG/SVG exports decode at native dimensions and contain real pixels for all four source classes");
  // Insert all aliases using the canonical document operations, then publish ONLY to this disposable server.
  const site = (await ctx.request.post(`${base}/api/sites`, { headers: H, data: { name: "Canonical icon test", templateId: "blank" } }).then(r => r.json())).site;
  const ops = aliases.map(alias => ({ type: "insertComponent", target: { parentId: site.document.pages[0].sections[0].id }, componentType: "icon", props: { icon: alias, size: 48 } }));
  assert.equal((await ctx.request.post(`${base}/api/sites/${site.id}/ops`, { headers: H, data: { baseRevision: 0, batchId: randomUUID(), ops } })).status(), 200);
  const live = await ctx.request.post(`${base}/api/sites/${site.id}/publish`, { headers: H });
  assert.equal(live.status(), 200);
  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`${base}/s/${site.slug}/`);
    for (const alias of aliases) await publicPage.locator(`[data-icon="${getIcon(alias)!.id}"] svg`).waitFor();
    await publicPage.screenshot({ path: `${output}/canonical-public-mobile.png` });
    assert.equal((await anonymous.request.get(`${base}/api/projects/${id}`)).status(), 401);
  } finally { await anonymous.close(); }
  assert.equal((await ctx.request.post(`${base}/api/sites/${site.id}/unpublish`, { headers: H })).status(), 200);
  assert.equal((await fetch(`${base}/s/${site.slug}/`)).status, 410);
  pass("canonical S/L/C/O icons publish anonymously at phone width, stay private in editing, and unpublish");
  project = (await ctx.request.get(`${base}/api/projects/${id}`).then(r => r.json())).project;
  assert.ok(!JSON.stringify(project.document).includes("<svg"));
  assert.deepEqual(errors, []);
  ok = true;
} finally {
  if (registered && ctx) {
    assert.equal((await ctx.request.delete(`${base}/api/auth/account`, { headers: H, data: { password } })).status(), 200);
  }
  writeFileSync(`${output}/evidence.json`, JSON.stringify({ passed: ok, aliases, steps, exports, artworkApproval: "pending" }, null, 2));
  await browser.close();
  server.kill("SIGTERM");
}
assert.ok(ok);
console.log(`Canonical icon journey passed: ${steps.length} checks`);
