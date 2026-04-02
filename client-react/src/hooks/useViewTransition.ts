import { useCallback } from "react";

/**
 * Wraps state updates in the View Transitions API when available.
 * Falls back to immediate update in unsupported browsers.
 */
export function useViewTransition() {
  const startTransition = useCallback((callback: () => void) => {
    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      typeof document.startViewTransition === "function"
    ) {
      document.startViewTransition(callback);
    } else {
      callback();
    }
  }, []);

  return { startTransition };
}
