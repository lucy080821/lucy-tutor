import { useState, useEffect, useMemo } from "react";

// Paginates an already-filtered array (filtering must happen on the full source list
// before it reaches this hook, so search/filter always match across every item, not
// just the current page). Pass a `resetKey` (e.g. the search query + filter value) so
// the page resets to 1 whenever the filter criteria change, instead of landing on a
// stale page number for the new result set.
export function usePagination<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [items, clampedPage, pageSize]
  );

  return { page: clampedPage, setPage, totalPages, pageItems, totalItems };
}
