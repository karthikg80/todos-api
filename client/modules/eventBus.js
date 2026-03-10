// =============================================================================
// eventBus.js — Minimal pub-sub for decoupled state→render wiring.
// =============================================================================
export const EventBus = (() => {
  const subs = {};
  return {
    subscribe(event, handler) {
      (subs[event] ??= []).push(handler);
    },
    unsubscribe(event, handler) {
      if (subs[event]) subs[event] = subs[event].filter((h) => h !== handler);
    },
    dispatch(event, payload) {
      (subs[event] ?? []).forEach((h) => h(payload));
    },
  };
})();
