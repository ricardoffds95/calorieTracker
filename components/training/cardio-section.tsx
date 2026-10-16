"use client";

import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivities, type Activity } from "@/lib/queries/activities";

interface CardioSectionProps {
  userId: string;
  /** A sport was chosen; null is "Other". */
  onChoose: (activity: Activity | null) => void;
}

/** The sports to log a cardio training with: the built-in ones, the user's own, and "Other". */
export function CardioSection({ userId, onChoose }: CardioSectionProps) {
  const activities = useActivities(userId);
  return (
    <section aria-label="Cardio and sport" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">Cardio & sport</h2>
      {activities.isPending && <Skeleton className="h-20 w-full" aria-label="Loading sports" />}
      {activities.isError && !activities.data && (
        <p role="alert" className="text-sm text-destructive">
          Couldn’t load sports
        </p>
      )}
      {activities.data && (
        <ul className="flex flex-wrap gap-2" data-testid="sports">
          {activities.data.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                aria-label={`Log ${activity.name}`}
                onClick={() => onChoose(activity)}
                className="min-h-11 rounded-full border border-input px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {activity.name}
              </button>
            </li>
          ))}
          <li>
            <button type="button" aria-label="Log other sport" onClick={() => onChoose(null)} className="flex min-h-11 items-center gap-1 rounded-full border border-dashed border-input px-4 text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Plus aria-hidden className="size-4" /> Other
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}
