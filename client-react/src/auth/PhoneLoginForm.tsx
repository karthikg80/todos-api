import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import { sendOtp, verifyOtp } from "./authApi";

interface Props {
  onBack: () => void;
}

export function PhoneLoginForm({ onBack }: Props) {
  const { setTokens } = useAuth();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const tickCooldown = useCallback(() => {
    setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(tickCooldown, 1000);
    return () => clearInterval(id);
  }, [resendCooldown, tickCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await verifyOtp(phone, code);
      setTokens(result.token, result.refreshToken, result.user);
      const next = new URLSearchParams(window.location.search).get("next");
      const target = (next === "/app" || next?.startsWith("/app/")) ? next : "/app";
      window.location.href = target;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!otpSent) {
    return (
      <form className="auth-form auth-form--active" onSubmit={handleSendOtp}>
        <h2>Sign in with phone</h2>
        <div className="auth-form__field">
          <label htmlFor="phone-number">Phone Number</label>
          <input
            id="phone-number"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+1 (555) 000-0000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        {error && <div className="auth-message auth-message--error auth-message--visible">{error}</div>}
        <div className="auth-form__actions">
          <button type="submit" className="auth-form__submit" disabled={submitting}>
            {submitting ? "Sending…" : "Send Code"}
          </button>
        </div>
        <button type="button" className="auth-form__link" onClick={onBack}>
          Back to Login
        </button>
      </form>
    );
  }

  return (
    <form className="auth-form auth-form--active" onSubmit={handleVerify}>
      <h2>Enter verification code</h2>
      <p className="otp-phone-display">Code sent to {phone}</p>
      <div className="auth-form__field">
        <label htmlFor="otp-code">6-digit code</label>
        <input
          id="otp-code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoComplete="one-time-code"
          className="otp-code"
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error && <div className="auth-message auth-message--error auth-message--visible">{error}</div>}
      <div className="auth-form__actions">
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? "Verifying…" : "Verify & Login"}
        </button>
      </div>
      <button
        type="button"
        className="auth-form__resend"
        disabled={resendCooldown > 0}
        onClick={async () => {
          setError(null);
          setSubmitting(true);
          try {
            await sendOtp(phone);
            setResendCooldown(60);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to resend");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
      </button>
      <button type="button" className="auth-form__link" onClick={onBack}>
        Use different number
      </button>
    </form>
  );
}
