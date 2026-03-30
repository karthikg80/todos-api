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

  const resend = useCallback(async () => {
    setSending(true);
    try {
      await apiCall("/auth/resend-verification", { method: "POST" });
      setSent(true);
    } catch {}
    setSending(false);
  }, []);

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
