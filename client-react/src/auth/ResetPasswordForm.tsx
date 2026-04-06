import { useState } from "react";
import { resetPassword } from "./authApi";

interface Props {
  token: string;
  onBack: () => void;
}

export function ResetPasswordForm({ token, onBack }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(onBack, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="auth-form auth-form--active">
        <h2>Password reset</h2>
        <p className="auth-reset-info">Your password has been reset. Redirecting to login…</p>
      </div>
    );
  }

  return (
    <form className="auth-form auth-form--active" onSubmit={handleSubmit}>
      <h2>Set new password</h2>
      <div className="auth-form__field">
        <label htmlFor="reset-password">New Password</label>
        <input
          id="reset-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="auth-form__field">
        <label htmlFor="reset-confirm">Confirm Password</label>
        <input
          id="reset-confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Min 8 characters"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      {error && <div className="auth-message auth-message--error auth-message--visible">{error}</div>}
      <div className="auth-form__actions">
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? "Resetting…" : "Reset Password"}
        </button>
      </div>
    </form>
  );
}
