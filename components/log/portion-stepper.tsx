import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOSE_STEP, MAX_DOSES, portionsLabel } from "@/lib/log";

/** Portions of a meal, in steps of 0.5 (meals are counted in portions, foods in grams). */
export function PortionStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const change = (delta: number) => onChange(Math.min(MAX_DOSES, Math.max(DOSE_STEP, value + delta)));
  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Menos porções" disabled={value <= DOSE_STEP} onClick={() => change(-DOSE_STEP)}>
        <Minus aria-hidden />
      </Button>
      <output aria-label="Porções" aria-live="polite" className="min-w-24 text-center text-base font-semibold tabular-nums">
        {portionsLabel(value)}
      </output>
      <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Mais porções" disabled={value >= MAX_DOSES} onClick={() => change(DOSE_STEP)}>
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
