// standaloneTransitions.js — Cross-page fade transitions for standalone pages.
// ---------------------------------------------------------------------------
// IIFE utility (no ES modules) that provides fade-out-before-navigate and
// fade-in-on-load for standalone pages (/feedback, /feedback/new, /app, /auth).
// Reads --dur-view from :root so JS and CSS stay in sync.
// ---------------------------------------------------------------------------
(function (globalScope) {
  "use strict";

  function prefersReducedMotion() {
    return globalScope.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  var _cachedDur = null;
  function getDurationMs() {
    if (_cachedDur !== null) return _cachedDur;
    var raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--dur-view")
      .trim();
    var parsed = parseInt(raw, 10);
    _cachedDur = parsed > 0 ? parsed : 280;
    return _cachedDur;
  }

  function getOrCreateOverlay() {
    var overlay = document.querySelector(".view-transition-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "view-transition-overlay";
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  /**
   * Fade overlay in, then navigate to href.
   * Under reduced motion, navigates immediately.
   */
  function navigateWithFade(href) {
    if (prefersReducedMotion()) {
      globalScope.location.href = href;
      return;
    }

    var overlay = getOrCreateOverlay();
    // Force reflow so the browser registers opacity:0 before transition
    overlay.offsetHeight; // eslint-disable-line no-unused-expressions
    overlay.classList.add("active");

    setTimeout(function () {
      globalScope.location.href = href;
    }, getDurationMs());
  }

  /**
   * On page load, start with overlay active (opaque) and fade it out.
   * Call this at boot in standalone page controllers.
   */
  function fadeInOnLoad() {
    if (prefersReducedMotion()) return;

    var overlay = getOrCreateOverlay();
    overlay.classList.add("active");

    // Wait for DOM + first paint, then fade out
    function revealPage() {
      requestAnimationFrame(function () {
        overlay.classList.remove("active");
        // Remove overlay element after transition completes
        setTimeout(function () {
          if (overlay.parentNode && !overlay.classList.contains("active")) {
            overlay.parentNode.removeChild(overlay);
          }
        }, getDurationMs() + 50);
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", revealPage);
    } else {
      revealPage();
    }
  }

  /**
   * Bind click handlers on all [data-navigate] elements to use fade transition.
   * Call after DOMContentLoaded.
   */
  function bindNavigateLinks() {
    document.addEventListener("click", function (e) {
      var target = e.target.closest("[data-navigate]");
      if (!target) return;
      e.preventDefault();
      navigateWithFade(target.getAttribute("data-navigate"));
    });
  }

  globalScope.StandaloneTransitions = {
    navigateWithFade: navigateWithFade,
    fadeInOnLoad: fadeInOnLoad,
    bindNavigateLinks: bindNavigateLinks,
  };
})(window);
