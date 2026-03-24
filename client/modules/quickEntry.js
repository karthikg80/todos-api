// =============================================================================
// quickEntry.js — Quick-entry form, natural date detection, task composer
// =============================================================================
import { state, hooks } from "./store.js";
import {
  isHomeWorkspaceActive,
  isUnsortedWorkspaceActive,
  hasHomeListDrilldown,
  getSelectedProjectKey,
} from "./filterLogic.js";
import { applyUiAction } from "./stateActions.js";
import { STORAGE_KEYS } from "../utils/storageKeys.js";

const { escapeHtml, getProjectLeafName } = (() => ({
  escapeHtml: (window.Utils || {}).escapeHtml,
  getProjectLeafName: (window.ProjectPathUtils || {}).getProjectLeafName,
}))();

const QUICK_ENTRY_NATURAL_DATE_DEBOUNCE_MS = 320;

export function readStoredQuickEntryPropertiesOpenState() {
  try {
    return (
      window.localStorage.getItem(STORAGE_KEYS.QUICK_ENTRY_PROPERTIES_OPEN) ===
      "1"
    );
  } catch (error) {
    return false;
  }
}

export function persistQuickEntryPropertiesOpenState(isOpen) {
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.QUICK_ENTRY_PROPERTIES_OPEN,
      isOpen ? "1" : "0",
    );
  } catch (error) {
    // Ignore storage failures.
  }
}

export function setQuickEntryPropertiesOpen(nextOpen, { persist = true } = {}) {
  applyUiAction("quickEntry/properties:set", { isOpen: nextOpen });
  if (persist) {
    persistQuickEntryPropertiesOpenState(state.isQuickEntryPropertiesOpen);
  }
  const panel = document.getElementById("quickEntryPropertiesPanel");
  const toggle = document.getElementById("quickEntryPropertiesToggle");
  if (panel instanceof HTMLElement) {
    panel.hidden = !state.isQuickEntryPropertiesOpen;
  }
  if (toggle instanceof HTMLElement) {
    toggle.setAttribute(
      "aria-expanded",
      String(state.isQuickEntryPropertiesOpen),
    );
    toggle.classList.toggle(
      "quick-entry-properties-toggle--active",
      state.isQuickEntryPropertiesOpen,
    );
  }
  updateQuickEntryPropertiesSummary();
}

export function formatQuickEntryDueSummary(value) {
  if (!value) return "No due date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No due date";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function updateQuickEntryPropertiesSummary() {
  const summaryEl = document.getElementById("quickEntryPropertiesSummary");
  if (!(summaryEl instanceof HTMLElement)) return;

  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  const projectValue =
    projectSelect instanceof HTMLSelectElement ? projectSelect.value : "";
  const dueValue =
    dueDateInput instanceof HTMLInputElement ? dueDateInput.value : "";
  const projectLabel = projectValue
    ? getProjectLeafName(projectValue)
    : "No project";
  const dueLabel = formatQuickEntryDueSummary(dueValue);
  const priorityLabel =
    state.currentPriority.charAt(0).toUpperCase() +
    state.currentPriority.slice(1);

  summaryEl.textContent = `${projectLabel} \u2022 ${dueLabel} \u2022 Priority: ${priorityLabel}`;
  summaryEl.hidden = state.isQuickEntryPropertiesOpen;
}

export function getQuickEntryNaturalDateElements() {
  const titleInput = document.getElementById("todoInput");
  const dueDateInput = document.getElementById("todoDueDateInput");
  const chipRow = document.getElementById("quickEntryNaturalDueChipRow");
  if (!(titleInput instanceof HTMLInputElement)) return null;
  if (!(dueDateInput instanceof HTMLInputElement)) return null;
  if (!(chipRow instanceof HTMLElement)) return null;
  return { titleInput, dueDateInput, chipRow };
}

export function normalizeQuickEntryTextSignature(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function toLocalDateTimeInputValue(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "";
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  const day = String(safeDate.getDate()).padStart(2, "0");
  const hours = String(safeDate.getHours()).padStart(2, "0");
  const minutes = String(safeDate.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatQuickEntryNaturalDueLabel(
  date,
  { includeTime = true } = {},
) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "";
  const options = includeTime
    ? {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    : {
        weekday: "short",
        month: "short",
        day: "numeric",
      };
  return safeDate.toLocaleString(undefined, options);
}

export async function loadChronoNaturalDateModule() {
  if (window.__chronoNaturalDateModule) {
    return window.__chronoNaturalDateModule;
  }
  if (!state.chronoNaturalDateModulePromise) {
    state.chronoNaturalDateModulePromise =
      import("/vendor/chrono-node/index.js")
        .then((module) => {
          window.__chronoNaturalDateModule = module;
          return module;
        })
        .catch((error) => {
          state.chronoNaturalDateModulePromise = null;
          console.warn("Natural date parser failed to load:", error);
          return null;
        });
  }
  return state.chronoNaturalDateModulePromise;
}

export function removeMatchedDatePhraseFromTitle(title, detection) {
  if (!detection || !Number.isInteger(detection.index)) {
    return String(title || "").trim();
  }
  const rawTitle = String(title || "");
  const start = Math.max(0, detection.index);
  const end = Math.min(
    rawTitle.length,
    start + String(detection.text || "").length,
  );
  if (start >= end) return rawTitle.trim();
  let nextTitle = `${rawTitle.slice(0, start)} ${rawTitle.slice(end)}`;
  nextTitle = nextTitle.replace(/\s+/g, " ").trim();
  nextTitle = nextTitle.replace(/\s+([,.;:!?])/g, "$1");
  return nextTitle;
}

export function parseQuickEntryNaturalDue(text, chronoModule) {
  const sourceText = String(text || "");
  const trimmed = sourceText.trim();
  if (!trimmed || !chronoModule || typeof chronoModule.parse !== "function") {
    return null;
  }

  let results = [];
  try {
    results = chronoModule.parse(sourceText, new Date(), {
      forwardDate: true,
    });
  } catch (error) {
    console.warn("Natural date parse failed:", error);
    return null;
  }
  if (!Array.isArray(results) || results.length === 0) return null;

  const match = results.find((result) => {
    const textValue = String(result?.text || "").trim();
    if (!textValue) return false;
    if (!/[a-zA-Z]|\/|:/.test(textValue)) return false;
    if (textValue.length < 2) return false;
    return true;
  });
  if (!match || !match.start || typeof match.start.date !== "function")
    return null;

  const dueDate = match.start.date();
  if (!(dueDate instanceof Date) || Number.isNaN(dueDate.getTime()))
    return null;
  const now = Date.now();
  const isPast = dueDate.getTime() < now - 60 * 1000;
  const hasExplicitTime =
    typeof match.start.isCertain === "function" &&
    (match.start.isCertain("hour") || match.start.isCertain("minute"));
  const dueValue = toLocalDateTimeInputValue(dueDate);
  if (!dueValue) return null;

  return {
    text: String(match.text || ""),
    index: Number(match.index) || 0,
    endIndex: (Number(match.index) || 0) + String(match.text || "").length,
    dueDate,
    dueInputValue: dueValue,
    hasExplicitTime,
    isPast,
    displayLabel: formatQuickEntryNaturalDueLabel(dueDate, {
      includeTime: hasExplicitTime,
    }),
    detectedSignature: `${String(match.text || "")
      .trim()
      .toLowerCase()}|${dueValue}`,
  };
}

export function setQuickEntryDueInputValue(value) {
  const refs = getQuickEntryNaturalDateElements();
  if (!refs) return;
  state.quickEntryNaturalDateState.dueInputProgrammatic = true;
  refs.dueDateInput.value = value;
  refs.dueDateInput.dispatchEvent(new Event("input", { bubbles: true }));
  refs.dueDateInput.dispatchEvent(new Event("change", { bubbles: true }));
  state.quickEntryNaturalDateState.dueInputProgrammatic = false;
}

export function clearQuickEntryNaturalSuggestionPreview() {
  state.quickEntryNaturalDateState.suggestionPreview = null;
}

export function renderQuickEntryNaturalDueChip() {
  const refs = getQuickEntryNaturalDateElements();
  if (!refs) return;
  const { chipRow, dueDateInput } = refs;

  const hasNaturalDuePreview =
    !!state.quickEntryNaturalDateState.appliedPreview &&
    state.quickEntryNaturalDateState.dueSource === "natural" &&
    !!dueDateInput.value;
  if (hasNaturalDuePreview) {
    chipRow.hidden = false;
    chipRow.innerHTML = `
      <div class="quick-entry-natural-due-chip quick-entry-natural-due-chip--applied">
        <span class="quick-entry-natural-due-chip__label">Due: ${escapeHtml(state.quickEntryNaturalDateState.appliedPreview.displayLabel)}</span>
        <button
          type="button"
          class="quick-entry-natural-due-chip__action"
          data-natural-due-action="clear"
          aria-label="Clear detected due date"
          title="Clear due date"
        >
          \u2715
        </button>
      </div>
    `;
    return;
  }

  if (state.quickEntryNaturalDateState.suggestionPreview) {
    chipRow.hidden = false;
    chipRow.innerHTML = `
      <div class="quick-entry-natural-due-chip quick-entry-natural-due-chip--suggested">
        <span class="quick-entry-natural-due-chip__label">Detected: ${escapeHtml(state.quickEntryNaturalDateState.suggestionPreview.displayLabel)}</span>
        <button
          type="button"
          class="quick-entry-natural-due-chip__action"
          data-natural-due-action="apply"
          aria-label="Apply detected due date"
        >
          Apply
        </button>
      </div>
    `;
    return;
  }

  chipRow.hidden = true;
  chipRow.innerHTML = "";
}

export function resetQuickEntryNaturalDueState() {
  if (state.quickEntryNaturalDateState.parseTimer) {
    clearTimeout(state.quickEntryNaturalDateState.parseTimer);
  }
  state.quickEntryNaturalDateState.parseTimer = null;
  state.quickEntryNaturalDateState.parseSeq += 1;
  state.quickEntryNaturalDateState.dueSource = "none";
  state.quickEntryNaturalDateState.appliedPreview = null;
  state.quickEntryNaturalDateState.suggestionPreview = null;
  state.quickEntryNaturalDateState.lastDetected = null;
  state.quickEntryNaturalDateState.lastSuppressedTextSignature = "";
  state.quickEntryNaturalDateState.lastSuppressedDetectedSignature = "";
  renderQuickEntryNaturalDueChip();
}

export function applyQuickEntryNaturalDueDetection(
  detection,
  { cleanupTitle = true } = {},
) {
  const refs = getQuickEntryNaturalDateElements();
  if (!refs || !detection) return false;

  setQuickEntryDueInputValue(detection.dueInputValue);
  state.quickEntryNaturalDateState.dueSource = "natural";
  state.quickEntryNaturalDateState.appliedPreview = {
    dueInputValue: detection.dueInputValue,
    displayLabel: detection.displayLabel,
    detectedSignature: detection.detectedSignature,
    text: detection.text,
  };
  clearQuickEntryNaturalSuggestionPreview();

  if (cleanupTitle) {
    const cleanedTitle = removeMatchedDatePhraseFromTitle(
      refs.titleInput.value,
      detection,
    );
    if (cleanedTitle !== refs.titleInput.value) {
      state.quickEntryNaturalDateState.suppressNextTitleInputParse = true;
      refs.titleInput.value = cleanedTitle;
      refs.titleInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  renderQuickEntryNaturalDueChip();
  return true;
}

export function shouldSuppressQuickEntryNaturalAutoApply(
  textSignature,
  detectionSignature,
) {
  return (
    state.quickEntryNaturalDateState.lastSuppressedTextSignature ===
      textSignature &&
    state.quickEntryNaturalDateState.lastSuppressedDetectedSignature ===
      detectionSignature
  );
}

export async function processQuickEntryNaturalDate({
  trigger = "typing",
  cleanupTitle = true,
} = {}) {
  const refs = getQuickEntryNaturalDateElements();
  if (!refs) return null;
  const startingTitle = refs.titleInput.value;
  const textSignature = normalizeQuickEntryTextSignature(startingTitle);

  if (!startingTitle.trim()) {
    state.quickEntryNaturalDateState.lastDetected = null;
    clearQuickEntryNaturalSuggestionPreview();
    if (state.quickEntryNaturalDateState.dueSource !== "natural") {
      state.quickEntryNaturalDateState.appliedPreview = null;
    }
    renderQuickEntryNaturalDueChip();
    return null;
  }

  const parseSeq = ++state.quickEntryNaturalDateState.parseSeq;
  const chronoModule = await loadChronoNaturalDateModule();
  if (parseSeq !== state.quickEntryNaturalDateState.parseSeq) return null;

  const refsAfterLoad = getQuickEntryNaturalDateElements();
  if (!refsAfterLoad) return null;
  if (refsAfterLoad.titleInput.value !== startingTitle) return null;

  const detection = parseQuickEntryNaturalDue(startingTitle, chronoModule);
  state.quickEntryNaturalDateState.lastDetected = detection;

  if (!detection) {
    clearQuickEntryNaturalSuggestionPreview();
    renderQuickEntryNaturalDueChip();
    return detection;
  }
  if (detection.isPast) {
    clearQuickEntryNaturalSuggestionPreview();
    // Show a brief "past date ignored" hint instead of silent rejection
    const chipRow =
      document.getElementById("inlineQuickAddChipRow") ||
      document.getElementById("quickEntryNaturalDateChipRow");
    if (chipRow instanceof HTMLElement) {
      chipRow.textContent = "";
      const hint = document.createElement("span");
      hint.className = "natural-date-chip natural-date-chip--muted";
      hint.textContent = "Past date ignored";
      chipRow.appendChild(hint);
      setTimeout(() => {
        if (hint.isConnected) hint.remove();
      }, 3000);
    }
    renderQuickEntryNaturalDueChip();
    return detection;
  }

  const hasDueValue = !!refsAfterLoad.dueDateInput.value;
  const manualDueSet =
    hasDueValue && state.quickEntryNaturalDateState.dueSource === "manual";
  const suppressedAutoApply = shouldSuppressQuickEntryNaturalAutoApply(
    textSignature,
    detection.detectedSignature,
  );

  if (!hasDueValue && !suppressedAutoApply) {
    applyQuickEntryNaturalDueDetection(detection, {
      cleanupTitle: cleanupTitle && trigger !== "suggestion-apply",
    });
    return detection;
  }

  if (manualDueSet || (!hasDueValue && suppressedAutoApply)) {
    state.quickEntryNaturalDateState.suggestionPreview = {
      ...detection,
    };
  } else {
    clearQuickEntryNaturalSuggestionPreview();
  }
  renderQuickEntryNaturalDueChip();
  return detection;
}

export function scheduleQuickEntryNaturalDateParse() {
  if (state.quickEntryNaturalDateState.parseTimer) {
    clearTimeout(state.quickEntryNaturalDateState.parseTimer);
  }
  state.quickEntryNaturalDateState.parseTimer = setTimeout(() => {
    state.quickEntryNaturalDateState.parseTimer = null;
    processQuickEntryNaturalDate({ trigger: "typing", cleanupTitle: true });
  }, QUICK_ENTRY_NATURAL_DATE_DEBOUNCE_MS);
}

export function onQuickEntryTitleInputForNaturalDate() {
  if (state.quickEntryNaturalDateState.suppressNextTitleInputParse) {
    state.quickEntryNaturalDateState.suppressNextTitleInputParse = false;
    renderQuickEntryNaturalDueChip();
    return;
  }
  const refs = getQuickEntryNaturalDateElements();
  if (!refs) return;
  const nextSignature = normalizeQuickEntryTextSignature(refs.titleInput.value);
  if (
    state.quickEntryNaturalDateState.lastSuppressedTextSignature !==
    nextSignature
  ) {
    state.quickEntryNaturalDateState.lastSuppressedTextSignature = "";
    state.quickEntryNaturalDateState.lastSuppressedDetectedSignature = "";
  }
  if (state.quickEntryNaturalDateState.dueSource !== "natural") {
    state.quickEntryNaturalDateState.appliedPreview = null;
  }
  scheduleQuickEntryNaturalDateParse();
}

export function onQuickEntryDueInputChangedByUser() {
  const refs = getQuickEntryNaturalDateElements();
  if (!refs) return;
  if (state.quickEntryNaturalDateState.dueInputProgrammatic) return;
  if (refs.dueDateInput.value) {
    state.quickEntryNaturalDateState.dueSource = "manual";
    state.quickEntryNaturalDateState.appliedPreview = null;
  } else {
    state.quickEntryNaturalDateState.dueSource = "none";
    state.quickEntryNaturalDateState.appliedPreview = null;
  }
  renderQuickEntryNaturalDueChip();
}

export function handleQuickEntryNaturalDueChipClick(action) {
  const refs = getQuickEntryNaturalDateElements();
  if (!refs) return;
  if (action === "clear") {
    const textSignature = normalizeQuickEntryTextSignature(
      refs.titleInput.value,
    );
    const detectedSignature =
      state.quickEntryNaturalDateState.appliedPreview?.detectedSignature ||
      state.quickEntryNaturalDateState.lastDetected?.detectedSignature ||
      "";
    state.quickEntryNaturalDateState.lastSuppressedTextSignature =
      textSignature;
    state.quickEntryNaturalDateState.lastSuppressedDetectedSignature =
      detectedSignature;
    state.quickEntryNaturalDateState.appliedPreview = null;
    state.quickEntryNaturalDateState.dueSource = "none";
    setQuickEntryDueInputValue("");
    if (
      state.quickEntryNaturalDateState.lastDetected &&
      !state.quickEntryNaturalDateState.lastDetected.isPast
    ) {
      state.quickEntryNaturalDateState.suggestionPreview = {
        ...state.quickEntryNaturalDateState.lastDetected,
      };
    }
    renderQuickEntryNaturalDueChip();
    return;
  }

  if (
    action === "apply" &&
    state.quickEntryNaturalDateState.suggestionPreview
  ) {
    applyQuickEntryNaturalDueDetection(
      state.quickEntryNaturalDateState.suggestionPreview,
      {
        cleanupTitle: true,
      },
    );
  }
}

export function bindQuickEntryNaturalDateHandlers() {
  if (window.__quickEntryNaturalDateHandlersBound) return;
  window.__quickEntryNaturalDateHandlersBound = true;

  const refs = getQuickEntryNaturalDateElements();
  if (!refs) return;

  refs.titleInput.addEventListener(
    "input",
    onQuickEntryTitleInputForNaturalDate,
  );
  refs.dueDateInput.addEventListener(
    "input",
    onQuickEntryDueInputChangedByUser,
  );
  refs.dueDateInput.addEventListener(
    "change",
    onQuickEntryDueInputChangedByUser,
  );

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const actionEl = target.closest("[data-natural-due-action]");
    if (!(actionEl instanceof HTMLElement)) return;
    const action = actionEl.getAttribute("data-natural-due-action");
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    handleQuickEntryNaturalDueChipClick(action);
  });
}

export function syncQuickEntryProjectActions() {
  const projectSelect = document.getElementById("todoProjectSelect");
  const createSubprojectButton = document.getElementById(
    "quickEntryCreateSubprojectButton",
  );
  const renameProjectButton = document.getElementById(
    "quickEntryRenameProjectButton",
  );
  const hasProjectSelected =
    projectSelect instanceof HTMLSelectElement && !!projectSelect.value;

  [createSubprojectButton, renameProjectButton].forEach((button) => {
    if (!(button instanceof HTMLElement)) return;
    button.hidden = !hasProjectSelected;
    button.setAttribute("aria-hidden", String(!hasProjectSelected));
  });
}

export function getTaskComposerElements() {
  const sheet = document.getElementById("taskComposerSheet");
  const backdrop = document.getElementById("taskComposerBackdrop");
  const titleInput = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  const dueClearButton = document.getElementById("taskComposerDueClearButton");
  const addButton = document.getElementById("taskComposerAddButton");
  if (!(sheet instanceof HTMLElement)) return null;
  if (!(backdrop instanceof HTMLElement)) return null;
  return {
    sheet,
    backdrop,
    titleInput: titleInput instanceof HTMLInputElement ? titleInput : null,
    projectSelect:
      projectSelect instanceof HTMLSelectElement ? projectSelect : null,
    dueDateInput:
      dueDateInput instanceof HTMLInputElement ? dueDateInput : null,
    dueClearButton:
      dueClearButton instanceof HTMLElement ? dueClearButton : null,
    addButton: addButton instanceof HTMLButtonElement ? addButton : null,
  };
}

export function updateTaskComposerDueClearButton() {
  const refs = getTaskComposerElements();
  if (!refs || !(refs.dueClearButton instanceof HTMLElement)) return;
  const hasDue = !!refs.dueDateInput?.value;
  refs.dueClearButton.hidden = !hasDue;
  refs.dueClearButton.setAttribute("aria-hidden", String(!hasDue));
}

export function inferTaskComposerDefaultProject() {
  if (isHomeWorkspaceActive()) return "";
  if (isUnsortedWorkspaceActive()) return "";
  if (hasHomeListDrilldown()) return "";
  return getSelectedProjectKey();
}

export function openTaskComposer(triggerEl = null) {
  hooks.ensureTodosShellActive?.();
  // In simple mode, focus the inline quick-add instead of the full composer
  if (document.body.classList.contains("simple-mode")) {
    const inlineInput =
      document.getElementById("inlineQuickAddInput") ||
      document.getElementById("todoInput");
    if (inlineInput instanceof HTMLInputElement) {
      inlineInput.focus();
      inlineInput.scrollIntoView({ block: "center" });
      return;
    }
  }
  const refs = getTaskComposerElements();
  if (!refs) return;
  const defaultProject = inferTaskComposerDefaultProject();
  applyUiAction("taskComposer/open", {
    triggerEl,
    defaultProject,
  });
  if (!String(refs.titleInput?.value || "").trim()) {
    setQuickEntryPropertiesOpen(false, { persist: false });
  }
  if (refs.projectSelect && !String(refs.titleInput?.value || "").trim()) {
    refs.projectSelect.value = state.taskComposerDefaultProject || "";
  }
  refs.sheet.classList.add("task-composer-sheet--open");
  refs.sheet.setAttribute("aria-hidden", "false");
  refs.backdrop.classList.add("task-composer-backdrop--open");
  refs.backdrop.setAttribute("aria-hidden", "false");
  hooks.DialogManager?.open("taskComposer", refs.sheet, {
    onEscape: () =>
      closeTaskComposer({ restoreFocus: true, force: true, reset: false }),
  });
  updateTaskComposerDueClearButton();
  window.requestAnimationFrame(() => {
    refs.titleInput?.focus();
  });
}

export function closeTaskComposer({
  restoreFocus = false,
  force = false,
  reset = false,
} = {}) {
  const refs = getTaskComposerElements();
  if (!refs || !state.isTaskComposerOpen) return false;
  const hasDraft = !!String(refs.titleInput?.value || "").trim();
  if (hasDraft && !force) return false;
  const focusTarget = state.lastTaskComposerTrigger;
  applyUiAction("taskComposer/close");
  refs.sheet.classList.remove("task-composer-sheet--open");
  refs.sheet.setAttribute("aria-hidden", "true");
  refs.backdrop.classList.remove("task-composer-backdrop--open");
  refs.backdrop.setAttribute("aria-hidden", "true");
  hooks.DialogManager?.close("taskComposer");
  if (reset) {
    resetTaskComposerFields();
  }
  if (restoreFocus && focusTarget instanceof HTMLElement) {
    focusTarget.focus({ preventScroll: true });
  }
  return true;
}

export function cancelTaskComposer() {
  closeTaskComposer({ restoreFocus: true, force: true, reset: true });
}

export function resetTaskComposerFields() {
  const input = document.getElementById("todoInput");
  const projectSelect = document.getElementById("todoProjectSelect");
  const dueDateInput = document.getElementById("todoDueDateInput");
  const notesInput = document.getElementById("todoNotesInput");
  const notesIcon = document.getElementById("notesExpandIcon");
  const statusSelect = document.getElementById("todoStatusSelect");
  const startDateInput = document.getElementById("todoStartDateInput");
  const scheduledDateInput = document.getElementById("todoScheduledDateInput");
  const reviewDateInput = document.getElementById("todoReviewDateInput");
  const contextInput = document.getElementById("todoContextInput");
  const energySelect = document.getElementById("todoEnergySelect");
  const estimateInput = document.getElementById("todoEstimateInput");
  const tagsInput = document.getElementById("todoTagsInput");
  const waitingOnInput = document.getElementById("todoWaitingOnInput");
  const dependsOnInput = document.getElementById("todoDependsOnInput");
  if (input instanceof HTMLInputElement) input.value = "";
  if (projectSelect instanceof HTMLSelectElement) {
    projectSelect.value = state.taskComposerDefaultProject || "";
  }
  if (dueDateInput instanceof HTMLInputElement) dueDateInput.value = "";
  if (statusSelect instanceof HTMLSelectElement) statusSelect.value = "next";
  if (startDateInput instanceof HTMLInputElement) startDateInput.value = "";
  if (scheduledDateInput instanceof HTMLInputElement)
    scheduledDateInput.value = "";
  if (reviewDateInput instanceof HTMLInputElement) reviewDateInput.value = "";
  if (contextInput instanceof HTMLInputElement) contextInput.value = "";
  if (energySelect instanceof HTMLSelectElement) energySelect.value = "";
  if (estimateInput instanceof HTMLInputElement) estimateInput.value = "";
  if (tagsInput instanceof HTMLInputElement) tagsInput.value = "";
  if (waitingOnInput instanceof HTMLInputElement) waitingOnInput.value = "";
  if (dependsOnInput instanceof HTMLTextAreaElement) dependsOnInput.value = "";
  if (notesInput instanceof HTMLTextAreaElement) {
    notesInput.value = "";
    notesInput.style.display = "none";
  }
  if (notesIcon instanceof HTMLElement) {
    notesIcon.classList.remove("expanded");
  }
  setQuickEntryPropertiesOpen(false, { persist: false });
  hooks.setPriority?.("medium");
  updateTaskComposerDueClearButton();
}

export function clearTaskComposerDueDate() {
  const dueDateInput = document.getElementById("todoDueDateInput");
  if (dueDateInput instanceof HTMLInputElement) {
    dueDateInput.value = "";
    dueDateInput.focus();
  }
  updateTaskComposerDueClearButton();
}

export function bindTaskComposerHandlers() {
  if (window.__taskComposerHandlersBound) return;
  window.__taskComposerHandlersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const backdrop = target.closest("#taskComposerBackdrop");
    if (backdrop && state.isTaskComposerOpen) {
      event.preventDefault();
      closeTaskComposer({ restoreFocus: true });
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.isTaskComposerOpen) return;
    event.preventDefault();
    closeTaskComposer({ restoreFocus: true, force: true });
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "todoDueDateInput") {
      updateTaskComposerDueClearButton();
    }
  });
}
