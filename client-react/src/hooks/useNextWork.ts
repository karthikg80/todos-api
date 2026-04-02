import { useState, useEffect, useCallback, useRef } from "react";
import type { NextWorkInputs, NextWorkResult, NextWorkRecommendation } from "../types/nextWork";
import { fetchNextWork } from "../api/nextWork";

// Module-level keyed cache — persists across navigations
const cache = new Map<string, NextWorkResult>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeInputs(raw: NextWorkInputs): NextWorkInputs {
  return {
    availableMinutes: raw.availableMinutes ?? undefined,
    energy: raw.energy ?? undefined,
  };
}

function cacheKey(inputs: NextWorkInputs): string {
  return JSON.stringify({ m: inputs.availableMinutes ?? null, e: inputs.energy ?? null });
}

function isFresh(result: NextWorkResult): boolean {
  return Date.now() - result.fetchedAt < CACHE_TTL_MS;
}

export function useNextWork() {
  const [inputs, setInputsState] = useState<NextWorkInputs>({});
  const [result, setResult] = useState<NextWorkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [actedOn, setActedOn] = useState<Set<string>>(new Set());

  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentInputsRef = useRef<NextWorkInputs>({});

  const doFetch = useCallback(async (normalized: NextWorkInputs, bypassTTL: boolean) => {
    const key = cacheKey(normalized);
    const cached = cache.get(key);

    // Fresh cache hit — no network needed
    if (cached && isFresh(cached) && !bypassTTL) {
      setResult(cached);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    // Stale cache hit — show stale data, revalidate in background
    if (cached && !bypassTTL) {
      setResult(cached);
      setLoading(false);
      setRefreshing(true);
    } else if (!cached) {
      setLoading(true);
      setRefreshing(false);
    } else {
      // bypassTTL with existing data
      setRefreshing(true);
    }

    const thisRequestId = ++requestIdRef.current;
    try {
      const recommendations = await fetchNextWork(normalized);
      if (requestIdRef.current !== thisRequestId) return; // stale response
      const newResult: NextWorkResult = {
        recommendations,
        inputs: normalized,
        fetchedAt: Date.now(),
      };
      cache.set(key, newResult);
      setResult(newResult);
      setError(null);
    } catch (err) {
      if (requestIdRef.current !== thisRequestId) return;
      const msg = err instanceof Error ? err.message : "Unknown error";
      // If we have stale data, keep it visible and just set error for subtle retry
      if (result) {
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      if (requestIdRef.current === thisRequestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [result]);

  // Debounced fetch triggered by input changes
  useEffect(() => {
    const normalized = normalizeInputs(inputs);
    currentInputsRef.current = normalized;

    // Synchronous cache check — serve immediately if fresh
    const key = cacheKey(normalized);
    const cached = cache.get(key);
    if (cached && isFresh(cached)) {
      setResult(cached);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    // Show stale data immediately if available, else signal loading eagerly
    if (cached) {
      setResult(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Debounce the network call
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doFetch(normalized, false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputs, doFetch]);

  const setInputs = useCallback((newInputs: NextWorkInputs) => {
    setInputsState(normalizeInputs(newInputs));
  }, []);

  const dismiss = useCallback((taskId: string) => {
    setDismissed((prev) => new Set(prev).add(taskId));
  }, []);

  const markActedOn = useCallback((taskId: string) => {
    setActedOn((prev) => new Set(prev).add(taskId));
  }, []);

  const unmarkActedOn = useCallback((taskId: string) => {
    setActedOn((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }, []);

  // refresh: bypass TTL, clear exclusions, use current inputs
  const refresh = useCallback(() => {
    // Clear exclusion state — safe because acted-on tasks won't appear in fresh server results
    setDismissed(new Set());
    setActedOn(new Set());
    setError(null);
    doFetch(currentInputsRef.current, true);
  }, [doFetch]);

  // Derive visible recommendations
  const visible: NextWorkRecommendation[] = result
    ? result.recommendations.filter(
        (r) => !dismissed.has(r.taskId) && !actedOn.has(r.taskId),
      )
    : [];

  return {
    result,
    visible,
    loading,
    refreshing,
    error,
    inputs,
    dismissed,
    actedOn,
    setInputs,
    dismiss,
    markActedOn,
    unmarkActedOn,
    refresh,
  };
}

/** Reset module cache — for tests only. */
export function _resetNextWorkCache() {
  cache.clear();
}
