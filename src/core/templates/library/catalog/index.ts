import { TemplateManifest, type Manifest } from "../index.js";
import { SITE_TEMPLATES } from "./sites.js";

/**
 * The shipped template catalog. A record is added here only together with its
 * content, a generated preview, a lock entry and an inventory entry; the
 * catalog tests fail otherwise.
 */
export const CATALOG: readonly Manifest[] = [...SITE_TEMPLATES].map((m) => TemplateManifest.parse(m));
