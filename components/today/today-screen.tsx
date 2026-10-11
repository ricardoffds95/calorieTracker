"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { DayNav } from "@/components/today/day-nav";
import { EditEntryDialog } from "@/components/today/edit-entry-dialog";
import { MacroColumns } from "@/components/today/macro-columns";
import { MealSection } from "@/components/today/meal-section";
import { SummaryHero } from "@/components/today/summary-hero";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dateKeyOrToday } from "@/lib/dates";
import { dayTotals, groupByMeal, mealTotals, type DiaryEntry } from "@/lib/diary";
import { MEAL_TYPES } from "@/lib/macros";
import { planItemRemoval, useDeleteEntry, useDiaryDay, useRemoveMealItem, useUpdateEntry } from "@/lib/queries/diary";
import { useProfile } from "@/lib/queries/profile";
import { cn } from "@/lib/utils";

// "Today" depends on the browser's time zone, so nothing date-based renders on the server.
const subscribeNothing = () => () => {};
const useMounted = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

export function TodayScreen({ userId }: { userId: string }) {
  const mounted = useMounted();
  if (!mounted) return <Skeleton className="h-96 w-full" aria-label="Loading" />;
  return <TodayDay userId={userId} />;
}

function TodayDay({ userId }: { userId: string }) {
  const [now] = useState(() => new Date());
  const dateKey = dateKeyOrToday(useSearchParams().get("d"), now);
  const [editing, setEditing] = useState<DiaryEntry | null>(null);

  const profile = useProfile(userId);
  const router = useRouter();
  // First login: the questionnaire. `=== null` on purpose: a profile cached before the column existed has it undefined.
  const needsOnboarding = profile.data?.onboarding_done_at === null;
  useEffect(() => {
    if (needsOnboarding) router.replace("/onboarding");
  }, [needsOnboarding, router]);
  const diary = useDiaryDay(userId, dateKey);
  const updateEntry = useUpdateEntry(userId, dateKey);
  const deleteEntry = useDeleteEntry(userId, dateKey);
  const removeItem = useRemoveMealItem(userId, dateKey);

  const entries = diary.data ?? [];
  const totals = dayTotals(entries);
  const perMeal = mealTotals(entries);
  const grouped = groupByMeal(entries);
  const goals = profile.data
    ? { calories: profile.data.goal_calories, protein: profile.data.goal_protein, carbs: profile.data.goal_carbs, fat: profile.data.goal_fat }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <DayNav dateKey={dateKey} now={now} />

      {goals ? (
        <>
          <SummaryHero goalCalories={goals.calories} consumed={totals.calories} />
          <MacroColumns goals={goals} totals={totals} />
        </>
      ) : (
        <Skeleton className="h-52 w-full" aria-label="Loading goals" />
      )}

      {/* Without a meal in mind the food goes to the snacks; the meals' own + buttons pick theirs. */}
      <Link href={`/add?meal=snacks&d=${dateKey}`} className={cn(buttonVariants({ size: "lg" }), "h-11")}>
        <Plus aria-hidden />
        Add meal
      </Link>

      {diary.isError && !diary.data && (
        <p role="alert" className="text-sm text-destructive">
          Couldn’t load diary
        </p>
      )}
      {diary.isPending && <Skeleton className="h-64 w-full" aria-label="Loading diary" />}
      {diary.data && entries.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged</p>}

      {diary.data && (
        <div className="flex flex-col gap-2">
          {MEAL_TYPES.map((meal) => (
            <MealSection
              key={meal}
              meal={meal}
              entries={grouped[meal]}
              calories={perMeal[meal].calories}
              dateKey={dateKey}
              onEdit={setEditing}
              onDelete={(entry) => deleteEntry.mutate(entry)}
              onRemoveItem={(entry, index) => {
                const plan = planItemRemoval(entry, index);
                if (plan) removeItem.mutate(plan);
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditEntryDialog
          key={editing.id}
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(id, update) => updateEntry.mutate({ id, update })}
        />
      )}
    </div>
  );
}
