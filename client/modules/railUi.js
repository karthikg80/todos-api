// =============================================================================
// railUi.js — Projects rail, sidebar navigation, more-filters UI.
// Depends on: store.js, filterLogic.js, projectsState.js, todosService.js.
// Cross-module calls go through hooks (wired by app.js).
// =============================================================================
import { state, hooks } from "./store.js";
import { applyDomainAction, applyUiAction } from "./stateActions.js";
import {
  getSelectedProjectKey,
  getSelectedProjectLabel,
  syncWorkspaceViewState,
  isTodoUnsorted,
  setSelectedProjectKey,
} from "./filterLogic.js";
import {
  buildOpenTodoCountMapByProject,
  getProjectsForRail,
  openProjectEditDrawer,
  closeProjectEditDrawer,
  closeProjectDeleteDialog,
  openProjectCrudModal,
  closeProjectCrudModal,
  confirmDeleteSelectedProject,
  handleProjectDeleteDialogAction,
  submitProjectCrudModal,
  submitProjectEditDrawer,
} from "./projectsState.js";
import { closeTodoDrawer } from "./drawerUi.js";
import { STORAGE_KEYS } from "../utils/storageKeys.js";

const { escapeHtml, PROJECT_PATH_SEPARATOR, MOBILE_DRAWER_MEDIA_QUERY } =
  window.Utils || {};
const { normalizeProjectPath, getProjectLeafName } =
  window.ProjectPathUtils || {};

const SIDEBAR_NAV_ITEMS = [];

function escapeSelectorValue(value) {
  const raw = String(value);
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(raw);
  }
  return raw.replace(/["\\]/g, "\\$&");
}

const AREA_LABELS = {
  home: "Home",
  family: "Family",
  work: "Work",
  finance: "Finance",
  "side-projects": "Side projects",
};

function getAreaLabel(area) {
  if (!area) return null;
  const key = String(area).toLowerCase().trim();
  return AREA_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

function groupProjectsByArea(projects) {
  const AREA_ORDER = ["home", "family", "work", "finance", "side-projects"];

  // Build a lookup: normalised project name → area
  const areaByProject = new Map();
  for (const record of Array.isArray(state.projectRecords)
    ? state.projectRecords
    : []) {
    const name = hooks.normalizeProjectPath?.(record?.name) || "";
    if (name) areaByProject.set(name, record.area || null);
  }

  // Bucket projects into areas
  const buckets = new Map(); // area (string | null) → string[]
  for (const projectName of projects) {
    const area = areaByProject.get(projectName) ?? null;
    if (!buckets.has(area)) buckets.set(area, []);
    buckets.get(area).push(projectName);
  }

  // Build result: known areas first (in AREA_ORDER), then unknown areas
  // alphabetically, then null area last
  const result = [];
  for (const area of AREA_ORDER) {
    if (buckets.has(area)) {
      result.push({
        area,
        label: getAreaLabel(area),
        projects: buckets.get(area),
      });
      buckets.delete(area);
    }
  }
  const unknownAreas = Array.from(buckets.keys())
    .filter((a) => a !== null)
    .sort();
  for (const area of unknownAreas) {
    result.push({
      area,
      label: getAreaLabel(area),
      projects: buckets.get(area),
    });
    buckets.delete(area);
  }
  if (buckets.has(null) && buckets.get(null).length > 0) {
    result.push({ area: null, label: null, projects: buckets.get(null) });
  }
  return result;
}

function renderGroupedProjectsRailHtml({
  groups,
  selectedProject,
  openTodoCountMap = null,
}) {
  return groups
    .map((group) => {
      const rowsHtml = renderProjectsRailListHtml({
        projects: group.projects,
        selectedProject,
        openTodoCountMap,
      });
      if (!group.label) return rowsHtml; // no-area group — no header
      const areaKey = group.area || "";
      const isCollapsed = state.collapsedAreas?.has(areaKey);
      return (
        `<div class="projects-rail-area-group${isCollapsed ? " projects-rail-area-group--collapsed" : ""}" data-area="${escapeHtml(areaKey)}">` +
        `<button type="button" class="projects-rail-area-header" data-area-toggle="${escapeHtml(areaKey)}" aria-expanded="${!isCollapsed}">${escapeHtml(group.label)}</button>` +
        rowsHtml +
        `</div>`
      );
    })
    .join("");
}

// =============================================================================
// Rail host layout
// =============================================================================

export function syncProjectsRailHost() {
  const projectsRail = document.getElementById("projectsRail");
  const projectsRailHost = document.getElementById("projectsRailHost");
  const todosLayout = document.querySelector(".todos-layout");
  if (!(todosLayout instanceof HTMLElement)) return;

  if (!(projectsRail instanceof HTMLElement)) {
    todosLayout.classList.remove("todos-layout--sidebar-mounted");
    return;
  }

  if (
    projectsRailHost instanceof HTMLElement &&
    projectsRail.parentElement !== projectsRailHost
  ) {
    projectsRailHost.appendChild(projectsRail);
  }

  todosLayout.classList.toggle(
    "todos-layout--sidebar-mounted",
    projectsRailHost instanceof HTMLElement &&
      projectsRail.parentElement === projectsRailHost,
  );
}

export function renderSidebarNavigation() {
  const navTargets = document.querySelectorAll("[data-sidebar-nav-target]");
  if (!navTargets.length) return;

  const navMarkup = SIDEBAR_NAV_ITEMS.map(
    ({ view, label }) =>
      `<button type="button" class="projects-rail-item sidebar-nav-item" data-sidebar-view="${escapeHtml(view)}" data-onclick="switchView('${escapeHtml(view)}')">${escapeHtml(label)}</button>`,
  ).join("");

  navTargets.forEach((target) => {
    if (!(target instanceof HTMLElement)) return;
    if (target.innerHTML === navMarkup) return;
    target.innerHTML = navMarkup;
  });
}

export function setSettingsPaneVisible(isVisible) {
  const settingsPane = document.getElementById("settingsPane");
  const todosView = document.getElementById("todosView");
  if (!(settingsPane instanceof HTMLElement)) return;

  settingsPane.hidden = !isVisible;
  if (todosView instanceof HTMLElement) {
    todosView.classList.toggle("todos-view--settings-active", isVisible);
  }
}

export function setFeedbackPaneVisible(isVisible) {
  const feedbackPane = document.getElementById("feedbackPane");
  const todosView = document.getElementById("todosView");
  if (!(feedbackPane instanceof HTMLElement)) return;

  feedbackPane.hidden = !isVisible;
  if (todosView instanceof HTMLElement) {
    todosView.classList.toggle("todos-view--feedback-active", isVisible);
  }
}

export function setAdminPaneVisible(isVisible) {
  const adminPane = document.getElementById("adminPane");
  const todosView = document.getElementById("todosView");
  if (!(adminPane instanceof HTMLElement)) return;

  adminPane.hidden = !isVisible;
  if (todosView instanceof HTMLElement) {
    todosView.classList.toggle("todos-view--admin-active", isVisible);
  }
}

export function setTodosViewBodyState(isTodosView) {
  document.body.classList.toggle("is-todos-view", isTodosView);
  syncProjectsRailHost();
}

// =============================================================================
// Rail collapsed state persistence
// =============================================================================

export function readStoredRailCollapsedState() {
  try {
    return (
      window.localStorage.getItem(STORAGE_KEYS.PROJECTS_RAIL_COLLAPSED) === "1"
    );
  } catch (error) {
    return false;
  }
}

export function persistRailCollapsedState(isCollapsed) {
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.PROJECTS_RAIL_COLLAPSED,
      isCollapsed ? "1" : "0",
    );
  } catch (error) {
    // Ignore storage failures.
  }
}

// =============================================================================
// AI Workspace state persistence (referenced from railUi and aiWorkspace)
// =============================================================================

export function readStoredAiWorkspaceCollapsedState() {
  try {
    const stored = window.localStorage.getItem(
      STORAGE_KEYS.AI_WORKSPACE_COLLAPSED,
    );
    if (stored === null) return true;
    return stored === "1";
  } catch (error) {
    return true;
  }
}

export function readStoredAiWorkspaceVisibleState() {
  const AI_DEBUG_ENABLED = hooks.AI_DEBUG_ENABLED;
  if (AI_DEBUG_ENABLED) return true;
  try {
    const stored = window.localStorage.getItem(
      STORAGE_KEYS.AI_WORKSPACE_VISIBLE,
    );
    if (stored === null) return false;
    return stored === "1";
  } catch (error) {
    return false;
  }
}

export function persistAiWorkspaceCollapsedState(isCollapsed) {
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.AI_WORKSPACE_COLLAPSED,
      isCollapsed ? "1" : "0",
    );
  } catch (error) {
    // Ignore storage failures.
  }
}

export function persistAiWorkspaceVisibleState(isVisible) {
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.AI_WORKSPACE_VISIBLE,
      isVisible ? "1" : "0",
    );
  } catch (error) {
    // Ignore storage failures.
  }
}

// =============================================================================
// Rail element factory
// =============================================================================

export function getProjectsRailElements() {
  const layout = document.querySelector(".todos-layout");
  const desktopRail = document.getElementById("projectsRail");
  const collapseToggle = document.getElementById("projectsRailToggle");
  const railList = document.getElementById("projectsRailList");
  const desktopPrimary = desktopRail?.querySelector(".projects-rail__primary");
  const homeButton = desktopPrimary?.querySelector(
    '.workspace-view-item[data-workspace-view="home"]',
  );
  const unsortedButton = desktopPrimary?.querySelector(
    '.workspace-view-item[data-workspace-view="unsorted"]',
  );
  const allTasksButton = desktopPrimary?.querySelector(
    '.workspace-view-item[data-workspace-view="all"]',
  );
  const mobileOpenButton = document.getElementById("projectsRailMobileOpen");
  const mobileCloseButton = document.getElementById("projectsRailMobileClose");
  const createButton = document.getElementById("projectsRailCreateButton");
  const sheetCreateButton = document.getElementById(
    "projectsRailSheetCreateButton",
  );
  const sheet = document.getElementById("projectsRailSheet");
  const sheetList =
    document.getElementById("projectsRailSheetList") ||
    sheet?.querySelector(".projects-rail__section .projects-rail__list");
  const sheetAllTasksButton = sheet?.querySelector(
    '.projects-rail__primary .workspace-view-item[data-workspace-view="all"]',
  );
  const sheetHomeButton = sheet?.querySelector(
    '.projects-rail__primary .workspace-view-item[data-workspace-view="home"]',
  );
  const sheetUnsortedButton = sheet?.querySelector(
    '.projects-rail__primary .workspace-view-item[data-workspace-view="unsorted"]',
  );
  const backdrop = document.getElementById("projectsRailBackdrop");

  if (!(desktopRail instanceof HTMLElement)) return null;
  if (!(collapseToggle instanceof HTMLElement)) return null;
  if (!(railList instanceof HTMLElement)) return null;
  if (!(allTasksButton instanceof HTMLElement)) return null;
  if (!(homeButton instanceof HTMLElement)) return null;
  if (!(unsortedButton instanceof HTMLElement)) return null;
  if (!(mobileOpenButton instanceof HTMLElement)) return null;
  if (!(mobileCloseButton instanceof HTMLElement)) return null;
  if (!(sheetCreateButton instanceof HTMLElement)) return null;
  if (!(sheet instanceof HTMLElement)) return null;
  if (!(sheetList instanceof HTMLElement)) return null;
  if (!(sheetAllTasksButton instanceof HTMLElement)) return null;
  if (!(sheetHomeButton instanceof HTMLElement)) return null;
  if (!(sheetUnsortedButton instanceof HTMLElement)) return null;
  if (!(backdrop instanceof HTMLElement)) return null;

  return {
    layout,
    desktopRail,
    collapseToggle,
    railList,
    homeButton,
    unsortedButton,
    allTasksButton,
    mobileOpenButton,
    mobileCloseButton,
    createButton,
    sheetCreateButton,
    sheet,
    sheetList,
    sheetHomeButton,
    sheetUnsortedButton,
    sheetAllTasksButton,
    backdrop,
  };
}

export function openProjectsFromCollapsedRail(triggerEl = null) {
  if (!state.isRailCollapsed) return;
  setProjectsRailCollapsed(false);
  window.requestAnimationFrame(() => {
    const refs = getProjectsRailElements();
    if (!refs) return;
    const selected = refs.desktopRail.querySelector(
      `.projects-rail-item[data-project-key="${escapeSelectorValue(getSelectedProjectKey())}"]`,
    );
    const firstProject = refs.desktopRail.querySelector(
      ".projects-rail-item[data-project-key]",
    );
    const fallbackTarget =
      (selected instanceof HTMLElement && selected) ||
      (firstProject instanceof HTMLElement && firstProject) ||
      refs.createButton;

    if (fallbackTarget instanceof HTMLElement) {
      fallbackTarget.focus({ preventScroll: true });
      return;
    }

    if (triggerEl instanceof HTMLElement) {
      triggerEl.focus({ preventScroll: true });
    }
  });
}

export function isMobileRailViewport() {
  if (typeof hooks.isMobileViewport === "function") {
    return hooks.isMobileViewport();
  }
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(MOBILE_DRAWER_MEDIA_QUERY).matches;
}

function getRailPresentationMode() {
  if (typeof hooks.getRailPresentationMode === "function") {
    return hooks.getRailPresentationMode();
  }
  return isMobileRailViewport() ? "sheet" : "sidebar";
}

export function getProjectTodoCount(projectName) {
  if (!projectName) return state.todos.filter((todo) => !todo.completed).length;
  return state.todos.filter((todo) => {
    if (todo.completed) return false;
    const todoProject = normalizeProjectPath(todo.category);
    if (!todoProject) return false;
    return (
      todoProject === projectName ||
      todoProject.startsWith(`${projectName}${PROJECT_PATH_SEPARATOR}`)
    );
  }).length;
}

export function updateTopbarProjectsButton(selectedProjectName = "All tasks") {
  const refs = getProjectsRailElements();
  if (!refs) return;

  const topbarLabel = document.getElementById("projectsRailTopbarLabel");
  const topbar = document.querySelector("#todosView .todos-top-bar");
  const railPresentationMode = getRailPresentationMode();
  const shouldShow = railPresentationMode === "sheet" || state.isRailCollapsed;

  if (topbar instanceof HTMLElement) {
    topbar.hidden = !shouldShow;
  }

  refs.mobileOpenButton.classList.toggle(
    "projects-rail-mobile-open--show",
    shouldShow,
  );
  refs.mobileOpenButton.setAttribute(
    "aria-expanded",
    String(
      railPresentationMode === "sheet"
        ? state.isRailSheetOpen
        : !state.isRailCollapsed,
    ),
  );
  if (shouldShow) {
    refs.mobileOpenButton.removeAttribute("aria-hidden");
    refs.mobileOpenButton.removeAttribute("tabindex");
  } else {
    refs.mobileOpenButton.setAttribute("aria-hidden", "true");
    refs.mobileOpenButton.setAttribute("tabindex", "-1");
  }

  if (topbarLabel instanceof HTMLElement) {
    const label = selectedProjectName || "All tasks";
    topbarLabel.textContent = `Projects: ${label}`;
    topbarLabel.setAttribute("title", `Projects: ${label}`);
  }

  const mobileTitle = document.getElementById("todosMobileTitle");
  if (mobileTitle instanceof HTMLElement) {
    mobileTitle.textContent = selectedProjectName || "Home";
  }
}

// =============================================================================
// Rail list rendering and A11y
// =============================================================================

export function renderProjectsRailListHtml({
  projects,
  selectedProject,
  openTodoCountMap = null,
}) {
  return projects
    .map((projectName) =>
      renderProjectsRailRowHtml(projectName, {
        selectedProject,
        count:
          openTodoCountMap instanceof Map
            ? openTodoCountMap.get(projectName) || 0
            : getProjectTodoCount(projectName),
      }),
    )
    .join("");
}

function renderProjectsRailRowHtml(
  projectName,
  { selectedProject = "", count = 0 } = {},
) {
  const isActive = projectName === selectedProject;
  const svgIcon =
    '<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  const leafName = getProjectLeafName(projectName);
  return (
    `<div class="projects-rail-row">` +
    `<button type="button" class="projects-rail-item${isActive ? " projects-rail-item--active" : ""}" data-project-key="${escapeHtml(projectName)}"${isActive ? ' aria-current="page"' : ""}>` +
    svgIcon +
    `<span class="projects-rail-item__label" title="${escapeHtml(leafName)}">${escapeHtml(leafName)}</span>` +
    `<span class="projects-rail-item__count"${count === 0 ? " hidden" : ""}>${count}</span>` +
    `</button></div>`
  );
}

function createProjectsRailRowElement(
  projectName,
  { selectedProject = "", count = 0 } = {},
) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderProjectsRailRowHtml(projectName, {
    selectedProject,
    count,
  }).trim();
  return wrapper.firstElementChild instanceof HTMLElement
    ? wrapper.firstElementChild
    : null;
}

function patchProjectsRailRowElement(
  row,
  projectName,
  { selectedProject = "", count = 0 } = {},
) {
  if (!(row instanceof HTMLElement)) return;
  const button = row.querySelector(".projects-rail-item[data-project-key]");
  if (!(button instanceof HTMLButtonElement)) return;

  const isActive = projectName === selectedProject;
  const leafName = getProjectLeafName(projectName);
  const label = row.querySelector(".projects-rail-item__label");
  const countEl = row.querySelector(".projects-rail-item__count");

  button.setAttribute("type", "button");
  button.setAttribute("data-project-key", projectName);
  button.classList.toggle("projects-rail-item--active", isActive);
  if (isActive) {
    button.setAttribute("aria-current", "page");
  } else {
    button.removeAttribute("aria-current");
  }

  if (label instanceof HTMLElement) {
    label.textContent = leafName;
    label.setAttribute("title", leafName);
  }
  if (countEl instanceof HTMLElement) {
    countEl.textContent = String(count);
    countEl.hidden = count === 0;
  }
}

function reconcileProjectsRailList(
  root,
  { projects, selectedProject, openTodoCountMap = null } = {},
) {
  if (!(root instanceof HTMLElement)) return;

  const existingRowsByProject = new Map();
  root.querySelectorAll(".projects-rail-row").forEach((row) => {
    if (!(row instanceof HTMLElement)) return;
    const button = row.querySelector(".projects-rail-item[data-project-key]");
    if (!(button instanceof HTMLElement)) return;
    existingRowsByProject.set(
      button.getAttribute("data-project-key") || "",
      row,
    );
  });

  let insertionPoint = root.firstElementChild;
  const desiredKeys = new Set(projects);

  projects.forEach((projectName) => {
    const count =
      openTodoCountMap instanceof Map
        ? openTodoCountMap.get(projectName) || 0
        : getProjectTodoCount(projectName);
    let row = existingRowsByProject.get(projectName) || null;
    if (!(row instanceof HTMLElement)) {
      row = createProjectsRailRowElement(projectName, {
        selectedProject,
        count,
      });
    }
    if (!(row instanceof HTMLElement)) return;

    patchProjectsRailRowElement(row, projectName, {
      selectedProject,
      count,
    });

    if (row !== insertionPoint) {
      root.insertBefore(row, insertionPoint);
    }
    insertionPoint = row.nextElementSibling;
  });

  existingRowsByProject.forEach((row, projectKey) => {
    if (desiredKeys.has(projectKey)) return;
    row.remove();
  });
}

function syncDesktopProjectsRailList(
  root,
  { projects, selectedProject, openTodoCountMap = null } = {},
) {
  if (!(root instanceof HTMLElement)) return;

  const shouldRenderDesktopProjects = !state.isRailCollapsed;
  root.hidden = !shouldRenderDesktopProjects;
  root.setAttribute("aria-hidden", String(!shouldRenderDesktopProjects));

  if (!shouldRenderDesktopProjects) {
    if (root.firstElementChild) {
      root.replaceChildren();
    }
    return;
  }

  const groups = groupProjectsByArea(projects);
  const hasMultipleAreas = groups.filter((g) => g.label !== null).length > 1;

  if (hasMultipleAreas) {
    // All user content in nextHtml is escaped via escapeHtml — safe assignment.
    const nextHtml = renderGroupedProjectsRailHtml({
      groups,
      selectedProject,
      openTodoCountMap,
    });
    if (root.innerHTML !== nextHtml) {
      root.innerHTML = nextHtml; // eslint-disable-line no-unsanitized/property
    }
  } else {
    reconcileProjectsRailList(root, {
      projects,
      selectedProject,
      openTodoCountMap,
    });
  }
}

export function getRailOptionElements(root) {
  return Array.from(
    root.querySelectorAll(".projects-rail-item[data-project-key]"),
  ).filter((button) => button instanceof HTMLElement);
}

export function getCurrentRailFocusKey(root) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!root.contains(active)) return null;

  const focusedOption = active.closest(".projects-rail-item[data-project-key]");
  if (!(focusedOption instanceof HTMLElement)) return null;
  return focusedOption.getAttribute("data-project-key") || "";
}

export function moveRailOptionFocus(root, delta) {
  const options = getRailOptionElements(root);
  if (options.length === 0) return;

  const focusedKey = getCurrentRailFocusKey(root);
  const currentKey =
    focusedKey !== null
      ? focusedKey
      : state.railRovingFocusKey || getSelectedProjectKey();
  const currentIndex = options.findIndex(
    (button) => (button.getAttribute("data-project-key") || "") === currentKey,
  );
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (baseIndex + delta + options.length) % options.length;
  const nextOption = options[nextIndex];
  if (!(nextOption instanceof HTMLElement)) return;

  state.railRovingFocusKey = nextOption.getAttribute("data-project-key") || "";
  options.forEach((button, index) => {
    button.setAttribute("tabindex", index === nextIndex ? "0" : "-1");
  });
  nextOption.focus({ preventScroll: true });
}

export function syncRailA11yState(root, selectedProject, focusKey = "") {
  root.setAttribute("role", "listbox");
  root.setAttribute("aria-label", "Projects");

  const options = getRailOptionElements(root);
  const fallbackFocusKey =
    focusKey ||
    selectedProject ||
    options[0]?.getAttribute("data-project-key") ||
    "";

  options.forEach((button) => {
    const projectName = button.getAttribute("data-project-key") || "";
    const isActive = projectName === selectedProject;
    const isFocusTarget = projectName === fallbackFocusKey;

    button.classList.toggle("projects-rail-item--active", isActive);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(isActive));
    button.setAttribute("tabindex", isFocusTarget ? "0" : "-1");

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });
}

export function focusActiveProjectItem({ preferSheet = false } = {}) {
  const refs = getProjectsRailElements();
  if (!refs) return;
  const root = preferSheet ? refs.sheet : refs.desktopRail;
  const selectedProject = getSelectedProjectKey();
  const activeWorkspaceItem = root.querySelector(
    ".workspace-view-item.projects-rail-item--active",
  );
  const optionSelector = `.projects-rail-item[data-project-key="${escapeSelectorValue(selectedProject)}"]`;
  const activeItem =
    activeWorkspaceItem ||
    root.querySelector(optionSelector) ||
    root.querySelector('.projects-rail-item[data-project-key=""]') ||
    root.querySelector('.projects-rail-item[aria-current="page"]') ||
    root.querySelector(".projects-rail-item[data-project-key]");
  if (activeItem instanceof HTMLElement) {
    state.railRovingFocusKey =
      activeItem.getAttribute("data-project-key") || "";
    activeItem.focus();
  }
}

export function openProjectsFromTopbar(triggerEl = null) {
  if (isMobileRailViewport()) {
    openProjectsRailSheet(triggerEl);
    return;
  }

  if (state.isRailCollapsed) {
    setProjectsRailCollapsed(false);
  }

  const refs = getProjectsRailElements();
  if (triggerEl instanceof HTMLElement && refs) {
    state.lastFocusedRailTrigger = triggerEl;
  }
  window.requestAnimationFrame(() => {
    focusActiveProjectItem({ preferSheet: false });
  });
}

export function setProjectsRailActiveState(selectedProject) {
  const refs = getProjectsRailElements();
  if (!refs) return;

  const desktopFocusKey =
    getCurrentRailFocusKey(refs.desktopRail) ||
    state.railRovingFocusKey ||
    selectedProject;
  const sheetFocusKey =
    getCurrentRailFocusKey(refs.sheet) ||
    state.railRovingFocusKey ||
    selectedProject;

  syncRailA11yState(refs.desktopRail, selectedProject, desktopFocusKey);
  syncRailA11yState(refs.sheet, selectedProject, sheetFocusKey);
}

export function renderProjectsRail() {
  const refs = getProjectsRailElements();
  if (!refs) return;

  if (state.isRailSheetOpen && !isMobileRailViewport()) {
    closeProjectsRailSheet({ restoreFocus: false });
  }

  const selectedProject = getSelectedProjectKey();
  const allCount = state.todos.filter((t) => !t.completed).length;
  const unsortedCount = state.todos.filter((todo) =>
    isTodoUnsorted(todo),
  ).length;
  const openTodoCountMap = buildOpenTodoCountMapByProject();
  const projects = getProjectsForRail(openTodoCountMap);
  if (
    state.openRailProjectMenuKey &&
    !projects.includes(state.openRailProjectMenuKey)
  ) {
    state.openRailProjectMenuKey = null;
  }

  syncDesktopProjectsRailList(refs.railList, {
    projects,
    selectedProject,
    openTodoCountMap,
  });
  const sheetGroups = groupProjectsByArea(projects);
  const sheetHasMultipleAreas =
    sheetGroups.filter((g) => g.label !== null).length > 1;
  if (sheetHasMultipleAreas) {
    // All user content in nextHtml is escaped via escapeHtml — safe assignment.
    const nextHtml = renderGroupedProjectsRailHtml({
      groups: sheetGroups,
      selectedProject,
      openTodoCountMap,
    });
    if (refs.sheetList.innerHTML !== nextHtml) {
      refs.sheetList.innerHTML = nextHtml; // eslint-disable-line no-unsanitized/property
    }
  } else {
    reconcileProjectsRailList(refs.sheetList, {
      projects,
      selectedProject,
      openTodoCountMap,
    });
  }

  const desktopAllCount = refs.allTasksButton.querySelector(
    ".projects-rail-item__count",
  );
  const desktopUnsortedCount = refs.unsortedButton.querySelector(
    ".projects-rail-item__count",
  );
  if (desktopAllCount instanceof HTMLElement) {
    desktopAllCount.textContent = String(allCount);
    desktopAllCount.hidden = allCount === 0;
  }
  if (desktopUnsortedCount instanceof HTMLElement) {
    desktopUnsortedCount.textContent = String(unsortedCount);
    desktopUnsortedCount.hidden = unsortedCount === 0;
  }
  const sheetAllCount = refs.sheetAllTasksButton.querySelector(
    ".projects-rail-item__count",
  );
  const sheetUnsortedCount = refs.sheetUnsortedButton.querySelector(
    ".projects-rail-item__count",
  );
  if (sheetAllCount instanceof HTMLElement) {
    sheetAllCount.textContent = String(allCount);
    sheetAllCount.hidden = allCount === 0;
  }
  if (sheetUnsortedCount instanceof HTMLElement) {
    sheetUnsortedCount.textContent = String(unsortedCount);
    sheetUnsortedCount.hidden = unsortedCount === 0;
  }

  refs.allTasksButton.setAttribute("data-project-key", "");
  refs.allTasksButton.setAttribute("type", "button");
  refs.sheetAllTasksButton.setAttribute("data-project-key", "");
  refs.sheetAllTasksButton.setAttribute("type", "button");
  refs.sheetAllTasksButton.classList.add("projects-rail-item");
  refs.sheetAllTasksButton.setAttribute("title", "All tasks");

  if (!state.railRovingFocusKey) {
    state.railRovingFocusKey = selectedProject || "";
  }
  setProjectsRailActiveState(selectedProject);
  syncWorkspaceViewState();
  setProjectsRailCollapsed(state.isRailCollapsed, {
    persist: false,
    focusOnExpand: false,
    projects,
    selectedProject,
    openTodoCountMap,
  });
}

export function patchProjectsRailView() {
  renderProjectsRail();
}

export function setProjectsRailCollapsed(
  nextCollapsed,
  {
    persist = true,
    focusOnExpand = true,
    projects = null,
    selectedProject = getSelectedProjectKey(),
    openTodoCountMap = null,
  } = {},
) {
  const wasCollapsed = state.isRailCollapsed;
  applyUiAction("rail/collapsed:set", { collapsed: nextCollapsed });
  if (persist) {
    persistRailCollapsedState(state.isRailCollapsed);
  }
  document.body.classList.toggle(
    "is-projects-rail-collapsed",
    state.isRailCollapsed,
  );
  const refs = getProjectsRailElements();
  if (!refs) return;

  refs.desktopRail.classList.toggle(
    "projects-rail--collapsed",
    state.isRailCollapsed,
  );
  refs.layout?.classList.toggle(
    "todos-layout--rail-collapsed",
    state.isRailCollapsed,
  );
  refs.collapseToggle.setAttribute(
    "aria-expanded",
    String(!state.isRailCollapsed),
  );
  refs.collapseToggle.setAttribute(
    "aria-label",
    state.isRailCollapsed ? "Expand sidebar" : "Collapse sidebar",
  );
  const nextOpenTodoCountMap =
    openTodoCountMap instanceof Map
      ? openTodoCountMap
      : buildOpenTodoCountMapByProject();
  const nextProjects = Array.isArray(projects)
    ? projects
    : getProjectsForRail(nextOpenTodoCountMap);
  syncDesktopProjectsRailList(refs.railList, {
    projects: nextProjects,
    selectedProject,
    openTodoCountMap: nextOpenTodoCountMap,
  });
  updateTopbarProjectsButton(getSelectedProjectLabel(selectedProject));

  if (
    focusOnExpand &&
    wasCollapsed &&
    !state.isRailCollapsed &&
    !isMobileRailViewport()
  ) {
    window.requestAnimationFrame(() => {
      focusActiveProjectItem({ preferSheet: false });
    });
  }
}

export function closeRailProjectMenu({ restoreFocus = false } = {}) {
  const previousKey = state.openRailProjectMenuKey;
  state.openRailProjectMenuKey = null;
  renderProjectsRail();

  if (restoreFocus && previousKey) {
    const toggle = document.querySelector(
      `.projects-rail-kebab[data-project-menu-toggle="${escapeSelectorValue(previousKey)}"]`,
    );
    if (toggle instanceof HTMLElement) {
      toggle.focus({ preventScroll: true });
    }
  }
}

export function toggleRailProjectMenu(projectName, triggerEl = null) {
  if (!projectName) return;
  const willOpen = state.openRailProjectMenuKey !== projectName;
  state.openRailProjectMenuKey = willOpen ? projectName : null;
  renderProjectsRail();
  if (!willOpen) return;

  window.requestAnimationFrame(() => {
    const firstAction = document.querySelector(
      `.projects-rail-menu-item[data-project-key="${escapeSelectorValue(projectName)}"]`,
    );
    if (firstAction instanceof HTMLElement) {
      firstAction.focus();
      return;
    }
    if (triggerEl instanceof HTMLElement) {
      triggerEl.focus();
    }
  });
}

export function lockBodyScrollForProjectsRail() {
  if (state.isRailBodyLocked || state.isDrawerBodyLocked) return;
  const body = document.body;
  state.railScrollLockY = window.scrollY || 0;
  body.classList.add("is-projects-rail-open");
  body.style.position = "fixed";
  body.style.top = `-${state.railScrollLockY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  state.isRailBodyLocked = true;
}

export function unlockBodyScrollForProjectsRail() {
  if (!state.isRailBodyLocked || state.isDrawerBodyLocked) return;
  const body = document.body;
  body.classList.remove("is-projects-rail-open");
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  window.scrollTo(0, state.railScrollLockY);
  state.railScrollLockY = 0;
  state.isRailBodyLocked = false;
}

export function openProjectsRailSheet(triggerEl = null) {
  const refs = getProjectsRailElements();
  if (!refs || state.isRailSheetOpen || !isMobileRailViewport()) return;

  closeRailProjectMenu();
  applyUiAction("railSheet/open", {
    triggerEl:
      triggerEl instanceof HTMLElement ? triggerEl : refs.mobileOpenButton,
  });
  refs.sheet.classList.add("projects-rail-sheet--open");
  refs.sheet.setAttribute("aria-hidden", "false");
  refs.backdrop.classList.add("projects-rail-backdrop--open");
  refs.backdrop.setAttribute("aria-hidden", "false");
  refs.mobileOpenButton.setAttribute("aria-expanded", "true");

  lockBodyScrollForProjectsRail();
  hooks.DialogManager?.open("railSheet", refs.sheet, {
    onEscape: () => {
      if (state.openRailProjectMenuKey) {
        closeRailProjectMenu({ restoreFocus: true });
        return;
      }
      closeProjectsRailSheet({ restoreFocus: true });
    },
    backdrop: false,
  });
  window.requestAnimationFrame(() => {
    focusActiveProjectItem({ preferSheet: true });
  });
}

export function closeProjectsRailSheet({ restoreFocus = false } = {}) {
  const refs = getProjectsRailElements();
  if (!refs || !state.isRailSheetOpen) return;
  const focusRestoreTarget = state.lastFocusedRailTrigger;

  closeRailProjectMenu();
  applyUiAction("railSheet/close");
  refs.sheet.classList.remove("projects-rail-sheet--open");
  refs.sheet.setAttribute("aria-hidden", "true");
  refs.backdrop.classList.remove("projects-rail-backdrop--open");
  refs.backdrop.setAttribute("aria-hidden", "true");
  refs.mobileOpenButton.setAttribute("aria-expanded", "false");

  unlockBodyScrollForProjectsRail();
  hooks.DialogManager?.close("railSheet");
  const selectedProject = getSelectedProjectKey();
  updateTopbarProjectsButton(getSelectedProjectLabel(selectedProject));

  if (restoreFocus) {
    const focusTarget =
      focusRestoreTarget instanceof HTMLElement
        ? focusRestoreTarget
        : refs.mobileOpenButton;
    focusTarget.focus({ preventScroll: true });
  }
}

export function selectProjectFromRail(projectName, triggerEl = null) {
  if (state.openRailProjectMenuKey) {
    state.openRailProjectMenuKey = null;
  }
  if (
    state.isProjectEditDrawerOpen &&
    normalizeProjectPath(projectName) !==
      normalizeProjectPath(state.projectEditTargetProject)
  ) {
    closeProjectEditDrawer({ restoreFocus: false });
  }
  hooks.ensureTodosShellActive?.();
  applyDomainAction("projectSelection:set", { projectName });
  setSelectedProjectKey(projectName);

  if (state.isRailSheetOpen) {
    closeProjectsRailSheet({
      restoreFocus: !(triggerEl instanceof HTMLElement),
    });
  }
}

// =============================================================================
// More filters panel
// =============================================================================

export function getMoreFiltersElements() {
  const toggle = document.getElementById("moreFiltersToggle");
  const panel = document.getElementById("moreFiltersPanel");
  if (!toggle || !panel) {
    return null;
  }
  return { toggle, panel };
}

export function getFirstFocusableInMoreFilters(panel) {
  return panel.querySelector(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
  );
}

export function openMoreFilters() {
  const refs = getMoreFiltersElements();
  if (!refs) return;

  const { toggle, panel } = refs;
  toggle.removeAttribute("hidden");
  applyUiAction("moreFilters:set", { isOpen: true });
  panel.classList.add("more-filters--open");
  toggle.setAttribute("aria-expanded", "true");

  const firstFocusable = getFirstFocusableInMoreFilters(panel);
  if (firstFocusable instanceof HTMLElement) {
    firstFocusable.focus();
  }
}

export function closeMoreFilters({ restoreFocus = false } = {}) {
  const refs = getMoreFiltersElements();
  if (!refs) return;

  const { toggle, panel } = refs;
  applyUiAction("moreFilters:set", { isOpen: false });
  panel.classList.remove("more-filters--open");
  toggle.setAttribute("aria-expanded", "false");

  if (restoreFocus) {
    toggle.focus();
  }

  // When restoreFocus=true the searchInput.blur handler will hide the toggle
  // naturally once focus moves out of the search/filter area.
  if (!restoreFocus) {
    const searchInput = document.getElementById("searchInput");
    if (document.activeElement !== searchInput) {
      toggle.setAttribute("hidden", "");
    }
  }
}

export function toggleMoreFilters() {
  if (state.isMoreFiltersOpen) {
    closeMoreFilters();
    return;
  }
  openMoreFilters();
}

// Syncs the mobile rail-sheet search proxy input to the canonical #searchInput.
export function syncSheetSearch() {
  const sheetInput = document.getElementById("searchInputSheet");
  const mainInput = document.getElementById("searchInput");
  if (sheetInput && mainInput) {
    mainInput.value = sheetInput.value;
    hooks.applyFiltersAndRender?.();
  }
}

// Reveals #moreFiltersToggle on search focus; re-hides it on blur when filters
// are closed and focus has moved outside the search/filter area.
export function bindRailSearchFocusBehavior() {
  const searchInput = document.getElementById("searchInput");
  const moreFiltersToggle = document.getElementById("moreFiltersToggle");
  if (!searchInput || !moreFiltersToggle) return;

  const shouldHideToggle = () => {
    if (state.isMoreFiltersOpen) return false;
    const active = document.activeElement;
    if (active === searchInput) return false;
    if (active === moreFiltersToggle) return false;
    const panel = document.getElementById("moreFiltersPanel");
    if (panel?.contains(active)) return false;
    return true;
  };

  searchInput.addEventListener("focus", () => {
    moreFiltersToggle.removeAttribute("hidden");
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      if (shouldHideToggle()) moreFiltersToggle.setAttribute("hidden", "");
    }, 150);
  });
}

// =============================================================================
// Sidebar navigation
// =============================================================================

export function syncSidebarNavState(activeView) {
  const normalizedView = activeView === "profile" ? "settings" : activeView;
  document
    .querySelectorAll(".sidebar-nav-item[data-sidebar-view]")
    .forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const isActive = el.getAttribute("data-sidebar-view") === normalizedView;
      el.classList.toggle("projects-rail-item--active", isActive);
    });
}

// =============================================================================
// Rail event handlers
// =============================================================================

export function bindProjectsRailHandlers() {
  if (window.__projectsRailHandlersBound) {
    return;
  }
  window.__projectsRailHandlersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const workspaceViewButton = target.closest(
      ".workspace-view-item[data-workspace-view]",
    );
    if (workspaceViewButton instanceof HTMLElement) {
      const view = workspaceViewButton.getAttribute("data-workspace-view");
      event.preventDefault();
      event.stopPropagation();
      hooks.selectWorkspaceView?.(view, workspaceViewButton);
      return;
    }

    const areaToggle = target.closest("[data-area-toggle]");
    if (areaToggle instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      const areaKey = areaToggle.getAttribute("data-area-toggle") || "";
      if (state.collapsedAreas.has(areaKey)) {
        state.collapsedAreas.delete(areaKey);
      } else {
        state.collapsedAreas.add(areaKey);
      }
      const group = areaToggle.closest(".projects-rail-area-group");
      if (group instanceof HTMLElement) {
        group.classList.toggle("projects-rail-area-group--collapsed");
        areaToggle.setAttribute(
          "aria-expanded",
          String(!state.collapsedAreas.has(areaKey)),
        );
      }
      return;
    }

    const collapsedProjectsButton = target.closest(
      "#projectsRailCollapsedProjectsButton",
    );
    if (collapsedProjectsButton instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      openProjectsFromCollapsedRail(collapsedProjectsButton);
      return;
    }

    const projectButton = target.closest(
      ".projects-rail-item[data-project-key]",
    );
    if (projectButton instanceof HTMLElement) {
      const projectName = projectButton.getAttribute("data-project-key") || "";
      event.preventDefault();
      event.stopPropagation();
      selectProjectFromRail(projectName, projectButton);
      return;
    }

    const projectActionsButton = target.closest("#projectViewActionsButton");
    if (projectActionsButton instanceof HTMLElement) {
      event.preventDefault();
      event.stopPropagation();
      openProjectEditDrawer(projectActionsButton, getSelectedProjectKey());
      return;
    }

    const createButton = target.closest("#projectsRailCreateButton");
    if (createButton) {
      event.preventDefault();
      event.stopPropagation();
      openProjectCrudModal("create", createButton);
      return;
    }

    const sheetCreateButton = target.closest("#projectsRailSheetCreateButton");
    if (sheetCreateButton) {
      event.preventDefault();
      event.stopPropagation();
      openProjectCrudModal("create", sheetCreateButton);
      return;
    }

    const backdrop = target.closest("#projectsRailBackdrop");
    if (backdrop && state.isRailSheetOpen) {
      event.preventDefault();
      closeProjectsRailSheet({ restoreFocus: true });
      return;
    }

    const mobileClose = target.closest("#projectsRailMobileClose");
    if (mobileClose && state.isRailSheetOpen) {
      event.preventDefault();
      closeProjectsRailSheet({ restoreFocus: true });
      return;
    }

    const modalOverlay = target.closest("#projectCrudModal");
    if (
      modalOverlay &&
      target instanceof HTMLElement &&
      target.id === "projectCrudModal"
    ) {
      event.preventDefault();
      closeProjectCrudModal();
      return;
    }

    const modalCancel = target.closest("#projectCrudCancelButton");
    if (modalCancel && state.isProjectCrudModalOpen) {
      event.preventDefault();
      closeProjectCrudModal();
      return;
    }

    const projectDrawerClose = target.closest("#projectEditDrawerClose");
    if (projectDrawerClose && state.isProjectEditDrawerOpen) {
      event.preventDefault();
      if (state.isProjectDeletePending) return;
      closeProjectEditDrawer({ restoreFocus: true });
      return;
    }

    const projectDrawerCancel = target.closest("#projectEditCancelButton");
    if (projectDrawerCancel && state.isProjectEditDrawerOpen) {
      event.preventDefault();
      if (state.isProjectDeletePending) return;
      closeProjectEditDrawer({ restoreFocus: true });
      return;
    }

    const projectDrawerDelete = target.closest("#projectEditDeleteButton");
    if (projectDrawerDelete && state.isProjectEditDrawerOpen) {
      event.preventDefault();
      if (state.isProjectDeletePending) return;
      confirmDeleteSelectedProject(state.projectEditTargetProject);
      return;
    }

    const projectDrawerBackdrop = target.closest("#projectEditDrawerBackdrop");
    if (projectDrawerBackdrop && state.isProjectEditDrawerOpen) {
      event.preventDefault();
      if (state.isProjectDeletePending) return;
      closeProjectEditDrawer({ restoreFocus: true });
      return;
    }

    const projectDeleteAction = target.closest("[data-project-delete-action]");
    if (projectDeleteAction instanceof HTMLElement) {
      event.preventDefault();
      handleProjectDeleteDialogAction(
        projectDeleteAction.getAttribute("data-project-delete-action") || "",
      );
      return;
    }

    if (
      target instanceof HTMLElement &&
      target.id === "projectDeleteDialog" &&
      state.projectDeleteDialogState
    ) {
      event.preventDefault();
      if (state.isProjectDeletePending) return;
      closeProjectDeleteDialog();
    }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (form.id === "projectCrudForm") {
      submitProjectCrudModal();
      return;
    }
    if (form.id === "projectEditDrawerForm") {
      submitProjectEditDrawer();
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const refs = getProjectsRailElements();
    if (!refs) return;

    const inDesktopRail = refs.desktopRail.contains(target);
    const inSheetRail = refs.sheet.contains(target);
    if (!inDesktopRail && !inSheetRail) return;
    if (target.closest(".projects-rail-menu")) return;

    const root = inSheetRail ? refs.sheet : refs.desktopRail;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveRailOptionFocus(root, 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveRailOptionFocus(root, -1);
      return;
    }

    if (event.key === "Enter") {
      const focusedWorkspaceView = target.closest(
        ".workspace-view-item[data-workspace-view]",
      );
      if (focusedWorkspaceView instanceof HTMLElement) {
        event.preventDefault();
        const view =
          focusedWorkspaceView.getAttribute("data-workspace-view") || "all";
        hooks.selectWorkspaceView?.(view, focusedWorkspaceView);
        return;
      }

      const focusedOption = target.closest(
        ".projects-rail-item[data-project-key]",
      );
      if (!(focusedOption instanceof HTMLElement)) return;
      event.preventDefault();
      const projectName = focusedOption.getAttribute("data-project-key") || "";
      selectProjectFromRail(projectName, focusedOption);
      return;
    }

    if (event.key === "Escape" && inSheetRail && state.isRailSheetOpen) {
      event.preventDefault();
      closeProjectsRailSheet({ restoreFocus: true });
      return;
    }

    if (event.key === "Escape" && inDesktopRail) {
      event.preventDefault();
      refs.collapseToggle.focus({ preventScroll: true });
    }
  });
}
