/**
 * Responsive coherence checks for the Studio homepage.
 *
 * Uses the real client render and mocks only API responses so this can run
 * without a local database server.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const base = process.env.BINHI_RESPONSIVE_BASE ?? "http://127.0.0.1:4321";
const shotsDir = process.env.BINHI_RESPONSIVE_SHOTS ?? path.join(root, "e2e", "screenshots", "responsive-homepage");

mkdirSync(shotsDir, { recursive: true });

const viewports = [
  { name: "mobile", width: 375, height: 812, expectedColumns: 1 },
  { name: "tablet", width: 768, height: 1024, expectedColumns: 2 },
  { name: "desktop", width: 1280, height: 800, expectedColumns: 3 },
] as const;

const mockState = {
  user: { id: "usr_responsive", email: "responsive@example.com", displayName: "Responsive Tester" },
  sites: [
    { id: "site_demo", name: "Binhi Demo Site", slug: "binhi-demo-site", templateId: "creative-studio", revision: 12, livePublicationId: null, createdAt: "2026-10-27T12:00:00.000Z", updatedAt: "2026-10-28T08:00:00.000Z", publication: null, liveUrl: null },
  ],
  projects: [
    { id: "prj_design_a", kind: "design", name: "Hero Poster", revision: 4, schemaVersion: 1, createdAt: "2026-10-26T10:00:00.000Z", updatedAt: "2026-10-28T07:00:00.000Z", meta: { width: 1080, height: 1080, layers: 9 } },
    { id: "prj_photo_a", kind: "photo", name: "Beach Edit", revision: 2, schemaVersion: 1, createdAt: "2026-10-26T11:00:00.000Z", updatedAt: "2026-10-28T07:30:00.000Z", meta: { width: 2400, height: 1600, sourceAssetId: "asset_1" } },
  ],
  designTemplates: [
    { id: "prj_tpl_1", kind: "design-template", name: "Event Poster", revision: 1, schemaVersion: 1, createdAt: "2026-10-20T10:00:00.000Z", updatedAt: "2026-10-28T07:10:00.000Z", meta: { width: 1080, height: 1350, layers: 7 } },
  ],
  templates: [
    { id: "creative-studio", name: "Creative studio", category: "Portfolio", description: "Showcase your work with calm spacing.", swatch: ["#1f6f4a", "#dff1e6", "#ffffff"] },
    { id: "travel-blog", name: "Travel blog", category: "Blog", description: "Story-first editorial layout.", swatch: ["#355ca8", "#dbe9ff", "#ffffff"] },
  ],
};

function jsonResponse(body: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();

      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));

      await page.route("**/api/**", async (route) => {
        const url = new URL(route.request().url());
        const key = `${route.request().method()} ${url.pathname}${url.search}`;
        if (key === "GET /api/auth/me") return route.fulfill(jsonResponse({ user: mockState.user, signupEnabled: true }));
        if (key === "GET /api/sites") return route.fulfill(jsonResponse({ sites: mockState.sites }));
        if (key === "GET /api/projects") return route.fulfill(jsonResponse({ projects: mockState.projects }));
        if (key === "GET /api/projects?kind=design-template") return route.fulfill(jsonResponse({ projects: mockState.designTemplates }));
        if (key === "GET /api/templates") return route.fulfill(jsonResponse({ templates: mockState.templates }));
        if (key === "POST /api/auth/logout") return route.fulfill(jsonResponse({ ok: true }));
        return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: key } }) });
      });

      await page.goto(`${base}/`, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: /What will you create today/i }).waitFor();

      const metrics = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>(".studio-home-main");
        const cards = Array.from(document.querySelectorAll<HTMLElement>(".studio-home-grid .studio-home-card"));
        const cardTopRows = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top))).size;
        const inferredColumns = cards.length > 0 ? Math.round(cards.length / cardTopRows) : 0;
        const cta = document.querySelector<HTMLElement>(".studio-home-cta");
        const ctaButton = cta?.querySelector<HTMLElement>(".btn");
        const ctaHeadline = cta?.querySelector<HTMLElement>("h2");
        const menuButton = document.querySelector<HTMLElement>(".studio-shell-menu");
        const collapseButton = document.querySelector<HTMLElement>(".studio-sidebar-collapse");
        const sideNav = document.querySelector<HTMLElement>(".studio-sidebar");
        const chips = Array.from(document.querySelectorAll<HTMLElement>(".studio-home-chip"));
        const templateRow = document.querySelector<HTMLElement>(".studio-template-row");
        const templateCards = Array.from(document.querySelectorAll<HTMLElement>(".studio-template-card"));
        const promptInput = document.querySelector<HTMLInputElement>("#home-create-prompt");
        const promptButton = document.querySelector<HTMLElement>(".studio-home-send");
        const h1 = document.querySelector<HTMLElement>(".studio-home-title");
        const categoryChips = Array.from(document.querySelectorAll<HTMLElement>(".studio-home-category-chip"));
        const categoriesTopRows = new Set(categoryChips.map((chip) => Math.round(chip.getBoundingClientRect().top))).size;
        const unlabeledIconButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button.icon-btn"))
          .filter((button) => button.querySelector("svg") && !button.textContent?.trim() && !button.getAttribute("aria-label"))
          .length;
        const headingLevels = Array.from(document.querySelectorAll("h1,h2,h3")).map((heading) => Number(heading.tagName.slice(1)));
        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          mainWidth: main?.getBoundingClientRect().width ?? 0,
          inferredColumns,
          cardCount: cards.length,
          promptRowExists: !!promptInput && !!promptButton,
          promptInputHeight: promptInput?.getBoundingClientRect().height ?? 0,
          promptButtonHeight: promptButton?.getBoundingClientRect().height ?? 0,
          heroTitleSize: h1 ? Number.parseFloat(getComputedStyle(h1).fontSize) : 0,
          chipCount: chips.length,
          chipRows: new Set(chips.map((chip) => Math.round(chip.getBoundingClientRect().top))).size,
          templateRowOverflows: !!templateRow && templateRow.scrollWidth > templateRow.clientWidth,
          firstTemplateOffset: templateRow && templateCards[0] ? Math.round(templateCards[0].getBoundingClientRect().left - templateRow.getBoundingClientRect().left) : null,
          templateScrollLeft: templateRow?.scrollLeft ?? 0,
          templateDirection: templateRow ? getComputedStyle(templateRow).direction : "n/a",
          templateWidth: templateRow?.clientWidth ?? 0,
          templateScrollWidth: templateRow?.scrollWidth ?? 0,
          documentDirection: getComputedStyle(document.documentElement).direction,
          categoryRows: categoriesTopRows,
          menuVisible: !!menuButton && getComputedStyle(menuButton).display !== "none",
          collapseVisible: !!collapseButton && getComputedStyle(collapseButton).display !== "none",
          sideNavPinned: !!sideNav && getComputedStyle(sideNav).position !== "fixed",
          ctaStacked: !!ctaButton && !!ctaHeadline && ctaButton.getBoundingClientRect().top > ctaHeadline.getBoundingClientRect().bottom,
          ctaInline: !!ctaButton && !!ctaHeadline && ctaButton.getBoundingClientRect().left > ctaHeadline.getBoundingClientRect().right,
          mainLandmarks: document.querySelectorAll("main").length,
          navLandmarks: document.querySelectorAll("nav").length,
          unlabeledIconButtons,
          headingLevels,
        };
      });

      await page.keyboard.press("Tab");
      const firstFocusedRole = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active || active === document.body) return "none";
        return active.getAttribute("aria-label") ?? active.textContent?.trim() ?? active.tagName.toLowerCase();
      });

      console.log(`[${viewport.name}:raw]`, JSON.stringify(metrics));
      assert.ok(metrics.cardCount >= 9, `${viewport.name}: feature cards render`);
      assert.equal(metrics.promptRowExists, true, `${viewport.name}: prompt row renders`);
      assert.ok(metrics.promptInputHeight >= 40, `${viewport.name}: prompt input remains touch-friendly`);
      assert.ok(metrics.promptButtonHeight >= 40, `${viewport.name}: prompt submit remains touch-friendly`);
      assert.ok(metrics.heroTitleSize >= 30, `${viewport.name}: hero title remains legible`);
      assert.ok(metrics.scrollWidth <= viewport.width, `${viewport.name}: no horizontal document overflow`);
      assert.equal(metrics.inferredColumns, viewport.expectedColumns, `${viewport.name}: feature card columns are coherent`);
      assert.ok(metrics.chipCount === 5, `${viewport.name}: quick action chips render completely`);
      assert.ok(metrics.categoryRows >= 1, `${viewport.name}: category chip section renders`);
      assert.equal(metrics.mainLandmarks, 1, `${viewport.name}: single main landmark`);
      assert.ok(metrics.navLandmarks >= 1, `${viewport.name}: navigation landmarks present`);
      assert.equal(metrics.unlabeledIconButtons, 0, `${viewport.name}: icon-only buttons are labeled`);
      assert.ok(metrics.headingLevels[0] === 1, `${viewport.name}: heading hierarchy starts with h1`);
      assert.notEqual(firstFocusedRole, "none", `${viewport.name}: keyboard focus moves on tab`);

      if (viewport.name === "mobile") {
        assert.equal(metrics.menuVisible, true, "mobile: menu button visible");
        assert.equal(metrics.collapseVisible, false, "mobile: desktop collapse control hidden");
        assert.equal(metrics.ctaStacked, true, "mobile: CTA stacks below copy");
        const menu = page.getByRole("button", { name: "Open navigation menu" });
        await menu.click();
        assert.equal(await menu.getAttribute("aria-expanded"), "true", "mobile: menu reports open state");
        await page.getByRole("navigation", { name: "Primary navigation" }).getByText("Today", { exact: true }).waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await menu.getAttribute("aria-expanded"), "false", "mobile: Escape closes menu");
      } else if (viewport.name === "tablet") {
        assert.equal(metrics.menuVisible, true, "tablet: menu button visible in collapsible nav mode");
        assert.equal(metrics.collapseVisible, false, "tablet: desktop collapse control hidden");
        assert.equal(metrics.templateRowOverflows, true, "tablet: templates row remains horizontally browsable");
      } else {
        assert.equal(metrics.menuVisible, false, "desktop: menu button hidden");
        assert.equal(metrics.collapseVisible, true, "desktop: collapse control visible");
        assert.equal(metrics.sideNavPinned, true, "desktop: sidebar pinned");
        assert.equal(metrics.ctaInline, true, "desktop: CTA aligns beside copy");
        const collapse = page.getByRole("button", { name: "Collapse sidebar" });
        await collapse.click();
        const expand = page.getByRole("button", { name: "Expand sidebar" });
        await expand.waitFor();
        assert.equal(await expand.getAttribute("aria-expanded"), "false", "desktop: collapsed state is exposed");
        assert.equal(await page.getByRole("link", { name: "Today", exact: true }).count(), 1, "desktop: collapsed links retain accessible names");
      }

      assert.deepEqual(errors, [], `${viewport.name}: no console/page errors`);
      await page.screenshot({ path: path.join(shotsDir, `${viewport.name}.png`), fullPage: true });
      console.log(`[${viewport.name}]`, JSON.stringify(metrics));

      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
