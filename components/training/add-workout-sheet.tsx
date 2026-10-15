"use client";

import { useState } from "react";
import { DateField } from "@/components/training/date-field";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { parseDateKey } from "@/lib/dates";
import type { SavedWorkout } from "@/lib/queries/training";

interface AddWorkoutSheetProps {
  workout: SavedWorkout;
  initialDate: string;
  pending: boolean;
  onAdd: (workout: SavedWorkout, date: string) => void;
  onClose: () => void;
}

/** A workout the user keeps, to mark as done on a day. */
export function AddWorkoutSheet({ workout, initialDate, pending, onAdd, onClose }: AddWorkoutSheetProps) {
  const [date, setDate] = useState(initialDate);
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{workout.name}</SheetTitle>
          <SheetDescription>
            {workout.exercises.length} {workout.exercises.length === 1 ? "exercise" : "exercises"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            {workout.exercises.map((exercise) => (
              <li key={exercise.id}>{exercise.name}</li>
            ))}
          </ol>
          <DateField value={date} onChange={setDate} />
        </div>
        <SheetFooter>
          <Button type="button" size="lg" className="h-12" disabled={pending || parseDateKey(date) === null} onClick={() => onAdd(workout, date)}>
            {pending ? "Adding…" : "Add to diary"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
