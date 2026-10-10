"use client";

import { useState } from "react";
import { ChevronRight, Pencil, X } from "lucide-react";
import { ARROW_SLOT, KCAL, ROW_GRID } from "@/components/today/row-layout";
import { Button } from "@/components/ui/button";
import type { DiaryEntry } from "@/lib/diary";
import { portionsLabel } from "@/lib/log";
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
      <div className={ROW_GRID}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={`${entry.name}, ${items.length} itens`}
          onClick={() => setExpanded((v) => !v)}
          className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-sm px-1 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ChevronRight className={cn(ARROW_SLOT, "text-muted-foreground motion-safe:transition-transform", expanded && "rotate-90")} aria-hidden />
            <span className="min-w-0 py-1">
              <span className="line-clamp-2 break-words">{entry.name}</span>
              {entry.doses !== null && entry.doses !== 1 && <span className="block text-xs text-muted-foreground">{portionsLabel(entry.doses)}</span>}
            </span>
          </span>
          <span data-testid="row-kcal" className={KCAL}>{entry.calories} kcal</span>
        </button>
        <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label={`Editar ${entry.name}`} onClick={() => onEdit(entry)}>
          <Pencil aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label={`Remover ${entry.name}`} onClick={() => onDelete(entry)}>
          <X aria-hidden />
        </Button>
      </div>
      {expanded && (
        <ul id={panelId} className="ml-6 border-l border-border pl-3">
          {items.map((item, index) => (
            <li key={`${item.name}-${index}`} className={cn(ROW_GRID, "grid-cols-[minmax(0,1fr)_2.75rem_2.75rem] text-sm")}>
              <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1">
                <span className="min-w-0 py-2">
                  <span className="line-clamp-2 break-words">
                    {item.name}
                    {item.quantity_g !== null && <span className="text-muted-foreground"> · {item.quantity_g} g</span>}
                  </span>
                </span>
                <span data-testid="row-kcal" className={cn(KCAL, "text-muted-foreground")}>{item.calories} kcal</span>
              </span>
              <span aria-hidden />
              {items.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 text-muted-foreground"
                  aria-label={`Remover ${item.name} de ${entry.name}`}
                  onClick={() => onRemoveItem(entry, index)}
                >
                  <X aria-hidden />
                </Button>
              ) : (
                <span aria-hidden />
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
