(function initThemeModule(globalScope) {
  function toggleTheme() {
    var body = document.body;
    var isDark = body.classList.toggle("dark-mode");
    localStorage.setItem("theme", isDark ? "dark" : "light");

    var toggleBtn = document.querySelector(".theme-toggle");
    if (toggleBtn) toggleBtn.textContent = isDark ? "☀️" : "🌙";
  }

  function initTheme() {
    var savedTheme = localStorage.getItem("theme");
    var prefersDark =
      globalScope.matchMedia &&
      globalScope.matchMedia("(prefers-color-scheme: dark)").matches;
    var shouldBeDark = savedTheme === "dark" || (!savedTheme && prefersDark);

    if (shouldBeDark) {
      document.body.classList.add("dark-mode");
      var toggleBtn = document.querySelector(".theme-toggle");
      if (toggleBtn) toggleBtn.textContent = "☀️";
    }
  }

  globalScope.ThemeModule = {
    toggleTheme: toggleTheme,
    initTheme: initTheme,
  };
})(window);
