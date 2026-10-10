"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanError, startBarcodeScan } from "@/lib/barcode-scanner";
import { FoodSearchError, searchByBarcode, type FoodSearchResult } from "@/lib/food-search";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The product found for the scanned code; the dialog closes itself afterwards. */
  onFound: (result: FoodSearchResult) => void;
}

export function BarcodeScannerDialog({ open, onOpenChange, onFound }: BarcodeScannerDialogProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ler código de barras</DialogTitle>
          <DialogDescription>Aponta a câmara para o código de barras do produto.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so closing the dialog always releases the camera. */}
        {open && (
          <ScannerView
            key={attempt}
            onFound={(result) => {
              onFound(result);
              onOpenChange(false);
            }}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type ScanState =
  | { phase: "starting" | "scanning" | "looking_up" }
  | { phase: "error"; message: string };

const STATUS: Record<"starting" | "scanning" | "looking_up", string> = {
  starting: "A iniciar a câmara…",
  scanning: "À procura de um código…",
  looking_up: "A procurar produto…",
};

const NOT_FOUND = "Produto não encontrado. Tenta pesquisar pelo nome.";
const UNEXPECTED = "Erro ao procurar produto. Tenta novamente.";

function ScannerView({ onFound, onRetry }: { onFound: (result: FoodSearchResult) => void; onRetry: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>({ phase: "starting" });
  const found = useEffectEvent(onFound);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const scan = new AbortController();
    const lookup = new AbortController();

    const handleCode = (code: string) => {
      setState({ phase: "looking_up" });
      searchByBarcode(code, { signal: lookup.signal })
        .then((result) => {
          if (lookup.signal.aborted) return;
          if (result) found(result);
          else setState({ phase: "error", message: NOT_FOUND });
        })
        .catch((error: unknown) => {
          if (lookup.signal.aborted) return;
          setState({ phase: "error", message: error instanceof FoodSearchError ? error.message : UNEXPECTED });
        });
    };

    startBarcodeScan({ video, onCode: handleCode, signal: scan.signal })
      .then(() => {
        if (!scan.signal.aborted) setState((s) => (s.phase === "starting" ? { phase: "scanning" } : s));
      })
      .catch((error: unknown) => {
        if (scan.signal.aborted) return;
        setState({ phase: "error", message: error instanceof ScanError ? error.message : UNEXPECTED });
      });

    return () => {
      scan.abort();
      lookup.abort();
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-md bg-muted">
        <video ref={videoRef} playsInline muted autoPlay className="aspect-[4/3] w-full object-cover" aria-hidden />
        {state.phase !== "error" && (
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-sm border-2 border-background" />
        )}
      </div>
      {state.phase === "error" ? (
        <>
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
          <Button type="button" variant="outline" className="h-11" onClick={onRetry}>
            Tentar novamente
          </Button>
        </>
      ) : (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {STATUS[state.phase]}
        </p>
      )}
    </div>
  );
}
