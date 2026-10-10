"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GRAMS_STEP, MAX_GRAMS, parseIntegerInput, stepValue } from "@/lib/profile";
import { cn } from "@/lib/utils";

export interface MacroGramInputs {
  protein: string;
  carbs: string;
  fat: string;
}

const COLUMNS = [
  { key: "protein", label: "Proteína", tone: "text-protein" },
  { key: "carbs", label: "Hidratos", tone: "text-carbs" },
  { key: "fat", label: "Gordura", tone: "text-fat" },
] as const;

interface MacroGramsProps {
  values: MacroGramInputs;
  onChange: (key: keyof MacroGramInputs, value: string) => void;
  /** Calories the grams add up to (the calories field follows the grams). */
  calories: number;
  /** Message per macro when its text is not a whole number of grams. */
  errors: Partial<Record<keyof MacroGramInputs, string>>;
}

/** The daily goals in grams, also editable: changing one updates the calories and the percentages above. */
export function MacroGrams({ values, onChange, calories, errors }: MacroGramsProps) {
  return (
    <section aria-label="Metas em gramas" data-testid="goals-preview" className="rounded-md bg-muted p-4">
      <h3 className="mb-1 text-sm font-medium">Metas em gramas</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Também podes mudar os gramas: as calorias e as percentagens acompanham.{" "}
        <span className="tabular-nums">Total: {Number.isFinite(calories) ? calories : "—"} kcal</span>
      </p>
      <div className="grid grid-cols-3 gap-3">
        {COLUMNS.map(({ key, label, tone }) => {
          const current = parseIntegerInput(values[key]);
          const apply = (delta: number) => onChange(key, String(stepValue(current, delta, 0, MAX_GRAMS, 0)));
          return (
            <div key={key} className="flex flex-col items-center gap-1.5">
              <label htmlFor={`grams-${key}`} className={cn("text-xs font-medium", tone)}>
                {label} (g)
              </label>
              <Input
                id={`grams-${key}`}
                inputMode="numeric"
                aria-invalid={errors[key] ? true : undefined}
                value={values[key]}
                onChange={(e) => onChange(key, e.target.value)}
                className={cn("h-11 min-w-0 text-center text-lg font-semibold tabular-nums", tone)}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="icon" className="size-10" aria-label={`Diminuir ${label} (g)`} onClick={() => apply(-GRAMS_STEP)}>
                  <Minus aria-hidden />
                </Button>
                <Button type="button" variant="outline" size="icon" className="size-10" aria-label={`Aumentar ${label} (g)`} onClick={() => apply(GRAMS_STEP)}>
                  <Plus aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {Object.values(errors).some(Boolean) && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {Object.values(errors).find(Boolean)}
        </p>
      )}
    </section>
  );
}
