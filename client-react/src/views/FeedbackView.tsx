import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";
import { FeedbackForm } from "../components/FeedbackForm";
import { fetchUserFeedback, type FeedbackItem, type UserFeedbackListItem } from "../api/feedbackApi";
import { navigateWithFade } from "../utils/pageTransitions";
import "../styles/feedback.css";

type FeedbackViewMode = "list" | "form" | "confirmation";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "new": return "Submitted";
    case "triaged": return "Under review";
    case "promoted": return "Tracked";
    case "rejected": return "Closed";
    case "resolved": return "Resolved";
    default: return status;
  }
}

function statusClass(status: string): string {
  switch (status) {
    case "new": return "feedback-list__status--new";
    case "triaged": return "feedback-list__status--triaged";
    case "promoted": return "feedback-list__status--promoted";
    case "rejected": return "feedback-list__status--rejected";
    default: return "feedback-list__status--new";
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "bug": return "Bug";
    case "feature": return "Feature";
    case "general": return "Feedback";
    default: return type;
  }
}

function typeClass(type: string): string {
  switch (type) {
    case "bug": return "feedback-list__type--bug";
    case "feature": return "feedback-list__type--feature";
    default: return "feedback-list__type--bug";
  }
}

function ConfirmationView({
  item,
  onSendAnother,
}: {
  item: FeedbackItem;
  onSendAnother: () => void;
}) {
  const isBug = item.type === "bug";
  return (
    <div className="feedback-confirmation">
      <h3>{isBug ? "Bug report sent" : "Feature request sent"}</h3>
      <p>
        {isBug
          ? "Thanks for the report. We'll review it and get back to you."
          : "Thanks for the idea. We'll review it and consider it for the roadmap."}
      </p>
      <p className="feedback-confirmation__meta">
        Reference ID: {item.id}
      </p>
      <div className="feedback-confirmation__actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => navigateWithFade("/feedback")}
        >
          View your submissions
        </button>
        <button type="button" className="btn btn--secondary" onClick={onSendAnother}>
          Send another
        </button>
      </div>
    </div>
  );
}

function FeedbackListView({
  items,
  loading,
  onNew,
}: {
  items: UserFeedbackListItem[];
  loading: boolean;
  onNew: () => void;
}) {
  return (
    <div>
      <div className="feedback-standalone__actions">
        <button type="button" className="btn btn--primary" onClick={onNew}>
          Submit feedback
        </button>
      </div>
      {loading ? (
        <div className="feedback-list__empty">Loading your submissions…</div>
      ) : items.length === 0 ? (
        <div className="feedback-list__empty">
          You haven't submitted any feedback yet.
        </div>
      ) : (
        <ul className="feedback-list" role="list">
          {items.map((item) => (
            <li key={item.id} className="feedback-list__item">
              <span className={`feedback-list__type ${typeClass(item.type)}`}>
                {typeLabel(item.type)}
              </span>
              <span className="feedback-list__title" title={item.title}>
                {item.title}
              </span>
              <span className={`feedback-list__status ${statusClass(item.status)}`}>
                {statusLabel(item.status)}
              </span>
              <span className="feedback-list__date">{formatDate(item.createdAt)}</span>
              {item.githubIssueUrl && (
                <a
                  href={item.githubIssueUrl}
                  className="feedback-list__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View issue →
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FeedbackView() {
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<FeedbackViewMode>("list");
  const [items, setItems] = useState<UserFeedbackListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [lastSubmitted, setLastSubmitted] = useState<FeedbackItem | null>(null);

  // Auth gate — redirect to /auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigateWithFade("/auth?next=/feedback", { replace: true });
    }
  }, [authLoading, user]);

  // Load feedback list when in list mode
  useEffect(() => {
    if (mode !== "list" || authLoading || !user) return;
    setListLoading(true);
    fetchUserFeedback()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setListLoading(false));
  }, [mode, authLoading, user]);

  // Check URL for /feedback/new
  useEffect(() => {
    if (window.location.pathname === "/feedback/new") {
      setMode("form");
    }
  }, []);

  if (authLoading || !user) {
    return (
      <div className="feedback-page">
        <div className="feedback-standalone">
          <div className="loading">Loading…</div>
        </div>
      </div>
    );
  }

  const goHome = () => navigateWithFade("/app", { replace: true });
  const goList = () => {
    window.history.pushState({}, "", "/feedback");
    setMode("list");
  };
  const goForm = () => {
    window.history.pushState({}, "", "/feedback/new");
    setMode("form");
  };

  return (
    <div className="feedback-page">
      <div className="feedback-standalone">
        {/* Header */}
        <div className="feedback-standalone__header">
          <button className="feedback-standalone__back" onClick={goHome}>
            ← Workspace
          </button>
          <span className="feedback-standalone__logo">Todos</span>
        </div>

        {/* Content */}
        {mode === "list" && (
          <>
            <h2>Your submissions</h2>
            <p className="feedback-standalone__lede">
              Track the status of your bug reports and feature requests.
            </p>
            <FeedbackListView items={items} loading={listLoading} onNew={goForm} />
          </>
        )}

        {mode === "form" && (
          <>
            <h2>Submit feedback</h2>
            <p className="feedback-standalone__lede">
              Tell us what's broken, what's missing, or what could be better.
              Your feedback helps shape the product.
            </p>
            {lastSubmitted ? (
              <ConfirmationView
                item={lastSubmitted}
                onSendAnother={() => {
                  setLastSubmitted(null);
                  setMode("form");
                }}
              />
            ) : (
              <FeedbackForm
                onSuccess={(item: FeedbackItem) => {
                  setLastSubmitted(item);
                  setMode("confirmation");
                }}
              />
            )}
          </>
        )}

        {mode === "confirmation" && lastSubmitted && (
          <>
            <ConfirmationView
              item={lastSubmitted}
              onSendAnother={() => {
                setLastSubmitted(null);
                setMode("form");
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
