"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastSaveError } from "@/lib/queries/errors";
import type { ProfileUpdate } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;

export const profileKey = (userId: string) => ["profile", userId] as const;

export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKey(userId),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await createClient().from("profiles").select("*").eq("user_id", userId).single();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Write-through: always updates the DB. The cache is updated optimistically and rolled back on failure,
 * so nothing is ever shown as saved that the DB does not have.
 */
export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  const key = profileKey(userId);

  return useMutation({
    mutationFn: async (update: ProfileUpdate): Promise<Profile> => {
      const { data, error } = await createClient().from("profiles").update(update).eq("user_id", userId).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async (update) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, ...update });
      return { previous };
    },
    onError: (error: { message?: string }, _update, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toastSaveError(error);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      toast.success("Objetivos guardados");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
