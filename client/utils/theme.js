(function initThemeModule(globalScope) {
  var SUN_SVG =
    '<svg class="app-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
  var MOON_SVG =
    '<svg class="app-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

  function syncThemeLabel(isDark) {
    // SVGs are hardcoded constants, not user input — safe for innerHTML
    var svgIcon = isDark ? SUN_SVG : MOON_SVG;
    var toggleBtns = document.querySelectorAll(
      '[data-onclick="toggleTheme()"]',
    );
    for (var i = 0; i < toggleBtns.length; i++) {
      var btn = toggleBtns[i];
      btn.setAttribute("aria-pressed", String(isDark));
      if (btn.classList.contains("theme-toggle")) btn.innerHTML = svgIcon; // eslint-disable-line no-unsanitized/property
    }
    var sidebarLabel = document.querySelector(".app-sidebar__theme-label");
    if (sidebarLabel) sidebarLabel.textContent = "Theme";
  }

  function toggleTheme() {
    var body = document.body;
    var isDark = body.classList.toggle("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    syncThemeLabel(isDark);
  }

  function initTheme() {
    var savedTheme = localStorage.getItem("theme");
    var prefersDark =
      globalScope.matchMedia &&
      globalScope.matchMedia("(prefers-color-scheme: dark)").matches;
    var shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark);

    if (shouldBeDark) {
      document.body.classList.add("dark-mode");
      syncThemeLabel(true);
    }
  }

  globalScope.ThemeModule = {
    toggleTheme: toggleTheme,
    initTheme: initTheme,
  };
})(window);
