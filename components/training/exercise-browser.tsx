"use client";

import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Pagination } from "@/components/log/pagination";
import { useBlurOnScroll } from "@/components/log/use-blur-on-scroll";
import { BodyPicker, type BodyView } from "@/components/training/body-picker";
import { EquipmentFilter } from "@/components/training/equipment-filter";
import { ExerciseSheet } from "@/components/training/exercise-sheet";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { paginate } from "@/lib/food-search";
import { useKeyboardOpen } from "@/lib/use-keyboard-open";
import { useExercises } from "@/lib/queries/training";
import { LEVELS, MUSCLE_LABELS, equipmentOf, exerciseImageUrl, filterExercises, toWorkoutExercise, type Exercise, type Muscle } from "@/lib/training";
import { cn } from "@/lib/utils";

const SELECT = "h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ExerciseBrowserProps {
  /** Ids already in the workout being put together. */
  inWorkout: readonly string[];
  /** Without it (no workout being made) the exercise sheet has no "Add" button. */
  onAdd?: (exercise: { id: string; name: string }) => void;
  /** Which body to draw. */
  gender?: "male" | "female";
}

/** The body to pick muscles on, and the exercises for them. */
export function ExerciseBrowser({ inWorkout, onAdd, gender }: ExerciseBrowserProps) {
  const exercises = useExercises();
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [view, setView] = useState<BodyView>("front");
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  useBlurOnScroll(searchRef, searchFocused);
  const [level, setLevel] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Exercise | null>(null);

  const equipmentList = useMemo(() => (exercises.data ? equipmentOf(exercises.data) : []), [exercises.data]);
  const hits = useMemo(
    () => (exercises.data ? filterExercises(exercises.data, muscles, { query, equipment, level: level || null }) : []),
    [exercises.data, muscles, query, equipment, level],
  );
  const shown = paginate(hits, page);

  // Any change of the search starts again at page 1.
  const change = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <BodyPicker selected={muscles} onChange={change(setMuscles)} view={view} onViewChange={setView} gender={gender} />

      {muscles.length > 0 ? (
        <ul aria-label="Chosen muscles" className="flex flex-wrap gap-2">
          {muscles.map((muscle) => (
            <li key={muscle}>
              <button
                type="button"
                aria-label={`Remove ${MUSCLE_LABELS[muscle]}`}
                onClick={() => change(setMuscles)(muscles.filter((m) => m !== muscle))}
                className="flex min-h-9 items-center gap-1 rounded-full bg-primary/10 px-3 text-sm text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {MUSCLE_LABELS[muscle]}
                <X aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Hint>Pick a muscle</Hint>
      )}

      {muscles.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="search"
                aria-label="Search exercises"
                placeholder="Search exercises"
                enterKeyHint="search"
                autoComplete="off"
                className="h-11 pl-9"
                value={query}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChange={(e) => change(setQuery)(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EquipmentFilter options={equipmentList} selected={equipment} onChange={change(setEquipment)} />
              <select aria-label="Level" value={level} onChange={(e) => change(setLevel)(e.target.value)} className={SELECT}>
                <option value="">Any level</option>
                {LEVELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {exercises.isPending && <Skeleton className="h-40 w-full" aria-label="Loading exercises" />}
          {exercises.isError && (
            <div className="flex items-center justify-between gap-3">
              <p role="alert" className="text-sm text-destructive">
                Couldn’t load exercises
              </p>
              <Button type="button" variant="outline" className="h-11" onClick={() => void exercises.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {exercises.data && hits.length === 0 && <p className="text-sm text-muted-foreground">No exercises</p>}
          {exercises.data && hits.length > 0 && (
            <section aria-label="Exercises" className="flex flex-col gap-1">
              <p data-testid="exercise-count" className="text-sm text-muted-foreground">
                {hits.length} {hits.length === 1 ? "exercise" : "exercises"}
              </p>
              <ul data-testid="exercise-list">
                {shown.items.map(({ exercise, secondary }) => (
                  <li key={exercise.id}>
                    <button
                      type="button"
                      aria-label={`Open ${exercise.name}`}
                      onClick={() => setOpen(exercise)}
                      className="flex min-h-16 w-full items-center gap-3 rounded-sm px-1 py-1 text-left"
                    >
                      {exercise.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external photo of the exercise dataset, served as it is
                        <img src={exerciseImageUrl(exercise.images[0])} alt="" loading="lazy" className="size-14 shrink-0 rounded-md bg-muted object-cover" />
                      ) : (
                        <span aria-hidden className="size-14 shrink-0 rounded-md bg-muted" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 break-words">{exercise.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {exercise.equipment}
                          {secondary && " · secondary"}
                        </span>
                      </span>
                      {inWorkout.includes(exercise.id) && <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">In workout</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination
                page={Math.min(page, shown.pageCount)}
                pageCount={shown.pageCount}
                onChange={setPage}
                // Fixed above the tab bar; with the keyboard open the tab bar is hidden and iOS does not move "sticky", so it stays in the flow.
                className={cn(keyboardOpen ? "static" : "bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))]")}
              />
            </section>
          )}
        </>
      )}

      {open && (
        <ExerciseSheet
          exercise={open}
          inWorkout={inWorkout.includes(open.id)}
          onAdd={
            onAdd
              ? (exercise) => {
                  onAdd(toWorkoutExercise(exercise));
                  setOpen(null);
                }
              : undefined
          }
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
