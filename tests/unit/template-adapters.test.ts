import { describe, expect, it } from "vitest";
import { ADAPTERS, CONTRACTS, EDITOR_IDS, EDITORS, adapterConsistencyIssues, validateContract, type ContractEditor } from "../../src/core/templates/library/index.js";

const field = (over: Record<string, unknown> = {}) => ({ id: "full_name", type: "text", label: "Full name", required: true, maxLength: 80, ...over });
const form = (over: Record<string, unknown> = {}) => ({
  version: 1,
  title: "Contact us",
  fields: [field(), field({ id: "email", type: "email", label: "Email", maxLength: undefined }), field({ id: "topic", type: "select", label: "Topic", required: false, options: ["Sales", "Support"], maxLength: undefined })],
  submission: { mode: "store-only", successMessage: "Thanks, we will reply soon.", maxPerDayPerIp: 20 },
  ownership: "owner-only",
  ...over,
});
const blocks = [{ type: "heading", level: 1, text: "Title" }, { type: "paragraph", text: "Body" }, { type: "list", ordered: false, items: ["One", "Two"] }, { type: "table", columns: ["Item", "Qty"], rows: 3 }];

const valid: Record<ContractEditor, unknown> = {
  form: form(),
  photo: { version: 1, requiresSourcePhoto: true, adjustments: { brightness: 105, contrast: 110, saturation: 90, rotation: 0, flipX: false, flipY: false } },
  document: { version: 1, page: { size: "A4", orientation: "portrait" }, blocks, output: "pdf" },
  presentation: { version: 1, aspect: "16:9", slides: [{ layout: "title", blocks: blocks.slice(0, 2) }, { layout: "content", blocks }], output: "pdf" },
  video: { version: 1, aspect: "9:16", fps: 30, durationMs: 6000, scenes: [{ startMs: 0, endMs: 3000, blocks: blocks.slice(0, 1) }, { startMs: 3000, endMs: 6000, blocks: [] }], output: "mp4" },
  email: { version: 1, widthPx: 600, blocks, sending: "none" },
};

describe("template adapter contracts", () => {
  it("every contract accepts a valid sample", () => {
    for (const editor of Object.keys(CONTRACTS) as ContractEditor[]) expect(validateContract(editor, valid[editor]), editor).toEqual({ ok: true });
  });

  it("every contract is strict: unknown keys are rejected", () => {
    for (const editor of Object.keys(CONTRACTS) as ContractEditor[]) {
      const r = validateContract(editor, { ...(valid[editor] as object), script: "alert(1)" });
      expect(r.ok, editor).toBe(false);
    }
  });

  it("every contract rejects an empty or wrong-version record", () => {
    for (const editor of Object.keys(CONTRACTS) as ContractEditor[]) {
      expect(validateContract(editor, {}).ok, editor).toBe(false);
      expect(validateContract(editor, { ...(valid[editor] as object), version: 2 }).ok, editor).toBe(false);
    }
  });

  describe("forms", () => {
    it("requires a visible label, a unique id and consistent constraints", () => {
      expect(validateContract("form", form({ fields: [field({ label: "" })] })).ok).toBe(false);
      expect(validateContract("form", form({ fields: [field(), field()] })).ok).toBe(false);
      expect(validateContract("form", form({ fields: [field({ id: "Bad Id" })] })).ok).toBe(false);
      expect(validateContract("form", form({ fields: [field({ type: "select", options: ["Only one"] })] })).ok).toBe(false);
      expect(validateContract("form", form({ fields: [field({ options: ["a", "b"] })] })).ok).toBe(false);
      expect(validateContract("form", form({ fields: [field({ minLength: 10, maxLength: 5 })] })).ok).toBe(false);
      expect(validateContract("form", form({ fields: [field({ type: "checkbox", maxLength: 5 })] })).ok).toBe(false);
      expect(validateContract("form", form({ fields: [field({ type: "number", min: 10, max: 1, maxLength: undefined })] })).ok).toBe(false);
      expect(validateContract("form", form({ fields: [] })).ok).toBe(false);
    });
    it("only stores submissions for the owner; email sending is not part of the contract", () => {
      expect(validateContract("form", form({ submission: { mode: "email", successMessage: "x", maxPerDayPerIp: 5 } })).ok).toBe(false);
      expect(validateContract("form", form({ ownership: "public" })).ok).toBe(false);
    });
  });

  it("photo templates carry adjustments only: masks, frames and overlays are rejected", () => {
    const photo = valid.photo as { adjustments: object };
    expect(validateContract("photo", { ...photo, mask: { shape: "circle" } }).ok).toBe(false);
    expect(validateContract("photo", { ...photo, frame: "polaroid" }).ok).toBe(false);
    expect(validateContract("photo", { ...photo, adjustments: { ...photo.adjustments, brightness: 500 } }).ok).toBe(false);
    expect(validateContract("photo", { ...photo, requiresSourcePhoto: false }).ok).toBe(false);
  });

  it("video scenes must lie within the duration", () => {
    const v = valid.video as { scenes: unknown[] };
    expect(validateContract("video", { ...v, durationMs: 4000 }).ok).toBe(false);
    expect(validateContract("video", { ...v, scenes: [{ startMs: 2000, endMs: 1000, blocks: [] }] }).ok).toBe(false);
  });

  it("email layouts never include sending behaviour", () => {
    expect(validateContract("email", { ...(valid.email as object), sending: "smtp" }).ok).toBe(false);
  });

  it("every adapter agrees with the editor registry, and only website and design are active", () => {
    expect(adapterConsistencyIssues()).toEqual([]);
    expect(EDITOR_IDS.filter((id) => ADAPTERS[id].status === "active")).toEqual(["website", "design"]);
    for (const id of EDITOR_IDS) {
      expect(ADAPTERS[id].editor).toBe(id);
      if (ADAPTERS[id].status === "contract-only") {
        expect(ADAPTERS[id].requires.length, id).toBeGreaterThan(0);
        expect(EDITORS[id].templates, id).toBe(false);
      }
    }
  });
});
