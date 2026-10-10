"use client";

import { useState } from "react";
import { ChevronRight, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiaryEntry } from "@/lib/diary";
import { cn } from "@/lib/utils";

interface MealEntryRowProps {
  entry: DiaryEntry;
  onEdit: (entry: DiaryEntry) => void;
  onDelete: (entry: DiaryEntry) => void;
  onRemoveItem: (entry: DiaryEntry, index: number) => void;
}

export function MealEntryRow({ entry, onEdit, onDelete, onRemoveItem }: MealEntryRowProps) {
  const [expanded, setExpanded] = useState(false);
  const items = entry.items ?? [];
  const panelId = `meal-items-${entry.id}`;

  return (
    <li data-testid="entry-row">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${entry.name}, ${items.length} itens`}
          onClick={() => setExpanded((v) => !v)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-sm px-1 text-left"
        >
          <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground motion-safe:transition-transform", expanded && "rotate-90")} aria-hidden />
          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          <span className="shrink-0 text-sm tabular-nums">{entry.calories} kcal</span>
        </button>
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Editar ${entry.name}`} onClick={() => onEdit(entry)}>
          <Pencil aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0 text-muted-foreground" aria-label={`Remover ${entry.name}`} onClick={() => onDelete(entry)}>
          <X aria-hidden />
        </Button>
      </div>
      {expanded && (
        <ul id={panelId} className="ml-6 border-l border-border pl-3">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="flex items-center gap-1 text-sm">
              <span className="min-w-0 flex-1 truncate py-2">
                {item.name}
                <span className="text-muted-foreground"> · {item.quantity_g} g</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{item.calories} kcal</span>
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 text-muted-foreground"
                  aria-label={`Remover ${item.name} de ${entry.name}`}
                  onClick={() => onRemoveItem(entry, index)}
                >
                  <X aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
