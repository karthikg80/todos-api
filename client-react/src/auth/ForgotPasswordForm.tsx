import { useState } from "react";
import { forgotPassword } from "./authApi";

interface Props {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-form auth-form--active">
        <h2>Check your email</h2>
        <p className="auth-reset-info">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a reset link.
        </p>
        <div className="auth-form__actions">
          <button type="button" className="auth-form__submit" onClick={onBack}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="auth-form auth-form--active" onSubmit={handleSubmit}>
      <h2>Reset your password</h2>
      <p className="auth-reset-info">Enter the email for your account and we&apos;ll send a reset link.</p>
      <div className="auth-form__field">
        <label htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && <div className="auth-message auth-message--error auth-message--visible">{error}</div>}
      <div className="auth-form__actions">
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? "Sending…" : "Send Reset Link"}
        </button>
      </div>
      <button type="button" className="auth-form__link" onClick={onBack}>
        Back to Login
      </button>
    </form>
  );
}
