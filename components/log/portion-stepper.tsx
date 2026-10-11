import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOSE_PRESETS, DOSE_STEP, MAX_DOSES, portionsLabel, roundDoses } from "@/lib/log";

/** Portions of a meal, 0.1 at a time with shortcuts (meals are counted in portions, foods in grams). */
export function PortionStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const change = (delta: number) => onChange(Math.min(MAX_DOSES, Math.max(DOSE_STEP, roundDoses(value + delta))));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Fewer portions" disabled={value <= DOSE_STEP} onClick={() => change(-DOSE_STEP)}>
          <Minus aria-hidden />
        </Button>
        <output aria-label="Portions" aria-live="polite" className="min-w-24 text-center text-base font-semibold tabular-nums">
          {portionsLabel(value)}
        </output>
        <Button type="button" variant="outline" size="icon" className="size-11" aria-label="More portions" disabled={value >= MAX_DOSES} onClick={() => change(DOSE_STEP)}>
          <Plus aria-hidden />
        </Button>
      </div>
      <div role="group" aria-label="Common portions" className="flex gap-2">
        {DOSE_PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            aria-label={`Use ${portionsLabel(preset)}`}
            aria-pressed={value === preset}
            className="h-9 px-3 aria-pressed:border-primary aria-pressed:text-primary"
            onClick={() => onChange(preset)}
          >
            {preset}
          </Button>
        ))}
      </div>
    </div>
  );
}
