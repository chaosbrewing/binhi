import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BinhiApp } from "../../src/server/app.js";
import { api, batch, createSite, signup, testApp, type Session } from "../helpers.js";
import { createDesignDocument, makeLayer } from "../../src/core/creative/index.js";
import { scanIconContent, summarize } from "../../scripts/icons/rollback-preflight.js";

let b: BinhiApp;
let s: Session;
beforeAll(async () => {
  b = await testApp();
  s = await signup(b.app);
});
afterAll(async () => b.close());

describe("rollback preflight (read-only)", () => {
  it("finds every website element and design layer that uses a library icon, and nothing else", async () => {
    const withIcon = await createSite(b.app, s, "blank", "Has icons");
    await createSite(b.app, s, "blank", "No icons");
    const sec = withIcon.document.pages[0]!.sections[0]!.id;
    await api(b.app, s).post(`/api/sites/${withIcon.id}/ops`, batch(0, [{ type: "insertComponent", target: { parentId: sec }, componentType: "icon", props: { icon: "binhi.icon.camera", variant: "duotone" } }, { type: "insertComponent", target: { parentId: sec }, componentType: "icon", props: { name: "mail" } }]));
    const doc = createDesignDocument(800, 800);
    await api(b.app, s).post("/api/projects", { kind: "design", name: "Icons", document: { ...doc, layers: [makeLayer("icon", doc, { icon: "binhi.icon.star" }), makeLayer("icon", doc, { icon: "binhi.icon.heart" }), makeLayer("rect", doc)] } });
    await api(b.app, s).post("/api/projects", { kind: "design", name: "Plain", document: { ...doc, layers: [makeLayer("rect", doc)] } });

    const scan = await scanIconContent(b.sql);
    expect(scan.sites.map((x) => x.name)).toEqual(["Has icons"]);
    expect(scan.sites[0]!.icons).toHaveLength(1); // the legacy "mail" icon is not library content
    expect(scan.sites[0]!.icons[0]!.props).toMatchObject({ icon: "binhi.icon.camera", variant: "duotone" });
    expect(scan.designs.map((x) => [x.name, x.iconLayers])).toEqual([["Icons", 2]]);
    expect(summarize(scan).join("\n")).toContain("BINHI_ICON_LIBRARY=false");
  });

  it("cannot write: it runs inside a read-only transaction", async () => {
    await scanIconContent(b.sql); // completes without altering data
    const before = await b.sql`select count(*)::int as n from binhi_sites`;
    await expect(b.sql.begin("read only", (tx) => tx`update binhi_sites set name = name`)).rejects.toThrow();
    expect((await b.sql`select count(*)::int as n from binhi_sites`)[0]!.n).toBe(before[0]!.n);
  });

  it("reports an empty database as safe to roll back", async () => {
    expect(summarize({ scannedAt: "", sites: [], designs: [] }).join(" ")).toContain("loses nothing");
  });

  it("writes a private backup that holds the full documents and refuses to overwrite", async () => {
    const scan = await scanIconContent(b.sql);
    const dir = mkdtempSync(join(tmpdir(), "binhi-preflight-"));
    const file = join(dir, "backup.json");
    const { spawnSync } = await import("node:child_process");
    const run = () => spawnSync(process.execPath, ["--import", "tsx", "scripts/icons/rollback-preflight.ts", "--backup", file], { env: { ...process.env, BINHI_DATABASE_URL: process.env.BINHI_TEST_DATABASE_URL ?? "postgres://binhi:binhi_dev_pw@127.0.0.1:5432/binhi_test" }, encoding: "utf8" });
    const first = run();
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).not.toContain("binhi_dev_pw"); // credentials are never printed
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const saved = JSON.parse(readFileSync(file, "utf8"));
    expect(saved.sites.length).toBe(scan.sites.length);
    expect(JSON.stringify(saved.designs[0].document)).toContain("binhi.icon.star");
    const second = run();
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("never overwritten");
  });
});
