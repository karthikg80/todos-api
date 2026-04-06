import { useState, useCallback, useMemo } from "react";
import { useAuth } from "../auth/AuthProvider";
import { submitFeedback, type FeedbackType, type FeedbackItem } from "../api/feedbackApi";
import { navigateWithFade } from "../utils/pageTransitions";

interface Props {
  onSuccess: (item: FeedbackItem) => void;
}

const QUESTIONS: Record<FeedbackType, { q1: string; q2: string; q3: string }> = {
  bug: {
    q1: "What happened?",
    q2: "What did you expect?",
    q3: "What were you doing right before it happened?",
  },
  feature: {
    q1: "What are you trying to do?",
    q2: "What is hard today?",
    q3: "What would make this better?",
  },
  general: {
    q1: "What's on your mind?",
    q2: "Any suggestions?",
    q3: "Anything else?",
  },
};

function buildBody(
  type: FeedbackType,
  a1: string,
  a2: string,
  a3: string,
): string {
  const q = QUESTIONS[type];
  const parts: string[] = [];
  if (a1.trim()) {
    parts.push(`${q.q1}\n${a1.trim()}`);
  }
  if (a2.trim()) {
    parts.push(`${q.q2}\n${a2.trim()}`);
  }
  if (a3.trim()) {
    parts.push(`${q.q3}\n${a3.trim()}`);
  }
  return parts.join("\n\n");
}

const APP_VERSION =
  (document.querySelector('meta[name="app-version"]') as HTMLMetaElement | null)?.content ?? "unknown";

export function FeedbackForm({ onSuccess }: Props) {
  const { user } = useAuth();
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [a1, setA1] = useState("");
  const [a2, setA2] = useState("");
  const [a3, setA3] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useMemo(() => QUESTIONS[type], [type]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        setError("Please add a short title.");
        return;
      }
      if (!a1.trim()) {
        setError("Please answer the first question before sending.");
        return;
      }

      setSubmitting(true);
      try {
        const item = await submitFeedback({
          type,
          title: trimmedTitle,
          body: buildBody(type, a1, a2, a3),
          screenshotUrl: screenshotUrl.trim() || null,
          attachmentMetadata: null,
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
          appVersion: APP_VERSION,
        });
        onSuccess(item);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submission failed");
      } finally {
        setSubmitting(false);
      }
    },
    [type, title, a1, a2, a3, screenshotUrl, onSuccess],
  );

  const reset = useCallback(() => {
    setType("bug");
    setTitle("");
    setA1("");
    setA2("");
    setA3("");
    setScreenshotUrl("");
    setError(null);
  }, []);

  return (
    <form className="feedback-form" onSubmit={handleSubmit}>
      {/* Type selector */}
      <div className="feedback-form__field">
        <label htmlFor="feedback-type" className="feedback-form__label">
          Submission type
        </label>
        <select
          id="feedback-type"
          className="feedback-form__select"
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackType)}
        >
          <option value="bug">Bug report</option>
          <option value="feature">Feature request</option>
          <option value="general">General feedback</option>
        </select>
      </div>

      {/* Title */}
      <div className="feedback-form__field">
        <label htmlFor="feedback-title" className="feedback-form__label">
          Title
        </label>
        <input
          id="feedback-title"
          type="text"
          className="feedback-form__input"
          maxLength={200}
          required
          placeholder="Short summary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Question 1 */}
      <div className="feedback-form__field">
        <label htmlFor="feedback-q1" className="feedback-form__label">
          {q.q1}
        </label>
        <textarea
          id="feedback-q1"
          className="feedback-form__textarea"
          rows={4}
          required
          placeholder="Describe in your own words…"
          value={a1}
          onChange={(e) => setA1(e.target.value)}
        />
      </div>

      {/* Question 2 */}
      <div className="feedback-form__field">
        <label htmlFor="feedback-q2" className="feedback-form__label">
          {q.q2}
        </label>
        <textarea
          id="feedback-q2"
          className="feedback-form__textarea"
          rows={4}
          placeholder="Optional"
          value={a2}
          onChange={(e) => setA2(e.target.value)}
        />
      </div>

      {/* Question 3 */}
      <div className="feedback-form__field">
        <label htmlFor="feedback-q3" className="feedback-form__label">
          {q.q3}
        </label>
        <textarea
          id="feedback-q3"
          className="feedback-form__textarea"
          rows={4}
          placeholder="Optional"
          value={a3}
          onChange={(e) => setA3(e.target.value)}
        />
      </div>

      {/* Screenshot URL */}
      <div className="feedback-form__field">
        <label htmlFor="feedback-screenshot" className="feedback-form__label">
          Screenshot URL (optional)
        </label>
        <input
          id="feedback-screenshot"
          type="url"
          inputMode="url"
          className="feedback-form__input"
          placeholder="https://…"
          value={screenshotUrl}
          onChange={(e) => setScreenshotUrl(e.target.value)}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="feedback-form__error" role="alert">
          {error}
        </div>
      )}

      {/* Context info */}
      <div className="feedback-form__context">
        <dl className="feedback-form__context-list">
          <div className="feedback-form__context-row">
            <dt>Page</dt>
            <dd>{window.location.pathname}</dd>
          </div>
          <div className="feedback-form__context-row">
            <dt>Version</dt>
            <dd>{APP_VERSION}</dd>
          </div>
          {user && (
            <div className="feedback-form__context-row">
              <dt>User</dt>
              <dd>{user.email}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="feedback-form__submit"
        disabled={submitting}
      >
        {submitting ? "Sending…" : "Send feedback"}
      </button>

      {/* Reset link (shown after success via parent) */}
      <button type="button" className="feedback-form__reset" onClick={reset}>
        Send another
      </button>
    </form>
  );
}
