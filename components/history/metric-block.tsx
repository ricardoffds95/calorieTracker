import { ArrowDown, ArrowUp } from "lucide-react";
import { MetricChart } from "@/components/history/metric-chart";
import { dayLabel, type Bucket, type Metric, type MetricStats, type PeriodKind } from "@/lib/history";
import { cn } from "@/lib/utils";

const TEXT: Record<Metric, string> = { calories: "text-primary", protein: "text-protein", carbs: "text-carbs", fat: "text-fat" };

interface MetricBlockProps {
  metric: Metric;
  label: string;
  unit: string;
  stats: MetricStats;
  /** "41% das kcal" for the macros. */
  note?: string;
  buckets: readonly Bucket[];
  kind: PeriodKind;
  selected: string | null;
  onSelect: (key: string | null) => void;
}

/** One metric: its average per logged day, the highest and lowest day, and its chart. */
export function MetricBlock({ metric, label, unit, stats, note, buckets, kind, selected, onSelect }: MetricBlockProps) {
  const items = [
    { key: "avg", name: "Média", icon: null, value: stats.average, day: null },
    { key: "max", name: "Máx", icon: ArrowUp, value: stats.max.value, day: stats.max.date },
    { key: "min", name: "Mín", icon: ArrowDown, value: stats.min.value, day: stats.min.date },
  ] as const;

  return (
    <section aria-label={label} data-testid={`metric-${metric}`} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{label}</h2>
        {note && <p className="text-xs text-muted-foreground tabular-nums">{note}</p>}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-0.5">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              {item.icon && <item.icon aria-hidden className={cn("size-3", TEXT[metric])} />}
              {item.name}
            </dt>
            <dd data-testid={`stat-${metric}-${item.key}`} className="tabular-nums">
              <span className={cn("text-xl font-semibold", TEXT[metric])}>{item.value}</span>
              <span className="text-xs text-muted-foreground"> {unit}</span>
              {item.day && <span className="block text-xs text-muted-foreground">{dayLabel(item.day)}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <MetricChart metric={metric} label={label} unit={unit} buckets={buckets} kind={kind} selected={selected} onSelect={onSelect} accessible={metric === "calories"} tall={metric === "calories"} />
    </section>
  );
}
