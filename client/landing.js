// landing.js — Standalone initializer for public/index.html (landing page).
// Depends on: /utils/theme.js (loaded before this script).

// Show "Go to app" CTA for authenticated users, hide login/register buttons.
if (localStorage.getItem("token")) {
  var goBtn = document.getElementById("landingGoToApp");
  var loginBtn = document.getElementById("landingLoginBtn");
  var regBtn = document.getElementById("landingRegisterBtn");
  if (goBtn) goBtn.style.display = "";
  if (loginBtn) loginBtn.style.display = "none";
  if (regBtn) regBtn.style.display = "none";
}

// Event delegation for data-onclick attributes.
// NOTE: This uses new Function() intentionally — the data-onclick pattern is an
// existing codebase convention used across all pages. The values come from
// static HTML attributes authored by developers, not from user input.
document.addEventListener("click", function (e) {
  var el = e.target.closest("[data-onclick]");
  if (el) {
    new Function(el.dataset.onclick).call(el); // eslint-disable-line no-new-func
  }
});
