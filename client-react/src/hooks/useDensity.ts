import { useState, useEffect, useCallback } from "react";

export type Density = "compact" | "normal" | "spacious";

export function useDensity() {
  const [density, setDensity] = useState<Density>(
    () => (localStorage.getItem("todos:density") as Density) || "normal",
  );

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem("todos:density", density);
  }, [density]);

  const cycle = useCallback(() => {
    setDensity((d) => {
      const order: Density[] = ["compact", "normal", "spacious"];
      const idx = order.indexOf(d);
      return order[(idx + 1) % order.length];
    });
  }, []);

  return { density, setDensity, cycle };
}
