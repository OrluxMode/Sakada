// Client-side pagination helpers for the admin tables. Pure functions,
// no DOM, so they're easy to test.

export const PAGE_SIZE = 25;

/** Slice `items` for one page. Out-of-range pages are clamped. */
export function paginate(items, page, pageSize = PAGE_SIZE) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  const rows = items.slice(start, start + pageSize);
  return {
    rows,
    page: current,
    totalPages,
    total,
    from: total ? start + 1 : 0,
    to: start + rows.length,
  };
}

/**
 * Page numbers to show, with "…" for gaps: always the first and last page
 * plus the pages next to the current one. Up to 7 pages are all shown.
 */
export function pageList(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const keep = [1, totalPages, page - 1, page, page + 1]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of new Set(keep)) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}
