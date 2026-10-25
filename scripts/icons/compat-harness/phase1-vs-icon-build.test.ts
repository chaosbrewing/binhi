// Compatibility harness (not part of `npm test`). Copy this file into tests/integration/ of a checkout of the OLDER
// build (for example `git worktree add ../phase1 2c766f2`, symlink node_modules), point NEW_REPO at this repository,
// make sure BINHI_TEST_DATABASE_URL is a disposable database, and run `npx vitest run tests/integration/<this file>`
// with `--reporter=verbose --disable-console-intercept`. It writes icon content with the NEW build, then opens the same
// database with the OLD build and prints what happens (see docs/ICON_COMPATIBILITY.md for the recorded results).
const NEW_REPO = process.env.NEW_REPO ?? "/home/user/binhi";
import { describe, it, expect } from "vitest";
const { testApp: newApp, api: newApi, signup: newSignup, createSite: newSite, batch } = await import(`${NEW_REPO}/tests/helpers.js`);
import { testApp as oldApp, api as oldApi } from "../helpers.js";
const { createDesignDocument, makeLayer } = await import(`${NEW_REPO}/src/core/creative/index.js`);

describe("Phase 1 build (2c766f2) against documents written by the icon build", () => {
  it("reports what actually happens", async () => {
    const out: Record<string, unknown> = {};
    const n = await newApp();
    const s = await newSignup(n.app);
    const site = await newSite(n.app, s, "blank", "Compat");
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const headingId = site.document.pages[0]!.sections[0]!.children![0]!.id;
    await newApi(n.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "insertComponent", target: { parentId: sectionId }, componentType: "icon", nodeId: "icon_compat0001", props: { icon: "binhi.icon.camera", size: 48, variant: "duotone", strokeWidth: 1.5 } }]));
    const doc = createDesignDocument(1080, 1080);
    const design = (await newApi(n.app, s).post("/api/projects", { kind: "design", name: "Has icon", document: { ...doc, layers: [makeLayer("icon", doc, { icon: "binhi.icon.heart", variant: "filled" }), makeLayer("rect", doc)] } })).json().project;
    await n.close();

    const o = await oldApp({}, { truncate: false });
    const a = oldApi(o.app, s);
    const find = (d: any) => { let f: any; const v = (x: any) => { if (x.type === "icon") f = x; x.children?.forEach(v); }; d.pages[0].sections.forEach(v); return f; };

    // --- designs
    const got = await a.get(`/api/projects/${design.id}`);
    out.design_get = got.statusCode;
    out.design_list = (await a.get("/api/projects?kind=design")).statusCode;
    const rename = await a.patch(`/api/projects/${design.id}`, { name: "Renamed in old build", baseRevision: 0 });
    out.design_rename = rename.statusCode;
    out.design_doc_after_rename_still_has_icon = JSON.stringify((await a.get(`/api/projects/${design.id}`)).json().project.document).includes("binhi.icon.heart");
    // --- duplicate / template of a design with icons
    out.design_duplicate_to_template = (await a.post(`/api/projects/${design.id}/duplicate`, { kind: "design-template", name: "t" })).statusCode;

    const rewrite = await a.patch(`/api/projects/${design.id}`, { document: { ...doc, layers: [] }, baseRevision: 1 }); // what an editor that could open it would send
    out.design_overwrite_with_other_doc = rewrite.statusCode; // allowed: a user-intended overwrite is possible only if the client can open it (it cannot)
    // --- websites
    const sg = (await a.get(`/api/sites/${site.id}`)).json().site;
    out.site_get = sg.revision;
    out.site_icon_props_as_stored = find(sg.document)?.props;
    const unrelated = await a.post(`/api/sites/${site.id}/ops`, batch(sg.revision, [{ type: "updateProps", nodeId: headingId, props: { text: "Edited in old build" } }]));
    out.site_unrelated_edit = unrelated.statusCode;
    out.site_icon_props_after_unrelated_edit = find((await a.get(`/api/sites/${site.id}`)).json().site.document)?.props;
    const prev = await a.get(`/api/sites/${site.id}/preview/`);
    out.preview_status = prev.statusCode;
    out.preview_shows_star_path = prev.body.includes("M12 2l3.09 6.26");
    out.preview_contains_library_id = prev.body.includes("binhi.icon");
    const rev = (await a.get(`/api/sites/${site.id}`)).json().site.revision;
    const edit = await a.post(`/api/sites/${site.id}/ops`, batch(rev, [{ type: "updateProps", nodeId: "icon_compat0001", props: { size: 40 } }]));
    out.site_edit_icon_in_old_build = edit.statusCode;
    out.site_icon_props_after_icon_edit = find((await a.get(`/api/sites/${site.id}`)).json().site.document)?.props;
    const pubr = await a.post(`/api/sites/${site.id}/publish`);
    out.publish = pubr.statusCode;
    const revs = (await a.get(`/api/sites/${site.id}/revisions`)).json().revisions;
    out.revisions = revs.map((r: any) => `${r.revision}:${r.kind}`);
    // can the pre-edit revision (with library icon props) still be read and restored?
    const first = revs.find((r: any) => r.revision === 1);
    const old = first ? (await a.get(`/api/sites/${site.id}/revisions/${first.revision}`)) : null;
    out.revision1_still_has_icon_props = old ? JSON.stringify(old.json()).includes("binhi.icon.camera") : "no revision 1";
    await o.close();
    console.log("COMPAT_RESULT " + JSON.stringify(out, null, 1));
    expect(true).toBe(true);
  });
});
