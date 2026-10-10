import type { PeriodSummary } from "@/lib/history";


export function PeriodSummaryCard({ summary }: { summary: PeriodSummary }) {
  const { average, loggedDays, elapsedDays, total } = summary;
  if (!average) {
    return (
      <section aria-label="Resumo do período" className="flex flex-col gap-1">
        <p data-testid="history-empty" className="text-lg font-semibold">
          Sem registos neste período
        </p>
        <p className="text-sm text-muted-foreground">{elapsedDays === 0 ? "Este período ainda não começou." : "Regista refeições no ecrã Registar para as ver aqui."}</p>
      </section>
    );
  }
  return (
    <section aria-label="Resumo do período" className="flex flex-col gap-3">
      <div>
        <p data-testid="avg-kcal" className="text-6xl font-semibold tracking-tight tabular-nums">
          {average.calories}
        </p>
        <p className="text-base text-muted-foreground">kcal por dia registado</p>
      </div>
      <p data-testid="logged-days" className="text-sm tabular-nums">
        {loggedDays} de {elapsedDays} {elapsedDays === 1 ? "dia registado" : "dias registados"}
        <span className="text-muted-foreground"> · total {total.calories} kcal</span>
      </p>
    </section>
  );
}
