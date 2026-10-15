"use client";

import { useEffect, type RefObject } from "react";

/** Scrolling this far with the field focused closes the keyboard (otherwise it covers the results). */
const SCROLL_BLUR_PX = 24;
/** Scrolls this soon after focusing are the browser revealing the field, not the user. */
const SCROLL_ARM_MS = 500;

/**
 * Scrolling the results closes the keyboard, so neither it nor the browser bar covers them. The first moments after
 * focusing are ignored: iOS itself scrolls the page (or the dialog) to reveal the field, which would close the keyboard
 * as soon as it opened. Any scroller counts (the page, or the dialog the search sits in).
 */
export function useBlurOnScroll(inputRef: RefObject<HTMLInputElement | null>, focused: boolean) {
  useEffect(() => {
    if (!focused) return;
    const starts = new Map<EventTarget, number>();
    const position = (target: EventTarget) => (target instanceof Element ? target.scrollTop : window.scrollY);
    const onScroll = (event: Event) => {
      const target = event.target === document ? window : (event.target ?? window);
      const now = position(target);
      // a list that was not around the field when focusing starts at its top
      if (Math.abs(now - (starts.get(target) ?? 0)) > SCROLL_BLUR_PX) inputRef.current?.blur();
    };
    const arm = window.setTimeout(() => {
      // Where every scroller around the field is now: scrolling is measured from here.
      starts.set(window, window.scrollY);
      for (let el = inputRef.current?.parentElement; el; el = el.parentElement) starts.set(el, el.scrollTop);
      document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    }, SCROLL_ARM_MS);
    return () => {
      window.clearTimeout(arm);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [focused, inputRef]);
}
