"use client";

import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDateKey } from "@/lib/dates";

/** The day a training is added to (a real calendar day). */
export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="training-date">Date</Label>
      <Input id="training-date" type="date" className="block h-11 w-full min-w-0 max-w-full appearance-none" value={value} onChange={(e) => onChange(e.target.value)} />
      {parseDateKey(value) === null && <Hint>Pick a date</Hint>}
    </div>
  );
}
