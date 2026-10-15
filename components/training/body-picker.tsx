"use client";

import Model, { type IMuscleStats } from "react-body-highlighter";
import { Button } from "@/components/ui/button";
import { BODY_ZONES, MUSCLES, MUSCLE_LABELS, toggleZone, zonesOf, type BodyZone, type Muscle } from "@/lib/training";
import { cn } from "@/lib/utils";

export type BodyView = "anterior" | "posterior";

interface BodyPickerProps {
  selected: readonly Muscle[];
  onChange: (muscles: Muscle[]) => void;
  view: BodyView;
  onViewChange: (view: BodyView) => void;
}

const isZone = (value: string): value is BodyZone => (BODY_ZONES as readonly string[]).includes(value);

/** The body, front or back: tap a muscle to choose it (several at once), tap again to let it go. */
export function BodyPicker({ selected, onChange, view, onViewChange }: BodyPickerProps) {
  const zones = zonesOf(selected);
  return (
    <div className="flex flex-col items-center gap-3">
      <div role="group" aria-label="Body side" className="grid w-full max-w-60 grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["anterior", "posterior"] as const).map((side) => (
          <Button
            key={side}
            type="button"
            variant="ghost"
            aria-pressed={view === side}
            className="h-10 text-sm text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
            onClick={() => onViewChange(side)}
          >
            {side === "anterior" ? "Front" : "Back"}
          </Button>
        ))}
      </div>
      <div data-testid="body" data-view={view} className="w-56 max-w-full">
        <Model
          type={view}
          bodyColor="var(--body-color)"
          highlightedColors={["var(--primary)"]}
          data={zones.length > 0 ? [{ name: "chosen", muscles: zones, frequency: 1 }] : []}
          style={{ width: "100%" }}
          svgStyle={{ cursor: "pointer" }}
          onClick={({ muscle }: IMuscleStats) => {
            if (isZone(muscle)) onChange(toggleZone(selected, muscle));
          }}
        />
      </div>
      <details className="w-full">
        <summary className="flex min-h-11 cursor-pointer items-center justify-center text-sm text-muted-foreground">By name</summary>
        <div role="group" aria-label="Muscles" className="flex flex-wrap justify-center gap-2 pt-1 pb-2">
          {MUSCLES.map((muscle) => {
            const on = selected.includes(muscle);
            return (
              <button
                key={muscle}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((m) => m !== muscle) : [...selected, muscle])}
                className={cn("min-h-9 rounded-full border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground")}
              >
                {MUSCLE_LABELS[muscle]}
              </button>
            );
          })}
        </div>
      </details>
    </div>
  );
}
