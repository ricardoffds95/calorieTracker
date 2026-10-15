"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Avatar } from "@/components/profile/avatar";
import { Button } from "@/components/ui/button";
import { AVATARS, AVATARS_SHOWN } from "@/lib/avatars";
import { cn } from "@/lib/utils";

interface AvatarGridProps {
  /** The chosen avatar id, or null when none was chosen yet. */
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** The pictures the account can have: the first few, and the rest behind "Show more" (open when the chosen one is among them). */
export function AvatarGrid({ value, onChange, disabled = false }: AvatarGridProps) {
  const chosenIndex = AVATARS.findIndex((a) => a.id === value);
  const [more, setMore] = useState(chosenIndex >= AVATARS_SHOWN);
  const shown = more ? AVATARS : AVATARS.slice(0, AVATARS_SHOWN);

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Icon" className="grid grid-cols-3 gap-4 py-2">
        {shown.map((avatar) => {
          const selected = value === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={avatar.label}
              disabled={disabled}
              onClick={() => !selected && onChange(avatar.id)}
              className={cn("mx-auto rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring", selected && "ring-2 ring-primary")}
            >
              <Avatar id={avatar.id} className="size-20" />
            </button>
          );
        })}
      </div>
      {AVATARS.length > AVATARS_SHOWN && (
        <Button type="button" variant="ghost" className="h-11 text-muted-foreground" aria-expanded={more} onClick={() => setMore((value) => !value)}>
          {more ? (
            <>
              <ChevronUp aria-hidden /> Show less
            </>
          ) : (
            <>
              <ChevronDown aria-hidden /> Show more · {AVATARS.length - AVATARS_SHOWN}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
