import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthProvider";
import { FeedbackForm } from "../components/FeedbackForm";
import {
  fetchUserFeedback,
  type FeedbackItem,
  type UserFeedbackListItem,
} from "../api/feedbackApi";
import { navigateWithFade } from "../utils/pageTransitions";
import { ViewHeader } from "../components/layout/ViewHeader";
import { Badge, type BadgeTone } from "../components/shared/Badge";
import { EmptyState } from "../components/shared/EmptyState";

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
    case "new":
      return "Submitted";
    case "triaged":
      return "Under review";
    case "promoted":
      return "Tracked";
    case "rejected":
      return "Closed";
    case "resolved":
      return "Resolved";
    default:
      return status;
  }
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "triaged":
      return "info";
    case "promoted":
      return "success";
    case "rejected":
      return "muted";
    case "resolved":
      return "success";
    case "new":
    default:
      return "muted";
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "bug":
      return "Bug";
    case "feature":
      return "Feature";
    case "general":
      return "Feedback";
    default:
      return type;
  }
}

function typeClass(type: string): string {
  switch (type) {
    case "bug":
      return "feedback-list__type--bug";
    case "feature":
      return "feedback-list__type--feature";
    default:
      return "feedback-list__type--bug";
  }
}

export function ConfirmationView({
  item,
  onSendAnother,
}: {
  item: FeedbackItem;
  onSendAnother: () => void;
}) {
  const isBug = item.type === "bug";
  return (
    <EmptyState
      className="feedback-confirmation"
      headline={isBug ? "Bug report sent" : "Feature request sent"}
      copy={
        <>
          {isBug
            ? "Thanks for the report. We'll review it and get back to you."
            : "Thanks for the idea. We'll review it and consider it for the roadmap."}
          <span className="feedback-confirmation__meta">
            Reference ID: {item.id}
          </span>
        </>
      }
      cta={
        <div className="feedback-confirmation__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigateWithFade("/feedback")}
          >
            View your submissions
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onSendAnother}
          >
            Send another
          </button>
        </div>
      }
    />
  );
}

export function FeedbackListView({
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
              <Badge
                tone={statusTone(item.status)}
                size="sm"
                className="feedback-list__status"
              >
                {statusLabel(item.status)}
              </Badge>
              <span className="feedback-list__date">
                {formatDate(item.createdAt)}
              </span>
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

  const headerTitle =
    mode === "form"
      ? "Submit feedback"
      : mode === "confirmation"
        ? "Feedback received"
        : "Your submissions";
  const headerSubtitle =
    mode === "form"
      ? "Tell us what's broken, what's missing, or what could be better. Your feedback helps shape the product."
      : mode === "list"
        ? "Track the status of your bug reports and feature requests."
        : undefined;

  return (
    <div className="feedback-page">
      <div className="feedback-standalone">
        <ViewHeader
          crumb="Settings › Feedback"
          title={headerTitle}
          subtitle={headerSubtitle}
          back={{ onClick: goHome, label: "Workspace" }}
        />

        {/* Content */}
        {mode === "list" && (
          <FeedbackListView
            items={items}
            loading={listLoading}
            onNew={goForm}
          />
        )}

        {mode === "form" && (
          <>
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
