import { useCallback, useEffect, useSyncExternalStore } from "react";
import type {
  TuneUpSection,
  TuneUpData,
  StaleTask,
} from "../types/tuneup";
import {
  fetchDuplicates,
  fetchStaleItems,
  fetchQualityIssues,
  fetchTaxonomy,
} from "../api/tuneup";

// ---------------------------------------------------------------------------
// Module-level shared state — survives navigation, shared across all mounts.
// Uses immutable replacement: every mutation creates a new cache object so
// that useSyncExternalStore's getSnapshot returns a fresh reference.
// ---------------------------------------------------------------------------

interface TuneUpCache {
  data: TuneUpData;
  loading: Record<TuneUpSection, boolean>;
  error: Record<TuneUpSection, string | null>;
  dismissed: Set<string>;
  patchedTaskIds: Set<string>;
  patchedProjectIds: Set<string>;
  hasFetched: boolean;          // true once at least one section succeeded
  allSettled: boolean;          // true when no section is currently loading
  initialLoadTriggered: boolean; // dedupe guard: true once fetchAll() has been called
  lastFetchedAt: number | null;
}

const INITIAL_LOADING: Record<TuneUpSection, boolean> = {
  duplicates: false, stale: false, quality: false, taxonomy: false,
};
const INITIAL_ERROR: Record<TuneUpSection, string | null> = {
  duplicates: null, stale: null, quality: null, taxonomy: null,
};

function makeEmptyCache(): TuneUpCache {
  return {
    data: { duplicates: null, stale: null, quality: null, taxonomy: null },
    loading: { ...INITIAL_LOADING },
    error: { ...INITIAL_ERROR },
    dismissed: new Set(),
    patchedTaskIds: new Set(),
    patchedProjectIds: new Set(),
    hasFetched: false,
    allSettled: true,
    initialLoadTriggered: false,
    lastFetchedAt: null,
  };
}

// The single shared cache instance. Replaced immutably on every update.
let cache: TuneUpCache = makeEmptyCache();

// Subscribers for useSyncExternalStore
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function getSnapshot(): TuneUpCache {
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Mutation helper — always produces a new cache object (immutable)
// ---------------------------------------------------------------------------

function updateCache(updater: (draft: TuneUpCache) => Partial<TuneUpCache>) {
  const patch = updater(cache);
  cache = { ...cache, ...patch };
  notify();
}

const SECTIONS: TuneUpSection[] = ["duplicates", "stale", "quality", "taxonomy"];

type Fetcher = () => Promise<unknown>;
const FETCHERS: Record<TuneUpSection, Fetcher> = {
  duplicates: fetchDuplicates,
  stale: fetchStaleItems,
  quality: fetchQualityIssues,
  taxonomy: fetchTaxonomy,
};

async function fetchSection(section: TuneUpSection) {
  updateCache((c) => ({
    loading: { ...c.loading, [section]: true },
    error: { ...c.error, [section]: null },
    allSettled: false,
  }));
  try {
    const result = await FETCHERS[section]();
    const newLoading = { ...cache.loading, [section]: false };
    updateCache(() => ({
      data: { ...cache.data, [section]: result },
      loading: newLoading,
      hasFetched: true,
      lastFetchedAt: Date.now(),
      allSettled: SECTIONS.every((s) => !newLoading[s]),
    }));
  } catch (err) {
    const newLoading = { ...cache.loading, [section]: false };
    updateCache(() => ({
      loading: newLoading,
      error: { ...cache.error, [section]: err instanceof Error ? err.message : "Unknown error" },
      allSettled: SECTIONS.every((s) => !newLoading[s]),
    }));
  }
}

function fetchAll() {
  updateCache(() => ({ allSettled: false, initialLoadTriggered: true }));
  SECTIONS.forEach(fetchSection);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseTuneUpOptions {
  /** If false, do not auto-fetch on mount. Caller must call load(). Default: true. */
  autoFetch?: boolean;
}

export function useTuneUp(options: UseTuneUpOptions = {}) {
  const { autoFetch = true } = options;

  // Subscribe to shared state. Returns the immutable cache snapshot.
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  // Auto-fetch on first mount if cache is cold and autoFetch is true.
  // Uses module-level initialLoadTriggered to dedupe across concurrent mounts.
  useEffect(() => {
    if (autoFetch && !cache.initialLoadTriggered) {
      fetchAll();
    }
  }, [autoFetch]);

  const load = useCallback(() => {
    if (!cache.initialLoadTriggered) fetchAll();
  }, []);

  const refresh = useCallback(() => {
    cache = makeEmptyCache();
    notify();
    fetchAll();
  }, []);

  const refreshSection = useCallback((key: TuneUpSection) => {
    fetchSection(key);
  }, []);

  const dismiss = useCallback((findingKey: string) => {
    updateCache((c) => ({
      dismissed: new Set(c.dismissed).add(findingKey),
    }));
  }, []);

  // --- Destructive patches (cross-section removal) ---

  const patchTaskOut = useCallback((taskId: string) => {
    updateCache((c) => ({
      patchedTaskIds: new Set(c.patchedTaskIds).add(taskId),
    }));
  }, []);

  const unpatchTaskOut = useCallback((taskId: string) => {
    updateCache((c) => {
      const next = new Set(c.patchedTaskIds);
      next.delete(taskId);
      return { patchedTaskIds: next };
    });
  }, []);

  const patchProjectOut = useCallback((projectId: string) => {
    updateCache((c) => ({
      patchedProjectIds: new Set(c.patchedProjectIds).add(projectId),
    }));
  }, []);

  const unpatchProjectOut = useCallback((projectId: string) => {
    updateCache((c) => {
      const next = new Set(c.patchedProjectIds);
      next.delete(projectId);
      return { patchedProjectIds: next };
    });
  }, []);

  // --- Non-destructive patches (section-specific removal with restore) ---

  const patchQualityResolved = useCallback((taskId: string) => {
    updateCache((c) => {
      if (!c.data.quality) return {};
      return {
        data: {
          ...c.data,
          quality: {
            ...c.data.quality,
            results: c.data.quality.results.filter((r) => r.id !== taskId),
          },
        },
      };
    });
  }, []);

  /** Remove a task from the stale section. Returns the removed task for undo. */
  const patchStaleResolved = useCallback((taskId: string): StaleTask | null => {
    const task = cache.data.stale?.staleTasks.find((t) => t.id === taskId) ?? null;
    if (task) {
      updateCache((c) => {
        if (!c.data.stale) return {};
        return {
          data: {
            ...c.data,
            stale: {
              ...c.data.stale,
              staleTasks: c.data.stale.staleTasks.filter((t) => t.id !== taskId),
            },
          },
        };
      });
    }
    return task;
  }, []);

  /** Restore a task to the stale section (for undo). */
  const restoreStaleTask = useCallback((task: StaleTask) => {
    updateCache((c) => {
      if (!c.data.stale) return {};
      return {
        data: {
          ...c.data,
          stale: {
            ...c.data.stale,
            staleTasks: [...c.data.stale.staleTasks, task],
          },
        },
      };
    });
  }, []);

  return {
    data: snap.data,
    loading: snap.loading,
    error: snap.error,
    dismissed: snap.dismissed,
    patchedTaskIds: snap.patchedTaskIds,
    patchedProjectIds: snap.patchedProjectIds,
    hasFetched: snap.hasFetched,
    allSettled: snap.allSettled,
    lastFetchedAt: snap.lastFetchedAt,
    load,
    refresh,
    refreshSection,
    dismiss,
    patchTaskOut,
    unpatchTaskOut,
    patchProjectOut,
    unpatchProjectOut,
    patchQualityResolved,
    patchStaleResolved,
    restoreStaleTask,
  };
}

/** Reset module cache — for tests only. */
export function _resetTuneUpCache() {
  cache = makeEmptyCache();
  notify();
}
