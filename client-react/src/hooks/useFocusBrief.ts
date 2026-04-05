import { useState, useEffect, useCallback } from "react";
import { apiCall } from "../api/client";
import type { FocusBriefResponse } from "../types/focusBrief";

const CACHE_KEY = "todos:focus-brief-cache";

function readCache(): FocusBriefResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(data: FocusBriefResponse): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function useFocusBrief() {
  const [brief, setBrief] = useState<FocusBriefResponse | null>(readCache);
  const [loading, setLoading] = useState(!brief);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBrief = useCallback(async () => {
    try {
      const res = await apiCall("/ai/focus-brief");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FocusBriefResponse = await res.json();
      setBrief(data);
      writeCache(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load focus brief");
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchBrief().finally(() => setLoading(false));
  }, [fetchBrief]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await apiCall("/ai/focus-brief/refresh", { method: "POST" });
      await fetchBrief();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBrief]);

  return { brief, loading, error, refreshing, refresh };
}
