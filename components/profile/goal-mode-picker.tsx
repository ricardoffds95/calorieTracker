"use client";

import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { GoalMode } from "@/lib/macros";
import { GOAL_MODE_OPTIONS } from "@/lib/profile";
import { cn } from "@/lib/utils";

const ICONS: Record<GoalMode, LucideIcon> = { cut: TrendingDown, maintain: Minus, bulk: TrendingUp };

export function GoalModePicker({ value, onChange }: { value: GoalMode | null; onChange: (mode: GoalMode) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Objetivo</legend>
      <div className="grid grid-cols-3 gap-2">
        {GOAL_MODE_OPTIONS.map(({ mode, label, description }) => {
          const Icon = ICONS[mode];
          const selected = value === mode;
          return (
            <label
              key={mode}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col items-center gap-1 rounded-md border bg-card p-3 text-center transition-colors",
                "has-focus-visible:ring-2 has-focus-visible:ring-ring",
                selected ? "border-primary text-primary" : "border-border text-muted-foreground",
              )}
            >
              <input type="radio" name="goal-mode" value={mode} checked={selected} onChange={() => onChange(mode)} className="sr-only" />
              <Icon className="size-5" aria-hidden />
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs leading-tight">{description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
