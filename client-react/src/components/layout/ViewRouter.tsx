import {
  useState,
  useRef,
  useCallback,
  useMemo,
  type ReactElement,
  Children,
  isValidElement,
} from "react";
import { ViewActivityProvider } from "./ViewActivityContext";
import { ViewSnapshotContext } from "../../hooks/useViewSnapshot";

// Module-level snapshot store — survives view eviction
const snapshotStore = new Map<string, unknown>();

/** Clear all snapshots. Call on logout/workspace change. */
export function clearSnapshotStore() {
  snapshotStore.clear();
}

/** Delete a specific snapshot (e.g., on project delete). */
export function deleteSnapshot(viewKey: string) {
  snapshotStore.delete(viewKey);
}

// --- ViewRoute: thin child marker ---

interface ViewRouteProps {
  viewKey: string;
  children: React.ReactNode;
}

export function ViewRoute({ children }: ViewRouteProps) {
  // ViewRoute is a marker component. ViewRouter reads its props directly.
  // It just renders children when ViewRouter decides to mount it.
  return <>{children}</>;
}

// --- ViewRouter ---

interface ViewRouterProps {
  activeViewKey: string;
  capacity?: number;
  children: React.ReactNode;
}

interface CachedView {
  key: string;
  element: ReactElement;
}

export function ViewRouter({ activeViewKey, capacity = 3, children }: ViewRouterProps) {
  // Extract ViewRoute children
  const routes = useMemo(() => {
    const map = new Map<string, ReactElement>();
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === ViewRoute) {
        const key = (child.props as ViewRouteProps).viewKey;
        map.set(key, child);
      }
    });
    return map;
  }, [children]);

  // LRU cache: ordered list of cached view keys (most recent first)
  const [lru, setLru] = useState<string[]>([]);
  const captureRegistryRef = useRef<Map<string, () => unknown>>(new Map());

  // Update LRU on activeViewKey change
  const currentLru = useMemo(() => {
    const next = [activeViewKey, ...lru.filter((k) => k !== activeViewKey)];
    return next.slice(0, capacity);
  }, [activeViewKey, lru, capacity]);

  // Detect evictions
  const prevLruRef = useRef<string[]>([]);
  const evictedKeys = prevLruRef.current.filter((k) => !currentLru.includes(k));
  if (evictedKeys.length > 0) {
    for (const key of evictedKeys) {
      // Capture snapshot before eviction
      const capture = captureRegistryRef.current.get(key);
      if (capture) {
        try {
          snapshotStore.set(key, capture());
        } catch {
          // Best-effort
        }
        captureRegistryRef.current.delete(key);
      }
    }
  }
  prevLruRef.current = currentLru;

  // Sync LRU state (deferred to avoid render-loop)
  if (lru.join(",") !== currentLru.join(",")) {
    setLru(currentLru);
  }

  // Build snapshot context for each cached view
  const makeSnapshotCtx = useCallback(
    (viewKey: string) => ({
      registerCapture: (capture: () => unknown) => {
        captureRegistryRef.current.set(viewKey, capture);
      },
      snapshot: snapshotStore.get(viewKey) ?? null,
    }),
    [],
  );

  return (
    <>
      {currentLru.map((viewKey) => {
        const route = routes.get(viewKey);
        if (!route) return null;
        const isActive = viewKey === activeViewKey;
        return (
          <div
            key={viewKey}
            className="view-router__slot"
            style={{ display: isActive ? undefined : "none" }}
            data-view-key={viewKey}
            data-active={isActive ? "true" : "false"}
          >
            <ViewActivityProvider isActive={isActive}>
              <ViewSnapshotContext.Provider value={makeSnapshotCtx(viewKey)}>
                {route}
              </ViewSnapshotContext.Provider>
            </ViewActivityProvider>
          </div>
        );
      })}
    </>
  );
}
