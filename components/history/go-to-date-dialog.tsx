"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseDateKey } from "@/lib/dates";
import { periodFor, periodHref, type Period } from "@/lib/history";

const NAMES = { week: "week", month: "month", year: "year" } as const;

/** Jumps to the week/month/year that contains a chosen date (one native date field works everywhere, unlike month/week inputs on iOS). */
export function GoToDateDialog({ period, now, onClose }: { period: Period; now: Date; onClose: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(period.from);
  const kind = period.kind === "custom" ? "week" : period.kind;
  const valid = parseDateKey(date) !== null;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    router.push(periodHref(periodFor(kind, date), now));
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Go to date</DialogTitle>
          <DialogDescription>Opens that {NAMES[kind]}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goto-date">Date</Label>
            <Input id="goto-date" type="date" className="h-11" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {!valid && (
            <p role="alert" className="text-sm text-destructive">
              Invalid date
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={!valid}>
              Go
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
