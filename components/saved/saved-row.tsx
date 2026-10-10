import { ChevronRight } from "lucide-react";

interface SavedRowProps {
  name: string;
  /** Second line: brand or the items of a meal. */
  subtitle?: string;
  /** "380 kcal/100 g" or "450 kcal" */
  energy: string;
  macros: string;
  timesUsed: number;
  onEdit: () => void;
}

export function SavedRow({ name, subtitle, energy, macros, timesUsed, onEdit }: SavedRowProps) {
  return (
    <li className="flex items-center gap-1 border-b border-border last:border-b-0">
      <button type="button" aria-label={`Abrir ${name}`} onClick={onEdit} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-sm px-1 py-2 text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">{name}</span>
          <span className="shrink-0 text-sm tabular-nums">{energy}</span>
        </span>
        <span className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{subtitle ? `${subtitle} · ${macros}` : macros}</span>
          <span className="shrink-0">{timesUsed === 0 ? "nunca usado" : `usado ${timesUsed}×`}</span>
        </span>
      </button>
      <ChevronRight aria-hidden className="mr-2 size-4 shrink-0 text-muted-foreground" />
    </li>
  );
}
