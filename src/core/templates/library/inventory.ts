/**
 * Machine-verifiable template inventory. Each catalog template has exactly
 * one entry recording how far it has been proven. A stage can only be
 * claimed with evidence, and a template is counted as complete only at
 * "approved". Evidence strings name the test or journey that proved it
 * (for example "e2e/templates.ts#create-and-reopen").
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
    if ((m.lifecycle === "published" || m.lifecycle === "approved") && entry.stage !== "approved") issues.push({ where: key, message: `Lifecycle "${m.lifecycle}" requires inventory stage "approved", found "${entry.stage}"` });
  }
  for (const key of byKey.keys()) issues.push({ where: key, message: "Inventory entry has no matching template" });
  return issues;
}

export function countByStage(entries: readonly InventoryEntry[]): Record<Stage, number> {
  const out = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const e of entries) out[e.stage]++;
  return out;
}

/** Templates that count towards the seed-catalog target: only fully approved ones. */
export function completedCount(entries: readonly InventoryEntry[]): number {
  return entries.filter((e) => e.stage === "approved").length;
}
