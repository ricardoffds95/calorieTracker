"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { periodHref, validateRange, type Period } from "@/lib/history";

/** Two dates: from and to (both included). Native date inputs work on iOS. */
export function CustomRangeForm({ period, now }: { period: Period; now: Date }) {
  const router = useRouter();
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [touched, setTouched] = useState(false);
  const error = validateRange(from, to);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!error) router.push(periodHref({ kind: "custom", from, to }, now));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3" aria-label="Intervalo de datas">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="range-from">De</Label>
          <Input id="range-from" type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="range-to">Até</Label>
          <Input id="range-to" type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {touched && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" className="h-11">
        Ver intervalo
      </Button>
    </form>
  );
}
