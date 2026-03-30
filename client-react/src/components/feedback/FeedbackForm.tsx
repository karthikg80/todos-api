import { useState, useCallback } from "react";
import { apiCall } from "../../api/client";

interface Props {
  onBack: () => void;
}

const FEEDBACK_TYPES = ["bug", "feature", "improvement", "other"];

export function FeedbackForm({ onBack }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("feature");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiCall("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          type,
          description: description.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error || "Failed to submit feedback",
        );
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }, [title, type, description, submitting]);

  if (submitted) {
    return (
      <div id="feedbackConfirmation" className="feedback-page">
        <div className="feedback-page__header">
          <button className="btn" onClick={onBack}>
            ← Back
          </button>
        </div>
        <div className="feedback-success">
          <h2 id="feedbackConfirmationTitle">Thank you!</h2>
          <p>Your feedback has been submitted.</p>
          <button className="btn" onClick={onBack}>
            Back to app
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <div className="feedback-page__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h2 className="feedback-page__title">Submit Feedback</h2>
      </div>

      <div id="feedbackForm" className="feedback-form">
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="feedbackTitle">
            Title
          </label>
          <input
            id="feedbackTitle"
            className="settings-field__input"
            type="text"
            placeholder="Brief summary"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="settings-field">
          <label className="settings-field__label" htmlFor="feedbackType">
            Type
          </label>
          <select
            id="feedbackType"
            className="todo-drawer__select"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {FEEDBACK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <label className="settings-field__label" htmlFor="feedbackDescription">
            Description
          </label>
          <textarea
            id="feedbackDescription"
            className="todo-drawer__textarea"
            placeholder="Describe the issue or suggestion in detail"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
        </div>

        {error && <p style={{ color: "var(--danger)", fontSize: "var(--fs-meta)" }}>{error}</p>}

        <button
          className="btn"
          style={{
            background: "var(--accent)",
            color: "#fff",
            borderColor: "var(--accent)",
            alignSelf: "flex-start",
          }}
          onClick={handleSubmit}
          disabled={!title.trim() || submitting}
        >
          {submitting ? "Submitting…" : "Submit Feedback"}
        </button>
      </div>
    </div>
  );
}
