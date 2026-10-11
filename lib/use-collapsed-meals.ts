"use client";

import { useCallback, useState } from "react";
import { MEAL_TYPES, type MealType } from "@/lib/macros";

const STORAGE_KEY = "today-collapsed";

function read(): MealType[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? MEAL_TYPES.filter((meal) => parsed.includes(meal)) : [];
  } catch {
    return [];
  }
}

function write(collapsed: MealType[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  } catch {
    // storage unavailable: it still works until the page is closed
  }
}

/** Which meals of the day are minimized: kept on this device for every day, everything open if storage fails. */
export function useCollapsedMeals() {
  const [collapsed, setCollapsed] = useState<MealType[]>(read);
  const toggle = useCallback((meal: MealType) => {
    setCollapsed((current) => {
      const next = current.includes(meal) ? current.filter((m) => m !== meal) : [...current, meal];
      write(next);
      return next;
    });
  }, []);
  return { isCollapsed: (meal: MealType) => collapsed.includes(meal), toggle };
}
