import { useState, useCallback } from "react";
import type { GroupBy } from "../utils/groupTodos";

const STORAGE_KEY = "todos:collapsed-groups";

/** Read Record<groupBy, collapsedKeys[]> from localStorage with defensive parsing. */
function readStored(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStored(val: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

export function useCollapsedGroups(groupBy: GroupBy) {
  const [allCollapsed, setAllCollapsed] = useState(readStored);

  const collapsed = allCollapsed[groupBy] ?? [];

  const isCollapsed = useCallback(
    (groupKey: string) => collapsed.includes(groupKey),
    [collapsed],
  );

  const toggle = useCallback(
    (groupKey: string) => {
      setAllCollapsed((prev) => {
        const current = prev[groupBy] ?? [];
        const next = current.includes(groupKey)
          ? current.filter((k) => k !== groupKey)
          : [...current, groupKey];
        const updated = { ...prev, [groupBy]: next };
        writeStored(updated);
        return updated;
      });
    },
    [groupBy],
  );

  return { isCollapsed, toggle };
}
