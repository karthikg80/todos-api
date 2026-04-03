import { useState, useCallback } from "react";
import { apiCall } from "../../api/client";
import {
  normalizeWeeklyReviewResponse,
  type ReviewData,
} from "./weeklyReviewModels";

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

  const runReview = useCallback(async (mode: ReviewMode = "suggest") => {
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
  }, [onApplied]);

  return (
    <div className="weekly-review">
      <div className="weekly-review__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h2 className="weekly-review__title">Weekly Review</h2>
      </div>

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
        <div className="weekly-review__loading">
          <div className="loading-bar">
            <div className="loading-bar__fill" />
          </div>
          <p>Analyzing your week…</p>
        </div>
      )}

      {state === "error" && (
        <div className="weekly-review__error">
          <p>{error}</p>
          <button className="btn" onClick={() => void runReview("suggest")}>
            Try again
          </button>
        </div>
      )}

      {state === "reviewing" && data && (
        <div className="weekly-review__content">
          {/* Step 1: Summary metrics */}
          {data.summary && (
            <section className="weekly-review__section">
              <h3 className="weekly-review__section-title">Summary</h3>
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
                  <span className="weekly-review__metric-label">Stale tasks</span>
                </div>
                <div className="weekly-review__metric">
                  <span className="weekly-review__metric-value">
                    {data.summary.waitingTasks}
                  </span>
                  <span className="weekly-review__metric-label">Waiting on</span>
                </div>
                <div className="weekly-review__metric">
                  <span className="weekly-review__metric-value">
                    {data.summary.upcomingTasks}
                  </span>
                  <span className="weekly-review__metric-label">Upcoming</span>
                </div>
              </div>
            </section>
          )}

          {/* Step 2: Reflection */}
          {data.reflectionSummary && (
            <section className="weekly-review__section">
              <h3 className="weekly-review__section-title">Reflection</h3>
              <p className="weekly-review__text">{data.reflectionSummary}</p>
            </section>
          )}

          {/* Step 3: Rollover review */}
          {data.rolloverGroups.length > 0 && (
            <section className="weekly-review__section">
              <h3 className="weekly-review__section-title">Rolled Over</h3>
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
            </section>
          )}

          {/* Step 4: Findings */}
          {data.findings.length > 0 && (
            <section className="weekly-review__section">
              <h3 className="weekly-review__section-title">What got stuck</h3>
              {data.findings.map((f, i) => (
                <div key={i} className="weekly-review__finding">
                  <span className="weekly-review__finding-title">{f.taskTitle}</span>
                  <span className="weekly-review__finding-reason">{f.reason}</span>
                </div>
              ))}
            </section>
          )}

          {/* Step 5: Next week focus */}
          {data.anchorSuggestions.length > 0 && (
            <section className="weekly-review__section">
              <h3 className="weekly-review__section-title">Next Week Focus</h3>
              {data.anchorSuggestions.map((s, i) => (
                <div key={i} className="weekly-review__anchor">
                  <span className="weekly-review__anchor-title">{s.title}</span>
                  {s.reason && (
                    <span className="weekly-review__anchor-reason">{s.reason}</span>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Step 6: Behavioral adjustment */}
          {data.behaviorAdjustment && (
            <section className="weekly-review__section">
              <h3 className="weekly-review__section-title">Recommendation</h3>
              <p className="weekly-review__text">{data.behaviorAdjustment}</p>
            </section>
          )}

          {/* Step 7: Actions */}
          {data.actions.length > 0 && (
            <section className="weekly-review__section">
              <h3 className="weekly-review__section-title">
                Suggested Actions ({data.actions.length})
              </h3>
              {data.actions.map((a, i) => (
                <div key={i} className="weekly-review__action">
                  <span className="weekly-review__action-type">{a.type}</span>
                  <span className="weekly-review__action-title">{a.title}</span>
                  <span className="weekly-review__action-reason">{a.reason}</span>
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
            </section>
          )}

          {data.actions.length === 0 && (
            <section className="weekly-review__empty">
              <h3>Nothing urgent to reset this week.</h3>
              <p>Your weekly review is clear.</p>
            </section>
          )}
        </div>
      )}

      {state === "applying" && (
        <div className="weekly-review__loading">
          <p>Applying actions…</p>
        </div>
      )}
    </div>
  );
}
