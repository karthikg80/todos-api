(function initThemeModule(globalScope) {
  function syncThemeLabel(isDark) {
    var icon = isDark ? "☀️" : "🌙";
    var toggleBtns = document.querySelectorAll(
      '[data-onclick="toggleTheme()"]',
    );
    for (var i = 0; i < toggleBtns.length; i++) {
      var btn = toggleBtns[i];
      btn.setAttribute("aria-pressed", String(isDark));
      if (btn.classList.contains("theme-toggle")) btn.textContent = icon;
    }
    var sidebarLabel = document.querySelector(".app-sidebar__theme-label");
    if (sidebarLabel) sidebarLabel.textContent = icon + " Theme";
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
