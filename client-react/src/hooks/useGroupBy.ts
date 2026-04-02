import { useState, useEffect, useCallback } from "react";
import type { GroupBy } from "../utils/groupTodos";

const STORAGE_KEY = "todos:group-by";
const VALID: GroupBy[] = ["none", "project", "status", "priority", "dueDate"];

function readStored(): GroupBy {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val && VALID.includes(val as GroupBy)) return val as GroupBy;
  } catch {
    /* ignore */
  }
  return "none";
}

export function useGroupBy() {
  const [groupBy, setGroupByState] = useState<GroupBy>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, groupBy);
    } catch {
      /* ignore */
    }
  }, [groupBy]);

  const setGroupBy = useCallback((val: GroupBy) => {
    if (VALID.includes(val)) setGroupByState(val);
    else setGroupByState("none");
  }, []);

  return { groupBy, setGroupBy };
}
