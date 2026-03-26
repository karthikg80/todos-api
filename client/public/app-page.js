// app-page.js — Standalone app page bootstrap shim.
// ---------------------------------------------------------------------------
// Runs BEFORE app.js (loaded as a regular script, not a module).
// Responsibilities:
//   1. Auth gate: redirect to /public/auth.html if no valid session
//   2. Inject stub DOM elements that app.js / authUi.js expect but are
//      absent from the standalone app page (#authView, #profileView, etc.)
//   3. Patch showAuthView() so that logout redirects to /public/auth.html
//      instead of trying to show a nonexistent auth form
//
// Required globals (loaded via <script> tags before this file):
//   window.AppState — from /utils/authSession.js
// ---------------------------------------------------------------------------
(function () {
  "use strict";

  var AppState = window.AppState;
  if (!AppState) {
    document.addEventListener("DOMContentLoaded", function () {
      document.body.textContent =
        "App page failed to load: missing AppState (authSession.js)";
    });
    return;
  }

  // -------------------------------------------------------------------------
  // 1. Auth gate — redirect immediately if not authenticated.
  //    Token alone is sufficient: social OAuth callbacks only carry
  //    token + refreshToken (no user object). The user profile is loaded
  //    by app.js after boot via loadUserProfile().
  // -------------------------------------------------------------------------
  var session = AppState.loadStoredSession();
  if (!session.token) {
    window.location.replace("/auth");
    return; // stop all further execution
  }

  // -------------------------------------------------------------------------
  // 1b. Ensure a user object exists in localStorage.
  //     app.js init() checks `token && user` before calling showAppView().
  //     Social OAuth only stores tokens (no user object), so without a
  //     placeholder app.js treats the session as unauthenticated.
  //     A stub user lets app.js proceed; loadUserProfile() replaces it
  //     with real data immediately after boot.
  // -------------------------------------------------------------------------
  if (!session.user) {
    localStorage.setItem("user", JSON.stringify({ _pending: true }));
  }

  // -------------------------------------------------------------------------
  // 2. Inject stub DOM elements that app.js/authUi.js reference without
  //    null guards. These are invisible and exist solely to prevent
  //    "cannot read property of null" errors.
  //
  //    IMPORTANT: these must be injected synchronously (not in a
  //    DOMContentLoaded listener) because module scripts like app.js
  //    execute BEFORE DOMContentLoaded fires. If we defer injection,
  //    showAppView() hits null elements and throws.
  // -------------------------------------------------------------------------
  function injectStubs() {
    // showAppView() calls: getElementById("authView").classList.remove("active")
    // showAuthView() calls: getElementById("authView").classList.add("active")
    if (!document.getElementById("authView")) {
      var stub = document.createElement("div");
      stub.id = "authView";
      stub.className = "view";
      stub.hidden = true;
      document.body.appendChild(stub);
    }

    // showAuthView() calls: getElementById("profileView").classList.remove("active")
    if (!document.getElementById("profileView")) {
      var profileStub = document.createElement("div");
      profileStub.id = "profileView";
      profileStub.className = "view";
      profileStub.hidden = true;
      document.body.appendChild(profileStub);
    }

    // showAuthView() references these auth form elements with null guards,
    // but we add stubs defensively in case future code drops the guards.
    var optionalStubs = ["landingPage", "authFormSection"];
    optionalStubs.forEach(function (id) {
      if (!document.getElementById(id)) {
        var el = document.createElement("div");
        el.id = id;
        el.hidden = true;
        document.body.appendChild(el);
      }
    });
  }

  // Inject immediately if <body> is available (defer scripts run after
  // parsing, so document.body exists). Fall back to DOMContentLoaded
  // only if body is somehow unavailable.
  if (document.body) {
    injectStubs();
  } else {
    document.addEventListener("DOMContentLoaded", injectStubs);
  }

  // -------------------------------------------------------------------------
  // 3. Patch showAuthView / logout to redirect instead of toggling DOM.
  //    app.js sets window.logout and authUi.js calls showAuthView() at the
  //    end of logout(). We intercept by watching for the window property
  //    and wrapping it after app.js has finished initialising.
  //
  //    The safest hook point: after app.js runs, window.logout will exist.
  //    We replace it with a version that clears the session and redirects.
  // -------------------------------------------------------------------------
  var _patchApplied = false;
  function patchLogout() {
    if (_patchApplied) return;
    if (typeof window.logout !== "function") return;
    _patchApplied = true;

    var originalLogout = window.logout;
    window.logout = function standaloneLogout() {
      // Call original to revoke server-side refresh token + clear state
      try {
        originalLogout();
      } catch (_) {
        // showAuthView() may throw on missing DOM — that's fine, we redirect
      }
      // Ensure session is cleared then redirect
      AppState.clearSession();
      window.location.replace("/auth");
    };
  }

  // Try patching immediately (in case module already ran) and on DOMContentLoaded
  patchLogout();
  document.addEventListener("DOMContentLoaded", function () {
    // app.js module may not have executed yet; poll briefly
    patchLogout();
    setTimeout(patchLogout, 0);
    setTimeout(patchLogout, 50);
  });
})();
