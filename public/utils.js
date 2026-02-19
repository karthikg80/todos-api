(function initUtils(globalScope) {
  const PROJECT_PATH_SEPARATOR = " / ";
  const MOBILE_DRAWER_MEDIA_QUERY = "(max-width: 768px)";

  function showMessage(id, message, type) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.getAttribute("aria-live")) {
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-atomic", "true");
    }
    el.textContent = message;
    el.className = `message ${type} show`;
  }

  function hideMessage(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  globalScope.Utils = {
    PROJECT_PATH_SEPARATOR,
    MOBILE_DRAWER_MEDIA_QUERY,
    showMessage,
    hideMessage,
    escapeHtml,
  };
})(window);
