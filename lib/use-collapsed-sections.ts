"use client";

import { useCallback, useState } from "react";
import { MEAL_TYPES, type MealType } from "@/lib/macros";

const STORAGE_KEY = "today-collapsed";

/** The sections of the day that can be minimized: the four meals and the training. */
export type Section = MealType | "training";
const SECTIONS: readonly Section[] = [...MEAL_TYPES, "training"];

function read(): Section[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? SECTIONS.filter((section) => parsed.includes(section)) : [];
  } catch {
    return [];
  }
}

function write(collapsed: Section[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
  } catch {
    // storage unavailable: it still works until the page is closed
  }
}

/** Which sections of the day are minimized: kept on this device for every day, everything open if storage fails. */
export function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Section[]>(read);
  const toggle = useCallback((section: Section) => {
    setCollapsed((current) => {
      const next = current.includes(section) ? current.filter((s) => s !== section) : [...current, section];
      write(next);
      return next;
    });
  }, []);
  return { isCollapsed: (section: Section) => collapsed.includes(section), toggle };
}
