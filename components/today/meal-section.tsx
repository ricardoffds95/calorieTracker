import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { EntryRow } from "@/components/today/entry-row";
import { ARROW_SLOT, KCAL, ROW_GRID } from "@/components/today/row-layout";
import { MealEntryRow } from "@/components/today/meal-entry-row";
import { buttonVariants } from "@/components/ui/button";
import type { DiaryEntry } from "@/lib/diary";
import type { MealType } from "@/lib/macros";
import { mealLabel } from "@/lib/today";
import { cn } from "@/lib/utils";

interface MealSectionProps {
  meal: MealType;
  entries: DiaryEntry[];
  calories: number;
  dateKey: string;
  collapsed: boolean;
  onToggle: () => void;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
  onRemoveItem: (entry: DiaryEntry, index: number) => void;
}

export function MealSection({ meal, entries, calories, dateKey, collapsed, onToggle, onEdit, onDelete, onRemoveItem }: MealSectionProps) {
  const label = mealLabel(meal);
  return (
    <section aria-labelledby={`meal-${meal}`} data-testid={`meal-${meal}`} className="border-t border-border pt-2">
      <div className={ROW_GRID}>
        <h2 id={`meal-${meal}`} className="min-w-0 text-base font-semibold">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={`meal-${meal}-entries`}
            aria-label={`${label}, ${collapsed ? "show" : "hide"}`}
            onClick={onToggle}
            className="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 rounded-sm px-1 text-left"
          >
            <span className="flex min-w-0 items-center gap-2">
              <ChevronRight aria-hidden className={cn(ARROW_SLOT, "text-muted-foreground motion-safe:transition-transform", !collapsed && "rotate-90")} />
              <span className="min-w-0 truncate">{label}</span>
            </span>
            <span data-testid={`meal-${meal}-kcal`} className={cn(KCAL, "font-normal text-muted-foreground")}>
              {entries.length === 0 ? "—" : `${calories} kcal`}
            </span>
          </button>
        </h2>
        <span aria-hidden />
        <Link
          href={`/add?meal=${meal}&d=${dateKey}`}
          aria-label={`Add to ${label}`}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-11 text-primary")}
        >
          <Plus aria-hidden />
        </Link>
      </div>
      {entries.length > 0 && !collapsed && (
        <ul id={`meal-${meal}-entries`}>
          {entries.map((entry) =>
            entry.kind === "meal" ? (
              <MealEntryRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} onRemoveItem={onRemoveItem} />
            ) : (
              <EntryRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
