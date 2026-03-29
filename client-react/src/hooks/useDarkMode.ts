import { useState, useEffect, useCallback } from "react";

export function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem("darkMode") === "true");

  useEffect(() => {
    document.body.classList.toggle("dark-mode", dark);
    localStorage.setItem("darkMode", String(dark));
  }, [dark]);

  // Restore on mount
  useEffect(() => {
    if (localStorage.getItem("darkMode") === "true") {
      document.body.classList.add("dark-mode");
    }
  }, []);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return { dark, toggle };
}
