"use client";

import Body from "react-muscle-highlighter";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BODY_ZONES, toggleZone, zonesOf, type BodyZone, type Muscle } from "@/lib/training";

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

/** The body, front or back (turn it with the arrow): tap a muscle to choose it (several at once), tap again to let it go. */
export function BodyPicker({ selected, onChange, view, onViewChange, gender = "male" }: BodyPickerProps) {
  // The head and the hair are not muscles: they take the colour of the body, not the library's greys.
  const data = [...zonesOf(selected).map((slug) => ({ slug, intensity: 1 })), { slug: "head" as const, color: "var(--body-color)" }, { slug: "hair" as const, color: "var(--body-color)" }];
  return (
    <div data-testid="body" data-view={view} data-gender={gender} className="relative flex w-full justify-center">
      <Body
        side={view}
        gender={gender}
        scale={1.15}
        data={data}
        colors={["var(--primary)"]}
        defaultFill="var(--body-color)"
        border="var(--background)"
        onBodyPartPress={(part) => {
          if (isZone(part.slug)) onChange(toggleZone(selected, part.slug));
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="absolute top-0 right-0 size-11 rounded-full"
        aria-label="Rotate body"
        onClick={() => onViewChange(view === "front" ? "back" : "front")}
      >
        <RotateCw aria-hidden />
      </Button>
    </div>
  );
}
