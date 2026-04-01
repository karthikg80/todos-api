import { useState, useEffect } from "react";
import { apiCall } from "../../api/client";
import { relativeTime } from "../../utils/relativeTime";

interface ActivityEvent {
  id: string;
  eventType: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const EVENT_LABELS: Record<string, { label: string; icon: string }> = {
  task_created: { label: "Created", icon: "+" },
  task_completed: { label: "Completed", icon: "✓" },
  task_uncompleted: { label: "Reopened", icon: "↩" },
  task_deleted: { label: "Deleted", icon: "×" },
  task_updated: { label: "Updated", icon: "✎" },
  task_status_changed: { label: "Status changed", icon: "→" },
  subtask_completed: { label: "Subtask completed", icon: "✓" },
};

interface Props {
  todoId: string;
}

export function TaskTimeline({ todoId }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiCall(`/activity-events?entityId=${todoId}&entityType=task&limit=20`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [todoId]);

  if (loading) return null;
  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, 5);
  const hasMore = events.length > 5 && !expanded;

  return (
    <div className="task-timeline">
      <div className="task-timeline__header">Activity</div>
      <div className="task-timeline__list">
        {visible.map((event) => {
          const info = EVENT_LABELS[event.eventType] || {
            label: event.eventType.replace(/_/g, " "),
            icon: "•",
          };
          const statusTo = event.metadata?.statusTo as string | undefined;

          return (
            <div key={event.id} className="task-timeline__event">
              <span className="task-timeline__icon">{info.icon}</span>
              <span className="task-timeline__label">
                {info.label}
                {statusTo && (
                  <span className="task-timeline__status">
                    {" "}
                    → {statusTo.replace("_", " ")}
                  </span>
                )}
              </span>
              <span className="task-timeline__time">
                {relativeTime(event.createdAt)}
              </span>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          className="mini-btn"
          onClick={() => setExpanded(true)}
        >
          Show all ({events.length})
        </button>
      )}
    </div>
  );
}
