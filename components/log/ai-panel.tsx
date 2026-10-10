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
import type { FoodItem } from "@/lib/nutrition";
import { AI_MAX_TEXT_LENGTH } from "@/lib/schemas";

interface AiPanelProps {
  userId: string;
  initialTarget: LogTarget;
  now: Date;
  onClose: () => void;
  onAdded: (message: string, day: string) => void;
}

type Result = { name: string; items: FoodItem[] };

export function AiPanel({ userId, initialTarget, now, onClose, onAdded }: AiPanelProps) {
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
    if (response.ok) setResult({ name: response.name, items: response.items });
    else setError(response.message);
  }

  const editedItems = editing ? fromEditable(editing.rows) : null;
  const editedName = editing?.name.trim() ?? "";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{result && !editing ? result.name : "Registar com IA"}</SheetTitle>
          <SheetDescription>
            {editing
              ? "Corrige o nome, as quantidades ou remove itens."
              : result
                ? "Estimativa da IA: confirma os valores antes de guardar."
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
                  setResult({ name: editedName, items: editedItems });
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
