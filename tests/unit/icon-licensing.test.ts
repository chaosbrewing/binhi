import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ICON_LIST, getIcon } from "../../src/core/icons/index.js";
import { applyOperation, createSiteDocument, renderPage, type RenderOptions } from "../../src/core/index.js";
import { resolveIconShapeSync } from "../../src/core/icons/shapes-all.js";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const notices = read("public/third-party-notices.txt");
const doc = read("docs/ICON_LICENSES.md");
const inventory = read("docs/ICON_INVENTORY.md");
const squash = (s: string) => s.replace(/\s+/g, " ");

describe("icon licensing obligations", () => {
  it("ships the Lucide ISC and Feather MIT notices verbatim with the app", () => {
    const n = squash(notices);
    for (const required of [
      "ISC License",
      "Copyright (c) 2026 Lucide Icons and Contributors",
      "Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.",
      "THE SOFTWARE IS PROVIDED \"AS IS\" AND THE AUTHOR DISCLAIMS ALL WARRANTIES",
      "The MIT License (MIT) (for the icons listed above)",
      "Copyright (c) 2013-present Cole Bemis",
      "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.",
      "The following Lucide icons are derived from the Feather project:",
    ]) expect(n, required).toContain(required);
  });

  it("keeps the same notices in the repository documentation", () => {
    const d = squash(doc);
    expect(d).toContain("Copyright (c) 2026 Lucide Icons and Contributors");
    expect(d).toContain("Copyright (c) 2013-present Cole Bemis");
    expect(d).toContain("provided that the above copyright notice and this permission notice appear in all copies");
    expect(d).toContain("shall be included in all copies or substantial portions of the Software");
  });

  it("classifies every icon's licence and keeps the inventory totals in step with the registry", () => {
    const original = ICON_LIST.filter((d) => d.source.kind === "original");
    const feather = ICON_LIST.filter((d) => d.licence.spdx === "ISC AND MIT");
    const isc = ICON_LIST.filter((d) => d.licence.spdx === "ISC");
    expect([isc.length, feather.length, original.length]).toEqual([124, 20, 106]);
    expect(original.every((d) => d.licence.spdx === "LicenseRef-BINHI")).toBe(true);
    expect(inventory).toContain("S=75, L=70, C=80, O=25");
    // renamed Lucide glyphs that equal a Feather icon are still marked (detected by geometry, not by name)
    for (const slug of ["more-options", "error", "warning-triangle", "help-circle"]) {
      expect(getIcon(`binhi.icon.${slug}`)?.licence.spdx, slug).toBe("ISC AND MIT");
    }
  });

  it("puts the notice in published pages that inline Lucide artwork, and only those", () => {
    const opts: RenderOptions = { mode: "publish", baseHref: "/s/x/", formAction: () => "#", iconShape: resolveIconShapeSync };
    const base = createSiteDocument("blank", "x");
    const sectionId = base.pages[0]!.sections[0]!.id;
    const withIcon = applyOperation(base, { type: "insertComponent", target: { parentId: sectionId }, componentType: "icon", props: { icon: "binhi.icon.camera" } }).document;
    expect(renderPage(withIcon, withIcon.pages[0]!.id, opts)).toContain("Lucide (ISC)");
    expect(renderPage(withIcon, withIcon.pages[0]!.id, opts)).toContain("/third-party-notices.txt");
    expect(renderPage(base, base.pages[0]!.id, opts)).not.toContain("Lucide");
    const original = applyOperation(base, { type: "insertComponent", target: { parentId: sectionId }, componentType: "icon", props: { icon: "binhi.icon.opacity" } }).document;
    expect(renderPage(original, original.pages[0]!.id, opts)).not.toContain("Lucide");
  });
});
