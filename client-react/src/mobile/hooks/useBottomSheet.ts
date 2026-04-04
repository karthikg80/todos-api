import { useState, useCallback } from "react";

export type BottomSheetSnap = "closed" | "half" | "full";

export function useBottomSheet() {
  const [snap, setSnap] = useState<BottomSheetSnap>("closed");
  const [taskId, setTaskId] = useState<string | null>(null);

  const openHalf = useCallback((id: string) => {
    setTaskId(id);
    setSnap("half");
  }, []);

  const expandFull = useCallback(() => {
    setSnap("full");
  }, []);

  const close = useCallback(() => {
    setSnap("closed");
    setTaskId(null);
  }, []);

  return { snap, taskId, openHalf, expandFull, close };
}
