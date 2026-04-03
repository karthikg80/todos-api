import { useState, useEffect, useCallback, useRef } from "react";
import * as aiApi from "../../api/ai";

const PRIORITIES_CACHE_KEY = "todos:home-priorities-brief-cache";
const STALE_REFRESH_RETRY_MS = 1500;
const MAX_STALE_REFRESH_POLLS = 3;

function readCachedBrief(): aiApi.PrioritiesBrief | null {
  try {
    const raw = window.localStorage.getItem(PRIORITIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const html = typeof parsed?.html === "string" ? parsed.html.trim() : "";
    if (!html) return null;
    return {
      html,
      generatedAt:
        typeof parsed?.generatedAt === "string" ? parsed.generatedAt : "",
      expiresAt:
        typeof parsed?.expiresAt === "string" ? parsed.expiresAt : null,
      cached: true,
      isStale: true,
      refreshInFlight: false,
    };
  } catch {
    return null;
  }
}

function writeCachedBrief(brief: aiApi.PrioritiesBrief) {
  try {
    window.localStorage.setItem(
      PRIORITIES_CACHE_KEY,
      JSON.stringify({
        html: brief.html,
        generatedAt: brief.generatedAt,
        expiresAt: brief.expiresAt ?? null,
      }),
    );
  } catch {
    // Ignore storage failures; the tile still renders from in-memory state.
  }
}

function formatTimestamp(value: string | undefined) {
  if (!value) return "";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "";
  return ts.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PrioritiesBriefTile() {
  const [brief, setBrief] = useState<aiApi.PrioritiesBrief | null>(() =>
    readCachedBrief(),
  );
  const [loading, setLoading] = useState(() => !readCachedBrief());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const staleRefreshPollsRef = useRef(0);
  const staleRefreshTimerRef = useRef<number | null>(null);

  const clearStaleRefreshTimer = useCallback(() => {
    if (staleRefreshTimerRef.current != null) {
      window.clearTimeout(staleRefreshTimerRef.current);
      staleRefreshTimerRef.current = null;
    }
  }, []);

  const applyBrief = useCallback((next: aiApi.PrioritiesBrief | null) => {
    if (!next) return false;
    setBrief(next);
    setRefreshError("");
    if (next.html.trim()) {
      writeCachedBrief(next);
    }
    return true;
  }, []);

  const loadBrief = useCallback(
    async ({
      force = false,
      background = false,
    }: { force?: boolean; background?: boolean } = {}) => {
      const hasVisibleContent = Boolean(brief?.html);
      if (force && hasVisibleContent) {
        setRefreshing(true);
        setRefreshError("");
        await aiApi.refreshPrioritiesBrief().catch(() => null);
      } else if (!background) {
        setLoading(!hasVisibleContent);
        setRefreshing(hasVisibleContent);
        setRefreshError("");
      }

      try {
        const next = await aiApi.fetchPrioritiesBrief();
        if (!next) throw new Error("Could not load priorities");
        applyBrief(next);

        if (next.refreshInFlight || (next.isStale && !background)) {
          if (staleRefreshPollsRef.current >= MAX_STALE_REFRESH_POLLS) {
            staleRefreshPollsRef.current = 0;
          } else {
            clearStaleRefreshTimer();
            staleRefreshPollsRef.current += 1;
            staleRefreshTimerRef.current = window.setTimeout(() => {
              staleRefreshTimerRef.current = null;
              void loadBrief({ background: true });
            }, STALE_REFRESH_RETRY_MS);
          }
        } else {
          staleRefreshPollsRef.current = 0;
        }
      } catch {
        if (!hasVisibleContent && !brief?.html) {
          setBrief(null);
        } else {
          setRefreshError("Showing the last update.");
          setBrief((current) =>
            current
              ? {
                  ...current,
                  isStale: true,
                  refreshInFlight: false,
                }
              : current,
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyBrief, brief?.html, clearStaleRefreshTimer],
  );

  useEffect(() => {
    void loadBrief();
    return () => clearStaleRefreshTimer();
  }, [clearStaleRefreshTimer, loadBrief]);

  const handleRefresh = useCallback(async () => {
    staleRefreshPollsRef.current = 0;
    clearStaleRefreshTimer();
    await loadBrief({ force: true });
  }, [clearStaleRefreshTimer, loadBrief]);

  if (loading) {
    return (
      <section
        className="home-tile home-tile--priorities"
        data-testid="home-priorities-tile"
      >
        <div className="home-tile__header">
          <div className="home-tile__title-row">
            <h3 className="home-tile__title">Today's focus</h3>
          </div>
        </div>
        <div className="home-tile__body">
          <div className="priorities-brief__loading">
            Loading priorities…
          </div>
        </div>
      </section>
    );
  }

  if (!brief) {
    return (
      <section
        className="home-tile home-tile--priorities"
        data-testid="home-priorities-tile"
      >
        <div className="home-tile__header">
          <div className="home-tile__title-row">
            <h3 className="home-tile__title">Today's focus</h3>
          </div>
        </div>
        <div className="home-tile__body">
          <div className="priorities-brief__loading">
            Nothing urgent right now.
          </div>
        </div>
      </section>
    );
  }

  const timestamp = formatTimestamp(brief.generatedAt);
  const showBackgroundRefresh = Boolean(brief.isStale && brief.refreshInFlight);

  return (
    <section
      className="home-tile home-tile--priorities"
      data-home-tile="priorities_brief"
      data-testid="home-priorities-tile"
    >
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <h3 className="home-tile__title">Today's focus</h3>
          {timestamp && (
            <span className="priorities-brief__timestamp">
              Updated {timestamp}
            </span>
          )}
        </div>
        <button
          className="mini-btn home-priorities-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="home-tile__body">
        <div
          className="priorities-brief__content"
          dangerouslySetInnerHTML={{ __html: brief.html }}
        />
        {refreshing && (
          <div className="priorities-brief__status" aria-live="polite">
            Refreshing priorities…
          </div>
        )}
        {!refreshing && refreshError && (
          <div
            className="priorities-brief__status priorities-brief__status--warning"
            aria-live="polite"
          >
            {refreshError}
          </div>
        )}
        {!refreshing && !refreshError && showBackgroundRefresh && (
          <div className="priorities-brief__status" aria-live="polite">
            Updating priorities in the background…
          </div>
        )}
      </div>
    </section>
  );
}
