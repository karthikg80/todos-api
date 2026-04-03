import { useState, useCallback } from "react";
import { apiCall } from "../../api/client";

interface Props {
  email: string;
  isVerified: boolean;
}

export function VerificationBanner({ email, isVerified }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");

  const resend = useCallback(async () => {
    setSending(true);
    setError("");
    try {
      const res = await apiCall("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to send");
      }
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to send");
    }
    setSending(false);
  }, [email]);

  if (isVerified || dismissed) return null;

  return (
    <div id="verificationBanner" className="verification-banner">
      <span>
        Please verify your email <strong>{email}</strong>.
      </span>
      {sent ? (
        <span className="verification-banner__sent">Sent!</span>
      ) : (
        <button
          className="verification-banner__btn"
          onClick={resend}
          disabled={sending}
        >
          {sending ? "Sending…" : "Resend"}
        </button>
      )}
      {error && <span className="verification-banner__sent">{error}</span>}
      <button
        className="verification-banner__close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
