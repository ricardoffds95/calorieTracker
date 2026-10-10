"use client";

import { useState } from "react";
import { ItemsEditor, fromEditable, toEditable, type EditableItem } from "@/components/log/items-editor";
import { PhotoPicker } from "@/components/log/photo-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { requestAiParse } from "@/lib/ai-client";
import type { AiImage } from "@/lib/image";
import type { FoodItem } from "@/lib/nutrition";
import { sumItems } from "@/lib/nutrition";
import { AI_MAX_TEXT_LENGTH } from "@/lib/schemas";

interface AiPanelProps {
  mealName: string;
  pending: boolean;
  onClose: () => void;
  onAdd: (items: FoodItem[]) => void;
  onSaveMeal: (name: string, items: FoodItem[]) => void;
}

export function AiPanel({ mealName, pending, onClose, onAdd, onSaveMeal }: AiPanelProps) {
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<AiImage | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<EditableItem[] | null>(null);
  const [mealTitle, setMealTitle] = useState("");

  const canAnalyze = !analyzing && (photo !== null || text.trim().length > 0);

  async function analyze() {
    setError(null);
    setAnalyzing(true);
    const result = await requestAiParse(photo ? { type: "image", ...photo } : { type: "text", text });
    setAnalyzing(false);
    if (result.ok) setRows(toEditable(result.items));
    else setError(result.message);
  }

  const items = rows ? fromEditable(rows) : null;
  const totals = items ? sumItems(items) : null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>Registar com IA</SheetTitle>
          <SheetDescription>
            {rows ? "Revê os valores antes de adicionar. As estimativas da IA podem falhar." : "Descreve o que comeste ou tira uma foto do prato."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {!rows ? (
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
              <Button type="button" size="lg" className="h-11" disabled={!canAnalyze} onClick={analyze}>
                {analyzing ? "A analisar…" : "Analisar"}
              </Button>
            </>
          ) : (
            <>
              <ItemsEditor rows={rows} onChange={setRows} />
              {totals && (
                <p className="text-sm tabular-nums" data-testid="ai-totals">
                  Total: <strong>{totals.total_calories} kcal</strong> · P {totals.total_protein} · H {totals.total_carbs} · G {totals.total_fat}
                </p>
              )}
              <Button type="button" size="lg" className="h-11" disabled={!items || pending} onClick={() => items && onAdd(items)}>
                {pending ? "A adicionar…" : `Adicionar ${rows.length === 1 ? "1 item" : `${rows.length} itens`} a ${mealName.toLowerCase()}`}
              </Button>
              <div className="flex gap-2">
                <Input aria-label="Nome da refeição a guardar" placeholder="Nome da refeição" className="h-11 flex-1" value={mealTitle} onChange={(e) => setMealTitle(e.target.value)} />
                <Button type="button" variant="outline" className="h-11" disabled={!items || !mealTitle.trim()} onClick={() => items && onSaveMeal(mealTitle, items)}>
                  Guardar refeição
                </Button>
              </div>
              <Button type="button" variant="ghost" className="h-11" onClick={() => setRows(null)}>
                Voltar
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
