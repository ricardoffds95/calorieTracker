import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatDayLabel, isToday } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface LogHeaderProps {
  dateKey: string;
  now: Date;
}

export function dayHref(dateKey: string, now: Date) {
  return isToday(dateKey, now) ? "/" : `/?d=${dateKey}`;
}

/** The meal is chosen on the screen where food is added, not here. */
export function LogHeader({ dateKey, now }: LogHeaderProps) {
  return (
    <header className="flex items-center gap-1">
      <Link href={dayHref(dateKey, now)} aria-label="Voltar ao dia" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "-ml-2 size-11")}>
        <ChevronLeft aria-hidden />
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Registar</h1>
      <span data-testid="log-day" className="ml-auto text-sm text-muted-foreground">
        {formatDayLabel(dateKey, now)}
      </span>
    </header>
  );
}
