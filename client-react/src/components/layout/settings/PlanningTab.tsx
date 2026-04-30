import { useState, useCallback, useEffect } from "react";
import { apiCall } from "../../../api/client";
import type { UserPlanningPreferences } from "../../../types";
import {
  CHUNK_MINUTE_OPTIONS,
  DEFAULT_USER_PREFERENCES,
  SOUL_DAILY_RITUAL_OPTIONS,
  SOUL_ENERGY_PATTERN_OPTIONS,
  SOUL_PLANNING_STYLE_OPTIONS,
  SOUL_TONE_OPTIONS,
  mergePlanningPreferences,
  parsePreferredContexts,
} from "../settingsModels";
import { Field } from "../../shared/Field";

export function PlanningTab() {
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

  if (loading) {
    return (
      <section className="settings-section">
        <p className="settings-meta">Loading…</p>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <div className="settings-grid">
        <Field label="Daily task target" htmlFor="settingsMaxDailyTasks">
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
                maxDailyTasks: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
        </Field>
        <Field
          label="Preferred work chunk"
          htmlFor="settingsPreferredChunkMinutes"
        >
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
        </Field>
        <Field
          label="Waiting follow-up days"
          htmlFor="settingsWaitingFollowUpDays"
        >
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
                waitingFollowUpDays: Math.max(1, Number(e.target.value) || 1),
              }))
            }
          />
        </Field>
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
        <Field label="Tone" htmlFor="settingsTone">
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
        </Field>
        <Field label="Planning style" htmlFor="settingsPlanningStyle">
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
        </Field>
        <Field label="Energy pattern" htmlFor="settingsEnergyPattern">
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
        </Field>
        <Field label="Daily ritual" htmlFor="settingsDailyRitual">
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
        </Field>
      </div>

      <Field
        label="Preferred contexts"
        htmlFor="settingsPreferredContexts"
        help="Comma-separated contexts used by planning features."
      >
        <input
          id="settingsPreferredContexts"
          className="settings-field__input"
          type="text"
          value={preferredContextsInput}
          onChange={(e) => setPreferredContextsInput(e.target.value)}
          placeholder="Home, errands, deep work"
        />
      </Field>

      {message && <p className="settings-message">{message}</p>}
      <button className="btn" onClick={savePreferences} disabled={saving}>
        {saving ? "Saving…" : "Save planning preferences"}
      </button>
    </section>
  );
}
