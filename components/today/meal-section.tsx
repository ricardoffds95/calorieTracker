import Link from "next/link";
import { Plus } from "lucide-react";
import { EntryRow } from "@/components/today/entry-row";
import { KCAL, ROW_GRID } from "@/components/today/row-layout";
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
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
  onRemoveItem: (entry: DiaryEntry, index: number) => void;
}

export function MealSection({ meal, entries, calories, dateKey, onEdit, onDelete, onRemoveItem }: MealSectionProps) {
  const label = mealLabel(meal);
  return (
    <section aria-labelledby={`meal-${meal}`} data-testid={`meal-${meal}`} className="border-t border-border pt-2">
      <div className={ROW_GRID}>
        <h2 id={`meal-${meal}`} className="flex min-w-0 items-center justify-between gap-2 px-1 text-base font-semibold">
          <span className="min-w-0 truncate">{label}</span>
          <span data-testid={`meal-${meal}-kcal`} className={cn(KCAL, "font-normal text-muted-foreground")}>
            {entries.length === 0 ? "—" : `${calories} kcal`}
          </span>
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
      {entries.length > 0 && (
        <ul>
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
