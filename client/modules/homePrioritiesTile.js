// =============================================================================
// homePrioritiesTile.js — AI-powered "Next priorities" home tile.
// Uses local snapshot persistence plus server stale-while-refresh metadata so
// Home can render immediately without blanking during refreshes.
// =============================================================================

import { hooks } from "./store.js";
import { STORAGE_KEYS } from "../utils/storageKeys.js";

const TILE_BODY_ID = "homePrioritiesTileBody";
const HOME_PRIORITIES_POLL_MS = 1500;
const HOME_PRIORITIES_MAX_POLL_ATTEMPTS = 4;

// Session-scoped state — not in shared store
let _status = "idle"; // idle | loading | loaded | error
let _html = "";
let _generatedAt = null;
let _staleAt = null;
let _expiresAt = null;
let _isStale = false;
let _refreshInFlight = false;
let _error = "";
let _cacheHydrated = false;
let _refreshPollTimer = null;
let _refreshPollAttempts = 0;

function _clearRefreshPoll() {
  if (_refreshPollTimer) {
    window.clearTimeout(_refreshPollTimer);
    _refreshPollTimer = null;
  }
}

function _getVisibleSnapshot() {
  return _html.trim() ? _html : "";
}

function _readCachedSnapshot() {
  try {
    const raw = window.localStorage.getItem(
      STORAGE_KEYS.HOME_PRIORITIES_BRIEF_CACHE,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.html !== "string" || !parsed.html.trim()) return null;
    return {
      html: parsed.html,
      generatedAt:
        typeof parsed.generatedAt === "string" ? parsed.generatedAt : null,
      staleAt: typeof parsed.staleAt === "string" ? parsed.staleAt : null,
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
    };
  } catch {
    return null;
  }
}

function _persistSnapshot() {
  const snapshot = _getVisibleSnapshot();
  if (!snapshot) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.HOME_PRIORITIES_BRIEF_CACHE,
      JSON.stringify({
        html: snapshot,
        generatedAt: _generatedAt,
        staleAt: _staleAt,
        expiresAt: _expiresAt,
      }),
    );
  } catch {
    // Ignore localStorage failures; server state is still usable.
  }
}

function _hydrateCacheIfNeeded({ force = false } = {}) {
  if (!force && _cacheHydrated && _getVisibleSnapshot()) return;
  _cacheHydrated = true;
  const cached = _readCachedSnapshot();
  if (!cached) return;
  _html = cached.html;
  _generatedAt = cached.generatedAt;
  _staleAt = cached.staleAt;
  _expiresAt = cached.expiresAt;
  _status = "loaded";
}

function _applyResponseSnapshot(data) {
  _html = String(data?.html || "");
  _generatedAt =
    typeof data?.generatedAt === "string" ? data.generatedAt : null;
  _staleAt = typeof data?.staleAt === "string" ? data.staleAt : null;
  _expiresAt = typeof data?.expiresAt === "string" ? data.expiresAt : null;
  _isStale = !!data?.isStale;
  _refreshInFlight = !!data?.refreshInFlight;
  _status = _html ? "loaded" : "idle";
  _error = "";
  if (_html) {
    _persistSnapshot();
  }
}

function _formatTimestamp() {
  if (!_generatedAt) return "";
  const ts = new Date(_generatedAt);
  if (Number.isNaN(ts.getTime())) return "";
  return `Updated ${ts.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function _renderStatusMarkup() {
  const parts = [];
  const stamp = _formatTimestamp();
  if (stamp) {
    parts.push(stamp);
  }
  if (_refreshInFlight) {
    parts.push(_isStale ? "Refreshing…" : "Checking for updates…");
  } else if (_error && _getVisibleSnapshot()) {
    parts.push("Refresh failed — showing last saved brief.");
  } else if (_isStale) {
    parts.push("Saved brief");
  }
  if (!parts.length) return "";
  return `<div class="home-priorities-timestamp">${parts.join(" · ")}</div>`;
}

function _renderBodyMarkup() {
  const snapshot = _getVisibleSnapshot();
  if (snapshot) {
    return `${snapshot}${_renderStatusMarkup()}`;
  }

  if (_status === "idle" || _status === "loading") {
    return `<div class="home-priorities-state" aria-live="polite">Loading priorities&#8230;</div>`;
  }

  return `
    <div class="home-priorities-state home-priorities-state--error">
      Could not load priorities.
      <button type="button" class="mini-btn" data-onclick="refreshPrioritiesTile()">Retry</button>
    </div>`;
}

function _patchBody() {
  const body = document.getElementById(TILE_BODY_ID);
  if (!(body instanceof HTMLElement)) return;
  body.innerHTML = _renderBodyMarkup();
}

function _scheduleRefreshPoll() {
  if (_refreshPollAttempts >= HOME_PRIORITIES_MAX_POLL_ATTEMPTS) {
    _refreshInFlight = false;
    _patchBody();
    return;
  }
  _clearRefreshPoll();
  _refreshPollAttempts += 1;
  _refreshPollTimer = window.setTimeout(() => {
    void loadPrioritiesBrief({
      force: false,
      allowPoll: true,
      background: true,
    });
  }, HOME_PRIORITIES_POLL_MS);
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function loadPrioritiesBrief({
  force = false,
  allowPoll = true,
  background = false,
} = {}) {
  _hydrateCacheIfNeeded({ force: true });

  if (!force && !background) {
    if (_status === "loading") return;
    if (_status === "loaded" && !_refreshInFlight && !_isStale) return;
  }

  const hasVisibleSnapshot = !!_getVisibleSnapshot();
  _status = hasVisibleSnapshot ? "loaded" : "loading";
  _error = "";
  _refreshInFlight = hasVisibleSnapshot;
  _patchBody();

  try {
    if (force) {
      const refreshResponse = await hooks.apiCall(
        `${hooks.API_URL}/ai/priorities-brief/refresh`,
        {
          method: "POST",
        },
      );
      if (refreshResponse && !refreshResponse.ok) {
        const data = await refreshResponse.json().catch(() => ({}));
        throw new Error(
          String(data?.error || `HTTP ${refreshResponse.status}`),
        );
      }
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
    _applyResponseSnapshot(data);
    _refreshPollAttempts = 0;
    _patchBody();

    if (_refreshInFlight && allowPoll) {
      _scheduleRefreshPoll();
    } else {
      _clearRefreshPoll();
    }
  } catch (err) {
    _clearRefreshPoll();
    _refreshInFlight = false;
    _hydrateCacheIfNeeded({ force: true });
    const hasCachedSnapshot = !!_getVisibleSnapshot();
    if (hasVisibleSnapshot || hasCachedSnapshot) {
      _status = "loaded";
      _error = String(err?.message || "Could not refresh priorities");
      _patchBody();
      return;
    }
    _status = "error";
    _error = String(err?.message || "Could not load priorities");
    _patchBody();
  }
}

export function refreshPrioritiesTile() {
  _clearRefreshPoll();
  _refreshPollAttempts = 0;
  void loadPrioritiesBrief({ force: true, allowPoll: true });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function renderPrioritiesTileShell() {
  _hydrateCacheIfNeeded({ force: true });

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
        ${_renderBodyMarkup()}
      </div>
    </section>`;
}
