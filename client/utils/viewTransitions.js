// viewTransitions.js — Centralised view-transition orchestration.
// ---------------------------------------------------------------------------
// Provides a token-guarded, timeout-backed helper for animating between the
// app's top-level .view elements.  All duration values are read from the CSS
// custom property --dur-view so JS and CSS cannot drift.
//
// Exports:
//   prefersReducedMotion()         — true when the user prefers reduced motion
//   getViewDurationMs()            — reads --dur-view from :root, cached
//   transitionViews(from, to, opts)— animated view swap with beforeEnter hook
//   showOverlay()                  — full-screen fade overlay (returns Promise)
// ---------------------------------------------------------------------------

let _transitionToken = 0;
let _cachedDurationMs = null;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** True when the user or OS prefers reduced motion. */
export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Read --dur-view from :root computed styles.  Falls back to 280 ms if the
 * property is missing or unparseable.  The value is cached after first read
 * because custom-property changes at runtime are not expected.
 */
export function getViewDurationMs() {
  if (_cachedDurationMs !== null) return _cachedDurationMs;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--dur-view")
    .trim();
  const parsed = parseInt(raw, 10);
  _cachedDurationMs = Number.isFinite(parsed) && parsed > 0 ? parsed : 280;
  return _cachedDurationMs;
}

// ---------------------------------------------------------------------------
// transitionViews
// ---------------------------------------------------------------------------

/**
 * Animate the switch from one .view element to another.
 *
 * @param {HTMLElement|null} fromEl  — the currently-active view (may be null)
 * @param {HTMLElement}      toEl    — the view to activate
 * @param {object}           [opts]
 * @param {function}         [opts.beforeEnter] — called after exit completes
 *   but before the new view receives .active.  Use for body-class changes,
 *   pane resets, and other layout prep that should happen between views.
 * @returns {Promise<void>} resolves when the full transition is done
 */
export function transitionViews(fromEl, toEl, { beforeEnter } = {}) {
  // Same-element no-op
  if (fromEl && fromEl === toEl) return Promise.resolve();

  // Mint a token so rapid re-invocations cancel earlier transitions.
  const token = ++_transitionToken;

  // Reduced-motion fast path — instant swap, no animation classes.
  if (prefersReducedMotion()) {
    if (fromEl) fromEl.classList.remove("active", "view-enter", "view-exit");
    beforeEnter?.();
    toEl.classList.remove("view-exit");
    toEl.classList.add("active");
    return Promise.resolve();
  }

  const dur = getViewDurationMs();

  return new Promise((resolve) => {
    // --- Exit phase -------------------------------------------------------
    if (fromEl && fromEl.classList.contains("active")) {
      // Defensively clear residue from interrupted transitions
      fromEl.classList.remove("view-enter");
      toEl.classList.remove("view-exit");

      fromEl.classList.add("view-exit");

      let exitDone = false;
      const fallbackTimer = setTimeout(finishExit, dur + 50);

      function onExitEnd(e) {
        if (e.target !== fromEl) return; // ignore bubbled events from children
        finishExit();
      }

      fromEl.addEventListener("animationend", onExitEnd, { once: true });

      function finishExit() {
        if (exitDone || token !== _transitionToken) return;
        exitDone = true;
        clearTimeout(fallbackTimer);
        fromEl.removeEventListener("animationend", onExitEnd);
        fromEl.classList.remove("active", "view-exit");
        enterPhase();
      }
    } else {
      // No active source view — go straight to enter
      enterPhase();
    }

    // --- Enter phase ------------------------------------------------------
    function enterPhase() {
      if (token !== _transitionToken) {
        resolve();
        return;
      }

      beforeEnter?.();

      toEl.classList.remove("view-enter"); // clear residue
      toEl.classList.add("active", "view-enter");

      let enterDone = false;
      const fallbackTimer = setTimeout(finishEnter, dur + 50);

      function onEnterEnd(e) {
        if (e.target !== toEl) return;
        finishEnter();
      }

      toEl.addEventListener("animationend", onEnterEnd, { once: true });

      function finishEnter() {
        if (enterDone || token !== _transitionToken) return;
        enterDone = true;
        clearTimeout(fallbackTimer);
        toEl.removeEventListener("animationend", onEnterEnd);
        toEl.classList.remove("view-enter");
        resolve();
      }
    }
  });
}

// ---------------------------------------------------------------------------
// showOverlay — full-screen fade used by standalone app-page logout
// ---------------------------------------------------------------------------

/**
 * Create (or reuse) a full-screen overlay that fades in over --dur-view.
 * Returns a Promise that resolves once the overlay is fully opaque (or
 * immediately under reduced motion).
 *
 * The overlay is intentionally left mounted after resolve — callers that
 * redirect (window.location.replace) do not need to clean it up.
 */
export function showOverlay() {
  let overlay = document.querySelector(".view-transition-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "view-transition-overlay";
    document.body.appendChild(overlay);
  }

  // Reduced-motion fast path
  if (prefersReducedMotion()) {
    overlay.classList.add("active");
    return Promise.resolve();
  }

  // Force reflow so the browser registers opacity:0 before we transition
  // eslint-disable-next-line no-unused-expressions
  overlay.offsetHeight;
  overlay.classList.add("active");

  const dur = getViewDurationMs();

  return new Promise((resolve) => {
    let done = false;
    const fallback = setTimeout(finish, dur + 50);

    function onEnd(e) {
      if (e.target !== overlay) return;
      finish();
    }

    overlay.addEventListener("transitionend", onEnd, { once: true });

    function finish() {
      if (done) return;
      done = true;
      clearTimeout(fallback);
      overlay.removeEventListener("transitionend", onEnd);
      resolve();
    }
  });
}
