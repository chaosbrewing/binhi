/**
 * READ-ONLY rollback preflight for the icon library. Run it BEFORE redeploying any build older than the icon library.
 *
 *   node --import tsx scripts/icons/rollback-preflight.ts --backup /secure/place/icon-content-backup.json
 *
 * It lists every website element and design layer that uses a library icon and writes their full documents to a
 * backup file (mode 0600, never overwritten). It issues SELECTs inside a READ ONLY transaction and changes nothing.
 * Credentials are read from BINHI_DATABASE_URL / DATABASE_URL and are never printed.
 */
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import postgres from "postgres";

interface Node { id: string; type: string; props?: Record<string, unknown>; children?: Node[] }
export interface IconSiteHit { siteId: string; name: string; slug: string; revision: number; icons: { nodeId: string; props: Record<string, unknown> }[]; document: unknown }
export interface IconDesignHit { projectId: string; kind: string; name: string; revision: number; iconLayers: number; document: unknown }
export interface IconScan { scannedAt: string; sites: IconSiteHit[]; designs: IconDesignHit[] }

const MARK = "binhi\\.icon\\.";

function collectSiteIcons(document: { pages?: { sections?: Node[] }[]; header?: Node | null; footer?: Node | null }) {
  const found: { nodeId: string; props: Record<string, unknown> }[] = [];
  const visit = (n: Node) => {
    if (n.type === "icon" && typeof n.props?.icon === "string") found.push({ nodeId: n.id, props: n.props });
    n.children?.forEach(visit);
  };
  for (const page of document.pages ?? []) page.sections?.forEach(visit);
  if (document.header) visit(document.header);
  if (document.footer) visit(document.footer);
  return found;
}

/** Pure SELECTs inside a read-only transaction. */
export async function scanIconContent(sql: postgres.Sql): Promise<IconScan> {
  return sql.begin("read only", async (tx) => {
    const siteRows = await tx<{ id: string; name: string; slug: string; revision: number; document: unknown }[]>`
      select id, name, slug, revision, document from binhi_sites where deleted_at is null and document::text ~ ${MARK}`;
    const projectRows = await tx<{ id: string; kind: string; name: string; revision: number; document: unknown }[]>`
      select id, kind, name, revision, document from binhi_projects where deleted_at is null and kind in ('design','design-template') and document::text ~ ${MARK}`;
    const sites = siteRows
      .map((r) => ({ siteId: r.id, name: r.name, slug: r.slug, revision: r.revision, icons: collectSiteIcons(r.document as never), document: r.document }))
      .filter((s) => s.icons.length > 0);
    const designs = projectRows
      .map((r) => ({ projectId: r.id, kind: r.kind, name: r.name, revision: r.revision, iconLayers: ((r.document as { layers?: { type: string }[] }).layers ?? []).filter((l) => l.type === "icon").length, document: r.document }))
      .filter((d) => d.iconLayers > 0);
    return { scannedAt: new Date().toISOString(), sites, designs };
  }) as Promise<IconScan>;
}

export function summarize(scan: IconScan): string[] {
  const lines = [
    `Websites using library icons : ${scan.sites.length} (${scan.sites.reduce((n, s) => n + s.icons.length, 0)} icon elements)`,
    `Designs/templates with icons  : ${scan.designs.length} (${scan.designs.reduce((n, d) => n + d.iconLayers, 0)} icon layers)`,
  ];
  if (scan.sites.length || scan.designs.length) {
    lines.push("An older build would: show website icons as a default/fallback glyph and DROP their icon settings if that element is edited and saved;");
    lines.push("and refuse to open designs that contain icon layers (the data stays intact). Back up, then prefer BINHI_ICON_LIBRARY=false over rolling back.");
  } else lines.push("No icon content exists: rolling back loses nothing from the icon library.");
  return lines;
}

async function main() {
  const args = process.argv.slice(2);
  const backupAt = args.includes("--backup") ? args[args.indexOf("--backup") + 1] : undefined;
  const url = process.env.BINHI_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Set BINHI_DATABASE_URL or DATABASE_URL (read-only access is enough).");
    process.exit(2);
  }
  const u = new URL(url);
  console.log(`database: ${u.hostname}/${u.pathname.replace(/^\//, "")} (read-only scan, credentials not printed)`);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const scan = await scanIconContent(sql);
    for (const line of summarize(scan)) console.log(line);
    for (const s of scan.sites) console.log(`  site ${s.siteId} "${s.name}" rev ${s.revision}: ${s.icons.length} icon(s)`);
    for (const d of scan.designs) console.log(`  ${d.kind} ${d.projectId} "${d.name}" rev ${d.revision}: ${d.iconLayers} icon layer(s)`);
    if (backupAt) {
      if (existsSync(backupAt)) throw new Error(`${backupAt} already exists; choose a new file (backups are never overwritten)`);
      writeFileSync(backupAt, JSON.stringify(scan, null, 2), { mode: 0o600 });
      chmodSync(backupAt, 0o600);
      console.log(`backup written: ${backupAt} (${scan.sites.length} sites, ${scan.designs.length} designs)`);
    } else if (scan.sites.length || scan.designs.length) {
      console.log("No backup written. Re-run with --backup <new file> before any rollback.");
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("rollback-preflight.ts")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
