/**
 * Catalog validation. Returns every problem found rather than throwing on
 * the first, so a reviewer sees the whole picture. Used by the unit tests,
 * by the catalog build check and, for user templates, at save time.
 */
import { CATEGORIES, FORMAT_EDITORS, SUBCATEGORIES, getCategory, getSubcategory, type CategoryDef } from "./taxonomy.js";
import { DOCUMENT_SCHEMA_VERSIONS, EDITORS, KIND_OUTPUTS } from "./editors.js";
import { evaluateAvailability } from "./lifecycle.js";
import { TemplateManifest, type TemplateManifest as Manifest } from "./schema.js";

export interface Issue {
  /** Template id, or "taxonomy" / "catalog" for cross-cutting problems. */
  where: string;
  message: string;
}

/** What the catalog can resolve. Everything defaults to "does not exist" so a dependency can never be assumed. */
export interface CatalogContext {
  resolveIcon?: (id: string) => boolean;
  resolveElement?: (id: string) => boolean;
  resolveBundledAsset?: (id: string) => boolean;
  knownComponents?: ReadonlySet<string>;
}

export const EXPECTED_CATEGORY_COUNT = 30;
export const EXPECTED_SUBCATEGORIES_PER_CATEGORY = 10;

export function validateTaxonomy(categories: readonly CategoryDef[] = CATEGORIES): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string) => issues.push({ where: "taxonomy", message });
  if (categories.length !== EXPECTED_CATEGORY_COUNT) add(`Expected exactly ${EXPECTED_CATEGORY_COUNT} categories, found ${categories.length}`);
  const ids = new Set<string>();
  categories.forEach((c, i) => {
    if (c.number !== i + 1) add(`Category "${c.id}" has number ${c.number}, expected ${i + 1}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id)) add(`Category id "${c.id}" is not a lowercase slug`);
    if (ids.has(c.id)) add(`Duplicate category id "${c.id}"`);
    ids.add(c.id);
    if (c.subcategories.length !== EXPECTED_SUBCATEGORIES_PER_CATEGORY) add(`Category "${c.id}" has ${c.subcategories.length} subcategories, expected ${EXPECTED_SUBCATEGORIES_PER_CATEGORY}`);
    if (c.formats.length === 0) add(`Category "${c.id}" allows no formats`);
    if (c.editors.length === 0) add(`Category "${c.id}" allows no editors`);
  });
  const subIds = new Set<string>();
  for (const s of SUBCATEGORIES) {
    if (subIds.has(s.id)) add(`Duplicate subcategory id "${s.id}"`);
    subIds.add(s.id);
  }
  return issues;
}

function orientationOf(w: number, h: number): "landscape" | "portrait" | "square" {
  return w === h ? "square" : w > h ? "landscape" : "portrait";
}

export function validateManifest(m: Manifest, all: readonly Manifest[], ctx: CatalogContext = {}): Issue[] {
  const issues: Issue[] = [];
  const add = (message: string) => issues.push({ where: m.id, message });

  /* classification */
  const category = getCategory(m.primaryCategory);
  if (!category) add(`Unknown primary category "${m.primaryCategory}"`);
  if (category) {
    if (!category.formats.includes(m.format)) add(`Format "${m.format}" is not allowed in category "${category.id}"`);
    if (!category.editors.includes(m.editor)) add(`Editor "${m.editor}" is not allowed in category "${category.id}"`);
  }
  if (!FORMAT_EDITORS[m.format].includes(m.editor)) add(`Format "${m.format}" cannot be produced by the ${m.editor} editor`);
  if (m.subcategory !== undefined) {
    const sub = getSubcategory(m.subcategory);
    if (!sub) add(`Unknown subcategory "${m.subcategory}"`);
    else if (sub.categoryId !== m.primaryCategory) add(`Subcategory "${m.subcategory}" does not belong to "${m.primaryCategory}"`);
  }
  const seenSecondary = new Set<string>();
  for (const c of m.secondaryCategories) {
    if (!getCategory(c)) add(`Unknown secondary category "${c}"`);
    if (c === m.primaryCategory) add("Secondary categories must differ from the primary category");
    if (seenSecondary.has(c)) add(`Duplicate secondary category "${c}"`);
    seenSecondary.add(c);
  }
  if (new Set(m.tags).size !== m.tags.length) add("Duplicate tags");
  if (new Set(m.keywords.map((k) => k.toLowerCase())).size !== m.keywords.length) add("Duplicate keywords");

  /* document compatibility */
  const editor = EDITORS[m.editor];
  if (!editor.documentKinds.includes(m.documentKind)) add(`Editor "${m.editor}" cannot open document kind "${m.documentKind}"`);
  if (m.documentSchemaVersion !== DOCUMENT_SCHEMA_VERSIONS[m.documentKind]) add(`documentSchemaVersion ${m.documentSchemaVersion} does not match the current ${m.documentKind} schema (${DOCUMENT_SCHEMA_VERSIONS[m.documentKind]})`);
  for (const f of m.outputFormats) if (!KIND_OUTPUTS[m.documentKind].includes(f)) add(`Output "${f}" is not produced by ${m.documentKind} documents`);
  if (m.documentKind === "site") {
    if (m.size.kind !== "responsive") add("Website templates must use responsive sizing");
    if (m.orientation !== "responsive") add("Website templates must have orientation \"responsive\"");
    if (m.content.type === "builtin-design") add("A website template cannot use a design content reference");
  } else {
    if (m.size.kind !== "fixed") add("Design templates must declare fixed dimensions");
    else if (m.orientation !== orientationOf(m.size.width, m.size.height)) add(`Orientation "${m.orientation}" does not match ${m.size.width}x${m.size.height}`);
    if (m.content.type === "builtin-site") add("A design template cannot use a site content reference");
  }

  /* dependencies: every one must resolve; none is assumed */
  for (const id of m.dependencies.icons) if (!ctx.resolveIcon?.(id)) add(`Icon dependency "${id}" does not resolve`);
  for (const id of m.dependencies.elements) if (!ctx.resolveElement?.(id)) add(`Element dependency "${id}" does not resolve`);
  for (const id of m.dependencies.bundledAssets) if (!ctx.resolveBundledAsset?.(id)) add(`Bundled asset "${id}" does not resolve`);
  for (const id of m.dependencies.components) if (!ctx.knownComponents?.has(id)) add(`Component "${id}" is not a known component`);

  /* governance */
  if (m.creator.kind === "user" && (m.visibility !== "private" || m.license.id !== "user-owned")) add("User-created templates are private and user-owned in v1.0");
  if (m.creator.kind === "binhi" && m.license.id !== "binhi-original") add("BINHI templates must carry the binhi-original licence");
  if (m.creator.kind === "community" && m.lifecycle === "published") add("Community templates are untrusted and cannot be published in v1.0");
  if (m.visibility === "public" && m.creator.kind !== "binhi") add("Only BINHI-authored templates may be public in v1.0");
  if (m.lifecycle === "deprecated") {
    if (!m.deprecation) add("Deprecated templates must record a deprecation reason and date");
    else if (m.deprecation.replacedBy && !all.some((o) => o.id === m.deprecation!.replacedBy && o.version >= 1)) add(`replacedBy "${m.deprecation.replacedBy}" is not in the catalog`);
  } else if (m.deprecation) add("Only deprecated templates may carry deprecation details");

  /* publication: the rule that keeps unusable templates out of the public catalog */
  if (m.lifecycle === "published" && m.visibility === "public") {
    const availability = evaluateAvailability(m);
    if (!availability.usable) add(`Published public template is not usable: ${availability.reasons.map((r) => r.message).join(" ")}`);
    if (!m.publishedAt) add("Published templates need a publishedAt date");
    if (!m.preview.thumbnail) add("Published templates need a generated preview thumbnail");
    if (m.moderation !== "approved" && m.moderation !== "not-required") add(`Moderation status "${m.moderation}" blocks publication`);
  }
  if (m.lifecycle !== "published" && m.lifecycle !== "deprecated" && m.publishedAt) add("Only published or deprecated templates may have a publishedAt date");
  return issues;
}

export function validateCatalog(manifests: readonly unknown[], ctx: CatalogContext = {}): { issues: Issue[]; valid: Manifest[] } {
  const issues: Issue[] = [];
  const valid: Manifest[] = [];
  manifests.forEach((raw, i) => {
    const parsed = TemplateManifest.safeParse(raw);
    if (!parsed.success) {
      const id = typeof (raw as { id?: unknown })?.id === "string" ? (raw as { id: string }).id : `#${i}`;
      for (const e of parsed.error.issues) issues.push({ where: id, message: `${e.path.join(".") || "(record)"}: ${e.message}` });
      return;
    }
    valid.push(parsed.data);
  });

  const ids = new Map<string, number>();
  const legacy = new Map<string, string>();
  const idVersions = new Set<string>();
  for (const m of valid) {
    ids.set(m.id, (ids.get(m.id) ?? 0) + 1);
    const key = `${m.id}@${m.version}`;
    if (idVersions.has(key)) issues.push({ where: m.id, message: `Duplicate (id, version) ${key}` });
    idVersions.add(key);
    for (const l of m.legacyIds) {
      const owner = legacy.get(l);
      if (owner && owner !== m.id) issues.push({ where: m.id, message: `Legacy id "${l}" is already claimed by ${owner}` });
      legacy.set(l, m.id);
    }
  }
  // Several versions of one id may coexist; only one non-archived live version is allowed.
  for (const id of ids.keys()) {
    const live = valid.filter((m) => m.id === id && (m.lifecycle === "published" || m.lifecycle === "deprecated"));
    if (live.length > 1) issues.push({ where: id, message: "More than one published version is live; archive the older version" });
  }
  for (const m of valid) issues.push(...validateManifest(m, valid, ctx));
  return { issues, valid };
}
