import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

/** False on the server and during hydration, true afterwards: for anything that depends on the browser's clock. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}
