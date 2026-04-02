import { useEffect, useCallback } from "react";

export function useServiceWorker(
  onSyncComplete?: (replayed: number, failed: number) => void,
) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/app/sw.js")
      .catch(() => {
        // SW registration failed — no offline support
      });

    // Listen for sync complete messages
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "offline-sync-complete") {
        onSyncComplete?.(event.data.replayed, event.data.failed);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);

    // Trigger replay when coming back online
    const onOnline = () => {
      navigator.serviceWorker.controller?.postMessage("replay-mutations");
    };
    window.addEventListener("online", onOnline);

    return () => {
      navigator.serviceWorker.removeEventListener("message", handler);
      window.removeEventListener("online", onOnline);
    };
  }, [onSyncComplete]);

  const triggerSync = useCallback(() => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage("replay-mutations");
    }
  }, []);

  return { triggerSync };
}
