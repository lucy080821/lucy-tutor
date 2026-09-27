interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}

function pageNumbersToShow(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "...")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) out.push("...");
    out.push(p);
  });
  return out;
}

export default function Pagination({ page, totalPages, onPageChange, totalItems, pageSize }: PaginationProps) {
  if (totalPages <= 1) return null;
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <p className="text-xs text-foreground/50 font-medium">
        Hiển thị {startItem}-{endItem} / {totalItems}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-4 py-2 text-xs font-bold rounded-full border border-foreground/15 text-foreground/60 hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-foreground/15 disabled:hover:text-foreground/60 cursor-pointer transition-colors"
        >
          ← Trước
        </button>
        {pageNumbersToShow(page, totalPages).map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-foreground/40">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-9 h-9 text-xs font-bold rounded-full border transition-colors cursor-pointer ${
                p === page ? "bg-primary border-primary text-white shadow-sm" : "border-foreground/15 text-foreground/60 hover:border-primary hover:text-primary"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-4 py-2 text-xs font-bold rounded-full border border-foreground/15 text-foreground/60 hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-foreground/15 disabled:hover:text-foreground/60 cursor-pointer transition-colors"
        >
          Sau →
        </button>
      </div>
    </div>
  );
}
