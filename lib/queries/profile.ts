"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastSaveError } from "@/lib/queries/errors";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";

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
export function useUpdateProfile(userId: string, message = "Objetivos guardados") {
  const queryClient = useQueryClient();
  const key = profileKey(userId);

  return useMutation({
    mutationFn: async (update: TablesUpdate<"profiles">): Promise<Profile> => {
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
      toast.success(message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/**
 * Finishes (or skips) the onboarding questionnaire: stores what was answered, the goals and the AI's explanation,
 * and stamps `onboarding_done_at`. Same write-through as the goals form: the cache only keeps what the DB accepted.
 */
export function useSaveOnboarding(userId: string) {
  const queryClient = useQueryClient();
  const key = profileKey(userId);

  return useMutation({
    mutationFn: async (update: TablesUpdate<"profiles"> & { toast?: string }): Promise<Profile> => {
      const { toast: _message, ...row } = update;
      void _message;
      const { data, error } = await createClient().from("profiles").update({ ...row, onboarding_done_at: new Date().toISOString() }).eq("user_id", userId).select().single();
      if (error) throw error;
      return data;
    },
    onError: (error: { message?: string }) => toastSaveError(error),
    onSuccess: (saved, update) => {
      queryClient.setQueryData(key, saved);
      if (update.toast) toast.success(update.toast);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
