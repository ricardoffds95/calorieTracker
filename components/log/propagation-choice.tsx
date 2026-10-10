import { Button } from "@/components/ui/button";
import type { PropagationScope } from "@/lib/log";

interface PropagationChoiceProps {
  linked: { all: number; fromToday: number };
  pending: boolean;
  onChoose: (scope: PropagationScope) => void;
  onBack: () => void;
}

const entries = (n: number) => `${n} ${n === 1 ? "entrada" : "entradas"}`;

/** After editing a saved item: apply the change to the diary from today on, to the whole history, or not at all. */
export function PropagationChoice({ linked, pending, onChoose, onBack }: PropagationChoiceProps) {
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Atualizar o diário">
      <p className="text-sm">
        Está em <strong>{entries(linked.all)}</strong> do diário. Queres atualizá-las?
      </p>
      <Button type="button" size="lg" className="h-auto min-h-11 flex-col items-start gap-0.5 py-2 text-left" disabled={pending || linked.fromToday === 0} onClick={() => onChoose("from_today")}>
        <span>A partir de hoje</span>
        <span className="text-xs font-normal opacity-80">{entries(linked.fromToday)} · os dias anteriores ficam como estão</span>
      </Button>
      <Button type="button" variant="outline" size="lg" className="h-auto min-h-11 flex-col items-start gap-0.5 py-2 text-left" disabled={pending} onClick={() => onChoose("all")}>
        <span>Todo o histórico</span>
        <span className="text-xs font-normal text-muted-foreground">{entries(linked.all)} · para corrigir um erro nos valores</span>
      </Button>
      <Button type="button" variant="ghost" size="lg" className="h-11" disabled={pending} onClick={() => onChoose("none")}>
        Só o guardado, não atualizar o diário
      </Button>
      <Button type="button" variant="ghost" className="h-11 text-muted-foreground" disabled={pending} onClick={onBack}>
        Voltar
      </Button>
    </div>
  );
}
