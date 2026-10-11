import { X } from "lucide-react";
import { ARROW_SLOT, KCAL, ROW_GRID } from "@/components/today/row-layout";
import { Button } from "@/components/ui/button";
import type { DiaryEntry } from "@/lib/diary";

interface EntryRowProps {
  entry: DiaryEntry;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
}

export function EntryRow({ entry, onEdit, onDelete }: EntryRowProps) {
  return (
    <li className={ROW_GRID} data-testid="entry-row">
      <button
        type="button"
        aria-label={`Edit ${entry.name}`}
        onClick={() => onEdit(entry)}
        className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm px-1 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={ARROW_SLOT} />
          <span className="min-w-0 py-1">
            <span className="line-clamp-2 break-words">{entry.name}</span>
            {entry.quantity_g !== null && <span className="block text-xs text-muted-foreground">{entry.quantity_g} g</span>}
          </span>
        </span>
        <span data-testid="row-kcal" className={KCAL}>{entry.calories} kcal</span>
      </button>
      <span aria-hidden />
      <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label={`Remove ${entry.name}`} onClick={() => onDelete(entry)}>
        <X aria-hidden />
      </Button>
    </li>
  );
}
