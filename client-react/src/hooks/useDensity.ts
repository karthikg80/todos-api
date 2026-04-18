import { useState, useEffect, useCallback } from "react";

export type Density = "compact" | "normal" | "spacious";

const LEGACY_GLOBAL_KEY = "todos:density";

function storageKeyFor(viewKey: string | undefined): string {
  return viewKey ? `todos:density:${viewKey}` : LEGACY_GLOBAL_KEY;
}

function readStoredDensity(storageKey: string): Density {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === "compact" || raw === "normal" || raw === "spacious") {
      return raw;
    }
  } catch {
    // localStorage can throw in privacy modes; fall back below.
  }
  // Per-view keys fall back to the global default when unset so a
  // brand-new view inherits the user's preferred density.
  if (storageKey !== LEGACY_GLOBAL_KEY) {
    try {
      const fallback = localStorage.getItem(LEGACY_GLOBAL_KEY);
      if (fallback === "compact" || fallback === "normal" || fallback === "spacious") {
        return fallback;
      }
    } catch {
      // ignore
    }
  }
  return "normal";
}

/**
 * Read / write the active density token.
 *
 * When `viewKey` is omitted the hook uses the historical single
 * `todos:density` key so existing callers keep their behavior. Pass a
 * stable `viewKey` ("today", "inbox", "upcoming", …) to persist a
 * distinct density per view; switching views re-loads that view's
 * stored preference and reflects it on `<html data-density="…">` so
 * the density tokens in `tokens.css` pick it up.
 */
export function useDensity(viewKey?: string) {
  const storageKey = storageKeyFor(viewKey);
  const [density, setDensity] = useState<Density>(() =>
    readStoredDensity(storageKey),
  );

  // Reload whenever the storage key changes (i.e. the active view flips).
  useEffect(() => {
    setDensity(readStoredDensity(storageKey));
  }, [storageKey]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try {
      localStorage.setItem(storageKey, density);
    } catch {
      // ignore — ephemeral storage failures shouldn't break the UI.
    }
  }, [density, storageKey]);

  const cycle = useCallback(() => {
    setDensity((d) => {
      const order: Density[] = ["compact", "normal", "spacious"];
      const idx = order.indexOf(d);
      return order[(idx + 1) % order.length];
    });
  }, []);

  return { density, setDensity, cycle };
}
