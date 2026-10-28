/**
 * Curated collections: editorial groupings of existing templates. A
 * collection references canonical ids; it never duplicates a template record.
 * Empty until the seed catalog exists.
 */
export interface Collection {
  id: string;
  title: string;
  description: string;
  templateIds: readonly string[];
}

export const COLLECTIONS: readonly Collection[] = [];
