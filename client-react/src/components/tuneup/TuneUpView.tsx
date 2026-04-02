import { useState } from "react";
import { useTuneUp } from "../../hooks/useTuneUp";
import { dupGroupKey, taxSimilarKey } from "../../utils/topFinding";
import { SectionHeader } from "./SectionHeader";

interface Props {
  onOpenTask?: (taskId: string) => void;
  onUndo?: (action: { message: string; onUndo: () => void }) => void;
}

type CollapsedState = {
  duplicates: boolean;
  stale: boolean;
  quality: boolean;
  taxonomy: boolean;
};

function SkeletonRows() {
  return (
    <div className="tuneup-skeleton" aria-busy="true" aria-label="Loading…">
      <div className="tuneup-skeleton__row" />
      <div className="tuneup-skeleton__row" />
      <div className="tuneup-skeleton__row" />
    </div>
  );
}

function AllClear() {
  return (
    <div className="tuneup-all-clear">
      <span className="tuneup-all-clear__icon" aria-hidden="true">✓</span>
      All clear
    </div>
  );
}

export function TuneUpView({ onOpenTask: _onOpenTask, onUndo: _onUndo }: Props) {
  const {
    data,
    loading,
    error,
    dismissed,
    patchedTaskIds,
    patchedProjectIds,
    refresh,
    refreshSection,
  } = useTuneUp();

  const [collapsed, setCollapsed] = useState<CollapsedState>({
    duplicates: false,
    stale: false,
    quality: false,
    taxonomy: false,
  });

  function toggleSection(section: keyof CollapsedState) {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  // --- Compute visible counts per section (mirrors dismissal + patch filtering) ---

  const dupCount = data.duplicates
    ? data.duplicates.groups.filter((g) => {
        const key = dupGroupKey(g.tasks.map((t) => t.id));
        return !dismissed.has(key) && !g.tasks.some((t) => patchedTaskIds.has(t.id));
      }).length
    : 0;

  const staleCount = data.stale
    ? data.stale.staleTasks.filter(
        (t) => !dismissed.has(`stale:task:${t.id}`) && !patchedTaskIds.has(t.id),
      ).length +
      data.stale.staleProjects.filter(
        (p) => !dismissed.has(`stale:project:${p.id}`) && !patchedProjectIds.has(p.id),
      ).length
    : 0;

  const qualityCount = data.quality
    ? data.quality.results.filter(
        (r) => !dismissed.has(`quality:${r.id}`) && !patchedTaskIds.has(r.id),
      ).length
    : 0;

  const taxonomyCount = data.taxonomy
    ? data.taxonomy.similarProjects.filter((p) => {
        const key = taxSimilarKey(p.projectAId, p.projectBId, p.projectAName, p.projectBName);
        return !dismissed.has(key);
      }).length +
      data.taxonomy.smallProjects.filter(
        (p) => !(p.id ? dismissed.has(`tax:low:${p.id}`) || patchedProjectIds.has(p.id) : false),
      ).length
    : 0;

  return (
    <div className="tuneup-view">
      <div className="tuneup-view__header">
        <h1 className="tuneup-view__title">Tune-up</h1>
        <button
          className="tuneup-view__refresh"
          type="button"
          onClick={refresh}
          aria-label="Refresh all analyses"
        >
          Refresh
        </button>
      </div>

      {/* Duplicates section */}
      <section
        className="tuneup-section"
        aria-busy={loading.duplicates}
        data-section="duplicates"
      >
        <SectionHeader
          title="Duplicates"
          count={dupCount}
          isCollapsed={collapsed.duplicates}
          onToggle={() => toggleSection("duplicates")}
          loading={loading.duplicates}
          error={error.duplicates}
          onRetry={() => refreshSection("duplicates")}
        />
        {!collapsed.duplicates && (
          <div className="tuneup-section__body">
            {loading.duplicates ? (
              <SkeletonRows />
            ) : error.duplicates ? (
              <div className="tuneup-section__error" role="alert">
                {error.duplicates}
              </div>
            ) : dupCount === 0 ? (
              <AllClear />
            ) : (
              <div className="tuneup-section__placeholder">
                {dupCount} duplicate group{dupCount !== 1 ? "s" : ""} found
              </div>
            )}
          </div>
        )}
      </section>

      {/* Stale section */}
      <section
        className="tuneup-section"
        aria-busy={loading.stale}
        data-section="stale"
      >
        <SectionHeader
          title="Stale"
          count={staleCount}
          isCollapsed={collapsed.stale}
          onToggle={() => toggleSection("stale")}
          loading={loading.stale}
          error={error.stale}
          onRetry={() => refreshSection("stale")}
        />
        {!collapsed.stale && (
          <div className="tuneup-section__body">
            {loading.stale ? (
              <SkeletonRows />
            ) : error.stale ? (
              <div className="tuneup-section__error" role="alert">
                {error.stale}
              </div>
            ) : staleCount === 0 ? (
              <AllClear />
            ) : (
              <div className="tuneup-section__placeholder">
                {staleCount} stale item{staleCount !== 1 ? "s" : ""} found
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quality section */}
      <section
        className="tuneup-section"
        aria-busy={loading.quality}
        data-section="quality"
      >
        <SectionHeader
          title="Quality"
          count={qualityCount}
          isCollapsed={collapsed.quality}
          onToggle={() => toggleSection("quality")}
          loading={loading.quality}
          error={error.quality}
          onRetry={() => refreshSection("quality")}
        />
        {!collapsed.quality && (
          <div className="tuneup-section__body">
            {loading.quality ? (
              <SkeletonRows />
            ) : error.quality ? (
              <div className="tuneup-section__error" role="alert">
                {error.quality}
              </div>
            ) : qualityCount === 0 ? (
              <AllClear />
            ) : (
              <div className="tuneup-section__placeholder">
                {qualityCount} quality issue{qualityCount !== 1 ? "s" : ""} found
              </div>
            )}
          </div>
        )}
      </section>

      {/* Taxonomy section */}
      <section
        className="tuneup-section"
        aria-busy={loading.taxonomy}
        data-section="taxonomy"
      >
        <SectionHeader
          title="Taxonomy"
          count={taxonomyCount}
          isCollapsed={collapsed.taxonomy}
          onToggle={() => toggleSection("taxonomy")}
          loading={loading.taxonomy}
          error={error.taxonomy}
          onRetry={() => refreshSection("taxonomy")}
        />
        {!collapsed.taxonomy && (
          <div className="tuneup-section__body">
            {loading.taxonomy ? (
              <SkeletonRows />
            ) : error.taxonomy ? (
              <div className="tuneup-section__error" role="alert">
                {error.taxonomy}
              </div>
            ) : taxonomyCount === 0 ? (
              <AllClear />
            ) : (
              <div className="tuneup-section__placeholder">
                {taxonomyCount} taxonomy suggestion{taxonomyCount !== 1 ? "s" : ""} found
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
