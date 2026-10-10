import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDayLabel, isToday } from "@/lib/dates";
import { MEAL_TYPES, type MealType } from "@/lib/macros";
import { mealLabel } from "@/lib/today";
import { cn } from "@/lib/utils";

interface LogHeaderProps {
  dateKey: string;
  now: Date;
  meal: MealType;
  onMealChange: (meal: MealType) => void;
}

export function dayHref(dateKey: string, now: Date) {
  return isToday(dateKey, now) ? "/" : `/?d=${dateKey}`;
}

export function LogHeader({ dateKey, now, meal, onMealChange }: LogHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <Link
          href={dayHref(dateKey, now)}
          aria-label="Voltar ao dia"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "-ml-2 size-11")}
        >
          <ChevronLeft aria-hidden />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Registar</h1>
        <span data-testid="log-day" className="ml-auto text-sm text-muted-foreground">
          {formatDayLabel(dateKey, now)}
        </span>
      </div>
      <div role="group" aria-label="Refeição" className="grid grid-cols-4 gap-1">
        {MEAL_TYPES.map((m) => (
          <Button
            key={m}
            type="button"
            variant={m === meal ? "default" : "outline"}
            aria-pressed={m === meal}
            className="h-11 px-1 text-xs leading-tight whitespace-normal"
            onClick={() => onMealChange(m)}
          >
            {mealLabel(m)}
          </Button>
        ))}
      </div>
    </header>
  );
}
