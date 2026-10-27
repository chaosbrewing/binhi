export const PROJECT_FILTERS = ["all", "website", "photo", "design", "design-template"] as const;
export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

export const PROJECT_SORTS = ["updated-desc", "updated-asc", "name-asc", "name-desc"] as const;
export type ProjectSort = (typeof PROJECT_SORTS)[number];

export interface ProjectsViewState {
  search: string;
  filter: ProjectFilter;
  sort: ProjectSort;
}

export const DEFAULT_PROJECTS_VIEW_STATE: ProjectsViewState = {
  search: "",
  filter: "all",
  sort: "updated-desc",
};

export const LIBRARY_FILTERS = ["all", "used", "unused", "photo-original", "upload"] as const;
export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

export const LIBRARY_SORTS = ["recent", "oldest", "name-asc", "name-desc", "largest", "smallest"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export interface LibraryViewState {
  search: string;
  filter: LibraryFilter;
  sort: LibrarySort;
}

export const DEFAULT_LIBRARY_VIEW_STATE: LibraryViewState = {
  search: "",
  filter: "all",
  sort: "recent",
};

function normalizeSearch(raw: string | null): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ");
}

function parseEnum<T extends string>(raw: string | null, values: readonly T[], fallback: T): T {
  if (!raw) return fallback;
  return values.includes(raw as T) ? (raw as T) : fallback;
}

function setOrDelete(params: URLSearchParams, key: string, value: string, defaultValue: string): void {
  if (value === defaultValue) params.delete(key);
  else params.set(key, value);
}

export function parseProjectsViewState(params: URLSearchParams): ProjectsViewState {
  return {
    search: normalizeSearch(params.get("q")),
    filter: parseEnum(params.get("filter"), PROJECT_FILTERS, DEFAULT_PROJECTS_VIEW_STATE.filter),
    sort: parseEnum(params.get("sort"), PROJECT_SORTS, DEFAULT_PROJECTS_VIEW_STATE.sort),
  };
}

export function applyProjectsViewState(params: URLSearchParams, state: ProjectsViewState): URLSearchParams {
  const next = new URLSearchParams(params);
  const search = normalizeSearch(state.search);
  setOrDelete(next, "q", search, DEFAULT_PROJECTS_VIEW_STATE.search);
  setOrDelete(next, "filter", state.filter, DEFAULT_PROJECTS_VIEW_STATE.filter);
  setOrDelete(next, "sort", state.sort, DEFAULT_PROJECTS_VIEW_STATE.sort);
  return next;
}

export function parseLibraryViewState(params: URLSearchParams): LibraryViewState {
  return {
    search: normalizeSearch(params.get("q")),
    filter: parseEnum(params.get("filter"), LIBRARY_FILTERS, DEFAULT_LIBRARY_VIEW_STATE.filter),
    sort: parseEnum(params.get("sort"), LIBRARY_SORTS, DEFAULT_LIBRARY_VIEW_STATE.sort),
  };
}

export function applyLibraryViewState(params: URLSearchParams, state: LibraryViewState): URLSearchParams {
  const next = new URLSearchParams(params);
  const search = normalizeSearch(state.search);
  setOrDelete(next, "q", search, DEFAULT_LIBRARY_VIEW_STATE.search);
  setOrDelete(next, "filter", state.filter, DEFAULT_LIBRARY_VIEW_STATE.filter);
  setOrDelete(next, "sort", state.sort, DEFAULT_LIBRARY_VIEW_STATE.sort);
  return next;
}
