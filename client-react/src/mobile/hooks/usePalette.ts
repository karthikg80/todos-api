import { useState, useCallback } from "react";

export type PaletteKey = "amber" | "violet" | "teal" | "coral";

export const PALETTES: { key: PaletteKey; label: string; gradient: [string, string] }[] = [
  { key: "amber", label: "Sunset Amber", gradient: ["#FDCB6E", "#E17055"] },
  { key: "violet", label: "Iris Violet", gradient: ["#A29BFE", "#6C5CE7"] },
  { key: "teal", label: "Mint Teal", gradient: ["#00CEC9", "#00B894"] },
  { key: "coral", label: "Coral Fire", gradient: ["#FF6B6B", "#EE5A24"] },
];

const STORAGE_KEY = "mobile:palette";

function getStoredPalette(): PaletteKey {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && PALETTES.some((p) => p.key === stored)) return stored as PaletteKey;
  return "amber";
}

export function usePalette() {
  const [palette, setPaletteState] = useState<PaletteKey>(getStoredPalette);

  const setPalette = useCallback((key: PaletteKey) => {
    setPaletteState(key);
    localStorage.setItem(STORAGE_KEY, key);
  }, []);

  return { palette, setPalette };
}
