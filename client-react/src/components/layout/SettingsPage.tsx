import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { apiCall } from "../../api/client";

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  uiMode: string;
  onToggleUiMode: () => void;
  density: string;
  onCycleDensity: () => void;
  onBack: () => void;
}

export function SettingsPage({ dark, onToggleDark, uiMode, onToggleUiMode, density, onCycleDensity, onBack }: Props) {
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
        <div className="settings-field settings-field--row">
          <span className="settings-field__label">UI complexity</span>
          <button className="btn" onClick={onToggleUiMode}>
            {uiMode === "simple" ? "Switch to normal" : "Switch to simple"}
          </button>
        </div>
        <div className="settings-field settings-field--row">
          <span className="settings-field__label">
            Density
            <span className="settings-field__hint">
              {density === "compact"
                ? "Tight spacing, smaller text"
                : density === "spacious"
                  ? "More breathing room"
                  : "Balanced default"}
            </span>
          </span>
          <button className="btn" onClick={onCycleDensity}>
            {density.charAt(0).toUpperCase() + density.slice(1)}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h3 className="settings-section__title">Account</h3>
        <p className="settings-meta">
          Logged in as <strong>{user?.email}</strong>
        </p>
        <DataExportButton />
      </section>

      <McpSessionsSection />
    </div>
  );
}

function DataExportButton() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const handleExport = useCallback(async () => {
    setExporting(true);
    setMessage("");
    try {
      const res = await apiCall("/users/me/export");
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "todos-export.json";
        a.click();
        URL.revokeObjectURL(url);
        setMessage("Export downloaded");
      } else if (res.status === 429) {
        setMessage("Export limited to once per hour");
      } else {
        setMessage("Export failed");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setExporting(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }, []);

  return (
    <div className="settings-field settings-field--row">
      <span className="settings-field__label">Data export</span>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
        <button className="btn" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Download JSON"}
        </button>
        {message && (
          <span className="settings-meta">{message}</span>
        )}
      </div>
    </div>
  );
}

function McpSessionsSection() {
  const [sessions, setSessions] = useState<
    Array<{ id: string; clientName: string; createdAt: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiCall("/mcp/sessions")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const revoke = useCallback(async (id: string) => {
    await apiCall(`/mcp/sessions/${id}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const revokeAll = useCallback(async () => {
    await apiCall("/mcp/sessions", { method: "DELETE" });
    setSessions([]);
  }, []);

  return (
    <section className="settings-section">
      <h3 className="settings-section__title">MCP Sessions</h3>
      {loading ? (
        <p className="settings-meta">Loading…</p>
      ) : sessions.length === 0 ? (
        <p id="mcpSessionsList" className="settings-meta">
          No active MCP sessions.
        </p>
      ) : (
        <>
          <div id="mcpSessionsList" className="mcp-sessions">
            {sessions.map((s) => (
              <div key={s.id} className="mcp-session">
                <span className="mcp-session__name">
                  {s.clientName || "Unknown client"}
                </span>
                <span className="mcp-session__date">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
                <button
                  className="btn"
                  style={{
                    fontSize: "var(--fs-label)",
                    padding: "var(--s-0) var(--s-2)",
                  }}
                  onClick={() => revoke(s.id)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn btn--danger"
            style={{ alignSelf: "flex-start", fontSize: "var(--fs-meta)" }}
            onClick={revokeAll}
          >
            Revoke All
          </button>
        </>
      )}
    </section>
  );
}
