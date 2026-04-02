import { useState } from "react";
import type { NextWorkRecommendation } from "../../types/nextWork";
import { IconClock, IconXCircle } from "../shared/Icons";

interface Props {
  rec: NextWorkRecommendation;
  isTop: boolean;
  onStart: (taskId: string) => void;
  onSnooze: (taskId: string) => void;
  onDismiss: (taskId: string) => void;
}

export function WhatNextRow({ rec, isTop, onStart, onSnooze, onDismiss }: Props) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [state, setState] = useState<"idle" | "acting" | "done">("idle");

  const handleStart = () => {
    setState("acting");
    onStart(rec.taskId);
    setTimeout(() => setState("done"), 300);
  };

  const handleSnooze = () => {
    setState("acting");
    onSnooze(rec.taskId);
    setTimeout(() => setState("done"), 300);
  };

  const handleDismiss = () => {
    setState("done");
    onDismiss(rec.taskId);
  };

  const rowClass = `whatnext-row${isTop ? " whatnext-row--top" : ""}${state === "acting" ? " whatnext-row--acting" : ""}${state === "done" ? " whatnext-row--done" : ""}`;

  return (
    <div className={rowClass}>
      <div className="whatnext-row__content">
        <div className="whatnext-row__title-line">
          <span className="whatnext-row__title">{rec.title}</span>
          <span className="whatnext-row__badges">
            <span className={`whatnext-badge whatnext-badge--impact-${rec.impact}`}>
              {rec.impact} impact
            </span>
            <span className={`whatnext-badge whatnext-badge--effort-${rec.effort}`}>
              {rec.effort} effort
            </span>
          </span>
          <span className="sr-only">{rec.impact} impact, {rec.effort} effort</span>
        </div>
        <button
          className="whatnext-row__why"
          onClick={(e) => { e.stopPropagation(); setReasonOpen((o) => !o); }}
          aria-expanded={reasonOpen}
        >
          {reasonOpen ? "Hide" : "Why?"}
        </button>
        {reasonOpen && (
          <div className="whatnext-row__reason">{rec.reason}</div>
        )}
      </div>
      {state === "idle" && (
        <div className="whatnext-row__actions">
          <button
            className="whatnext-btn whatnext-btn--start"
            onClick={(e) => { e.stopPropagation(); handleStart(); }}
            aria-label={`Start task: ${rec.title}`}
          >
            Start
          </button>
          <button
            className="whatnext-btn whatnext-btn--snooze"
            onClick={(e) => { e.stopPropagation(); handleSnooze(); }}
            aria-label={`Snooze task: ${rec.title}`}
            title="Snooze to tomorrow"
          >
            <IconClock size={13} />
          </button>
          <button
            className="whatnext-btn whatnext-btn--dismiss"
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            aria-label={`Dismiss: ${rec.title}`}
            title="Dismiss"
          >
            <IconXCircle size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
