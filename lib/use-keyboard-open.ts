"use client";

import { useSyncExternalStore } from "react";

/** The on-screen keyboard takes at least this much of the screen (iOS Safari does not resize the layout viewport, only the visual one). */
const KEYBOARD_MIN_HEIGHT = 150;

function subscribe(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  viewport?.addEventListener("scroll", onChange);
  return () => {
    viewport?.removeEventListener("resize", onChange);
    viewport?.removeEventListener("scroll", onChange);
  };
}

function snapshot() {
  const viewport = window.visualViewport;
  return viewport !== null && window.innerHeight - viewport.height > KEYBOARD_MIN_HEIGHT;
}

/** True while the on-screen keyboard is open: the fixed tab bar must not float in the middle of the screen then. */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
