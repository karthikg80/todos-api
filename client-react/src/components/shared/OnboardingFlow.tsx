import { useCallback, useEffect, useMemo, useState } from "react";
import { apiCall } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import type {
  CreateTodoDto,
  SoulProfile,
  User,
  UserPlanningPreferences,
} from "../../types";
import {
  SOUL_COPY,
  SOUL_DAILY_RITUALS,
  SOUL_ENERGY_PATTERNS,
  SOUL_FAILURE_MODES,
  SOUL_GOOD_DAY_THEMES,
  SOUL_LIFE_AREAS,
  SOUL_PLANNING_STYLES,
  SOUL_TONES,
  getExampleSeedTasks,
  getTonePreview,
  mergePreferences,
  normalizeSoulProfile,
} from "./onboardingModels";

interface Props {
  onComplete: () => void;
  onAddTodo: (dto: CreateTodoDto) => Promise<unknown>;
}

type OnboardingStep = 1 | 2 | 3 | 4;

function getInitialStep(rawStep: number | null | undefined): OnboardingStep {
  const normalized = Number(rawStep || 1);
  if (normalized <= 1) return 1;
  if (normalized === 2) return 2;
  if (normalized === 3) return 3;
  return 4;
}

export function OnboardingFlow({ onComplete, onAddTodo }: Props) {
  const { user, setUser } = useAuth();
  const [step, setStep] = useState<OnboardingStep>(
    getInitialStep(user?.onboardingStep),
  );
  const [profile, setProfile] = useState<SoulProfile>(
    normalizeSoulProfile(undefined),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [customTask, setCustomTask] = useState("");
  const [addedSeedTitles, setAddedSeedTitles] = useState<string[]>([]);

  useEffect(() => {
    if (user?.onboardingCompletedAt) {
      onComplete();
      return;
    }
    setStep(getInitialStep(user?.onboardingStep));
  }, [onComplete, user?.onboardingCompletedAt, user?.onboardingStep]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiCall("/preferences")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load preferences");
        const data = (await res.json()) as Partial<UserPlanningPreferences>;
        if (cancelled) return;
        setProfile(
          mergePreferences(data).soulProfile ?? normalizeSoulProfile(undefined),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setMessage("Could not load onboarding preferences.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const seedTitles = useMemo(() => getExampleSeedTasks(profile), [profile]);
  const addedSet = useMemo(() => new Set(addedSeedTitles), [addedSeedTitles]);

  const updateUserStep = useCallback(
    (nextStep: number) => {
      if (!user) return;
      setUser({ ...user, onboardingStep: nextStep });
    },
    [setUser, user],
  );

  const persistStep = useCallback(
    async (nextStep: OnboardingStep) => {
      const res = await apiCall("/users/me/onboarding/step", {
        method: "PATCH",
        body: JSON.stringify({ step: nextStep }),
      });
      if (!res.ok) {
        throw new Error("Failed to save onboarding step");
      }
      updateUserStep(nextStep);
      setStep(nextStep);
    },
    [updateUserStep],
  );

  const saveSoulProfilePatch = useCallback(
    async (patch: Partial<SoulProfile>) => {
      const nextProfile = normalizeSoulProfile({ ...profile, ...patch });
      const res = await apiCall("/preferences", {
        method: "PATCH",
        body: JSON.stringify({ soulProfile: nextProfile }),
      });
      if (!res.ok) {
        throw new Error("Failed to save onboarding preferences");
      }
      const data = (await res.json()) as Partial<UserPlanningPreferences>;
      setProfile(mergePreferences(data).soulProfile ?? nextProfile);
    },
    [profile],
  );

  const completeOnboarding = useCallback(async () => {
    const res = await apiCall("/users/me/onboarding/complete", {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error("Failed to complete onboarding");
    }
    const updatedUser = (await res.json()) as User;
    setUser(updatedUser);
    onComplete();
  }, [onComplete, setUser]);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      await completeOnboarding();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to complete onboarding",
      );
    } finally {
      setSaving(false);
    }
  }, [completeOnboarding]);

  const handleSkip = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      await completeOnboarding();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to skip onboarding",
      );
    } finally {
      setSaving(false);
    }
  }, [completeOnboarding]);

  const handleStepOneNext = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      await saveSoulProfilePatch({
        lifeAreas: profile.lifeAreas,
        tone: profile.tone,
      });
      await persistStep(2);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to continue");
    } finally {
      setSaving(false);
    }
  }, [persistStep, profile.lifeAreas, profile.tone, saveSoulProfilePatch]);

  const handleStepTwoNext = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      await saveSoulProfilePatch({
        failureModes: profile.failureModes,
        planningStyle: profile.planningStyle,
        energyPattern: profile.energyPattern,
        goodDayThemes: profile.goodDayThemes,
        dailyRitual: profile.dailyRitual,
      });
      await persistStep(3);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to continue");
    } finally {
      setSaving(false);
    }
  }, [
    persistStep,
    profile.dailyRitual,
    profile.energyPattern,
    profile.failureModes,
    profile.goodDayThemes,
    profile.planningStyle,
    saveSoulProfilePatch,
  ]);

  const handleBack = useCallback(async () => {
    if (step <= 1) return;
    const previousStep = (step - 1) as OnboardingStep;
    setSaving(true);
    setMessage("");
    try {
      await persistStep(previousStep);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to go back");
    } finally {
      setSaving(false);
    }
  }, [persistStep, step]);

  const handleAddTask = useCallback(
    async (seedTitle = "") => {
      const title = String(seedTitle || customTask).trim();
      if (!title) return;
      setSaving(true);
      setMessage("");
      try {
        await onAddTodo({
          title,
          status: "next",
          priority: "medium",
          source: "system_seed",
        });
        setAddedSeedTitles((current) =>
          current.includes(title) ? current : [...current, title],
        );
        if (!seedTitle) {
          setCustomTask("");
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Failed to add task",
        );
      } finally {
        setSaving(false);
      }
    },
    [customTask, onAddTodo],
  );

  const handleExamplesNext = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      await persistStep(4);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to continue");
    } finally {
      setSaving(false);
    }
  }, [persistStep]);

  const toggleListValue = useCallback(
    (key: "lifeAreas" | "failureModes" | "goodDayThemes", value: string) => {
      setProfile((current) => {
        const list = current[key];
        return normalizeSoulProfile({
          ...current,
          [key]: list.includes(value)
            ? list.filter((item) => item !== value)
            : [...list, value],
        });
      });
    },
    [],
  );

  if (!user || user.onboardingCompletedAt) return null;

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card onboarding-card--wide">
        <div className="onboarding-card__progress">
          {[1, 2, 3, 4].map((dot) => (
            <div
              key={dot}
              className={`onboarding-card__dot${dot === step ? " onboarding-card__dot--active" : ""}${dot < step ? " onboarding-card__dot--done" : ""}`}
            />
          ))}
        </div>

        {loading ? (
          <div className="onboarding-card__step">
            <h2 className="onboarding-card__title">Loading onboarding</h2>
            <p className="onboarding-card__desc">
              Reading your current preferences.
            </p>
          </div>
        ) : (
          <>
            {step === 1 && (
              <div className="onboarding-card__step">
                <p className="onboarding-card__eyebrow">A calmer start</p>
                <h2 className="onboarding-card__title">
                  {SOUL_COPY.onboardingBelief}
                </h2>
                <p className="onboarding-card__desc">
                  Set tone first, then get to a usable workspace quickly.
                </p>
                <div className="onboarding-section">
                  <div className="onboarding-section__label">
                    What kind of life are you managing?
                  </div>
                  <div className="onboarding-choice-grid">
                    {SOUL_LIFE_AREAS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`onboarding-chip${profile.lifeAreas.includes(option.value) ? " onboarding-chip--selected" : ""}`}
                        onClick={() =>
                          toggleListValue("lifeAreas", option.value)
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="onboarding-section">
                  <div className="onboarding-section__label">
                    Pick the tone you want to hear back
                  </div>
                  <div className="onboarding-card-grid">
                    {SOUL_TONES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`onboarding-choice-card${profile.tone === option.value ? " onboarding-choice-card--selected" : ""}`}
                        onClick={() =>
                          setProfile((current) =>
                            normalizeSoulProfile({
                              ...current,
                              tone: option.value,
                            }),
                          )
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="onboarding-card__helper">
                    {getTonePreview(profile.tone)}
                  </p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="onboarding-card__step">
                <p className="onboarding-card__eyebrow">Step 2 of 4</p>
                <h2 className="onboarding-card__title">
                  Tell us how planning usually gets hard
                </h2>
                <div className="onboarding-section">
                  <div className="onboarding-section__label">
                    When task systems fail, what usually happens?
                  </div>
                  <div className="onboarding-choice-grid">
                    {SOUL_FAILURE_MODES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`onboarding-chip${profile.failureModes.includes(option.value) ? " onboarding-chip--selected" : ""}`}
                        onClick={() =>
                          toggleListValue("failureModes", option.value)
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="onboarding-grid">
                  <ChoiceGroup
                    label="Planning style"
                    options={SOUL_PLANNING_STYLES}
                    selected={profile.planningStyle}
                    onSelect={(value) =>
                      setProfile((current) =>
                        normalizeSoulProfile({
                          ...current,
                          planningStyle: value as SoulProfile["planningStyle"],
                        }),
                      )
                    }
                  />
                  <ChoiceGroup
                    label="Energy pattern"
                    options={SOUL_ENERGY_PATTERNS}
                    selected={profile.energyPattern}
                    onSelect={(value) =>
                      setProfile((current) =>
                        normalizeSoulProfile({
                          ...current,
                          energyPattern: value as SoulProfile["energyPattern"],
                        }),
                      )
                    }
                  />
                  <ChoiceGroup
                    label="Daily ritual"
                    options={SOUL_DAILY_RITUALS}
                    selected={profile.dailyRitual}
                    onSelect={(value) =>
                      setProfile((current) =>
                        normalizeSoulProfile({
                          ...current,
                          dailyRitual: value as SoulProfile["dailyRitual"],
                        }),
                      )
                    }
                  />
                </div>
                <div className="onboarding-section">
                  <div className="onboarding-section__label">
                    What does a good day look like?
                  </div>
                  <div className="onboarding-choice-grid">
                    {SOUL_GOOD_DAY_THEMES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`onboarding-chip${profile.goodDayThemes.includes(option.value) ? " onboarding-chip--selected" : ""}`}
                        onClick={() =>
                          toggleListValue("goodDayThemes", option.value)
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="onboarding-card__step">
                <p className="onboarding-card__eyebrow">Step 3 of 4</p>
                <h2 className="onboarding-card__title">
                  Start with a few gentle examples
                </h2>
                <p className="onboarding-card__desc">
                  {SOUL_COPY.taskPromptSecondary}
                </p>
                <div className="onboarding-examples">
                  {seedTitles.map((title) => (
                    <button
                      key={title}
                      type="button"
                      className={`onboarding-example${addedSet.has(title) ? " onboarding-example--added" : ""}`}
                      onClick={() => void handleAddTask(title)}
                      disabled={addedSet.has(title) || saving}
                    >
                      {addedSet.has(title) ? "Added" : "Add"} {title}
                    </button>
                  ))}
                </div>
                <div className="onboarding-custom-task">
                  <input
                    id="onboardingCustomTaskInput"
                    className="settings-field__input"
                    type="text"
                    maxLength={200}
                    value={customTask}
                    placeholder={SOUL_COPY.taskPromptPrimary}
                    onChange={(e) => setCustomTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleAddTask();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleAddTask()}
                    disabled={!customTask.trim() || saving}
                  >
                    Add task
                  </button>
                </div>
                <p className="onboarding-card__helper">
                  {addedSeedTitles.length > 0
                    ? "You can keep going now, or add one more example first."
                    : "Nothing here gets a forced due date. You can keep this light."}
                </p>
              </div>
            )}

            {step === 4 && (
              <div className="onboarding-card__step">
                <p className="onboarding-card__eyebrow">Daily brief preview</p>
                <h2 className="onboarding-card__title">
                  Your Focus view stays small on purpose
                </h2>
                <p className="onboarding-card__desc">
                  One clear focus, a few things due soon, and a short tune-up
                  list when it helps.
                </p>
                <div className="onboarding-preview-card">
                  <div className="onboarding-preview-card__title">
                    Today&apos;s focus
                  </div>
                  <p className="onboarding-preview-card__text">
                    {getTonePreview(profile.tone)}
                  </p>
                </div>
                <div className="onboarding-preview-card onboarding-preview-card--muted">
                  <div className="onboarding-preview-card__title">
                    Rescue mode
                  </div>
                  <p className="onboarding-preview-card__text">
                    {SOUL_COPY.rescueIntro}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {message && <p className="onboarding-card__error">{message}</p>}

        <div className="onboarding-card__actions">
          {step === 1 ? (
            <button
              className="btn"
              onClick={() => void handleSkip()}
              disabled={saving}
            >
              Skip for now
            </button>
          ) : (
            <button
              className="btn"
              onClick={() => void handleBack()}
              disabled={saving}
            >
              Back
            </button>
          )}

          {step === 1 && (
            <button
              className="btn btn--primary"
              onClick={() => void handleStepOneNext()}
              disabled={saving}
            >
              Continue
            </button>
          )}
          {step === 2 && (
            <button
              className="btn btn--primary"
              onClick={() => void handleStepTwoNext()}
              disabled={saving}
            >
              Keep going
            </button>
          )}
          {step === 3 && (
            <button
              className="btn btn--primary"
              onClick={() => void handleExamplesNext()}
              disabled={saving}
            >
              Continue
            </button>
          )}
          {step === 4 && (
            <button
              className="btn btn--primary"
              onClick={() => void handleFinish()}
              disabled={saving}
            >
              Open my workspace
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="onboarding-section">
      <div className="onboarding-section__label">{label}</div>
      <div className="onboarding-card-grid onboarding-card-grid--compact">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`onboarding-choice-card${selected === option.value ? " onboarding-choice-card--selected" : ""}`}
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
