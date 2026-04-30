import { useState, useCallback } from "react";
import { apiCall } from "../../api/client";
import { ViewHeader } from "./ViewHeader";
import { ViewState } from "./ViewState";
import { Skeleton } from "../shared/Skeleton";
import { Panel } from "../shared/Panel";
import { EmptyState } from "../shared/EmptyState";
import {
  normalizeWeeklyReviewResponse,
  type ReviewData,
} from "./weeklyReviewModels";

function isoWeekLabel(date: Date = new Date()): string {
  // ISO 8601 week number (Mon-start, weeks containing Thursday).
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `Week ${weekNum} · ${target.getUTCFullYear()}`;
}

type ReviewState = "idle" | "loading" | "reviewing" | "applying" | "error";
type ReviewMode = "suggest" | "apply";

interface Props {
  onBack: () => void;
  onApplied?: () => void;
}

export function WeeklyReview({ onBack, onApplied }: Props) {
  const [state, setState] = useState<ReviewState>("idle");
  const [data, setData] = useState<ReviewData | null>(null);
  const [reviewMode, setReviewMode] = useState<ReviewMode>("suggest");
  const [error, setError] = useState("");

  const runReview = useCallback(
    async (mode: ReviewMode = "suggest") => {
      setState(mode === "apply" ? "applying" : "loading");
      setError("");
      try {
        const res = await apiCall("/agent/write/weekly_review", {
          method: "POST",
          body: JSON.stringify({ mode }),
        });
        if (!res.ok) throw new Error("Failed to run review");
        const result = await res.json();
        setData(normalizeWeeklyReviewResponse(result));
        setReviewMode(mode);
        setState("reviewing");
        if (mode === "apply") {
          onApplied?.();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setState("error");
      }
    },
    [onApplied],
  );

  return (
    <div className="weekly-review">
      <ViewHeader
        crumb="Settings › Weekly Review"
        title="Weekly Review"
        subtitle={isoWeekLabel()}
        back={{ onClick: onBack }}
      />

      {state === "idle" && (
        <div className="weekly-review__start">
          <p className="weekly-review__desc">
            Review your week, clear the backlog, and set focus for next week.
          </p>
          <button
            className="btn btn--primary"
            onClick={() => void runReview("suggest")}
          >
            Run Review
          </button>
        </div>
      )}

      {state === "loading" && (
        <ViewState
          loading
          loadingContent={
            <>
              <Skeleton
                variant="row"
                count={3}
                aria-label="Analyzing your week"
              />
              <p>Analyzing your week…</p>
            </>
          }
        />
      )}

      {state === "error" && (
        <ViewState error={error} onRetry={() => void runReview("suggest")} />
      )}

      {state === "reviewing" && data && (
        <div className="weekly-review__content">
          {data.summary && (
            <Panel title="Summary">
              <div className="weekly-review__metrics">
                <div className="weekly-review__metric">
                  <span className="weekly-review__metric-value">
                    {data.summary.projectsWithoutNextAction}
                  </span>
                  <span className="weekly-review__metric-label">
                    Projects need next action
                  </span>
                </div>
                <div className="weekly-review__metric">
                  <span className="weekly-review__metric-value">
                    {data.summary.staleTasks}
                  </span>
                  <span className="weekly-review__metric-label">
                    Stale tasks
                  </span>
                </div>
                <div className="weekly-review__metric">
                  <span className="weekly-review__metric-value">
                    {data.summary.waitingTasks}
                  </span>
                  <span className="weekly-review__metric-label">
                    Waiting on
                  </span>
                </div>
                <div className="weekly-review__metric">
                  <span className="weekly-review__metric-value">
                    {data.summary.upcomingTasks}
                  </span>
                  <span className="weekly-review__metric-label">Upcoming</span>
                </div>
              </div>
            </Panel>
          )}

          {data.reflectionSummary && (
            <Panel title="Reflection">
              <p className="weekly-review__text">{data.reflectionSummary}</p>
            </Panel>
          )}

          {data.rolloverGroups.length > 0 && (
            <Panel title="Rolled Over">
              {data.rolloverGroups.map((group, i) => (
                <div key={i} className="weekly-review__group">
                  <div className="weekly-review__group-label">
                    {group.label} ({group.tasks.length})
                  </div>
                  {group.tasks.map((t, j) => (
                    <div key={j} className="weekly-review__task-row">
                      {t.title}
                    </div>
                  ))}
                </div>
              ))}
            </Panel>
          )}

          {data.findings.length > 0 && (
            <Panel title="What got stuck">
              {data.findings.map((f, i) => (
                <div key={i} className="weekly-review__finding">
                  <span className="weekly-review__finding-title">
                    {f.taskTitle}
                  </span>
                  <span className="weekly-review__finding-reason">
                    {f.reason}
                  </span>
                </div>
              ))}
            </Panel>
          )}

          {data.anchorSuggestions.length > 0 && (
            <Panel title="Next Week Focus">
              {data.anchorSuggestions.map((s, i) => (
                <div key={i} className="weekly-review__anchor">
                  <span className="weekly-review__anchor-title">{s.title}</span>
                  {s.reason && (
                    <span className="weekly-review__anchor-reason">
                      {s.reason}
                    </span>
                  )}
                </div>
              ))}
            </Panel>
          )}

          {data.behaviorAdjustment && (
            <Panel title="Recommendation">
              <p className="weekly-review__text">{data.behaviorAdjustment}</p>
            </Panel>
          )}

          {data.actions.length > 0 && (
            <Panel title={`Suggested Actions (${data.actions.length})`}>
              {data.actions.map((a, i) => (
                <div key={i} className="weekly-review__action">
                  <span className="weekly-review__action-type">{a.type}</span>
                  <span className="weekly-review__action-title">{a.title}</span>
                  <span className="weekly-review__action-reason">
                    {a.reason}
                  </span>
                </div>
              ))}
              {reviewMode === "apply" ? (
                <p className="weekly-review__applied">Actions applied.</p>
              ) : (
                <button
                  className="btn btn--primary"
                  onClick={() => void runReview("apply")}
                >
                  Apply All Actions
                </button>
              )}
            </Panel>
          )}

          {data.actions.length === 0 && (
            <EmptyState
              headline="Nothing urgent to reset this week."
              copy="Your weekly review is clear."
            />
          )}
        </div>
      )}

      {state === "applying" && (
        <ViewState loading loadingContent={<p>Applying actions…</p>} />
      )}
    </div>
  );
}
