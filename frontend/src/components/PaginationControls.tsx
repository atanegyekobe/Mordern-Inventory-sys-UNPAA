type PaginationControlsProps = {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  itemLabel?: string;
  className?: string;
};

export default function PaginationControls({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  itemLabel = "items",
  className = "",
}: PaginationControlsProps) {
  if (totalItems <= pageSize) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-black/60 ${className}`}>
      <p>
        Showing {start}-{end} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          className="rounded-full border border-black/15 px-3 py-1 font-semibold text-black/70 transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span>
          Page {safePage} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
          className="rounded-full border border-black/15 px-3 py-1 font-semibold text-black/70 transition hover:border-black/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
