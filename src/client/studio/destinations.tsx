import type { ReactNode } from "react";
import { I } from "../components/Icons.js";

/**
 * Every place the studio can take you, with an availability that reflects
 * what the code actually does today. "Planned" destinations open a scoped
 * roadmap screen and never pretend to process files.
 */
export type Availability = "available" | "planned";

export interface Destination {
  id: string;
  title: string;
  detail: string;
  href: string;
  mark: ReactNode;
  availability: Availability;
  /** Short, honest note for the card (what works, or what is missing). */
  note: string;
  wide?: boolean;
}

export const DESTINATIONS: Destination[] = [
  { id: "projects", title: "My Projects", detail: "Everything you are working on: websites, photos, designs and templates in one list.", href: "/projects", mark: <I.layers />, availability: "available", note: "Websites and creative projects, newest first", wide: true },
  { id: "website", title: "Website Builder", detail: "Build pages, shape your story and publish your own website.", href: "/websites", mark: <I.desktop />, availability: "available", note: "Canvas editor, revisions, verified publishing", wide: true },
  { id: "design", title: "Design Studio", detail: "Fixed-size graphics for social posts, covers, flyers and cards with text, shapes and your own images.", href: "/studio/design", mark: <I.elements />, availability: "available", note: "PNG and JPEG export; saved to My Projects" },
  { id: "photo", title: "Photo Editor", detail: "Crop, resize, rotate and adjust without touching the original. Save to reopen anywhere.", href: "/studio/photo", mark: <I.image />, availability: "available", note: "Non-destructive; originals stay private" },
  { id: "compress", title: "Image Compressor", detail: "Pick a format and quality, then see the real exported size next to the original.", href: "/studio/compress", mark: <I.down />, availability: "available", note: "JPEG, PNG and WebP; honest byte counts" },
  { id: "convert", title: "File Converter", detail: "A general converter is being scoped around formats that can be verified, not promised.", href: "/studio/convert", mark: <I.history />, availability: "planned", note: "Image formats already convert in the Photo Editor" },
  { id: "forms", title: "Form Builder", detail: "Standalone forms with safe submission handling are designed, not built.", href: "/studio/forms", mark: <I.pages />, availability: "planned", note: "Website contact forms already work" },
  { id: "templates", title: "Templates", detail: "Start a website from a curated template, or turn any design into a reusable template of your own.", href: "/templates", mark: <I.sections />, availability: "available", note: "Website starters and your design templates" },
  { id: "brand", title: "Brand Kits", detail: "Keep colours, fonts and a logo together and apply them to designs and websites.", href: "/brand-kits", mark: <I.palette />, availability: "available", note: "Applied only when you choose" },
  { id: "library", title: "Asset Library", detail: "Private images shared by every tool, with a record of where each one is used.", href: "/library", mark: <I.inbox />, availability: "available", note: "Private by default; publish to a website on request" },
];

export const PROJECT_KIND_LABEL: Record<string, string> = {
  website: "Website",
  photo: "Photo",
  design: "Design",
  "design-template": "Template",
};
