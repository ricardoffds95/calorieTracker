"use client";

import { useState } from "react";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import type { SavedTarget } from "@/components/log/edit-saved-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDeleteSaved } from "@/lib/queries/saved";

interface SavedActionsSheetProps {
  userId: string;
  target: SavedTarget;
  onClose: () => void;
  onEdit: () => void;
  onAddToDiary: () => void;
}

/** What to do with a saved food or meal: edit it, add it to the diary (day and meal chosen there) or delete it. */
export function SavedActionsSheet({ userId, target, onClose, onEdit, onAddToDiary }: SavedActionsSheetProps) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteSaved(userId);
  const { item } = target;
  const description =
    target.kind === "food"
      ? `${target.item.calories_100g} kcal por 100 g`
      : `${target.item.total_calories} kcal por porção`;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-md rounded-t-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{item.name}</SheetTitle>
          <SheetDescription>{confirming ? "As entradas do diário mantêm-se como estão." : description}</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          {confirming ? (
            <>
              <p className="text-sm">
                Apagar <strong>{item.name}</strong> dos guardados?
              </p>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="h-11"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ kind: target.kind, id: item.id }, { onSuccess: onClose })}
              >
                {remove.isPending ? "A apagar…" : "Apagar"}
              </Button>
              <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => setConfirming(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="lg" className="h-11" onClick={onAddToDiary}>
                <CalendarPlus aria-hidden />
                Adicionar ao diário
              </Button>
              <Button type="button" variant="outline" size="lg" className="h-11" onClick={onEdit}>
                <Pencil aria-hidden />
                Editar
              </Button>
              <Button type="button" variant="ghost" size="lg" className="h-11 text-destructive" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden />
                Apagar
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
