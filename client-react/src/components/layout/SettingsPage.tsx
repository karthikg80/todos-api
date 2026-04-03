import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { apiCall } from "../../api/client";
import type { McpSessionSummary, UserPlanningPreferences } from "../../types";
import {
  CHUNK_MINUTE_OPTIONS,
  DEFAULT_USER_PREFERENCES,
  SOUL_DAILY_RITUAL_OPTIONS,
  SOUL_ENERGY_PATTERN_OPTIONS,
  SOUL_PLANNING_STYLE_OPTIONS,
  SOUL_TONE_OPTIONS,
  mergePlanningPreferences,
  parsePreferredContexts,
} from "./settingsModels";
import { ToggleSwitch } from "../shared/ToggleSwitch";

interface Props {
  dark: boolean;
  onToggleDark: () => void;
  uiMode: string;
  onToggleUiMode: () => void;
  density: string;
  onCycleDensity: () => void;
  onBack: () => void;
}

export function SettingsPage({
  dark,
  onToggleDark,
  uiMode,
  onToggleUiMode,
  density,
  onCycleDensity,
  onBack,
}: Props) {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
  }, [user?.name, user?.email]);

  const handleSaveProfile = useCallback(async () => {
    if (!user) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    setSavingProfile(true);
    setProfileMessage("");
    try {
      const res = await apiCall("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          name: trimmedName || null,
          email: trimmedEmail,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setProfileMessage(
          (err as { error?: string }).error || "Failed to save profile",
        );
        return;
      }
      const updated = await res.json();
      setUser(updated);
      setProfileMessage(
        trimmedEmail !== user.email
          ? "Profile updated. Please verify your new email."
          : "Profile saved.",
      );
    } catch {
      setProfileMessage("Network error");
    } finally {
      setSavingProfile(false);
    }
  }, [email, name, setUser, user]);

  const resendVerification = useCallback(async () => {
    if (!user?.email) return;
    setSendingVerification(true);
    setVerificationMessage("");
    try {
      const res = await apiCall("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setVerificationMessage(
          (err as { error?: string }).error ||
            "Could not send verification email",
        );
        return;
      }
      setVerificationMessage("Verification email sent.");
    } catch {
      setVerificationMessage("Network error");
    } finally {
      setSendingVerification(false);
    }
  }, [user?.email]);

  const profileDirty =
    (name.trim() || "") !== (user?.name || "") ||
    email.trim().toLowerCase() !== (user?.email || "");

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
        <div className="settings-grid">
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
            />
          </div>
          <div className="settings-field">
            <label className="settings-field__label" htmlFor="settingsEmail">
              Email
            </label>
            <input
              id="settingsEmail"
              className="settings-field__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <span className="settings-field__hint">
              Changing your email will require verification again.
            </span>
          </div>
        </div>

        <div
          className={`settings-status${user?.isVerified ? " settings-status--good" : " settings-status--warning"}`}
        >
          <div>
            <div className="settings-status__title">
              {user?.isVerified
                ? "Email verified"
                : "Email verification pending"}
            </div>
            <p className="settings-status__copy">
              {user?.isVerified
                ? "Your account email is verified."
                : "Verify your email to keep account recovery and linked sessions healthy."}
            </p>
          </div>
          {!user?.isVerified && (
            <button
              className="btn"
              onClick={resendVerification}
              disabled={sendingVerification}
            >
              {sendingVerification ? "Sending…" : "Resend verification"}
            </button>
          )}
        </div>

        {verificationMessage && (
          <p className="settings-message">{verificationMessage}</p>
        )}
        {profileMessage && (
          <p id="profileMessage" className="settings-message">
            {profileMessage}
          </p>
        )}
        <button
          className="btn"
          onClick={handleSaveProfile}
          disabled={!profileDirty || savingProfile}
        >
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </section>

      <PlanningPreferencesSection />

      <section className="settings-section">
        <h3 className="settings-section__title">Appearance</h3>
        <ToggleSwitch
          checked={dark}
          label="Dark mode"
          description="Use the darker palette across the shell and task views."
          onChange={() => onToggleDark()}
        />
        <ToggleSwitch
          checked={uiMode === "normal"}
          label="Normal UI"
          description="Show the fuller workspace instead of the simplified mode."
          onChange={() => onToggleUiMode()}
        />
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
        <div className="settings-field settings-field--row">
          <span className="settings-field__label">
            Onboarding
            <span className="settings-field__hint">
              Re-run the intro flow with your current account.
            </span>
          </span>
          <button
            className="btn"
            onClick={() => {
              localStorage.removeItem("todos:onboarding-complete");
              window.location.reload();
            }}
          >
            Restart onboarding
          </button>
        </div>
      </section>

      <McpSessionsSection />
    </div>
  );
}

function PlanningPreferencesSection() {
  const [prefs, setPrefs] = useState<UserPlanningPreferences>(
    DEFAULT_USER_PREFERENCES,
  );
  const [preferredContextsInput, setPreferredContextsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiCall("/preferences")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as Partial<UserPlanningPreferences>;
        const merged = mergePlanningPreferences(data);
        setPrefs(merged);
        setPreferredContextsInput(merged.preferredContexts.join(", "));
      })
      .catch(() => {
        setMessage("Could not load planning preferences");
      })
      .finally(() => setLoading(false));
  }, []);

  const updatePrefs = useCallback(
    (
      updater:
        | UserPlanningPreferences
        | ((current: UserPlanningPreferences) => UserPlanningPreferences),
    ) => {
      setPrefs((current) =>
        typeof updater === "function"
          ? (
              updater as (
                current: UserPlanningPreferences,
              ) => UserPlanningPreferences
            )(current)
          : updater,
      );
    },
    [],
  );

  const savePreferences = useCallback(async () => {
    setSaving(true);
    setMessage("");
    const payload = {
      ...prefs,
      preferredContexts: parsePreferredContexts(preferredContextsInput),
    };
    try {
      const res = await apiCall("/preferences", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(
          (err as { error?: string }).error || "Failed to save preferences",
        );
        return;
      }
      const saved = mergePlanningPreferences(
        (await res.json()) as Partial<UserPlanningPreferences>,
      );
      setPrefs(saved);
      setPreferredContextsInput(saved.preferredContexts.join(", "));
      setMessage("Planning preferences saved.");
    } catch {
      setMessage("Network error");
    } finally {
      setSaving(false);
    }
  }, [preferredContextsInput, prefs]);

  return (
    <section className="settings-section">
      <h3 className="settings-section__title">Planning preferences</h3>
      {loading ? (
        <p className="settings-meta">Loading…</p>
      ) : (
        <>
          <div className="settings-grid">
            <div className="settings-field">
              <label
                className="settings-field__label"
                htmlFor="settingsMaxDailyTasks"
              >
                Daily task target
              </label>
              <input
                id="settingsMaxDailyTasks"
                className="settings-field__input"
                type="number"
                min="1"
                max="20"
                value={prefs.maxDailyTasks ?? ""}
                onChange={(e) =>
                  updatePrefs((current) => ({
                    ...current,
                    maxDailyTasks: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
              />
            </div>
            <div className="settings-field">
              <label
                className="settings-field__label"
                htmlFor="settingsPreferredChunkMinutes"
              >
                Preferred work chunk
              </label>
              <select
                id="settingsPreferredChunkMinutes"
                className="settings-field__input"
                value={prefs.preferredChunkMinutes ?? ""}
                onChange={(e) =>
                  updatePrefs((current) => ({
                    ...current,
                    preferredChunkMinutes: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
              >
                {CHUNK_MINUTE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label
                className="settings-field__label"
                htmlFor="settingsWaitingFollowUpDays"
              >
                Waiting follow-up days
              </label>
              <input
                id="settingsWaitingFollowUpDays"
                className="settings-field__input"
                type="number"
                min="1"
                max="30"
                value={prefs.waitingFollowUpDays}
                onChange={(e) =>
                  updatePrefs((current) => ({
                    ...current,
                    waitingFollowUpDays: Math.max(
                      1,
                      Number(e.target.value) || 1,
                    ),
                  }))
                }
              />
            </div>
            <label className="settings-checkbox">
              <input
                type="checkbox"
                checked={prefs.weekendsActive}
                onChange={(e) =>
                  updatePrefs((current) => ({
                    ...current,
                    weekendsActive: e.target.checked,
                  }))
                }
              />
              <span>
                <span className="settings-field__label">Plan weekends too</span>
                <span className="settings-field__hint">
                  Keep the planner active on Saturdays and Sundays.
                </span>
              </span>
            </label>
          </div>

          <div className="settings-grid">
            <div className="settings-field">
              <label className="settings-field__label" htmlFor="settingsTone">
                Tone
              </label>
              <select
                id="settingsTone"
                className="settings-field__input"
                value={prefs.soulProfile?.tone ?? "calm"}
                onChange={(e) =>
                  updatePrefs((current) => ({
                    ...mergePlanningPreferences(current),
                    soulProfile: {
                      ...mergePlanningPreferences(current).soulProfile,
                      tone: e.target.value as NonNullable<
                        UserPlanningPreferences["soulProfile"]
                      >["tone"],
                    },
                  }))
                }
              >
                {SOUL_TONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label
                className="settings-field__label"
                htmlFor="settingsPlanningStyle"
              >
                Planning style
              </label>
              <select
                id="settingsPlanningStyle"
                className="settings-field__input"
                value={prefs.soulProfile?.planningStyle ?? "both"}
                onChange={(e) =>
                  updatePrefs((current) => ({
                    ...mergePlanningPreferences(current),
                    soulProfile: {
                      ...mergePlanningPreferences(current).soulProfile,
                      planningStyle: e.target.value as NonNullable<
                        UserPlanningPreferences["soulProfile"]
                      >["planningStyle"],
                    },
                  }))
                }
              >
                {SOUL_PLANNING_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label
                className="settings-field__label"
                htmlFor="settingsEnergyPattern"
              >
                Energy pattern
              </label>
              <select
                id="settingsEnergyPattern"
                className="settings-field__input"
                value={prefs.soulProfile?.energyPattern ?? "variable"}
                onChange={(e) =>
                  updatePrefs((current) => ({
                    ...mergePlanningPreferences(current),
                    soulProfile: {
                      ...mergePlanningPreferences(current).soulProfile,
                      energyPattern: e.target.value as NonNullable<
                        UserPlanningPreferences["soulProfile"]
                      >["energyPattern"],
                    },
                  }))
                }
              >
                {SOUL_ENERGY_PATTERN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label
                className="settings-field__label"
                htmlFor="settingsDailyRitual"
              >
                Daily ritual
              </label>
              <select
                id="settingsDailyRitual"
                className="settings-field__input"
                value={prefs.soulProfile?.dailyRitual ?? "neither"}
                onChange={(e) =>
                  updatePrefs((current) => ({
                    ...mergePlanningPreferences(current),
                    soulProfile: {
                      ...mergePlanningPreferences(current).soulProfile,
                      dailyRitual: e.target.value as NonNullable<
                        UserPlanningPreferences["soulProfile"]
                      >["dailyRitual"],
                    },
                  }))
                }
              >
                {SOUL_DAILY_RITUAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-field">
            <label
              className="settings-field__label"
              htmlFor="settingsPreferredContexts"
            >
              Preferred contexts
            </label>
            <input
              id="settingsPreferredContexts"
              className="settings-field__input"
              type="text"
              value={preferredContextsInput}
              onChange={(e) => setPreferredContextsInput(e.target.value)}
              placeholder="Home, errands, deep work"
            />
            <span className="settings-field__hint">
              Comma-separated contexts used by planning features.
            </span>
          </div>

          {message && <p className="settings-message">{message}</p>}
          <button className="btn" onClick={savePreferences} disabled={saving}>
            {saving ? "Saving…" : "Save planning preferences"}
          </button>
        </>
      )}
    </section>
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
      <div className="settings-actions">
        <button className="btn" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Download JSON"}
        </button>
        {message && <span className="settings-meta">{message}</span>}
      </div>
    </div>
  );
}

function McpSessionsSection() {
  const [sessions, setSessions] = useState<McpSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiCall("/auth/mcp/sessions");
      if (!res.ok) {
        throw new Error("Could not load sessions");
      }
      const data = (await res.json()) as { sessions?: McpSessionSummary[] };
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      setMessage("Could not load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revoke = useCallback(async (id: string) => {
    const res = await apiCall("/auth/mcp/sessions/revoke", {
      method: "POST",
      body: JSON.stringify({ sessionId: id }),
    });
    if (!res.ok) {
      setMessage("Could not revoke session.");
      return;
    }
    setSessions((prev) => prev.filter((session) => session.id !== id));
  }, []);

  const revokeAll = useCallback(async () => {
    const res = await apiCall("/auth/mcp/sessions/revoke", {
      method: "POST",
      body: JSON.stringify({ revokeAll: true }),
    });
    if (!res.ok) {
      setMessage("Could not revoke sessions.");
      return;
    }
    setSessions([]);
  }, []);

  return (
    <section className="settings-section">
      <h3 className="settings-section__title">MCP sessions</h3>
      <p className="settings-meta">
        Review connected assistants and revoke access when you no longer need
        it.
      </p>
      {message && <p className="settings-message">{message}</p>}
      {loading ? (
        <p className="settings-meta">Loading…</p>
      ) : sessions.length === 0 ? (
        <p id="mcpSessionsList" className="settings-meta">
          No assistants connected yet.
        </p>
      ) : (
        <>
          <div id="mcpSessionsList" className="mcp-sessions">
            {sessions.map((session) => (
              <div key={session.id} className="mcp-session">
                <div className="mcp-session__body">
                  <span className="mcp-session__name">
                    {session.assistantName ||
                      session.clientId ||
                      "Unknown assistant"}
                  </span>
                  <span className="mcp-session__meta">
                    {session.scopes.length > 0
                      ? session.scopes.join(", ")
                      : "No scopes recorded"}
                  </span>
                  <span className="mcp-session__date">
                    Last used{" "}
                    {session.lastUsedAt
                      ? new Date(session.lastUsedAt).toLocaleDateString()
                      : "never"}
                  </span>
                </div>
                <button className="btn" onClick={() => revoke(session.id)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
          <button className="btn btn--danger" onClick={revokeAll}>
            Revoke all
          </button>
        </>
      )}
    </section>
  );
}
