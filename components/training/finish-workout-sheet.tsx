"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { DateField } from "@/components/training/date-field";
import { DraftList } from "@/components/training/draft-list";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseDateKey } from "@/lib/dates";
import { MAX_WORKOUT_NAME, workoutProblem, type WorkoutExercise } from "@/lib/training";
import { cn } from "@/lib/utils";

interface FinishWorkoutSheetProps {
  exercises: readonly WorkoutExercise[];
  initialDate: string;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAdd: (values: { name: string; save: boolean; date: string }) => void;
  onClose: () => void;
  pending: boolean;
  error: string | null;
}

/** A workout made on the spot: the name, the day and the star (keep it in Workouts), then Add to diary. */
export function FinishWorkoutSheet({ exercises, initialDate, onMove, onRemove, onAdd, onClose, pending, error }: FinishWorkoutSheetProps) {
  const [name, setName] = useState("");
  const [save, setSave] = useState(true);
  const [date, setDate] = useState(initialDate);
  const problem = workoutProblem(name, exercises);
  const ready = !problem && parseDateKey(date) !== null;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>New workout</SheetTitle>
          <SheetDescription>
            {exercises.length} {exercises.length === 1 ? "exercise" : "exercises"}
          </SheetDescription>
        </SheetHeader>
        <form
          id="finish-form"
          noValidate
          className="flex flex-col gap-4 px-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) onAdd({ name, save, date });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finish-name">Workout name</Label>
            <Input id="finish-name" className="h-11" placeholder="e.g. Back day" maxLength={MAX_WORKOUT_NAME + 20} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {exercises.length > 0 ? <DraftList exercises={exercises} onMove={onMove} onRemove={onRemove} /> : <p className="text-sm text-muted-foreground">No exercises</p>}
          <DateField value={date} onChange={setDate} />
          <button
            type="button"
            aria-pressed={save}
            onClick={() => setSave((value) => !value)}
            className={cn("flex min-h-12 items-center gap-3 rounded-md border px-3 text-left text-sm font-medium", save ? "border-primary bg-primary/10" : "border-input text-muted-foreground")}
          >
            <Star aria-hidden className={cn("size-7 shrink-0", save ? "fill-primary text-primary" : "text-muted-foreground")} />
            Save to favorites
          </button>
          {problem && <Hint>{problem}</Hint>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <SheetFooter>
          <Button type="submit" form="finish-form" size="lg" className="h-12" disabled={!ready || pending}>
            {pending ? "Adding…" : "Add to diary"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
