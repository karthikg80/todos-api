const TRANSITION_KEY = "todos:cross-page-transition";
const TRANSITION_TTL_MS = 4000;
const DEFAULT_DURATION_MS = 280;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getDurationMs(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--dur-view")
    .trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DURATION_MS;
}

function getOrCreateOverlay(): HTMLDivElement {
  let overlay = document.querySelector<HTMLDivElement>(".view-transition-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "view-transition-overlay";
    document.body.appendChild(overlay);
  }
  return overlay;
}

function writePendingTransition(href: string) {
  try {
    window.sessionStorage.setItem(
      TRANSITION_KEY,
      JSON.stringify({
        href,
        at: Date.now(),
      }),
    );
  } catch {}
}

function consumePendingTransition(): boolean {
  try {
    const raw = window.sessionStorage.getItem(TRANSITION_KEY);
    if (!raw) return false;

    window.sessionStorage.removeItem(TRANSITION_KEY);
    const parsed = JSON.parse(raw) as { at?: number } | null;
    if (!parsed || typeof parsed.at !== "number") {
      return false;
    }

    return Date.now() - parsed.at <= TRANSITION_TTL_MS;
  } catch {
    return false;
  }
}

function performNavigation(href: string, replace?: boolean) {
  if (replace) {
    window.location.replace(href);
    return;
  }

  window.location.href = href;
}

export function navigateWithFade(
  href: string,
  options: { replace?: boolean } = {},
) {
  if (prefersReducedMotion()) {
    performNavigation(href, options.replace);
    return;
  }

  writePendingTransition(href);
  const overlay = getOrCreateOverlay();
  overlay.offsetHeight;
  overlay.classList.add("active");

  window.setTimeout(() => {
    performNavigation(href, options.replace);
  }, getDurationMs());
}

export function fadeInOnLoad() {
  if (prefersReducedMotion()) return;
  if (!consumePendingTransition()) return;

  const overlay = getOrCreateOverlay();
  overlay.classList.add("active");

  requestAnimationFrame(() => {
    overlay.classList.remove("active");

    window.setTimeout(() => {
      if (overlay.parentNode && !overlay.classList.contains("active")) {
        overlay.parentNode.removeChild(overlay);
      }
    }, getDurationMs() + 50);
  });
}
