import { useState, useCallback, useEffect, useRef } from "react";
import { useNextWork } from "../../hooks/useNextWork";
import { useViewActivity } from "../../components/layout/ViewActivityContext";
import { WhatNextExpanded } from "./WhatNextExpanded";
import { apiCall } from "../../api/client";
import { tomorrowLocal } from "../../utils/localDate";

interface Props {
  onUndo: (action: { message: string; onUndo: () => void }) => void;
}

export function WhatNextTile({ onUndo }: Props) {
  const { isActive } = useViewActivity();
  const hook = useNextWork();
  const { visible, loading, refreshing, error, inputs, setInputs, dismiss, markActedOn, unmarkActedOn, refresh } = hook;
  const [expanded, setExpanded] = useState(false);

  // Guard debounced fetches: only refresh when view becomes active again after being hidden
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;
    // If view transitions from inactive → active and we have no result, trigger a refresh
    if (isActive && !wasActive && !hook.result) {
      refresh();
    }
  }, [isActive, hook.result, refresh]);

  const top = visible[0] ?? null;

  const handleStart = useCallback(async (taskId: string) => {
    markActedOn(taskId);
    try {
      const res = await apiCall(`/todos/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (!res.ok) {
        unmarkActedOn(taskId);
      }
    } catch {
      unmarkActedOn(taskId);
    }
  }, [markActedOn, unmarkActedOn]);

  const handleSnooze = useCallback(async (taskId: string) => {
    // Store prior values for undo
    let prevScheduledDate: string | null = null;
    let prevStatus: string | null = null;
    try {
      const taskRes = await apiCall(`/todos/${taskId}`);
      if (taskRes.ok) {
        const taskData = await taskRes.json();
        prevScheduledDate = taskData.scheduledDate ?? null;
        prevStatus = taskData.status ?? null;
      }
    } catch { /* proceed with null priors */ }

    markActedOn(taskId);
    try {
      const res = await apiCall(`/todos/${taskId}`, {
        method: "PUT",
        body: JSON.stringify({ scheduledDate: tomorrowLocal(), status: "scheduled" }),
      });
      if (res.ok) {
        onUndo({
          message: "Snoozed to tomorrow",
          onUndo: async () => {
            await apiCall(`/todos/${taskId}`, {
              method: "PUT",
              body: JSON.stringify({ scheduledDate: prevScheduledDate, status: prevStatus ?? "next" }),
            });
            unmarkActedOn(taskId);
          },
        });
      } else {
        unmarkActedOn(taskId);
      }
    } catch {
      unmarkActedOn(taskId);
    }
  }, [markActedOn, unmarkActedOn, onUndo]);

  // Collapsed state
  if (!expanded) {
    return (
      <section className="home-tile" data-home-tile="what_next" aria-busy={loading}>
        <div className="home-tile__header">
          <div className="home-tile__title-row">
            <h3 className="home-tile__title">What Next?</h3>
          </div>
          {top && (
            <button className="mini-btn home-tile__see-all" onClick={() => setExpanded(true)}>
              See more
            </button>
          )}
        </div>
        <div className="home-tile__body">
          {loading ? (
            <p className="whatnext-loading">Finding your next task...</p>
          ) : error && !top ? (
            <p className="whatnext-error">
              Couldn't load recommendations —{" "}
              <button className="whatnext-retry-link" onClick={refresh}>Retry</button>
            </p>
          ) : top ? (
            <div className="whatnext-collapsed">
              <div className="whatnext-collapsed__title">{top.title}</div>
              <div className="whatnext-collapsed__reason">{top.reason}</div>
              <div className="whatnext-collapsed__badges">
                <span className={`whatnext-badge whatnext-badge--impact-${top.impact}`}>
                  {top.impact} impact
                </span>
                <span className={`whatnext-badge whatnext-badge--effort-${top.effort}`}>
                  {top.effort} effort
                </span>
              </div>
            </div>
          ) : (
            <p className="whatnext-empty-collapsed">No recommendations right now</p>
          )}
        </div>
      </section>
    );
  }

  // Expanded state
  return (
    <section className="home-tile home-tile--expanded" data-home-tile="what_next" aria-busy={loading}>
      <div className="home-tile__header">
        <div className="home-tile__title-row">
          <h3 className="home-tile__title">What Next?</h3>
        </div>
      </div>
      <div className="home-tile__body">
        <WhatNextExpanded
          visible={visible}
          inputs={inputs}
          refreshing={refreshing}
          error={error}
          onInputsChange={setInputs}
          onStart={handleStart}
          onSnooze={handleSnooze}
          onDismiss={dismiss}
          onRefresh={refresh}
          onCollapse={() => setExpanded(false)}
        />
      </div>
    </section>
  );
}
