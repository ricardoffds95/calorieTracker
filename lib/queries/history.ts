"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DayTotals } from "@/lib/history";
import { createClient } from "@/lib/supabase/client";

export const historyKey = (userId: string) => ["history", userId] as const;

/** Per-day totals of a period (one row per day with entries), summed in SQL: a year has more entries than one request returns. */
export function useHistory(userId: string, from: string, to: string) {
  return useQuery({
    queryKey: [...historyKey(userId), from, to],
    queryFn: async (): Promise<DayTotals[]> => {
      const { data, error } = await createClient().rpc("diary_daily_totals", { p_from: from, p_to: to });
      if (error) throw error;
      return data.map((row) => ({
        date: row.entry_date,
        calories: row.calories,
        protein_g: row.protein_g,
        carbs_g: row.carbs_g,
        fat_g: row.fat_g,
        entries: row.entries,
      }));
    },
    // Keep the previous period on screen (dimmed) while the next one loads: no skeleton, no layout jump.
    placeholderData: keepPreviousData,
  });
}
