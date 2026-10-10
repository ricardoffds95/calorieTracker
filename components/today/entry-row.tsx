import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiaryEntry } from "@/lib/diary";

interface EntryRowProps {
  entry: DiaryEntry;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
}

export function EntryRow({ entry, onEdit, onDelete }: EntryRowProps) {
  return (
    <li className="flex items-center gap-1" data-testid="entry-row">
      <button
        type="button"
        aria-label={`Editar ${entry.name}`}
        onClick={() => onEdit(entry)}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-sm px-1 text-left"
      >
        <span className="min-w-0 truncate">
          {entry.name}
          {entry.quantity_g !== null && <span className="text-sm text-muted-foreground"> · {entry.quantity_g} g</span>}
        </span>
        <span className="shrink-0 text-sm tabular-nums">{entry.calories} kcal</span>
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Remover ${entry.name}`} onClick={() => onDelete(entry)}>
        <X aria-hidden />
      </Button>
    </li>
  );
}
