"use client";

import { useState } from "react";
import { Minus, Plus, Star } from "lucide-react";
import { DateField } from "@/components/training/date-field";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { parseDateKey } from "@/lib/dates";
import { DEFAULT_MINUTES, MAX_ACTIVITY_NAME, MAX_NOTES, MINUTES_PRESETS, estimateCalories, parseMinutes, stepMinutes, validateCardio } from "@/lib/cardio";
import { useProfile } from "@/lib/queries/profile";
import type { Activity } from "@/lib/queries/activities";
import { cn } from "@/lib/utils";

export interface CardioValues {
  name: string;
  minutes: number;
  notes: string | null;
  date: string;
  /** "Other" only: keep the sport as one of the user's own. */
  save: boolean;
  /** The estimate shown (null without a MET or a weight), and what it was made from. */
  calories: number | null;
  weightKg: number | null;
}

interface CardioSheetProps {
  userId: string;
  /** The built-in or own sport; null for "Other" (the user writes its name). */
  activity: Activity | null;
  initialDate: string;
  pending: boolean;
  /** A problem found when adding (e.g. the sport name is already saved). */
  error: string | null;
  onAdd: (values: CardioValues) => void;
  onClose: () => void;
}

/** A cardio training or a sport: the time, the day and a note (the pace, the distance...), with an estimate of the calories. */
export function CardioSheet({ userId, activity, initialDate, pending, error, onAdd, onClose }: CardioSheetProps) {
  const weightKg = useProfile(userId).data?.weight_kg ?? null;
  const [name, setName] = useState("");
  const [minutesText, setMinutesText] = useState(String(DEFAULT_MINUTES));
  const [date, setDate] = useState(initialDate);
  const [notes, setNotes] = useState("");
  const [save, setSave] = useState(false);

  const minutes = parseMinutes(minutesText);
  const checked = validateCardio({ name: activity ? activity.name : name, minutes, notes });
  const calories = minutes ? estimateCalories(activity?.met, weightKg, minutes) : null;
  const ready = checked.ok && parseDateKey(date) !== null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{activity ? activity.name : "Other sport"}</SheetTitle>
          <SheetDescription>{activity?.met ? `MET ${activity.met} · Compendium of Physical Activities` : "Cardio & sport"}</SheetDescription>
        </SheetHeader>
        <form
          id="cardio-form"
          noValidate
          className="flex flex-col gap-4 px-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (checked.ok && ready) onAdd({ name: checked.name, minutes: checked.minutes, notes: checked.notes, date, save: !activity && save, calories, weightKg });
          }}
        >
          {!activity && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cardio-name">Sport name</Label>
              <Input id="cardio-name" className="h-11" placeholder="e.g. Beach volleyball" maxLength={MAX_ACTIVITY_NAME + 10} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="cardio-minutes">Time (min)</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label="Less time" onClick={() => setMinutesText(String(stepMinutes(minutes, -1)))}>
                <Minus aria-hidden />
              </Button>
              <Input id="cardio-minutes" inputMode="numeric" className="h-11 text-center text-lg tabular-nums" value={minutesText} onChange={(e) => setMinutesText(e.target.value)} />
              <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label="More time" onClick={() => setMinutesText(String(stepMinutes(minutes, 1)))}>
                <Plus aria-hidden />
              </Button>
            </div>
            <div role="group" aria-label="Usual times" className="grid grid-cols-4 gap-1">
              {MINUTES_PRESETS.map((value) => (
                <Button key={value} type="button" variant={minutes === value ? "default" : "outline"} aria-pressed={minutes === value} className="h-10 text-sm" onClick={() => setMinutesText(String(value))}>
                  {value}
                </Button>
              ))}
            </div>
          </div>

          <DateField value={date} onChange={setDate} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cardio-notes">Notes</Label>
            <Textarea id="cardio-notes" rows={3} placeholder="e.g. 5 km, 5:30/km" maxLength={MAX_NOTES + 50} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {calories !== null && (
            <p data-testid="cardio-kcal" className="text-sm">
              ≈ {calories} kcal <span className="text-muted-foreground">· estimate</span>
            </p>
          )}
          {activity?.met && weightKg === null && <p className="text-xs text-muted-foreground">Add your weight in Profile for kcal</p>}
          {activity?.name === "Padel" && <p className="text-xs text-muted-foreground">Padel is not in the Compendium: the value is tennis doubles.</p>}

          {!activity && (
            <button
              type="button"
              aria-pressed={save}
              onClick={() => setSave((value) => !value)}
              className={cn("flex min-h-12 items-center gap-3 rounded-md border px-3 text-left text-sm font-medium", save ? "border-primary bg-primary/10" : "border-input text-muted-foreground")}
            >
              <Star aria-hidden className={cn("size-7 shrink-0", save ? "fill-primary text-primary" : "text-muted-foreground")} />
              Save to favorites
            </button>
          )}
          {!checked.ok && <Hint>{checked.message}</Hint>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <SheetFooter>
          <Button type="submit" form="cardio-form" size="lg" className="h-12" disabled={!ready || pending}>
            {pending ? "Adding…" : "Add to diary"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
