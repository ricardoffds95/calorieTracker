"use client";

import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MUSCLE_LABELS, exerciseImageUrl, type Exercise, type Muscle } from "@/lib/training";

interface ExerciseSheetProps {
  exercise: Exercise;
  /** Already in the workout being put together. */
  inWorkout: boolean;
  /** Without it (no workout being made) there is no button. */
  onAdd?: (exercise: Exercise) => void;
  onClose: () => void;
}

const label = (muscle: string) => MUSCLE_LABELS[muscle as Muscle] ?? muscle;

/** One exercise: the photos, the muscles and the steps. */
export function ExerciseSheet({ exercise, inWorkout, onAdd, onClose }: ExerciseSheetProps) {
  const muscles = [...exercise.primaryMuscles.map(label), ...exercise.secondaryMuscles.map((m) => `${label(m)} (secondary)`)];
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{exercise.name}</SheetTitle>
          <SheetDescription>
            {exercise.equipment} · {exercise.level}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          {exercise.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2" data-testid="exercise-photos">
              {exercise.images.map((path) => (
                // eslint-disable-next-line @next/next/no-img-element -- external photos of the exercise dataset, served as they are
                <img key={path} src={exerciseImageUrl(path)} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-md bg-muted object-cover" />
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground" data-testid="exercise-muscles">
            {muscles.join(" · ")}
          </p>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
            {exercise.instructions.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
        {onAdd && (
          <SheetFooter>
            <Button type="button" size="lg" className="h-12" disabled={inWorkout} onClick={() => onAdd(exercise)}>
              {inWorkout ? (
                <>
                  <Check aria-hidden /> In workout
                </>
              ) : (
                <>
                  <Plus aria-hidden /> Add to workout
                </>
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
