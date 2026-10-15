"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface EquipmentFilterProps {
  /** Every equipment there is. */
  options: readonly string[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}

/** What the button says: nothing chosen, the one chosen, or how many. */
export function equipmentLabel(selected: readonly string[]): string {
  if (selected.length === 0) return "Any equipment";
  if (selected.length === 1) return selected[0]!;
  return `${selected.length} equipment`;
}

/** Choose one or more equipment: an exercise is listed when it needs any of them. */
export function EquipmentFilter({ options, selected, onChange }: EquipmentFilterProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Equipment"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{equipmentLabel(selected)}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <Sheet open onOpenChange={(isOpen) => !isOpen && setOpen(false)}>
          <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle>Equipment</SheetTitle>
              <SheetDescription>{selected.length === 0 ? "Any" : `${selected.length} chosen`}</SheetDescription>
            </SheetHeader>
            <div role="group" aria-label="Equipment choices" className="flex flex-wrap gap-2 px-4">
              {options.map((item) => {
                const on = selected.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange(on ? selected.filter((e) => e !== item) : [...selected, item])}
                    className={cn("min-h-10 rounded-full border px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground")}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <SheetFooter>
              <Button type="button" size="lg" className="h-12" onClick={() => setOpen(false)}>
                Done
              </Button>
              <Button type="button" variant="outline" className="h-11" disabled={selected.length === 0} onClick={() => onChange([])}>
                Clear
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
