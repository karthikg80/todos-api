// =============================================================================
// createSelector.js — Memoized derived-state helpers.
//
// Usage:
//   const getVisibleTodos = createSelector(
//     (state) => state.todos,
//     (state) => state.currentDateView,
//     (todos, dateView) => todos.filter(t => matchesDateView(t, dateView))
//   );
//   const result = getVisibleTodos(store.getState());
// =============================================================================

/**
 * Creates a memoized selector that recomputes only when inputs change.
 * Accepts 1–4 input selectors + a result function.
 *
 * @param  {...Function} args  Input selectors followed by a combiner function.
 * @returns {Function}         Memoized selector: (state) => result.
 */
export function createSelector(...args) {
  const combiner = args.pop();
  const inputSelectors = args;
  let lastInputs = null;
  let lastResult = undefined;

  return function memoizedSelector(state) {
    const inputs = inputSelectors.map((sel) => sel(state));

    if (
      lastInputs !== null &&
      inputs.length === lastInputs.length &&
      inputs.every((val, i) => val === lastInputs[i])
    ) {
      return lastResult;
    }

    lastInputs = inputs;
    lastResult = combiner(...inputs);
    return lastResult;
  };
}
