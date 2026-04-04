import { useEffect } from "react";
import { useTuneUp } from "../../hooks/useTuneUp";
import { computeTopFinding } from "../../utils/topFinding";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Props {}

function freshnessLabel(lastFetchedAt: number | null): string {
  if (lastFetchedAt === null) return "";
  const diffMs = Date.now() - lastFetchedAt;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Last checked just now";
  if (diffMinutes < 60) return `Last checked ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `Last checked ${diffHours}h ago`;
}

export function TuneUpTile(_props: Props) {
  const {
    data,
    loading,
    hasFetched,
    allSettled,
    dismissed,
    patchedTaskIds,
    patchedProjectIds,
    lastFetchedAt,
    load,
  } = useTuneUp({ autoFetch: false });

  useEffect(() => {
    load();
  }, [load]);

  const isAnyLoading = Object.values(loading).some(Boolean);
  const topFinding = computeTopFinding(data, dismissed, patchedTaskIds, patchedProjectIds);

  // State 1: all settled but never fetched — all sections failed
  const allFailed = allSettled && !hasFetched && !isAnyLoading;

  // State 2: loading (no top-tier finding yet)
  const isLoadingNoFinding = isAnyLoading && topFinding === null;

  // State 3: early finding — loading but top-tier (1-3) finding available
  const earlyFinding = isAnyLoading && topFinding !== null && topFinding.tier <= 3;

  // State 4: settled with finding
  const settledWithFinding = allSettled && hasFetched && topFinding !== null;

  // State 5: settled with no findings
  const settledNoFindings = allSettled && hasFetched && topFinding === null;

  function getSeverityStyle(): React.CSSProperties {
    if (!topFinding) return {};
    if (topFinding.tier <= 3) return { color: "var(--danger)" };
    if (topFinding.tier === 7) return { opacity: 0.6 };
    return {};
  }

  return (
    <section className="home-tile" data-home-tile="tuneup">
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <svg
            className="home-tile__icon"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <h3 className="home-tile__title">Tune-up</h3>
        </div>
      </div>

      <div className="home-tile__body">
        {allFailed && (
          <div className="home-tile__empty">
            <p className="home-tile__empty-text">Couldn&apos;t analyze</p>
          </div>
        )}

        {isLoadingNoFinding && (
          <div className="home-tile__loading">
            <span className="home-tile__pulse" aria-label="Analyzing...">
              Analyzing&hellip;
            </span>
          </div>
        )}

        {earlyFinding && topFinding && (
          <div className="tuneup-tile__finding">
            <span
              className="tuneup-tile__finding-label"
              style={getSeverityStyle()}
            >
              {topFinding.label}
            </span>
            {topFinding.tier <= 3 && (
              <span className="tuneup-tile__severity-cue tuneup-tile__severity-cue--danger">
                Needs attention
              </span>
            )}
            <span className="tuneup-tile__loading-hint">Still analyzing&hellip;</span>
          </div>
        )}

        {settledWithFinding && topFinding && (
          <div className="tuneup-tile__finding">
            <span
              className="tuneup-tile__finding-label"
              style={getSeverityStyle()}
            >
              {topFinding.label}
            </span>
            {topFinding.tier <= 3 && (
              <span className="tuneup-tile__severity-cue tuneup-tile__severity-cue--danger">
                Needs attention
              </span>
            )}
            {lastFetchedAt !== null && (
              <span className="tuneup-tile__freshness">
                {freshnessLabel(lastFetchedAt)}
              </span>
            )}
          </div>
        )}

        {settledNoFindings && (
          <div className="home-tile__empty">
            <p className="home-tile__empty-text">
              All clear — nothing to clean up
            </p>
            {lastFetchedAt !== null && (
              <span className="tuneup-tile__freshness tuneup-tile__freshness--muted">
                {freshnessLabel(lastFetchedAt)}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
