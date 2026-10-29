import { TemplateManifest, type Manifest } from "../index.js";
import { SITE_TEMPLATES } from "./sites.js";
import { DESIGN_TEMPLATES } from "./designs/index.js";

/**
 * The shipped template catalog. A record is added here only together with its
 * content, a generated preview, a lock entry and an inventory entry; the
 * catalog tests fail otherwise.
 */
export const CATALOG: readonly Manifest[] = [...SITE_TEMPLATES, ...DESIGN_TEMPLATES].map((m) => {
  try {
    return TemplateManifest.parse(m);
  } catch (e) {
    throw new Error(`Catalog record ${m.id} is invalid: ${e instanceof Error ? e.message : String(e)}`);
  }
});
