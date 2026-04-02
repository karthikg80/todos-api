import { useState, useCallback } from "react";
import { useTuneUp } from "../../hooks/useTuneUp";
import { apiCall } from "../../api/client";
import { dupGroupKey, taxSimilarKey } from "../../utils/topFinding";
import { titlePassesQuality } from "../../utils/qualityHeuristic";
import { SectionHeader } from "./SectionHeader";
import { DuplicatesSection } from "./DuplicatesSection";
import { StaleSection } from "./StaleSection";
import { QualitySection } from "./QualitySection";
import { TaxonomySection } from "./TaxonomySection";
import type { DuplicateGroup } from "../../types/tuneup";

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
    <div className="tuneup-skeleton" aria-busy="true" aria-label="Loading...">
      <div className="tuneup-skeleton__row" />
      <div className="tuneup-skeleton__row" />
      <div className="tuneup-skeleton__row" />
    </div>
  );
}

export function TuneUpView({ onOpenTask, onUndo }: Props) {
  const {
    data,
    loading,
    error,
    dismissed,
    patchedTaskIds,
    patchedProjectIds,
    refresh,
    refreshSection,
    dismiss,
    patchTaskOut,
    unpatchTaskOut,
    patchProjectOut,
    unpatchProjectOut,
    patchQualityResolved,
    patchStaleResolved,
    restoreStaleTask,
  } = useTuneUp();

  const [collapsed, setCollapsed] = useState<CollapsedState>({
    duplicates: false,
    stale: false,
    quality: false,
    taxonomy: false,
  });

  const [mergeErrors, setMergeErrors] = useState<Record<string, string>>({});

  function toggleSection(section: keyof CollapsedState) {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  // --- Compute visible counts per section ---

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

  // --- Action handlers ---

  const handleMergeDuplicates = useCallback(
    async (group: DuplicateGroup) => {
      const survivor = group.tasks[0];
      const others = group.tasks.slice(1);
      const archivedIds: string[] = [];
      const failedIds: string[] = [];

      // Optimistically patch out all non-survivors
      for (const task of others) {
        patchTaskOut(task.id);
      }

      // Sequential archive calls
      for (const task of others) {
        try {
          const res = await apiCall(`/todos/${task.id}`, {
            method: "PUT",
            body: JSON.stringify({ archived: true }),
          });
          if (!res.ok) throw new Error(`Archive failed: ${res.status}`);
          archivedIds.push(task.id);
        } catch {
          failedIds.push(task.id);
          // Unpatch failed ones so they reappear
          unpatchTaskOut(task.id);
        }
      }

      // Show inline error for partial failures
      if (failedIds.length > 0) {
        const groupKey = dupGroupKey(group.tasks.map((t) => t.id));
        setMergeErrors((prev) => ({
          ...prev,
          [groupKey]: `Failed to archive ${failedIds.length} task${failedIds.length !== 1 ? "s" : ""}`,
        }));
      }

      if (archivedIds.length > 0 && onUndo) {
        onUndo({
          message: `Merged ${archivedIds.length + 1} tasks (kept "${survivor.title}")`,
          onUndo: async () => {
            for (const id of archivedIds) {
              unpatchTaskOut(id);
              try {
                await apiCall(`/todos/${id}`, {
                  method: "PUT",
                  body: JSON.stringify({ archived: false }),
                });
              } catch {
                // Best effort undo
              }
            }
          },
        });
      }
    },
    [patchTaskOut, unpatchTaskOut, onUndo],
  );

  const handleArchiveTask = useCallback(
    async (taskId: string) => {
      patchTaskOut(taskId);
      try {
        const res = await apiCall(`/todos/${taskId}`, {
          method: "PUT",
          body: JSON.stringify({ archived: true }),
        });
        if (!res.ok) {
          unpatchTaskOut(taskId);
          return;
        }
      } catch {
        unpatchTaskOut(taskId);
        return;
      }

      if (onUndo) {
        onUndo({
          message: "Task archived",
          onUndo: async () => {
            unpatchTaskOut(taskId);
            try {
              await apiCall(`/todos/${taskId}`, {
                method: "PUT",
                body: JSON.stringify({ archived: false }),
              });
            } catch {
              // Best effort
            }
          },
        });
      }
    },
    [patchTaskOut, unpatchTaskOut, onUndo],
  );

  const handleSnoozeTask = useCallback(
    async (taskId: string) => {
      // Fetch current reviewDate before mutating
      let priorReviewDate: string | null = null;
      try {
        const fetchRes = await apiCall(`/todos/${taskId}`);
        if (fetchRes.ok) {
          const taskData = await fetchRes.json();
          priorReviewDate = taskData.reviewDate ?? null;
        }
      } catch {
        // Proceed with null
      }

      const removedTask = patchStaleResolved(taskId);

      const reviewDate = new Date();
      reviewDate.setDate(reviewDate.getDate() + 30);

      try {
        const res = await apiCall(`/todos/${taskId}`, {
          method: "PUT",
          body: JSON.stringify({ reviewDate: reviewDate.toISOString() }),
        });
        if (!res.ok && removedTask) {
          restoreStaleTask(removedTask);
          return;
        }
      } catch {
        if (removedTask) restoreStaleTask(removedTask);
        return;
      }

      if (onUndo && removedTask) {
        onUndo({
          message: "Snoozed for 30 days",
          onUndo: async () => {
            restoreStaleTask(removedTask);
            try {
              await apiCall(`/todos/${taskId}`, {
                method: "PUT",
                body: JSON.stringify({ reviewDate: priorReviewDate }),
              });
            } catch {
              // Best effort
            }
          },
        });
      }
    },
    [patchStaleResolved, restoreStaleTask, onUndo],
  );

  const handleArchiveProject = useCallback(
    async (projectId: string) => {
      patchProjectOut(projectId);
      try {
        const res = await apiCall(`/projects/${projectId}`, {
          method: "PUT",
          body: JSON.stringify({ archived: true }),
        });
        if (!res.ok) {
          unpatchProjectOut(projectId);
          return;
        }
      } catch {
        unpatchProjectOut(projectId);
        return;
      }

      if (onUndo) {
        onUndo({
          message: "Project archived",
          onUndo: async () => {
            unpatchProjectOut(projectId);
            try {
              await apiCall(`/projects/${projectId}`, {
                method: "PUT",
                body: JSON.stringify({ archived: false }),
              });
            } catch {
              // Best effort
            }
          },
        });
      }
    },
    [patchProjectOut, unpatchProjectOut, onUndo],
  );

  const handleEditTitle = useCallback(
    async (taskId: string, newTitle: string) => {
      try {
        const res = await apiCall(`/todos/${taskId}`, {
          method: "PUT",
          body: JSON.stringify({ title: newTitle }),
        });
        if (!res.ok) return;
      } catch {
        return;
      }

      if (titlePassesQuality(newTitle)) {
        patchQualityResolved(taskId);
      }

      if (onUndo) {
        onUndo({
          message: "Title updated",
          onUndo: () => {
            // No undo for title edits
          },
        });
      }
    },
    [patchQualityResolved, onUndo],
  );

  const handleOpenTask = useCallback(
    (taskId: string) => {
      if (onOpenTask) onOpenTask(taskId);
    },
    [onOpenTask],
  );

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
            ) : data.duplicates ? (
              <>
                <DuplicatesSection
                  groups={data.duplicates.groups}
                  dismissed={dismissed}
                  patchedTaskIds={patchedTaskIds}
                  onMerge={handleMergeDuplicates}
                  onDismiss={dismiss}
                />
                {Object.entries(mergeErrors).map(([key, msg]) => (
                  <div key={key} className="tuneup-row tuneup-row--error">
                    <span className="tuneup-row__error-text">{msg}</span>
                  </div>
                ))}
              </>
            ) : null}
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
            ) : data.stale ? (
              <StaleSection
                staleTasks={data.stale.staleTasks}
                staleProjects={data.stale.staleProjects}
                dismissed={dismissed}
                patchedTaskIds={patchedTaskIds}
                patchedProjectIds={patchedProjectIds}
                onArchiveTask={handleArchiveTask}
                onSnoozeTask={handleSnoozeTask}
                onArchiveProject={handleArchiveProject}
                onDismiss={dismiss}
                onOpenTask={handleOpenTask}
              />
            ) : null}
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
            ) : data.quality ? (
              <QualitySection
                issues={data.quality.results}
                dismissed={dismissed}
                patchedTaskIds={patchedTaskIds}
                onEditTitle={handleEditTitle}
                onDismiss={dismiss}
              />
            ) : null}
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
            ) : data.taxonomy ? (
              <TaxonomySection
                similarProjects={data.taxonomy.similarProjects}
                smallProjects={data.taxonomy.smallProjects}
                dismissed={dismissed}
                patchedProjectIds={patchedProjectIds}
                onArchiveProject={handleArchiveProject}
                onDismiss={dismiss}
              />
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
