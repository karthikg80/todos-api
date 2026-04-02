import { useReducer, useCallback, useMemo } from "react";
import type { TaskViewState, TaskNavAction } from "../types/fieldLayout";

/**
 * Reducer-based three-tier task navigation state machine.
 *
 * Invariant: at most one active task across all tiers.
 * Exactly one of: collapsed | quickEdit | drawer | fullPage.
 */

function taskNavReducer(
  state: TaskViewState,
  action: TaskNavAction,
): TaskViewState {
  switch (action.type) {
    case "OPEN_QUICK_EDIT":
      // Clicking a different row while any tier is open → switch to QE for new task
      // Clicking same row in QE → collapse
      if (
        state.mode === "quickEdit" &&
        state.taskId === action.taskId
      ) {
        return { mode: "collapsed" };
      }
      return { mode: "quickEdit", taskId: action.taskId };

    case "OPEN_DRAWER":
      return { mode: "drawer", taskId: action.taskId };

    case "OPEN_FULL_PAGE":
      return { mode: "fullPage", taskId: action.taskId };

    case "ESCALATE": {
      switch (state.mode) {
        case "collapsed":
          // `e` from collapsed: open QE for focused row (if provided)
          if (action.focusedTaskId) {
            return { mode: "quickEdit", taskId: action.focusedTaskId };
          }
          return state; // no-op if no focused row
        case "quickEdit":
          return { mode: "drawer", taskId: state.taskId };
        case "drawer":
          return { mode: "fullPage", taskId: state.taskId };
        case "fullPage":
          return state; // already at max tier
      }
      break;
    }

    case "DEESCALATE":
      switch (state.mode) {
        case "fullPage":
          return { mode: "drawer", taskId: state.taskId };
        case "drawer":
          return { mode: "quickEdit", taskId: state.taskId };
        case "quickEdit":
          return { mode: "collapsed" };
        case "collapsed":
          return state;
      }
      break;

    case "COLLAPSE":
      return { mode: "collapsed" };
  }

  return state;
}

const INITIAL_STATE: TaskViewState = { mode: "collapsed" };

export function useTaskNavigation() {
  const [state, dispatch] = useReducer(taskNavReducer, INITIAL_STATE);

  const activeTaskId = useMemo(() => {
    return state.mode === "collapsed" ? null : state.taskId;
  }, [state]);

  const openQuickEdit = useCallback(
    (taskId: string) => dispatch({ type: "OPEN_QUICK_EDIT", taskId }),
    [],
  );

  const openDrawer = useCallback(
    (taskId: string) => dispatch({ type: "OPEN_DRAWER", taskId }),
    [],
  );

  const openFullPage = useCallback(
    (taskId: string) => dispatch({ type: "OPEN_FULL_PAGE", taskId }),
    [],
  );

  const escalate = useCallback(
    (focusedTaskId?: string) =>
      dispatch({ type: "ESCALATE", focusedTaskId }),
    [],
  );

  const deescalate = useCallback(
    () => dispatch({ type: "DEESCALATE" }),
    [],
  );

  const collapse = useCallback(
    () => dispatch({ type: "COLLAPSE" }),
    [],
  );

  return {
    state,
    activeTaskId,
    openQuickEdit,
    openDrawer,
    openFullPage,
    escalate,
    deescalate,
    collapse,
  };
}

// Export reducer for unit testing
export { taskNavReducer, INITIAL_STATE };
