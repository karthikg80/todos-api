import { useState, useCallback } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { apiCall } from "../../api/client";

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  onBack: () => void;
}

export function SettingsPage({ dark, onToggleDark, onBack }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await apiCall("/users/me", {
        method: "PUT",
        body: JSON.stringify({ name: name.trim() || null }),
      });
      if (res.ok) {
        const updated = await res.json();
        localStorage.setItem("user", JSON.stringify(updated));
        setMessage("Saved");
        setTimeout(() => setMessage(""), 2000);
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage((err as { error?: string }).error || "Failed to save");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  }, [name]);

  return (
    <div id="settingsPane" className="settings-page">
      <div className="settings-page__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <h2 className="settings-page__title">Settings</h2>
      </div>

      <section className="settings-section">
        <h3 className="settings-section__title">Profile</h3>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="settingsEmail">
            Email
          </label>
          <input
            id="settingsEmail"
            className="settings-field__input"
            type="email"
            value={user?.email || ""}
            disabled
          />
        </div>
        <div className="settings-field">
          <label className="settings-field__label" htmlFor="settingsName">
            Name
          </label>
          <input
            id="settingsName"
            className="settings-field__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
          />
        </div>
        {message && (
          <p id="profileMessage" className="settings-message">
            {message}
          </p>
        )}
        <button
          className="btn"
          onClick={handleSave}
          disabled={saving}
          style={{ alignSelf: "flex-start" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </section>

      <section className="settings-section">
        <h3 className="settings-section__title">Appearance</h3>
        <div className="settings-field settings-field--row">
          <span className="settings-field__label">Dark mode</span>
          <button className="btn" onClick={onToggleDark}>
            {dark ? "☀️ Switch to light" : "🌙 Switch to dark"}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section__title">Account</h3>
        <p className="settings-meta">
          Logged in as <strong>{user?.email}</strong>
        </p>
      </section>
    </div>
  );
}
