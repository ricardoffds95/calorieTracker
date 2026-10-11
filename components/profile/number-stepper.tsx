"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseIntegerInput, stepValue } from "@/lib/profile";
import { cn } from "@/lib/utils";

interface NumberStepperProps {
  label: string;
  /** Raw text, so the user can clear the field while typing. */
  value: string;
  onChange: (value: string) => void;
  step: number;
  min: number;
  max: number;
  unit: string;
  fallback?: number;
  invalid?: boolean;
  className?: string;
}

export function NumberStepper({ label, value, onChange, step, min, max, unit, fallback, invalid, className }: NumberStepperProps) {
  const current = parseIntegerInput(value);
  const apply = (delta: number) => onChange(String(stepValue(current, delta, min, max, fallback)));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`Decrease ${label}`} onClick={() => apply(-step)}>
        <Minus aria-hidden />
      </Button>
      <Input
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 text-center text-base tabular-nums"
      />
      <span className="w-9 shrink-0 text-sm text-muted-foreground">{unit}</span>
      <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={`Increase ${label}`} onClick={() => apply(step)}>
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
