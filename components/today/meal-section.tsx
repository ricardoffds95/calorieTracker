import Link from "next/link";
import { Plus } from "lucide-react";
import { EntryRow } from "@/components/today/entry-row";
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
      <div className="flex items-center justify-between">
        <h2 id={`meal-${meal}`} className="flex flex-1 items-baseline justify-between pr-2 text-base font-semibold">
          {label}
          <span data-testid={`meal-${meal}-kcal`} className="text-sm font-normal text-muted-foreground tabular-nums">
            {entries.length === 0 ? "—" : `${calories} kcal`}
          </span>
        </h2>
        <Link
          href={`/registar?meal=${meal}&d=${dateKey}`}
          aria-label={`Adicionar a ${label}`}
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
