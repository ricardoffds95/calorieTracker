"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastSaveError } from "@/lib/queries/errors";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

/** A sport or kind of cardio: built in (no owner, with a MET) or one the user wrote (no MET). */
export type Activity = Tables<"activities">;

export const activitiesKey = (userId: string) => ["activities", userId] as const;

/** Error code of a unique violation: an activity with the same name already exists. */
export const DUPLICATE_ACTIVITY = "23505";

/** The built-in activities in their order, then the user's own by name. */
function ordered(a: Activity, b: Activity) {
  if ((a.user_id === null) !== (b.user_id === null)) return a.user_id === null ? -1 : 1;
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, "en");
}

export function useActivities(userId: string) {
  return useQuery({
    queryKey: activitiesKey(userId),
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await createClient().from("activities").select("*");
      if (error) throw error;
      return data.sort(ordered);
    },
  });
}

/** Keeps a sport the user wrote ("Other") as one of their own, so it is there next time. */
export function useCreateActivity(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Activity> => {
      const { data, error } = await createClient().from("activities").insert({ name: name.trim(), user_id: userId }).select().single();
      if (error) throw error;
      return data;
    },
    // A duplicate name is shown inline by the caller; everything else as a toast.
    onError: (error: { message?: string; code?: string }) => {
      if (error.code !== DUPLICATE_ACTIVITY) toastSaveError(error);
    },
    onSuccess: () => toast.success("Sport saved"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: activitiesKey(userId) }),
  });
}
