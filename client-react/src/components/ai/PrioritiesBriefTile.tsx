import { useState, useEffect, useCallback } from "react";
import * as aiApi from "../../api/ai";

export function PrioritiesBriefTile() {
  const [brief, setBrief] = useState<aiApi.PrioritiesBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    aiApi
      .fetchPrioritiesBrief()
      .then(setBrief)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const updated = await aiApi.refreshPrioritiesBrief();
      if (updated) setBrief(updated);
    } catch {}
    setRefreshing(false);
  }, []);

  if (loading) {
    return (
      <section className="home-tile home-tile--priorities">
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

  if (!brief) return null;

  return (
    <section className="home-tile home-tile--priorities" data-home-tile="priorities_brief">
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <h3 className="home-tile__title">Today's focus</h3>
          {brief.cached && brief.generatedAt && (
            <span className="priorities-brief__timestamp">
              Updated{" "}
              {new Date(brief.generatedAt).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <button
          className="mini-btn"
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
      </div>
    </section>
  );
}
