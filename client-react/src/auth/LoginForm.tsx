import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { login, fetchProviders, type AuthProviders } from "./authApi";
import { SocialButtons } from "./SocialButtons";

interface Props {
  onSwitchToForgot: () => void;
  onSwitchToPhone: () => void;
  onSwitchToRegister: () => void;
  initialMessage?: { type: "error" | "success"; text: string } | null;
}

export function LoginForm({ onSwitchToForgot, onSwitchToPhone, onSwitchToRegister, initialMessage }: Props) {
  const { setTokens } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialMessage?.type === "error" ? initialMessage.text : null);
  const [providers, setProviders] = useState<AuthProviders>({ google: false, apple: false, phone: false });

  useEffect(() => {
    fetchProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialMessage?.type === "error") setError(initialMessage.text);
    if (initialMessage?.type === "success") setError(null);
  }, [initialMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      setTokens(result.token, result.refreshToken, result.user);
      const next = new URLSearchParams(window.location.search).get("next");
      const target = (next === "/app" || next?.startsWith("/app/")) ? next : "/app";
      window.location.href = target;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-form auth-form--active" onSubmit={handleSubmit}>
      <h2>Welcome back</h2>
      <div className="auth-form__field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="auth-form__field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="auth-form__actions">
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Login"}
        </button>
      </div>
      <button type="button" className="auth-form__link" onClick={onSwitchToForgot}>
        Forgot password?
      </button>
      {providers.phone && (
        <button type="button" className="auth-form__link" onClick={onSwitchToPhone}>
          Sign in with phone
        </button>
      )}
      <SocialButtons providers={providers} />
    </form>
  );
}
