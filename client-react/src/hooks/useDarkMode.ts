import { useState, useEffect, useCallback } from "react";

function getInitialDark(): boolean {
  const stored = localStorage.getItem("darkMode");
  if (stored !== null) return stored === "true";
  // First visit: respect system preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useDarkMode() {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", dark);
    localStorage.setItem("darkMode", String(dark));
  }, [dark]);

  // Listen for system theme changes (only if user hasn't manually toggled)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't set a manual preference
      if (localStorage.getItem("darkMode") === null) {
        setDark(e.matches);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return { dark, toggle };
}
