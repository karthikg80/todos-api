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
    el.textContent = "";
    const textNode = document.createTextNode(message);
    el.appendChild(textNode);
    var dismissBtn = document.createElement("button");
    dismissBtn.className = "message-dismiss";
    dismissBtn.setAttribute("aria-label", "Close alert");
    dismissBtn.textContent = "\u00d7";
    dismissBtn.onclick = function () {
      el.classList.remove("show");
    };
    el.appendChild(dismissBtn);
    el.className = "message " + type + " show";
    // Auto-dismiss success messages after 8 seconds; pause on hover
    if (type === "success") {
      clearTimeout(el._autoDismissTimer);
      var remaining = 8000;
      var startTime = Date.now();
      function startDismissTimer() {
        el._autoDismissTimer = setTimeout(function () {
          el.classList.remove("show");
        }, remaining);
        startTime = Date.now();
      }
      el.onmouseenter = function () {
        clearTimeout(el._autoDismissTimer);
        remaining -= Date.now() - startTime;
        if (remaining < 1000) remaining = 1000;
      };
      el.onmouseleave = function () {
        startDismissTimer();
      };
      startDismissTimer();
    }
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
