"use client";

import { useState } from "react";
import { ItemsEditor, fromEditable, toEditable, type EditableItem } from "@/components/log/items-editor";
import { MealActions } from "@/components/log/meal-actions";
import { PhotoPicker } from "@/components/log/photo-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { requestAiParse } from "@/lib/ai-client";
import type { AiImage } from "@/lib/image";
import type { LogTarget } from "@/lib/log";
import type { FoodSearchResult } from "@/lib/food-search";
import { per100gFromItems, type FoodItem } from "@/lib/nutrition";
import { AI_MAX_TEXT_LENGTH } from "@/lib/schemas";

interface AiPanelProps {
  userId: string;
  /** Where the meal is logged; with `onAdded` and `now`, only needed when the panel logs (no `onUse`). */
  initialTarget?: LogTarget;
  now?: Date;
  onClose: () => void;
  onAdded?: (message: string, day: string) => void;
  /** Instead of logging, hand the result back (used while creating a saved meal or food). */
  onUse?: (result: { name: string; kind: "food" | "meal"; items: FoodItem[] }, close: () => void) => void;
  /** A single food (not a meal): hand it over per 100 g with the estimated grams, to be added like a searched food. */
  onFood?: (food: FoodSearchResult, grams: number) => void;
  /** Button text for each kind of result (a single food or a whole meal). */
  useLabels?: { food: string; meal: string };
  /** Shown under a whole-meal result when `onUse` only wants one food. */
  mealNote?: string;
}

type Result = { name: string; kind: "food" | "meal"; items: FoodItem[] };

export function AiPanel({ userId, initialTarget, now, onClose, onAdded, onUse, onFood, useLabels = { food: "Usar", meal: "Usar" }, mealNote }: AiPanelProps) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<AiImage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [editing, setEditing] = useState<{ name: string; rows: EditableItem[] } | null>(null);

  async function analyze() {
    setError(null);
    setAnalyzing(true);
    const response = await requestAiParse(photo ? { type: "image", ...photo } : { type: "text", text });
    setAnalyzing(false);
    if (response.ok) {
      const per100 = response.kind === "food" && !onUse ? per100gFromItems(response.items) : null;
      const [item] = response.items;
      if (onFood && per100 && item?.quantity_g) {
        onFood({ id: `ai-${Date.now()}`, source: "off", name: response.name, ...per100 }, item.quantity_g);
        return;
      }
      setResult({ name: response.name, kind: response.kind, items: response.items });
    }
    else setError(response.message);
  }

  const editedItems = editing ? fromEditable(editing.rows) : null;
  const editedName = editing?.name.trim() ?? "";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{result && !editing ? result.name : onUse ? "Procurar com IA" : "Registar com IA"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Corrige o nome, as quantidades ou remove itens."
              : result
                ? `${result.kind === "food" ? "Alimento" : `Refeição com ${result.items.length} ${result.items.length === 1 ? "alimento" : "alimentos"}`} · estimativa da IA: confirma os valores.`
                : "Descreve o que comeste ou tira uma foto do prato."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {!result && (
            <>
              {!photo && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ai-text">O que comeste?</Label>
                  <Textarea
                    id="ai-text"
                    placeholder="ex: 150 g de frango grelhado com arroz e salada"
                    maxLength={AI_MAX_TEXT_LENGTH}
                    className="min-h-24 text-base"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
              )}
              <PhotoPicker onChange={setPhoto} disabled={analyzing} />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="button" size="lg" className="h-11" disabled={analyzing || (!photo && !text.trim())} onClick={analyze}>
                {analyzing ? "A analisar…" : "Analisar"}
              </Button>
            </>
          )}

          {result && !editing && (
            <>
              <ul className="flex flex-col text-sm" data-testid="ai-items">
                {result.items.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="flex justify-between gap-3 border-b border-border py-2">
                    <span className="min-w-0 truncate">
                      {item.name}
                      {item.quantity_g !== null && <span className="text-muted-foreground"> · {item.quantity_g} g</span>}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{item.calories} kcal</span>
                  </li>
                ))}
              </ul>
              {onUse || !initialTarget || !now || !onAdded ? (
                <>
                  {result.kind === "meal" && mealNote && <p className="text-sm text-muted-foreground">{mealNote}</p>}
                  <Button type="button" size="lg" className="h-11" onClick={() => onUse?.(result, onClose)}>
                    {useLabels[result.kind]}
                  </Button>
                  <Button type="button" variant="ghost" className="h-11" onClick={() => setResult(null)}>
                    Tentar outra vez
                  </Button>
                </>
              ) : (
              <MealActions
                key={JSON.stringify(result)}
                userId={userId}
                initialTarget={initialTarget}
                now={now}
                name={result.name}
                items={result.items}
                onAdded={onAdded}
                onEdit={() => setEditing({ name: result.name, rows: toEditable(result.items) })}
              />
              )}
            </>
          )}

          {editing && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ai-meal-name">Nome da refeição</Label>
                <Input id="ai-meal-name" className="h-11" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <ItemsEditor rows={editing.rows} onChange={(rows) => setEditing({ ...editing, rows })} />
              <Button
                type="button"
                size="lg"
                className="h-11"
                disabled={!editedItems || !editedName}
                onClick={() => {
                  if (!editedItems) return;
                  setResult({ kind: result?.kind ?? "meal", name: editedName, items: editedItems });
                  setEditing(null);
                }}
              >
                Concluir
              </Button>
              <Button type="button" variant="ghost" className="h-11" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
