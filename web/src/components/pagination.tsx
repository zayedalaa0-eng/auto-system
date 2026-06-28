"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ totalPages, currentPage }: { totalPages: number; currentPage: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) return null;

  const createPageURL = (pageNumber: number | string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-6 mb-4">
      <Link
        href={createPageURL(currentPage - 1)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
        aria-disabled={currentPage <= 1}
      >
        <ChevronRight className="h-4 w-4" />
      </Link>

      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          // Show only 5 pages around the current page
          if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
            return (
              <Link
                key={page}
                href={createPageURL(page)}
                className={`flex h-9 min-w-[36px] items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                  currentPage === page
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {page}
              </Link>
            );
          }
          if (page === currentPage - 2 || page === currentPage + 2) {
            return <span key={page} className="px-1 text-slate-400">...</span>;
          }
          return null;
        })}
      </div>

      <Link
        href={createPageURL(currentPage + 1)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
        aria-disabled={currentPage >= totalPages}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
    </div>
  );
}
