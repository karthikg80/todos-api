import { useState, useCallback } from "react";
import { apiCall } from "../../api/client";

interface ReviewSummary {
  projectsWithoutNextAction: number;
  staleTasks: number;
  waitingTasks: number;
  upcomingTasks: number;
}

interface Finding {
  type: string;
  taskTitle: string;
  reason: string;
}

interface ReviewAction {
  type: string;
  title: string;
  reason: string;
}

interface ReviewData {
  summary: ReviewSummary | null;
  findings: Finding[];
  actions: ReviewAction[];
  rolloverGroups: Array<{ label: string; tasks: Array<{ title: string }> }>;
  anchorSuggestions: Array<{ title: string; reason: string }>;
  behaviorAdjustment: string;
  reflectionSummary: string;
}

type ReviewState = "idle" | "loading" | "reviewing" | "applying" | "done" | "error";

interface Props {
  onBack: () => void;
}

export function WeeklyReview({ onBack }: Props) {
  const [state, setState] = useState<ReviewState>("idle");
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");

  const runReview = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const res = await apiCall("/agent/write/weekly_review", {
        method: "POST",
        body: JSON.stringify({ mode: "suggest" }),
      });
      if (!res.ok) throw new Error("Failed to run review");
      const result = await res.json();
      setData(result);
      setState("reviewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }, []);

  const applyActions = useCallback(async () => {
    setState("applying");
    try {
      await apiCall("/agent/write/weekly_review", {
        method: "POST",
        body: JSON.stringify({ mode: "apply" }),
      });
      setState("done");
    } catch {
      setError("Failed to apply actions");
      setState("error");
    }
  }, []);

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
          <button className="btn btn--primary" onClick={runReview}>
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
          <button className="btn" onClick={runReview}>
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
                  <div className="weekly-review__group-label">{group.label}</div>
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
              <button className="btn btn--primary" onClick={applyActions}>
                Apply All Actions
              </button>
            </section>
          )}
        </div>
      )}

      {state === "applying" && (
        <div className="weekly-review__loading">
          <p>Applying actions…</p>
        </div>
      )}

      {state === "done" && (
        <div className="weekly-review__done">
          <h3>Review Complete</h3>
          <p>Actions applied. You're set for next week.</p>
          <button className="btn" onClick={onBack}>
            Back to tasks
          </button>
        </div>
      )}
    </div>
  );
}
