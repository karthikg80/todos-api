import { useRef, useCallback } from "react";
import type { MobileTab } from "./useTabBar";

export function useScrollPersistence() {
  const positions = useRef<Record<string, number>>({});

  const save = useCallback((tab: MobileTab) => {
    const el = document.querySelector(".m-shell__content");
    if (el) positions.current[tab] = el.scrollTop;
  }, []);

  const restore = useCallback((tab: MobileTab) => {
    const el = document.querySelector(".m-shell__content");
    if (el) el.scrollTop = positions.current[tab] ?? 0;
  }, []);

  return { save, restore };
}
