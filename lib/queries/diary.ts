"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toDiaryEntry, type DiaryEntry } from "@/lib/diary";
import { itemsToJson, mealItemRemovalUpdate, toInsertRow, type EntryUpdate, type MealItemRemoval } from "@/lib/diary-edit";
import { toastSaveError } from "@/lib/queries/errors";
import { createClient } from "@/lib/supabase/client";

export const diaryKey = (userId: string, dateKey: string) => ["diary", userId, dateKey] as const;

function byCreatedAt(a: DiaryEntry, b: DiaryEntry) {
  return a.created_at.localeCompare(b.created_at);
}

export function useDiaryDay(userId: string, dateKey: string) {
  return useQuery({
    queryKey: diaryKey(userId, dateKey),
    queryFn: async (): Promise<DiaryEntry[]> => {
      const { data, error } = await createClient()
        .from("diary_entries")
        .select("*")
        .eq("entry_date", dateKey)
        .order("created_at", { ascending: true });
      if (error) throw error;
      // A corrupt row must not take the whole day down.
      return data.flatMap((row) => {
        try {
          return [toDiaryEntry(row)];
        } catch {
          console.warn("Ignored a corrupt diary row", row.id);
          return [];
        }
      });
    },
  });
}

interface DiaryMutationOptions<V> {
  mutationFn: (variables: V) => Promise<void>;
  /** Applies the change to the cached day so the UI updates immediately. */
  apply: (entries: DiaryEntry[], variables: V) => DiaryEntry[];
  onSuccess?: (variables: V) => void;
}

/** Write-through with optimistic cache update, rollback and toast on failure. */
function useDiaryMutation<V>(userId: string, dateKey: string, options: DiaryMutationOptions<V>) {
  const queryClient = useQueryClient();
  const key = diaryKey(userId, dateKey);

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<DiaryEntry[]>(key);
      if (previous) queryClient.setQueryData<DiaryEntry[]>(key, options.apply(previous, variables));
      return { previous };
    },
    onError: (error: { message?: string }, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      toastSaveError(error);
    },
    onSuccess: (_data, variables) => options.onSuccess?.(variables),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Throws when RLS or a stale id means no row was touched, so the UI never shows a false success. */
function assertTouched(rows: { id: string }[] | null) {
  if (!rows || rows.length === 0) throw new Error("Entry not found");
}

export function useUpdateEntry(userId: string, dateKey: string) {
  return useDiaryMutation<{ id: string; update: EntryUpdate }>(userId, dateKey, {
    mutationFn: async ({ id, update }) => {
      const { data, error } = await createClient().from("diary_entries").update(update).eq("id", id).select("id");
      if (error) throw error;
      assertTouched(data);
    },
    apply: (entries, { id, update }) => entries.map((e) => (e.id === id ? { ...e, ...update, quantity_g: update.quantity_g ?? e.quantity_g } : e)),
    onSuccess: () => toast.success("Entrada atualizada"),
  });
}

export function useRemoveMealItem(userId: string, dateKey: string) {
  return useDiaryMutation<{ id: string; removal: MealItemRemoval }>(userId, dateKey, {
    mutationFn: async ({ id, removal }) => {
      const payload = { ...removal, items: itemsToJson(removal.items) };
      const { data, error } = await createClient().from("diary_entries").update(payload).eq("id", id).select("id");
      if (error) throw error;
      assertTouched(data);
    },
    apply: (entries, { id, removal }) => entries.map((e) => (e.id === id ? { ...e, ...removal } : e)),
  });
}

/** Resolves the removal for an item index, or null when it is not allowed (last item). */
export function planItemRemoval(entry: DiaryEntry, index: number) {
  const removal = mealItemRemovalUpdate(entry, index);
  return removal ? { id: entry.id, removal } : null;
}

export function useDeleteEntry(userId: string, dateKey: string) {
  const queryClient = useQueryClient();
  const key = diaryKey(userId, dateKey);

  async function restore(entry: DiaryEntry) {
    const { error } = await createClient().from("diary_entries").insert(toInsertRow(entry));
    if (error) {
      toastSaveError(error);
      return;
    }
    queryClient.setQueryData<DiaryEntry[]>(key, (current) =>
      current && !current.some((e) => e.id === entry.id) ? [...current, entry].sort(byCreatedAt) : current,
    );
    await queryClient.invalidateQueries({ queryKey: key });
  }

  return useDiaryMutation<DiaryEntry>(userId, dateKey, {
    mutationFn: async (entry) => {
      const { data, error } = await createClient().from("diary_entries").delete().eq("id", entry.id).select("id");
      if (error) throw error;
      assertTouched(data);
    },
    apply: (entries, entry) => entries.filter((e) => e.id !== entry.id),
    onSuccess: (entry) => toast("Entrada removida", { action: { label: "Anular", onClick: () => void restore(entry) } }),
  });
}
