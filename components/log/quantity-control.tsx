"use client";

import { useState } from "react";
import { Minus, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { MAX_QUANTITY_G, quantitySchema, type QuantityPreset } from "@/lib/log";
import { formatNumberInput, parseDecimalInput } from "@/lib/numbers";

export const GRAMS_STEP = 10;
const SLIDER_MAX = 500;

interface QuantityControlProps {
  grams: number;
  onChange: (grams: number) => void;
  presets: readonly QuantityPreset[];
}

/** Grams with a bar that moves 10 g at a time (and − / + buttons), plus typing an exact value. Nothing is focused on open. */
export function QuantityControl({ grams, onChange, presets }: QuantityControlProps) {
  const [typing, setTyping] = useState<string | null>(null); // null: the field is hidden
  const error = typing !== null ? (quantitySchema.safeParse(parseDecimalInput(typing) ?? Number.NaN).error?.issues[0]?.message ?? null) : null;

  const set = (value: number) => {
    const clamped = Math.min(MAX_QUANTITY_G, Math.max(GRAMS_STEP, value));
    onChange(clamped);
    if (typing !== null) setTyping(formatNumberInput(clamped));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-4xl font-semibold tabular-nums" aria-live="polite" data-testid="grams-value">
        {formatNumberInput(grams)} <span className="text-lg font-normal text-muted-foreground">g</span>
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`Menos ${GRAMS_STEP} g`} disabled={grams <= GRAMS_STEP} onClick={() => set(Math.ceil(grams / GRAMS_STEP) * GRAMS_STEP - GRAMS_STEP)}>
          <Minus aria-hidden />
        </Button>
        <Slider
          aria-label="Quantidade em gramas"
          min={GRAMS_STEP}
          max={SLIDER_MAX}
          step={GRAMS_STEP}
          value={[Math.min(SLIDER_MAX, Math.max(GRAMS_STEP, grams))]}
          onValueChange={([value]) => value !== undefined && set(value)}
        />
        <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`Mais ${GRAMS_STEP} g`} disabled={grams >= MAX_QUANTITY_G} onClick={() => set(Math.floor(grams / GRAMS_STEP) * GRAMS_STEP + GRAMS_STEP)}>
          <Plus aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button key={preset.label} type="button" variant="outline" className="h-9" onClick={() => set(preset.grams)}>
            {preset.label}
          </Button>
        ))}
        <Button type="button" variant="ghost" className="h-9" aria-expanded={typing !== null} onClick={() => setTyping(typing === null ? formatNumberInput(grams) : null)}>
          <Pencil aria-hidden />
          Escrever gramas
        </Button>
      </div>
      {typing !== null && (
        <div className="flex flex-col gap-1.5">
          <Input
            aria-label="Gramas"
            inputMode="decimal"
            autoFocus // the user asked to type: this is the one place where the keyboard should open
            className="h-11 text-base tabular-nums"
            value={typing}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setTyping(e.target.value);
              const value = parseDecimalInput(e.target.value);
              if (value !== null && value > 0) onChange(Math.min(value, MAX_QUANTITY_G));
            }}
          />
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
