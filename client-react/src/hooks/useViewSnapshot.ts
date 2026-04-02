import { createContext, useContext, useEffect, useRef, useCallback } from "react";

interface ViewSnapshotContextValue {
  /** Register a capture function. Called on eviction. */
  registerCapture: (capture: () => unknown) => void;
  /** Snapshot to restore from (if this view was evicted and remounted). Null if first mount. */
  snapshot: unknown | null;
}

export const ViewSnapshotContext = createContext<ViewSnapshotContextValue>({
  registerCapture: () => {},
  snapshot: null,
});

interface UseViewSnapshotOptions<T> {
  /** Called on eviction. Must read from refs to avoid stale closures. Return a plain serializable object. */
  capture: () => T;
  /** Called once after remount if a snapshot exists. Restore state first, scroll second. */
  restore: (snapshot: T) => void;
  /** Schema version. Mismatched versions cause snapshot discard. */
  version: number;
}

interface VersionedSnapshot<T> {
  _v: number;
  data: T;
}

export function useViewSnapshot<T>(options: UseViewSnapshotOptions<T>) {
  const { registerCapture, snapshot } = useContext(ViewSnapshotContext);
  const captureRef = useRef(options.capture);
  const restoreRef = useRef(options.restore);
  const versionRef = useRef(options.version);
  const restoredRef = useRef(false);

  // Keep refs current
  captureRef.current = options.capture;
  restoreRef.current = options.restore;
  versionRef.current = options.version;

  // Register capture with ViewRouter
  useEffect(() => {
    registerCapture(() => {
      const data = captureRef.current();
      return { _v: versionRef.current, data } as VersionedSnapshot<T>;
    });
  }, [registerCapture]);

  // Restore once after mount (if snapshot exists and version matches)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (snapshot == null) return;
    const versioned = snapshot as VersionedSnapshot<T>;
    if (typeof versioned._v !== "number" || versioned._v !== versionRef.current) return;
    try {
      restoreRef.current(versioned.data);
    } catch {
      // Best-effort: silently skip invalid snapshots
    }
  }, []); // Mount-scoped: runs once
}
