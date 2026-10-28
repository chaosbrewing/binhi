import type { ReactNode } from "react";
import { I } from "../components/Icons.js";

export type NavigationAvailability = "available" | "planned";
export type NavigationSectionId = "workspace" | "create" | "resources";

export interface NavigationItem {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
  availability: NavigationAvailability;
  owns: (path: string) => boolean;
}

export interface NavigationSection {
  id: NavigationSectionId;
  label: string;
  items: NavigationItem[];
}

export const STUDIO_NAVIGATION: NavigationSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "today", label: "Today", to: "/", icon: <I.home />, availability: "available", owns: (path) => path === "/" },
      { id: "projects", label: "Projects", to: "/projects", icon: <I.layers />, availability: "available", owns: (path) => path === "/projects" },
      { id: "recent", label: "Recent", to: "/recent", icon: <I.history />, availability: "available", owns: (path) => path === "/recent" },
    ],
  },
  {
    id: "create",
    label: "Create",
    items: [
      { id: "website", label: "Website Builder", to: "/websites", icon: <I.desktop />, availability: "available", owns: (path) => path === "/websites" || path.startsWith("/sites/") },
      { id: "design", label: "Design Studio", to: "/studio/design", icon: <I.elements />, availability: "available", owns: (path) => path.startsWith("/studio/design") },
      { id: "photo", label: "Photo Editor", to: "/studio/photo", icon: <I.image />, availability: "available", owns: (path) => path.startsWith("/studio/photo") },
      { id: "forms", label: "Form Creator", to: "/studio/forms", icon: <I.pages />, availability: "planned", owns: (path) => path === "/studio/forms" },
      { id: "pdf", label: "PDF Editor", to: "/studio/pdf", icon: <I.pages />, availability: "planned", owns: (path) => path === "/studio/pdf" },
      { id: "convert", label: "File Converter", to: "/studio/convert", icon: <I.history />, availability: "planned", owns: (path) => path === "/studio/convert" },
      { id: "compress", label: "Image Compressor", to: "/studio/compress", icon: <I.down />, availability: "available", owns: (path) => path === "/studio/compress" },
      { id: "templates", label: "Templates", to: "/templates", icon: <I.sections />, availability: "available", owns: (path) => path === "/templates" },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    items: [
      { id: "brand", label: "Brand Kits", to: "/brand-kits", icon: <I.palette />, availability: "available", owns: (path) => path === "/brand-kits" },
      { id: "assets", label: "Assets", to: "/library", icon: <I.inbox />, availability: "available", owns: (path) => path === "/library" },
      { id: "settings", label: "Settings", to: "/account", icon: <I.settings />, availability: "available", owns: (path) => path === "/account" },
    ],
  },
];

export const navigationItems = STUDIO_NAVIGATION.flatMap((section) => section.items);

export function navigationOwner(path: string) {
  return navigationItems.find((item) => item.owns(path));
}
