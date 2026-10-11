"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rescaleEntry } from "@/lib/diary-edit";
import type { FoodItem } from "@/lib/nutrition";
import { parseDecimalInput } from "@/lib/numbers";

/**
 * An item being edited: `base` is the original (nutrients are always rescaled from it, so no drift).
 * `quantity` is null for an item without grams (a meal defined per portion): its values stay as they are.
 */
export interface EditableItem {
  key: string;
  base: FoodItem;
  name: string;
  quantity: string | null;
}

let nextKey = 0;
export function toEditable(items: readonly FoodItem[]): EditableItem[] {
  return items.map((base) => ({
    key: `item-${nextKey++}`,
    base,
    name: base.name,
    quantity: base.quantity_g === null ? null : String(base.quantity_g),
  }));
}

/** The current items, or null while any row is invalid (empty name, bad quantity). */
export function fromEditable(rows: readonly EditableItem[]): FoodItem[] | null {
  const items: FoodItem[] = [];
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) return null;
    if (row.quantity === null) {
      items.push({ ...row.base, name });
      continue;
    }
    const quantity = parseDecimalInput(row.quantity);
    if (quantity === null || quantity <= 0) return null;
    const scaled = quantity === row.base.quantity_g ? row.base : { ...row.base, ...rescaleEntry(row.base, quantity) };
    items.push({ ...scaled, name, quantity_g: quantity });
  }
  return items.length > 0 ? items : null;
}

interface ItemsEditorProps {
  rows: EditableItem[];
  onChange: (rows: EditableItem[]) => void;
  /** A meal being created may be emptied; an existing one always keeps at least one item. */
  allowEmpty?: boolean;
}

export function ItemsEditor({ rows, onChange, allowEmpty = false }: ItemsEditorProps) {
  const update = (key: string, patch: Partial<EditableItem>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <ul className="flex flex-col gap-3" data-testid="items-editor">
      {rows.map((row) => {
        const [item] = fromEditable([row]) ?? [];
        return (
          <li key={row.key} className="flex flex-col gap-1.5 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Input aria-label="Item name" className="h-11 flex-1" value={row.name} onChange={(e) => update(row.key, { name: e.target.value })} />
              {row.quantity !== null && (
                <>
                  <Input
                    aria-label={`Amount of ${row.name} (g)`}
                    inputMode="decimal"
                    className="h-11 w-20 text-right tabular-nums"
                    value={row.quantity}
                    aria-invalid={item ? undefined : true}
                    onChange={(e) => update(row.key, { quantity: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-muted-foreground"
                aria-label={`Remove ${row.name}`}
                disabled={!allowEmpty && rows.length <= 1}
                onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              >
                <X aria-hidden />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {item ? `${item.calories} kcal · P ${item.protein_g} · C ${item.carbs_g} · F ${item.fat_g}` : "Needs a name and an amount"}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
