// =============================================================================
// homePrioritiesTile.js — AI-powered "Next priorities" home tile.
// Fetches /ai/priorities-brief and renders AI-generated HTML inside a tile.
// Shell renders immediately on home load; content swaps in asynchronously.
// =============================================================================

import { STORAGE_KEYS } from "../utils/storageKeys.js";
import { hooks } from "./store.js";

const TILE_BODY_ID = "homePrioritiesTileBody";
const STALE_REFRESH_RETRY_MS = 1500;
const MAX_STALE_REFRESH_POLLS = 3;

// Session-scoped state — not in shared store
let _status = "idle"; // idle | loading | refreshing | loaded | error
let _html = "";
let _generatedAt = null;
let _expiresAt = null;
let _isStale = false;
let _refreshInFlight = false;
let _error = "";
let _cacheHydrated = false;
let _loadToken = 0;
let _staleRefreshTimer = null;
let _staleRefreshPolls = 0;

function _readCachedBrief() {
  try {
    const raw = window.localStorage.getItem(
      STORAGE_KEYS.HOME_PRIORITIES_BRIEF_CACHE,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const html = typeof parsed.html === "string" ? parsed.html.trim() : "";
    if (!html) return null;
    return {
      html,
      generatedAt:
        typeof parsed.generatedAt === "string" ? parsed.generatedAt : null,
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

function _writeCachedBrief() {
  if (!_html) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.HOME_PRIORITIES_BRIEF_CACHE,
      JSON.stringify({
        html: _html,
        generatedAt: _generatedAt,
        expiresAt: _expiresAt,
      }),
    );
  } catch {
    // Ignore storage failures; the tile still works for the current session.
  }
}

function _hydrateFromCache() {
  if (_cacheHydrated) return;
  _cacheHydrated = true;
  const cached = _readCachedBrief();
  if (!cached) return;
  _html = cached.html;
  _generatedAt = cached.generatedAt;
  _expiresAt = cached.expiresAt;
  _isStale = true;
  _refreshInFlight = false;
  _status = "loaded";
  _error = "";
}

function _clearStaleRefreshTimer() {
  if (_staleRefreshTimer) {
    window.clearTimeout(_staleRefreshTimer);
    _staleRefreshTimer = null;
  }
}

function _scheduleFollowUpRefresh() {
  if (_staleRefreshPolls >= MAX_STALE_REFRESH_POLLS) return;
  _clearStaleRefreshTimer();
  _staleRefreshPolls += 1;
  _staleRefreshTimer = window.setTimeout(() => {
    _staleRefreshTimer = null;
    void loadPrioritiesBrief({ background: true });
  }, STALE_REFRESH_RETRY_MS);
}

function _formatTimestamp(value) {
  if (!value) return "";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "";
  return ts.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function _buildMetaHtml() {
  const timestamp = _formatTimestamp(_generatedAt);
  const stampHtml = timestamp
    ? `<div class="home-priorities-timestamp">Updated ${timestamp}</div>`
    : "";

  if (_status === "refreshing") {
    return `
      <div class="home-priorities-status" aria-live="polite">
        Refreshing priorities…
      </div>
      ${stampHtml}`;
  }

  if (_error && _html) {
    return `
      <div class="home-priorities-status home-priorities-status--warning" aria-live="polite">
        Showing the last update.
        <button type="button" class="mini-btn" data-onclick="refreshPrioritiesTile()">Retry</button>
      </div>
      ${stampHtml}`;
  }

  if (_isStale) {
    return `
      <div class="home-priorities-status" aria-live="polite">
        Updating priorities in the background…
      </div>
      ${stampHtml}`;
  }

  return stampHtml;
}

function _buildBodyHtml() {
  if (_status === "idle" || (_status === "loading" && !_html)) {
    return `<div class="home-priorities-state" aria-live="polite">Loading priorities&#8230;</div>`;
  }

  if (_status === "error" && !_html) {
    return `
      <div class="home-priorities-state home-priorities-state--error">
        Could not load priorities.
        <button type="button" class="mini-btn" data-onclick="refreshPrioritiesTile()">Retry</button>
      </div>`;
  }

  return `${_html}${_buildMetaHtml()}`;
}

function _patchBody() {
  const body = document.getElementById(TILE_BODY_ID);
  if (!(body instanceof HTMLElement)) return;
  body.innerHTML = _buildBodyHtml();
}

function _applyResponsePayload(data) {
  _html = String(data?.html || "").trim();
  _generatedAt =
    typeof data?.generatedAt === "string" ? data.generatedAt : null;
  _expiresAt = typeof data?.expiresAt === "string" ? data.expiresAt : null;
  _isStale = !!data?.isStale;
  _refreshInFlight = !!data?.refreshInFlight;
  _status = "loaded";
  _error = "";
  if (_html) {
    _writeCachedBrief();
  }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function loadPrioritiesBrief({
  force = false,
  background = false,
} = {}) {
  _hydrateFromCache();

  if (!force && (_status === "loading" || _status === "refreshing")) return;

  const hasVisibleContent = !!_html;
  _status = hasVisibleContent ? "refreshing" : "loading";
  _error = "";
  _patchBody();

  _clearStaleRefreshTimer();
  const requestToken = ++_loadToken;

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
    if (requestToken !== _loadToken) return;

    _applyResponsePayload(data);

    if (_refreshInFlight || (_isStale && !background)) {
      _scheduleFollowUpRefresh();
    } else {
      _staleRefreshPolls = 0;
    }
  } catch (err) {
    if (requestToken !== _loadToken) return;
    if (_html) {
      _status = "loaded";
      _error = String(err?.message || "Could not refresh priorities");
      _isStale = true;
      _refreshInFlight = false;
    } else {
      _status = "error";
      _error = String(err?.message || "Could not load priorities");
    }
  }

  _patchBody();
}

export function refreshPrioritiesTile() {
  _staleRefreshPolls = 0;
  void loadPrioritiesBrief({ force: true });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderPrioritiesTileShell() {
  _hydrateFromCache();

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
        ${_buildBodyHtml()}
      </div>
    </section>`;
}
