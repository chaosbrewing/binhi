/**
 * Machine-verifiable template inventory. Each catalog template has exactly
 * one entry recording how far it has been proven. A stage can only be
 * claimed with evidence (the test or journey that proved it).
 *
 *   planned -> implemented -> preview-verified -> editor-verified
 *           -> export-verified -> approved
 *
 * A template counts as complete for the seed target at "export-verified":
 * its whole user journey passes (preview, create, edit, save, reopen, export
 * or publish). "approved" is the founder's release approval: tooling never
 * decides it, it only copies a recorded founder approval
 * (docs/TEMPLATE_APPROVALS.json) onto a template whose content fingerprint
 * still matches what was approved. Changing a template voids its approval.
 */
import type { Manifest } from "./index.js";

export const STAGES = ["planned", "implemented", "preview-verified", "editor-verified", "export-verified", "approved"] as const;
export type Stage = (typeof STAGES)[number];

export interface InventoryEntry {
  id: string;
  version: number;
  stage: Stage;
  /** One evidence reference per stage reached after "planned". */
  evidence: Partial<Record<Exclude<Stage, "planned">, string>>;
}

export interface InventoryIssue {
  where: string;
  message: string;
}

export function stageIndex(s: Stage): number {
  return STAGES.indexOf(s);
}

export function validateInventory(manifests: readonly Manifest[], entries: readonly InventoryEntry[]): InventoryIssue[] {
  const issues: InventoryIssue[] = [];
  const byKey = new Map<string, InventoryEntry>();
  for (const e of entries) {
    const key = `${e.id}@${e.version}`;
    if (byKey.has(key)) issues.push({ where: key, message: "Duplicate inventory entry" });
    byKey.set(key, e);
  }
  for (const m of manifests) {
    const key = `${m.id}@${m.version}`;
    const entry = byKey.get(key);
    if (!entry) {
      issues.push({ where: key, message: "Template has no inventory entry" });
      continue;
    }
    byKey.delete(key);
    for (let i = 1; i <= stageIndex(entry.stage); i++) {
      const stage = STAGES[i] as Exclude<Stage, "planned">;
      if (!entry.evidence[stage]) issues.push({ where: key, message: `Stage "${entry.stage}" is claimed without evidence for "${stage}"` });
    }
    if ((m.lifecycle === "published" || m.lifecycle === "approved") && stageIndex(entry.stage) < stageIndex("export-verified")) issues.push({ where: key, message: `Lifecycle "${m.lifecycle}" requires inventory stage "export-verified" or later, found "${entry.stage}"` });
  }
  for (const key of byKey.keys()) issues.push({ where: key, message: "Inventory entry has no matching template" });
  return issues;
}

export function countByStage(entries: readonly InventoryEntry[]): Record<Stage, number> {
  const out = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const e of entries) out[e.stage]++;
  return out;
}

/** Templates that count towards the seed-catalog target: the whole user journey has passed. */
export function completedCount(entries: readonly InventoryEntry[]): number {
  return entries.filter((e) => stageIndex(e.stage) >= stageIndex("export-verified")).length;
}

/** Templates the founder has approved for release. */
export function approvedCount(entries: readonly InventoryEntry[]): number {
  return entries.filter((e) => e.stage === "approved").length;
}

/** A founder's recorded approval: template key (`id@version`) to the content fingerprint that was approved. */
export interface ApprovalRecord {
  approvedBy: string;
  approvedAt: string;
  basis: string;
  entries: Record<string, string>;
}

/** Approvals that no longer describe the catalog: unknown template or changed content. */
export function validateApprovals(record: ApprovalRecord, lock: Readonly<Record<string, { contentSha256: string }>>): InventoryIssue[] {
  const issues: InventoryIssue[] = [];
  for (const [key, sha] of Object.entries(record.entries)) {
    const current = lock[key];
    if (!current) issues.push({ where: key, message: "Approval has no matching template" });
    else if (current.contentSha256 !== sha) issues.push({ where: key, message: "Template content changed after it was approved" });
  }
  return issues;
}

/** Marks export-verified entries as approved only where the founder's approval matches the proven content fingerprint. */
export function applyApprovals<E extends InventoryEntry & { contentSha256: string | null }>(entries: readonly E[], record: ApprovalRecord): E[] {
  return entries.map((e) => {
    const key = `${e.id}@${e.version}`;
    if (stageIndex(e.stage) < stageIndex("export-verified") || e.contentSha256 === null || record.entries[key] !== e.contentSha256) return e;
    return { ...e, stage: "approved", evidence: { ...e.evidence, approved: `docs/TEMPLATE_APPROVALS.json#${key}` } } as E;
  });
}
