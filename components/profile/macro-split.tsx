"use client";

import { NumberStepper } from "@/components/profile/number-stepper";
import { Input } from "@/components/ui/input";
import { PERCENT_STEP } from "@/lib/profile";
import { cn } from "@/lib/utils";

export interface MacroPercentInputs {
  protein: string;
  carbs: string;
  fat: string;
}

const ROWS = [
  { key: "protein", label: "Protein", dot: "bg-protein" },
  { key: "carbs", label: "Carbs", dot: "bg-carbs" },
  { key: "fat", label: "Fat", dot: "bg-fat" },
] as const;

export interface MacroGramInputs {
  protein: string;
  carbs: string;
  fat: string;
}

interface MacroSplitProps {
  values: MacroPercentInputs;
  onChange: (key: keyof MacroPercentInputs, value: string) => void;
  /** The same macros in grams, editable next to the percentage: each one updates the other. */
  grams: MacroGramInputs;
  onGramsChange: (key: keyof MacroGramInputs, value: string) => void;
  gramsErrors: Partial<Record<keyof MacroGramInputs, string>>;
  total: number;
  /** Calories the grams add up to. */
  calories: number;
}

export function MacroSplit({ values, onChange, grams, onGramsChange, gramsErrors, total, calories }: MacroSplitProps) {
  const ok = total === 100;
  const gramsError = Object.values(gramsErrors).find(Boolean);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Macro split</legend>
      {ROWS.map(({ key, label, dot }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="flex w-[4.5rem] shrink-0 items-center gap-1.5 text-sm">
            <span className={cn("size-2.5 shrink-0 rounded-full", dot)} aria-hidden />
            {label}
          </span>
          <NumberStepper
            label={`${label} %`}
            value={values[key]}
            onChange={(v) => onChange(key, v)}
            step={PERCENT_STEP}
            min={0}
            max={100}
            unit="%"
            fallback={0}
            invalid={!ok}
            compact
            className="min-w-0 flex-1"
          />
          <div className="flex w-[4.25rem] shrink-0 items-center gap-1">
            <Input
              aria-label={`${label} (g)`}
              inputMode="numeric"
              aria-invalid={gramsErrors[key] ? true : undefined}
              value={grams[key]}
              onChange={(e) => onGramsChange(key, e.target.value)}
              className="h-9 min-w-0 px-1 text-center text-sm tabular-nums"
            />
            <span className="text-sm text-muted-foreground">g</span>
          </div>
        </div>
      ))}
      <p data-testid="macro-total" role={ok ? undefined : "alert"} className={cn("text-sm tabular-nums", ok ? "text-muted-foreground" : "text-destructive")}>
        Total: {total}% {ok ? `· ${Number.isFinite(calories) ? calories : "—"} kcal` : "· Must total 100%"}
      </p>
      {gramsError && (
        <p role="alert" className="text-sm text-destructive">
          {gramsError}
        </p>
      )}
    </fieldset>
  );
}
