// =============================================================================
// createStore.js — Minimal store factory for feature-scoped state.
//
// Usage:
//   const store = createStore({ count: 0 });
//   const unsub = store.subscribe((state) => console.log(state.count));
//   store.update((s) => { s.count += 1; });      // notifies subscribers
//   const current = store.getState();             // { count: 1 }
//   unsub();                                       // removes listener
// =============================================================================

/**
 * Creates a minimal observable store.
 *
 * @param {T} initialState  Plain object representing the initial state.
 * @returns {{ getState: () => T, update: (fn: (state: T) => void) => void, subscribe: (fn: (state: T) => () => void) }}
 */
export function createStore(initialState) {
  const state = { ...initialState };
  const listeners = new Set();

  function getState() {
    return state;
  }

  function update(mutator) {
    mutator(state);
    for (const listener of listeners) {
      listener(state);
    }
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, update, subscribe };
}
