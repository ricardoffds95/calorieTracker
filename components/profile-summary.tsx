"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { GOAL_MODE_OPTIONS } from "@/lib/profile";
import { useProfile } from "@/lib/queries/profile";

export function ProfileSummary({ userId }: { userId: string }) {
  const { data, isPending, isError } = useProfile(userId);

  if (isPending) return <Skeleton className="h-6 w-48" aria-label="A carregar" />;
  // The screen that renders this shows the single error message.
  if (isError) return null;

  return (
    <p data-testid="profile-summary" className="text-sm tabular-nums">
      {data.name} · {GOAL_MODE_OPTIONS.find((o) => o.mode === data.mode)?.label ?? data.mode} · {data.goal_calories} kcal
    </p>
  );
}
