// =============================================================================
// homePrioritiesTile.js — AI-powered "Next priorities" home tile.
// Fetches /ai/priorities-brief and renders AI-generated HTML inside a tile.
// Shell renders immediately on home load; content swaps in asynchronously.
// =============================================================================

import { hooks } from "./store.js";

const TILE_BODY_ID = "homePrioritiesTileBody";

// Session-scoped state — not in shared store
let _status = "idle"; // idle | loading | loaded | error
let _html = "";
let _generatedAt = null;
let _error = "";

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function loadPrioritiesBrief({ force = false } = {}) {
  if (!force && (_status === "loaded" || _status === "loading")) return;

  _status = "loading";
  _patchBody();

  try {
    if (force) {
      await hooks.apiCall(`${hooks.API_URL}/ai/priorities-brief/refresh`, {
        method: "POST",
      });
    }

    const response = await hooks.apiCall(
      `${hooks.API_URL}/ai/priorities-brief`,
    );
    if (!response || !response.ok) {
      const data = response ? await response.json().catch(() => ({})) : {};
      throw new Error(
        String(data?.error || `HTTP ${response?.status ?? "unknown"}`),
      );
    }

    const data = await response.json();
    _html = String(data.html || "");
    _generatedAt = data.generatedAt || null;
    _status = "loaded";
    _error = "";
  } catch (err) {
    _status = "error";
    _error = String(err?.message || "Could not load priorities");
  }

  _patchBody();
}

export function refreshPrioritiesTile() {
  loadPrioritiesBrief({ force: true });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderPrioritiesTileShell() {
  return `
    <section class="home-tile home-tile--priorities" data-testid="home-priorities-tile">
      <div class="home-tile__header">
        <div class="home-tile__title-row">
          <h3 class="home-tile__title">Next priorities</h3>
        </div>
        <button type="button"
                class="mini-btn home-priorities-refresh-btn"
                data-onclick="refreshPrioritiesTile()"
                aria-label="Refresh priorities"
                title="Refresh">&#8635;</button>
      </div>
      <div class="home-tile__body home-priorities-body" id="${TILE_BODY_ID}">
        <div class="home-priorities-state" aria-live="polite">Loading&#8230;</div>
      </div>
    </section>`;
}

function _patchBody() {
  const body = document.getElementById(TILE_BODY_ID);
  if (!(body instanceof HTMLElement)) return;

  if (_status === "idle" || _status === "loading") {
    body.innerHTML = `<div class="home-priorities-state" aria-live="polite">Loading priorities&#8230;</div>`;
    return;
  }

  if (_status === "error") {
    body.innerHTML = `
      <div class="home-priorities-state home-priorities-state--error">
        Could not load priorities.
        <button type="button" class="mini-btn" data-onclick="refreshPrioritiesTile()">Retry</button>
      </div>`;
    return;
  }

  // Server-generated HTML from configured LLM using app's own CSS classes.
  // Content originates from the server's prioritiesBriefRouter which formats
  // user task data into HTML using a structured system prompt with a closed
  // set of CSS class names. No user-controlled HTML reaches this path.
  body.innerHTML = _html; // trusted server-generated HTML

  if (_generatedAt) {
    const ts = new Date(_generatedAt);
    if (!isNaN(ts.getTime())) {
      const stamp = document.createElement("div");
      stamp.className = "home-priorities-timestamp";
      stamp.textContent = `Updated ${ts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
      body.appendChild(stamp);
    }
  }
}
