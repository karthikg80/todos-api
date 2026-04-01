import { useState, useEffect, useCallback } from "react";

const TASK_ROUTE_RE = /^#\/task\/([a-f0-9-]+)$/;

/**
 * Minimal hash-based router for the full task page.
 *
 * Parses #/task/{id} from window.location.hash.
 * Hash is canonical for full page only — quick edit and drawer are local UI state.
 */
export function useHashRoute() {
  const [taskId, setTaskId] = useState<string | null>(() => parseHash());

  useEffect(() => {
    const handler = () => setTaskId(parseHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigateToTask = useCallback((id: string) => {
    window.location.hash = `#/task/${id}`;
  }, []);

  const clearRoute = useCallback(() => {
    // Use pushState to clear hash without triggering scroll-to-top
    history.pushState(null, "", window.location.pathname + window.location.search);
    setTaskId(null);
  }, []);

  return { taskId, navigateToTask, clearRoute };
}

function parseHash(): string | null {
  const match = window.location.hash.match(TASK_ROUTE_RE);
  return match ? match[1] : null;
}
