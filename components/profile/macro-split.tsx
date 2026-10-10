"use client";

import { NumberStepper } from "@/components/profile/number-stepper";
import { PERCENT_STEP } from "@/lib/profile";
import { cn } from "@/lib/utils";

export interface MacroPercentInputs {
  protein: string;
  carbs: string;
  fat: string;
}

const ROWS = [
  { key: "protein", label: "Proteína", dot: "bg-protein" },
  { key: "carbs", label: "Hidratos", dot: "bg-carbs" },
  { key: "fat", label: "Gordura", dot: "bg-fat" },
] as const;

interface MacroSplitProps {
  values: MacroPercentInputs;
  onChange: (key: keyof MacroPercentInputs, value: string) => void;
  total: number;
}

export function MacroSplit({ values, onChange, total }: MacroSplitProps) {
  const ok = total === 100;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-sm font-medium">Distribuição de macros</legend>
      {ROWS.map(({ key, label, dot }) => (
        <div key={key} className="flex items-center gap-3">
          <span className={cn("size-2.5 shrink-0 rounded-full", dot)} aria-hidden />
          <span className="w-16 shrink-0 text-sm">{label}</span>
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
            className="flex-1"
          />
        </div>
      ))}
      <p data-testid="macro-total" role={ok ? undefined : "alert"} className={cn("text-sm tabular-nums", ok ? "text-muted-foreground" : "text-destructive")}>
        Total: {total}% {ok ? "" : "· A soma tem de ser 100%."}
      </p>
    </fieldset>
  );
}
