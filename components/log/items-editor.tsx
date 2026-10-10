"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rescaleEntry } from "@/lib/diary-edit";
import type { FoodItem } from "@/lib/nutrition";
import { parseDecimalInput } from "@/lib/numbers";

/** An item being edited: `base` is the original (nutrients are always rescaled from it, so no drift). */
export interface EditableItem {
  key: string;
  base: FoodItem;
  name: string;
  quantity: string;
}

export function toEditable(items: readonly FoodItem[]): EditableItem[] {
  return items.map((base, i) => ({ key: `${i}-${base.name}`, base, name: base.name, quantity: String(base.quantity_g) }));
}

/** The current items, or null while any row is invalid (empty name, bad quantity). */
export function fromEditable(rows: readonly EditableItem[]): FoodItem[] | null {
  const items: FoodItem[] = [];
  for (const row of rows) {
    const quantity = parseDecimalInput(row.quantity);
    const name = row.name.trim();
    if (!name || quantity === null || quantity <= 0) return null;
    const scaled = quantity === row.base.quantity_g ? row.base : { ...row.base, ...rescaleEntry(row.base, quantity) };
    items.push({ ...scaled, name, quantity_g: quantity });
  }
  return items.length > 0 ? items : null;
}

interface ItemsEditorProps {
  rows: EditableItem[];
  onChange: (rows: EditableItem[]) => void;
}

export function ItemsEditor({ rows, onChange }: ItemsEditorProps) {
  const update = (key: string, patch: Partial<EditableItem>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <ul className="flex flex-col gap-3" data-testid="items-editor">
      {rows.map((row) => {
        const [item] = fromEditable([row]) ?? [];
        return (
          <li key={row.key} className="flex flex-col gap-1.5 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Input aria-label="Nome do item" className="h-11 flex-1" value={row.name} onChange={(e) => update(row.key, { name: e.target.value })} />
              <Input
                aria-label={`Quantidade de ${row.name} (g)`}
                inputMode="decimal"
                className="h-11 w-20 text-right tabular-nums"
                value={row.quantity}
                aria-invalid={item ? undefined : true}
                onChange={(e) => update(row.key, { quantity: e.target.value })}
              />
              <span className="text-sm text-muted-foreground">g</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground"
                aria-label={`Remover ${row.name}`}
                disabled={rows.length <= 1}
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              >
                <X aria-hidden />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {item ? `${item.calories} kcal · P ${item.protein_g} · H ${item.carbs_g} · G ${item.fat_g}` : "Indica um nome e uma quantidade maior que 0."}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
