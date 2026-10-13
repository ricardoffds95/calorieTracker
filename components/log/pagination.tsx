import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageWindow } from "@/lib/food-search";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  /** Where it sticks (a `bottom-*` class): always in view while the results are on screen, whatever the screen height. */
  className?: string;
}

/** ‹ 1 2 3 … 21 ›: every result of a search can be reached, a page at a time. */
export function Pagination({ page, pageCount, onChange, disabled = false, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Result pages" className={cn("sticky z-10 flex items-center justify-center gap-1 bg-background pt-2", className)}>
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Previous page" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft aria-hidden />
      </Button>
      {pageWindow(page, pageCount).map((entry, i) =>
        entry === "…" ? (
          <span key={`gap-${i}`} aria-hidden className="w-6 text-center text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={entry}
            type="button"
            variant={entry === page ? "default" : "ghost"}
            className="size-11 px-0 tabular-nums"
            aria-label={`Page ${entry}`}
            aria-current={entry === page ? "page" : undefined}
            disabled={disabled}
            onClick={() => onChange(entry)}
          >
            {entry}
          </Button>
        ),
      )}
      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Next page" disabled={disabled || page >= pageCount} onClick={() => onChange(page + 1)}>
        <ChevronRight aria-hidden />
      </Button>
    </nav>
  );
}
