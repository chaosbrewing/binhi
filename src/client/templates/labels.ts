import { FORMAT_FILTERS } from "../../core/templates/library/taxonomy.js";
import type { TemplateCard } from "../api.js";

export const formatLabel = (id: string): string => FORMAT_FILTERS.find((f) => f.id === id)?.label ?? id;

export function sizeLabel(size: TemplateCard["size"]): string {
  return size.kind === "fixed" ? `${size.width} × ${size.height} px` : "Responsive: desktop, tablet and mobile";
}

export function outputLabel(outputs: string[]): string {
  if (outputs.includes("website")) return "Publishes as a website";
  return `Exports ${outputs.map((o) => o.toUpperCase()).join(" or ")}`;
}

/** A short, honest line under a card title. */
export function cardMeta(card: TemplateCard): string {
  const size = card.size.kind === "fixed" ? `${card.size.width} × ${card.size.height}` : "Responsive";
  return `${formatLabel(card.format)} · ${size}`;
}
