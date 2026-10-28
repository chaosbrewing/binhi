import type { InventoryEntry } from "../inventory.js";

/**
 * Evidence ledger for the shipped catalog. Evidence names the test that
 * proves each stage; tests/unit/template-catalog.test.ts checks that every
 * referenced file exists and that the claims are consistent with the
 * catalog. "approved" (the founder's release approval) is never claimed here.
 */
const SITE_EVIDENCE = {
  implemented: "tests/unit/template-catalog.test.ts#documents-are-valid",
  "preview-verified": "e2e/templates.ts#thumbnail-and-sandboxed-preview",
  "editor-verified": "e2e/templates.ts#create-edit-autosave-reopen",
  "export-verified": "e2e/templates.ts#publish-and-read-live-site",
} as const;

export const INVENTORY: readonly InventoryEntry[] = [
  { id: "tpl.site.blank", version: 1, stage: "export-verified", evidence: { ...SITE_EVIDENCE } },
  { id: "tpl.site.portfolio", version: 1, stage: "export-verified", evidence: { ...SITE_EVIDENCE } },
  { id: "tpl.site.studio", version: 1, stage: "export-verified", evidence: { ...SITE_EVIDENCE } },
  { id: "tpl.site.freelancer", version: 1, stage: "export-verified", evidence: { ...SITE_EVIDENCE } },
  { id: "tpl.site.business", version: 1, stage: "export-verified", evidence: { ...SITE_EVIDENCE } },
  { id: "tpl.site.landing", version: 1, stage: "export-verified", evidence: { ...SITE_EVIDENCE } },
];
