"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Hint } from "@/components/ui/hint";

/** What a form tells the guard: whether it has unsaved changes, whether they can be saved, and how to save them. */
interface Entry {
  dirty: boolean;
  valid: boolean;
  save: () => Promise<unknown>;
}

const GuardContext = createContext<{ set: (id: string, entry: Entry) => void; remove: (id: string) => void } | null>(null);

/** Registers a form with the surrounding `UnsavedGuard`. */
export function useUnsavedEntry(id: string, entry: Entry) {
  const guard = useContext(GuardContext);
  const latest = useRef(entry);
  useEffect(() => {
    latest.current = entry;
  });
  useEffect(() => {
    guard?.set(id, { get dirty() { return latest.current.dirty; }, get valid() { return latest.current.valid; }, save: () => latest.current.save() });
    return () => guard?.remove(id);
  }, [guard, id]);
}

/**
 * Asks "save the changes?" when someone leaves the page by a link (the tab bar, any link) with edits not saved, and
 * warns on closing or reloading the tab. Next.js has no hook for blocking a navigation, so the click on the link is
 * caught before it reaches it.
 */
export function UnsavedGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const entries = useRef(new Map<string, Entry>());
  // where the user wanted to go, and whether every form with changes can be saved as it is (known when the link was clicked)
  const [target, setTarget] = useState<{ href: string; canSave: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false); // navigating on purpose: no browser warning

  const dirtyEntries = useCallback(() => [...entries.current.values()].filter((e) => e.dirty), []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname + url.search === window.location.pathname + window.location.search) return;
      const dirty = dirtyEntries();
      if (dirty.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget({ href: url.pathname + url.search + url.hash, canSave: dirty.every((e) => e.valid) });
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (leaving || dirtyEntries().length === 0) return;
      event.preventDefault();
      event.returnValue = "";
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirtyEntries, leaving]);

  const context = useMemo(
    () => ({
      set: (id: string, entry: Entry) => void entries.current.set(id, entry),
      remove: (id: string) => void entries.current.delete(id),
    }),
    [],
  );

  function go() {
    setLeaving(true);
    router.push(target!.href);
    setTarget(null);
  }

  async function saveAndGo() {
    setSaving(true);
    try {
      for (const entry of dirtyEntries()) await entry.save();
      go();
    } catch {
      // the form already told what went wrong (a toast): stay here
    } finally {
      setSaving(false);
    }
  }

  return (
    <GuardContext.Provider value={context}>
      {children}
      <Dialog open={target !== null} onOpenChange={(open) => !open && !saving && setTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar alterações?</DialogTitle>
            <DialogDescription>Tens alterações por guardar.</DialogDescription>
          </DialogHeader>
          {target && !target.canSave && <Hint>Corrige os erros do formulário para guardar.</Hint>}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" size="lg" className="h-11" disabled={!target?.canSave || saving} onClick={saveAndGo}>
              {saving ? "A guardar…" : "Guardar"}
            </Button>
            <Button type="button" variant="outline" size="lg" className="h-11" disabled={saving} onClick={go}>
              Descartar
            </Button>
            <Button type="button" variant="ghost" className="h-11" disabled={saving} onClick={() => setTarget(null)}>
              Continuar a editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}
