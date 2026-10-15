"use client";

import Body from "react-muscle-highlighter";
import { Button } from "@/components/ui/button";
import { BODY_ZONES, MUSCLES, MUSCLE_LABELS, toggleZone, zonesOf, type BodyZone, type Muscle } from "@/lib/training";
import { cn } from "@/lib/utils";

export type BodyView = "front" | "back";

interface BodyPickerProps {
  selected: readonly Muscle[];
  onChange: (muscles: Muscle[]) => void;
  view: BodyView;
  onViewChange: (view: BodyView) => void;
  /** The drawing: the male or the female body. */
  gender?: "male" | "female";
}

const isZone = (value: string | undefined): value is BodyZone => value !== undefined && (BODY_ZONES as readonly string[]).includes(value);

/** The body, front or back: tap a muscle to choose it (several at once), tap again to let it go. */
export function BodyPicker({ selected, onChange, view, onViewChange, gender = "male" }: BodyPickerProps) {
  const data = zonesOf(selected).map((slug) => ({ slug, intensity: 1 }));
  return (
    <div className="flex flex-col items-center gap-3">
      <div role="group" aria-label="Body side" className="grid w-full max-w-60 grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(["front", "back"] as const).map((side) => (
          <Button
            key={side}
            type="button"
            variant="ghost"
            aria-pressed={view === side}
            className="h-10 text-sm text-muted-foreground aria-pressed:bg-card aria-pressed:text-foreground dark:aria-pressed:bg-background"
            onClick={() => onViewChange(side)}
          >
            {side === "front" ? "Front" : "Back"}
          </Button>
        ))}
      </div>
      <div data-testid="body" data-view={view} data-gender={gender} className="flex w-full justify-center">
        <Body
          side={view}
          gender={gender}
          scale={0.9}
          data={data}
          colors={["var(--primary)"]}
          defaultFill="var(--body-color)"
          border="var(--background)"
          onBodyPartPress={(part) => {
            if (isZone(part.slug)) onChange(toggleZone(selected, part.slug));
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
