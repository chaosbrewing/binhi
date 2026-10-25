import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { BinhiApp } from "../../src/server/app.js";
import { api, batch, createSite, signup, testApp, type Session } from "../helpers.js";
import { applyOperations, findNode, newIdSeed, type Operation } from "../../src/core/index.js";

let b: BinhiApp;
let s: Session;
beforeAll(async () => {
  b = await testApp();
  s = await signup(b.app);
});
afterAll(async () => b.close());

describe("id seeds on the operations endpoint", () => {
  it("replays a composite insert plus an immediate edit of its child (the rapid-edit data-loss path)", async () => {
    const site = await createSite(b.app, s, "blank", "Seeds");
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const insert: Operation = { type: "insertComponent", target: { parentId: sectionId }, componentType: "card" };
    const seeds = [newIdSeed(), newIdSeed()];
    // what the editor does locally
    const local = applyOperations(site.document, [insert], [seeds[0]!]);
    const card = findNode(local.document, local.createdIds[0]!)!.node;
    const edit: Operation = { type: "updateProps", nodeId: card.children![0]!.id, props: { text: "Typed right away" } };
    const res = await api(b.app, s).post(`/api/sites/${site.id}/ops`, { ...batch(0, [insert, edit]), idSeeds: seeds });
    expect(res.statusCode).toBe(200);
    expect(res.json().createdIds[0]).toBe(card.id);
    const saved = (await api(b.app, s).get(`/api/sites/${site.id}`)).json().site.document;
    expect(JSON.stringify(saved)).toContain("Typed right away");
  });

  it("still accepts batches without seeds (older editors), and the old failure is reproduced without them", async () => {
    const site = await createSite(b.app, s, "blank", "No seeds");
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const ok = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(0, [{ type: "insertComponent", target: { parentId: sectionId }, componentType: "card" }]));
    expect(ok.statusCode).toBe(200);
    // an old editor that edits a child it only knows by a locally minted id gets a clear 422 instead of silent loss
    const stale = await api(b.app, s).post(`/api/sites/${site.id}/ops`, batch(1, [{ type: "updateProps", nodeId: "head_zzzzzzzzzz", props: { text: "x" } }]));
    expect(stale.statusCode).toBe(422);
  });

  it("rejects malformed or mismatched seeds", async () => {
    const site = await createSite(b.app, s, "blank", "Bad seeds");
    const sectionId = site.document.pages[0]!.sections[0]!.id;
    const op = { type: "insertComponent", target: { parentId: sectionId }, componentType: "heading" };
    expect((await api(b.app, s).post(`/api/sites/${site.id}/ops`, { ...batch(0, [op]), idSeeds: ["<script>"] })).statusCode).toBe(400);
    expect((await api(b.app, s).post(`/api/sites/${site.id}/ops`, { ...batch(0, [op]), idSeeds: [newIdSeed(), newIdSeed()] })).statusCode).toBe(400);
    expect((await api(b.app, s).post(`/api/sites/${site.id}/ops`, { ...batch(0, [op]), idSeeds: "nope" })).statusCode).toBe(400);
  });

  it("the same seed always yields the same ids; different seeds differ", async () => {
    const site = await createSite(b.app, s, "blank", "Determinism");
    const op: Operation = { type: "insertComponent", target: { parentId: site.document.pages[0]!.sections[0]!.id }, componentType: "card" };
    const seed = newIdSeed();
    const one = applyOperations(site.document, [op], [seed]).createdIds;
    const two = applyOperations(site.document, [op], [seed]).createdIds;
    const other = applyOperations(site.document, [op], [newIdSeed()]).createdIds;
    expect(one).toEqual(two);
    expect(other).not.toEqual(one);
    expect(one.length).toBeGreaterThan(1);
  });
});
