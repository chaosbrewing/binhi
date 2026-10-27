export const LIST_PAGE_SIZE = 24;

function normalizePageSize(pageSize: number): number {
  return Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : LIST_PAGE_SIZE;
}

export function initialVisibleCount(total: number, pageSize = LIST_PAGE_SIZE): number {
  if (total <= 0) return 0;
  return Math.min(total, normalizePageSize(pageSize));
}

export function clampVisibleCount(current: number, total: number, pageSize = LIST_PAGE_SIZE): number {
  if (total <= 0) return 0;
  const minPage = initialVisibleCount(total, pageSize);
  return Math.min(total, Math.max(minPage, Math.floor(current)));
}

export function nextVisibleCount(current: number, total: number, pageSize = LIST_PAGE_SIZE): number {
  if (total <= 0) return 0;
  const size = normalizePageSize(pageSize);
  return Math.min(total, Math.max(0, Math.floor(current)) + size);
}

export function visibleSlice<T>(rows: T[], visibleCount: number): T[] {
  return rows.slice(0, Math.max(0, Math.min(rows.length, Math.floor(visibleCount))));
}
