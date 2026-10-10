import { cn } from "@/lib/utils";

interface ProgressBarProps {
  label: string;
  /** 0..1 */
  value: number;
  over?: boolean;
  /** Token class for the fill when not over, e.g. "bg-protein". */
  tone: string;
  className?: string;
}

export function ProgressBar({ label, value, over = false, tone, className }: ProgressBarProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      data-over={over}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500", over ? "bg-destructive" : tone)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
