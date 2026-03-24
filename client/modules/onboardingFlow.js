// =============================================================================
// onboardingFlow.js — Soul MVP onboarding built on the existing step model.
// Step 1: belief + life areas + tone (modal)
// Step 2: planning patterns + rituals (modal)
// Step 3: seed a few example tasks + one freeform capture (inline on Home)
// Step 4: daily brief preview + rescue mode (modal)
// =============================================================================

import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";
import { TODOS_CHANGED } from "../platform/events/eventTypes.js";
import { ONBOARDING_COMPLETE } from "../platform/events/eventReasons.js";
import {
  SOUL_COPY,
  SOUL_PROFILE_DEFAULTS,
  SOUL_LIFE_AREAS,
  SOUL_FAILURE_MODES,
  SOUL_PLANNING_STYLES,
  SOUL_ENERGY_PATTERNS,
  SOUL_GOOD_DAY_THEMES,
  SOUL_TONES,
  SOUL_DAILY_RITUALS,
  normalizeSoulProfile,
  getExampleSeedTasks,
  getTonePreview,
} from "./soulConfig.js";

const { escapeHtml } = window.Utils || {};

let _step = 0;
let _saving = false;
let _createdSeedTitles = [];
let _draftProfile = normalizeSoulProfile(SOUL_PROFILE_DEFAULTS);

function getCurrentSoulProfile() {
  return normalizeSoulProfile(
    state.userPlanningPreferences?.soulProfile || _draftProfile,
  );
}

function setDraftProfile(patch = {}) {
  _draftProfile = normalizeSoulProfile({
    ...getCurrentSoulProfile(),
    ...patch,
  });
}

function toggleDraftListValue(key, value) {
  const current = Array.isArray(_draftProfile?.[key]) ? _draftProfile[key] : [];
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
  setDraftProfile({ [key]: next });
}

async function saveSoulProfilePatch(patch = {}) {
  const nextSoulProfile = normalizeSoulProfile({
    ...getCurrentSoulProfile(),
    ...patch,
  });
  setDraftProfile(nextSoulProfile);

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ soulProfile: nextSoulProfile }),
    });
    if (!response || !response.ok) return;
    const preferences = await response.json();
    state.userPlanningPreferences = {
      ...(preferences || {}),
      soulProfile: normalizeSoulProfile(preferences?.soulProfile),
    };
    _draftProfile = state.userPlanningPreferences.soulProfile;
    hooks.populateSoulPreferencesForm?.();
  } catch (error) {
    console.warn("Onboarding preferences save failed:", error);
  }
}

export function initOnboarding() {
  if (_step > 0) return;
  const user = state.currentUser;
  if (!user || user.onboardingCompletedAt) return;

  _draftProfile = getCurrentSoulProfile();
  _step = Number(user.onboardingStep || 0);
  if (_step <= 0) _step = 1;
  if (_step >= 5) {
    _markComplete();
    return;
  }
}

export function maybeRenderOnboardingModal() {
  if (![1, 2, 4].includes(_step)) return;
  if (document.getElementById("onboardingOverlay")) return;
  _render();
}

export function isOnboardingActive() {
  return _step >= 1 && _step <= 4;
}

export function advanceOnboarding() {
  if (_step >= 4) {
    void _markComplete();
    return;
  }
  _step += 1;
  void _saveStep(_step);
  _render();
}

export function dismissOnboarding() {
  void _markComplete();
}

async function _saveStep(step) {
  if (_saving) return;
  _saving = true;
  try {
    await hooks.apiCall(`${hooks.API_URL}/users/me/onboarding/step`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
    if (state.currentUser) {
      state.currentUser.onboardingStep = step;
    }
  } catch (error) {
    console.warn("Onboarding step save failed:", error);
  } finally {
    _saving = false;
  }
}

async function _markComplete() {
  _step = 5;
  _removeOverlay();
  _removeInlineBanner();

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/users/me/onboarding/complete`,
      { method: "POST" },
    );
    if (response && response.ok) {
      const user = await response.json();
      state.currentUser = { ...state.currentUser, ...user };
    }
  } catch (error) {
    console.warn("Onboarding complete save failed:", error);
  }

  EventBus.dispatch(TODOS_CHANGED, { reason: ONBOARDING_COMPLETE });
}

function _render() {
  if (_step === 1) {
    _removeInlineBanner();
    _renderStep1Modal();
    return;
  }
  if (_step === 2) {
    _removeInlineBanner();
    _renderStep2Modal();
    return;
  }
  if (_step === 3) {
    _removeOverlay();
    _renderStep3Inline();
    return;
  }
  if (_step === 4) {
    _removeInlineBanner();
    _renderStep4Modal();
  }
}

function renderSelectionButtons(
  options,
  selectedValues,
  handlerName,
  groupKey,
) {
  return options
    .map((option) => {
      const selected = selectedValues.includes(option.value);
      return `
        <button
          type="button"
          class="onb-choice-btn${selected ? " onb-choice-btn--selected" : ""}"
          data-group="${escapeHtml(groupKey)}"
          data-value="${escapeHtml(option.value)}"
          data-onclick="${handlerName}('${escapeHtml(option.value)}')"
        >
          ${escapeHtml(option.label)}
        </button>`;
    })
    .join("");
}

function renderChoiceCards(options, selectedValue, handlerName) {
  return options
    .map((option) => {
      const selected = selectedValue === option.value;
      return `
        <button
          type="button"
          class="onb-card-btn${selected ? " onb-card-btn--selected" : ""}"
          data-onclick="${handlerName}('${escapeHtml(option.value)}')"
        >
          <span class="onb-card-btn__label">${escapeHtml(option.label)}</span>
        </button>`;
    })
    .join("");
}

function _renderStep1Modal() {
  _removeOverlay();
  const profile = getCurrentSoulProfile();
  const overlay = document.createElement("div");
  overlay.id = "onboardingOverlay";
  overlay.className = "onboarding-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "onboardingModalTitle");
  overlay.innerHTML = `
    <div class="onb-modal onb-modal--wide">
      <div class="onb-progress">
        <span class="onb-progress__dot onb-progress__dot--active"></span>
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot"></span>
      </div>
      <p class="onb-modal__eyebrow">A calmer start</p>
      <h2 class="onb-modal__title" id="onboardingModalTitle">
        ${escapeHtml(SOUL_COPY.onboardingBelief)}
      </h2>
      <p class="onb-modal__subtitle">
        Let’s set the tone first, then we’ll get you to a useful screen quickly.
      </p>
      <div class="onb-section">
        <div class="onb-section__label">What kind of life are you managing?</div>
        <div class="onb-choice-grid">
          ${renderSelectionButtons(
            SOUL_LIFE_AREAS,
            profile.lifeAreas,
            "toggleOnboardingArea",
            "lifeAreas",
          )}
        </div>
      </div>
      <div class="onb-section">
        <div class="onb-section__label">Pick the tone you want to hear back</div>
        <div class="onb-card-grid">
          ${renderChoiceCards(SOUL_TONES, profile.tone, "setOnboardingTone")}
        </div>
        <p class="onb-modal__helper">${escapeHtml(getTonePreview(profile.tone))}</p>
      </div>
      <div class="onb-modal__actions">
        <button type="button" class="onb-skip-btn" data-onclick="dismissOnboarding()">Skip for now</button>
        <button type="button" class="onb-primary-btn" data-onclick="onboardingStep1Next()">
          Continue
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function _renderStep2Modal() {
  _removeOverlay();
  const profile = getCurrentSoulProfile();
  const overlay = document.createElement("div");
  overlay.id = "onboardingOverlay";
  overlay.className = "onboarding-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "onboardingModalTitle");
  overlay.innerHTML = `
    <div class="onb-modal onb-modal--wide">
      <div class="onb-progress">
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot onb-progress__dot--active"></span>
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot"></span>
      </div>
      <h2 class="onb-modal__title" id="onboardingModalTitle">
        Tell us how planning usually gets hard
      </h2>
      <div class="onb-section">
        <div class="onb-section__label">When task systems fail, what usually happens?</div>
        <div class="onb-choice-grid">
          ${renderSelectionButtons(
            SOUL_FAILURE_MODES,
            profile.failureModes,
            "toggleOnboardingFailureMode",
            "failureModes",
          )}
        </div>
      </div>
      <div class="onb-section">
        <div class="onb-section__label">Planning style</div>
        <div class="onb-card-grid">
          ${renderChoiceCards(
            SOUL_PLANNING_STYLES,
            profile.planningStyle,
            "setOnboardingPlanningStyle",
          )}
        </div>
      </div>
      <div class="onb-inline-grid">
        <div class="onb-section">
          <div class="onb-section__label">Energy pattern</div>
          <div class="onb-card-grid onb-card-grid--compact">
            ${renderChoiceCards(
              SOUL_ENERGY_PATTERNS,
              profile.energyPattern,
              "setOnboardingEnergyPattern",
            )}
          </div>
        </div>
        <div class="onb-section">
          <div class="onb-section__label">Daily ritual</div>
          <div class="onb-card-grid onb-card-grid--compact">
            ${renderChoiceCards(
              SOUL_DAILY_RITUALS,
              profile.dailyRitual,
              "setOnboardingDailyRitual",
            )}
          </div>
        </div>
      </div>
      <div class="onb-section">
        <div class="onb-section__label">What does a good day look like?</div>
        <div class="onb-choice-grid">
          ${renderSelectionButtons(
            SOUL_GOOD_DAY_THEMES,
            profile.goodDayThemes,
            "toggleOnboardingGoodDayTheme",
            "goodDayThemes",
          )}
        </div>
      </div>
      <div class="onb-modal__actions">
        <button type="button" class="onb-skip-btn" data-onclick="backOnboardingStep()">Back</button>
        <button type="button" class="onb-primary-btn" data-onclick="finishOnboardingStep2()">
          Keep going
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function _renderStep3Inline() {
  _removeInlineBanner();
  const banner = document.createElement("section");
  banner.id = "onboardingInlineBanner";
  banner.className = "onboarding-inline-banner onboarding-inline-banner--soul";
  const seedTitles = getExampleSeedTasks(getCurrentSoulProfile());
  const pendingSet = new Set(_createdSeedTitles);
  banner.innerHTML = `
    <div class="onboarding-inline-banner__header">
      <div>
        <p class="onboarding-inline-banner__eyebrow">Step 3 of 4</p>
        <h3>Start with a few gentle examples</h3>
        <p>${escapeHtml(SOUL_COPY.taskPromptSecondary)}</p>
      </div>
      <button type="button" class="mini-btn" data-onclick="skipOnboardingExamples()">
        Skip examples
      </button>
    </div>
    <div class="onboarding-inline-banner__examples">
      ${seedTitles
        .map(
          (title) => `
            <button
              type="button"
              class="onb-example-btn${pendingSet.has(title) ? " onb-example-btn--added" : ""}"
              data-onclick="onboardingAddTask('${escapeHtml(title)}')"
              ${pendingSet.has(title) ? "disabled" : ""}
            >
              ${pendingSet.has(title) ? "Added" : "Add"} ${escapeHtml(title)}
            </button>`,
        )
        .join("")}
    </div>
    <div class="onboarding-inline-banner__capture">
      <input
        id="onboardingCustomTaskInput"
        type="text"
        maxlength="200"
        placeholder="${escapeHtml(SOUL_COPY.taskPromptPrimary)}"
      />
      <button type="button" class="btn" data-onclick="onboardingAddTask()">
        Add task
      </button>
      <button type="button" class="mini-btn" data-onclick="finishOnboardingExamples()">
        Continue
      </button>
    </div>
    ${
      _createdSeedTitles.length > 0
        ? `<p class="onboarding-inline-banner__helper">You can keep going now, or add one more example first.</p>`
        : `<p class="onboarding-inline-banner__helper">Nothing here gets a forced due date. You can keep this light.</p>`
    }
  `;
  const host = document.getElementById("todosContent");
  if (host instanceof HTMLElement) {
    host.prepend(banner);
  }
}

function _renderStep4Modal() {
  _removeOverlay();
  const profile = getCurrentSoulProfile();
  const overlay = document.createElement("div");
  overlay.id = "onboardingOverlay";
  overlay.className = "onboarding-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "onboardingModalTitle");
  overlay.innerHTML = `
    <div class="onb-modal">
      <div class="onb-progress">
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot"></span>
        <span class="onb-progress__dot onb-progress__dot--active"></span>
      </div>
      <p class="onb-modal__eyebrow">Daily brief preview</p>
      <h2 class="onb-modal__title" id="onboardingModalTitle">
        Your Home view will stay small on purpose
      </h2>
      <p class="onb-modal__subtitle">
        You’ll see one clear focus, a few things due soon, and a short cleanup list when it helps.
      </p>
      <div class="onb-preview-card">
        <div class="onb-preview-card__title">Today’s focus</div>
        <p class="onb-preview-card__text">
          ${escapeHtml(getTonePreview(profile.tone))}
        </p>
      </div>
      <div class="onb-preview-card onb-preview-card--muted">
        <div class="onb-preview-card__title">Rescue mode</div>
        <p class="onb-preview-card__text">
          ${escapeHtml(SOUL_COPY.rescueIntro)}
        </p>
      </div>
      <div class="onb-modal__actions">
        <button type="button" class="onb-skip-btn" data-onclick="backOnboardingStep()">Back</button>
        <button type="button" class="onb-primary-btn" data-onclick="advanceOnboarding()">
          Open my workspace
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

export function toggleOnboardingArea(areaKey) {
  toggleDraftListValue("lifeAreas", areaKey);
  _renderStep1Modal();
}

export function setOnboardingTone(tone) {
  setDraftProfile({ tone });
  _renderStep1Modal();
}

export async function onboardingStep1Next() {
  await saveSoulProfilePatch({
    lifeAreas: getCurrentSoulProfile().lifeAreas,
    tone: getCurrentSoulProfile().tone,
  });
  _step = 2;
  await _saveStep(_step);
  _render();
}

export function toggleOnboardingFailureMode(value) {
  toggleDraftListValue("failureModes", value);
  _renderStep2Modal();
}

export function toggleOnboardingGoodDayTheme(value) {
  toggleDraftListValue("goodDayThemes", value);
  _renderStep2Modal();
}

export function setOnboardingPlanningStyle(value) {
  setDraftProfile({ planningStyle: value });
  _renderStep2Modal();
}

export function setOnboardingEnergyPattern(value) {
  setDraftProfile({ energyPattern: value });
  _renderStep2Modal();
}

export function setOnboardingDailyRitual(value) {
  setDraftProfile({ dailyRitual: value });
  _renderStep2Modal();
}

export function backOnboardingStep() {
  if (_step <= 1) return;
  _step -= 1;
  void _saveStep(_step);
  _render();
}

export async function finishOnboardingStep2() {
  await saveSoulProfilePatch({
    failureModes: getCurrentSoulProfile().failureModes,
    planningStyle: getCurrentSoulProfile().planningStyle,
    energyPattern: getCurrentSoulProfile().energyPattern,
    goodDayThemes: getCurrentSoulProfile().goodDayThemes,
    dailyRitual: getCurrentSoulProfile().dailyRitual,
  });
  _step = 3;
  await _saveStep(_step);
  _render();
}

export async function onboardingAddTask(seedTitle = "") {
  const input = document.getElementById("onboardingCustomTaskInput");
  const title = String(
    seedTitle || (input instanceof HTMLInputElement ? input.value : "") || "",
  ).trim();
  if (!title) return;

  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        status: "next",
        priority: "medium",
        source: "system_seed",
      }),
    });
    if (!response || !response.ok) return;
    const todo = await response.json();
    _createdSeedTitles.push(title);
    state.todos.unshift(todo);
    EventBus.dispatch(TODOS_CHANGED, { reason: "onboarding-seed-created" });
    hooks.updateCategoryFilter?.();
    hooks.populateSoulPreferencesForm?.();
    if (input instanceof HTMLInputElement && !seedTitle) {
      input.value = "";
    }
    _renderStep3Inline();
  } catch (error) {
    console.warn("Onboarding example task creation failed:", error);
  }
}

export async function finishOnboardingExamples() {
  _step = 4;
  await _saveStep(_step);
  _render();
}

export async function skipOnboardingExamples() {
  await finishOnboardingExamples();
}

export async function onboardingSetDueDate() {
  return Promise.resolve();
}

function _removeOverlay() {
  document.getElementById("onboardingOverlay")?.remove();
}

function _removeInlineBanner() {
  document.getElementById("onboardingInlineBanner")?.remove();
}

export { _step as onboardingStep };
