import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { register, fetchProviders, type AuthProviders } from "./authApi";
import { SocialButtons } from "./SocialButtons";

interface Props {
  onSwitchToLogin: () => void;
  onSwitchToPhone: () => void;
}

export function RegisterForm({ onSwitchToLogin, onSwitchToPhone }: Props) {
  const { setTokens } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProviders>({ google: false, apple: false, phone: false });

  useEffect(() => {
    fetchProviders().then(setProviders).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await register({ email, password, name: name || undefined });
      setTokens(result.token, result.refreshToken, result.user);
      const next = new URLSearchParams(window.location.search).get("next");
      const target = (next === "/app" || next?.startsWith("/app/")) ? next : "/app";
      window.location.href = target;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-form auth-form--active" onSubmit={handleSubmit}>
      <h2>Create your account</h2>
      <div className="auth-form__field">
        <label htmlFor="reg-name">Name (optional)</label>
        <input
          id="reg-name"
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="auth-form__field">
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="auth-form__field">
        <label htmlFor="reg-password">Password</label>
        <input
          id="reg-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Min 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="auth-form__actions">
        <button type="submit" className="auth-form__submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create Account"}
        </button>
      </div>
      <button type="button" className="auth-form__link" onClick={onSwitchToLogin}>
        Already have an account? Log in
      </button>
      {providers.phone && (
        <button type="button" className="auth-form__link" onClick={onSwitchToPhone}>
          Sign up with phone
        </button>
      )}
      <SocialButtons providers={providers} />
    </form>
  );
}
