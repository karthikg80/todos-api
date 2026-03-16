// =============================================================================
// projectsState.js — Project CRUD, headings, project catalog management.
// Imports state from store.js. Cross-module calls go through hooks.
// =============================================================================
import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";
import { applyUiAction } from "./stateActions.js";
import { toDateInputValue, toIsoFromDateInput } from "./todosService.js";

function projectStorageKey() {
  return `todo-projects:${state.currentUser?.id || "anonymous"}`;
}

function loadCustomProjects() {
  try {
    const raw = localStorage.getItem(projectStorageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    state.customProjects = Array.isArray(parsed)
      ? [
          ...new Set(
            parsed
              .filter((item) => typeof item === "string")
              .map((item) => hooks.normalizeProjectPath(item))
              .filter(Boolean),
          ),
        ].sort(hooks.compareProjectPaths)
      : [];
  } catch (error) {
    console.error("Failed to load custom projects:", error);
    state.customProjects = [];
  }
}

function saveCustomProjects() {
  try {
    localStorage.setItem(
      projectStorageKey(),
      JSON.stringify(state.customProjects),
    );
  } catch (error) {
    console.error("Failed to save custom projects:", error);
  }
}

async function loadProjects() {
  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/projects`);
    if (!response || !response.ok) {
      return;
    }
    const data = await response.json();
    state.projectRecords = Array.isArray(data) ? data : [];
    const projectNames = Array.isArray(data)
      ? data
          .map((item) => hooks.normalizeProjectPath(item?.name))
          .filter((name) => typeof name === "string" && name.length > 0)
      : [];
    state.customProjects = hooks.expandProjectTree([
      ...state.customProjects,
      ...projectNames,
    ]);
    saveCustomProjects();
    const selectedProject = getSelectedProjectKey();
    if (
      selectedProject &&
      !projectNames.includes(selectedProject) &&
      !getProjectRecordByName(selectedProject)
    ) {
      hooks.selectWorkspaceView?.("home");
    }
    updateProjectSelectOptions();
    updateCategoryFilter();
    renderProjectHeadingCreateButton();
    renderProjectEditDrawer();
    if (getSelectedProjectKey()) {
      await loadHeadingsForProject(getSelectedProjectKey());
    }
  } catch (error) {
    console.error("Failed to load projects:", error);
  }
}

function getProjectRecordByName(projectName) {
  const normalized = hooks.normalizeProjectPath(projectName);
  if (!normalized) {
    return null;
  }
  return (
    state.projectRecords.find(
      (record) => hooks.normalizeProjectPath(record?.name) === normalized,
    ) || null
  );
}

function getSelectedProjectRecord() {
  return getProjectRecordByName(getSelectedProjectKey());
}

function getProjectHeadings(projectName = getSelectedProjectKey()) {
  const projectRecord = getProjectRecordByName(projectName);
  if (!projectRecord?.id) return [];
  const headings = state.projectHeadingsByProjectId.get(
    String(projectRecord.id),
  );
  return Array.isArray(headings) ? headings : [];
}

function renderProjectHeadingCreateButton() {}

async function loadHeadingsForProject(projectName = getSelectedProjectKey()) {
  const normalized = hooks.normalizeProjectPath(projectName);
  const projectRecord = getProjectRecordByName(normalized);
  if (!normalized || !projectRecord?.id) {
    renderProjectHeadingCreateButton();
    return [];
  }

  const loadSeq = ++state.projectHeadingsLoadSeq;
  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/projects/${encodeURIComponent(projectRecord.id)}/headings`,
    );
    if (loadSeq !== state.projectHeadingsLoadSeq) {
      return getProjectHeadings(normalized);
    }
    if (!response || !response.ok) {
      state.projectHeadingsByProjectId.set(String(projectRecord.id), []);
      renderProjectHeadingCreateButton();
      return [];
    }
    const data = await response.json();
    const headings = (Array.isArray(data) ? data : [])
      .filter((heading) => heading && typeof heading === "object")
      .map((heading) => ({
        ...heading,
        id: String(heading.id || ""),
        projectId: String(heading.projectId || projectRecord.id),
        name: String(heading.name || "").trim(),
        sortOrder: Number.isFinite(Number(heading.sortOrder))
          ? Number(heading.sortOrder)
          : 0,
      }))
      .filter((heading) => heading.id && heading.name)
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined),
      );
    state.projectHeadingsByProjectId.set(String(projectRecord.id), headings);
    renderProjectHeadingCreateButton();
    return headings;
  } catch (error) {
    console.error("Failed to load project headings:", error);
    state.projectHeadingsByProjectId.set(String(projectRecord.id), []);
    renderProjectHeadingCreateButton();
    return [];
  }
}

function scheduleLoadSelectedProjectHeadings() {
  window.requestAnimationFrame(() => {
    loadHeadingsForProject(getSelectedProjectKey()).then(() => {
      EventBus.dispatch("todos:changed", { reason: "project-selected" });
    });
  });
}

async function createHeadingForSelectedProject() {
  const selectedProject = getSelectedProjectKey();
  const projectRecord = getProjectRecordByName(selectedProject);
  if (!selectedProject || !projectRecord?.id) {
    hooks.showMessage?.("todosMessage", "Select a project first", "error");
    return;
  }

  const name = await hooks.showInputDialog?.(
    `Heading name in "${selectedProject}":`,
  );
  if (name === null || name === undefined) return;
  const headingName = String(name || "").trim();
  if (!headingName) {
    hooks.showMessage?.(
      "todosMessage",
      "Heading name cannot be empty",
      "error",
    );
    return;
  }

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/projects/${encodeURIComponent(projectRecord.id)}/headings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: headingName }),
      },
    );
    if (!response || !response.ok) {
      const data = response ? await hooks.parseApiBody(response) : {};
      hooks.showMessage?.(
        "todosMessage",
        data.error || "Failed to create heading",
        "error",
      );
      return;
    }
    await loadHeadingsForProject(selectedProject);
    EventBus.dispatch("todos:changed", { reason: "state-changed" });
    hooks.showMessage?.(
      "todosMessage",
      `Heading "${headingName}" created`,
      "success",
    );
  } catch (error) {
    console.error("Create heading failed:", error);
    hooks.showMessage?.("todosMessage", "Failed to create heading", "error");
  }
}

async function ensureProjectExists(projectName) {
  const normalized = hooks.normalizeProjectPath(projectName);
  if (!normalized) {
    return false;
  }
  try {
    const response = await hooks.apiCall(`${hooks.API_URL}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalized }),
    });
    if (response && (response.ok || response.status === 409)) {
      return true;
    }
    const data = response ? await hooks.parseApiBody(response) : {};
    hooks.showMessage?.(
      "todosMessage",
      data.error || "Failed to create project",
      "error",
    );
    return false;
  } catch (error) {
    console.error("Ensure project exists failed:", error);
    hooks.showMessage?.("todosMessage", "Failed to create project", "error");
    return false;
  }
}

function getAllProjects() {
  // Get project names from todos — prefer projectId lookup, fall back to category
  const todoProjectNames = state.todos.map((todo) => {
    if (todo.projectId) {
      const record = state.projectRecords.find(
        (r) => String(r.id) === String(todo.projectId),
      );
      return record?.name || todo.category;
    }
    return todo.category;
  });

  const projectNames = [...state.customProjects, ...todoProjectNames]
    .map((value) => hooks.normalizeProjectPath(value))
    .filter(
      (value) => value.length > 0 && !hooks.isInternalCategoryPath?.(value),
    );
  return hooks.expandProjectTree(projectNames);
}

function buildOpenTodoCountMapByProject() {
  const map = new Map();

  state.todos.forEach((todo) => {
    if (todo?.completed) return;
    // Prefer projectId lookup, fall back to category
    let todoProject = "";
    if (todo.projectId) {
      const record = state.projectRecords.find(
        (r) => String(r.id) === String(todo.projectId),
      );
      todoProject = record?.name
        ? hooks.normalizeProjectPath(record.name)
        : hooks.normalizeProjectPath(todo?.category || "");
    } else {
      todoProject = hooks.normalizeProjectPath(todo?.category || "");
    }
    if (!todoProject) return;

    const segments = todoProject
      .split(hooks.PROJECT_PATH_SEPARATOR)
      .filter(Boolean);
    let prefix = "";
    segments.forEach((segment) => {
      prefix = prefix
        ? `${prefix}${hooks.PROJECT_PATH_SEPARATOR}${segment}`
        : segment;
      map.set(prefix, (map.get(prefix) || 0) + 1);
    });
  });

  return map;
}

function getProjectsForRail(
  openTodoCountMap = buildOpenTodoCountMapByProject(),
) {
  return getAllProjects().filter(
    (projectName) => (openTodoCountMap.get(projectName) || 0) > 0,
  );
}

function refreshProjectCatalog() {
  state.customProjects = hooks.expandProjectTree([
    ...state.customProjects,
    ...getAllProjects(),
  ]);
  saveCustomProjects();
  updateProjectSelectOptions();
  updateCategoryFilter();
}

function updateProjectSelectOptions() {
  const projects = getAllProjects();
  const todoProjectSelect = document.getElementById("todoProjectSelect");
  const editProjectSelect = document.getElementById("editTodoProjectSelect");

  const renderOptions = (selectedValue = "") =>
    `<option value="">No project</option>${projects
      .map((project) => hooks.renderProjectOptionEntry(project, selectedValue))
      .join("")}`;

  if (todoProjectSelect) {
    const selected = todoProjectSelect.value || "";
    todoProjectSelect.innerHTML = renderOptions(selected);
    todoProjectSelect.value = selected;
    hooks.syncQuickEntryProjectActions?.();
    hooks.updateQuickEntryPropertiesSummary?.();
  }
  if (editProjectSelect) {
    const selected = editProjectSelect.value || "";
    editProjectSelect.innerHTML = renderOptions(selected);
    editProjectSelect.value = selected;
  }
}

function validateProjectNameInput(
  input,
  { emptyMessage = "Project name is required" } = {},
) {
  const normalized = hooks.normalizeProjectPath(input);
  if (!normalized) {
    return { valid: false, message: emptyMessage, normalized: "" };
  }
  if (normalized.length > 50) {
    return {
      valid: false,
      message: "Project name cannot exceed 50 characters",
      normalized,
    };
  }
  return { valid: true, message: "", normalized };
}

function getProjectEditDrawerElements() {
  const drawer = document.getElementById("projectEditDrawer");
  const backdrop = document.getElementById("projectEditDrawerBackdrop");
  const form = document.getElementById("projectEditDrawerForm");
  const input = document.getElementById("projectEditNameInput");
  const meta = document.getElementById("projectEditMeta");
  const close = document.getElementById("projectEditDrawerClose");
  const save = document.getElementById("projectEditSaveButton");
  const cancel = document.getElementById("projectEditCancelButton");
  const deleteButton = document.getElementById("projectEditDeleteButton");
  if (!(drawer instanceof HTMLElement)) return null;
  if (!(backdrop instanceof HTMLElement)) return null;
  if (!(form instanceof HTMLFormElement)) return null;
  if (!(input instanceof HTMLInputElement)) return null;
  if (!(meta instanceof HTMLElement)) return null;
  if (!(close instanceof HTMLButtonElement)) return null;
  if (!(save instanceof HTMLButtonElement)) return null;
  if (!(cancel instanceof HTMLButtonElement)) return null;
  if (!(deleteButton instanceof HTMLButtonElement)) return null;
  return {
    drawer,
    backdrop,
    form,
    input,
    meta,
    close,
    save,
    cancel,
    deleteButton,
  };
}

function getProjectEditDrawerMetaElements() {
  return {
    descriptionInput: document.getElementById("projectEditDescriptionInput"),
    statusSelect: document.getElementById("projectEditStatusSelect"),
    prioritySelect: document.getElementById("projectEditPrioritySelect"),
    areaInput: document.getElementById("projectEditAreaInput"),
    goalInput: document.getElementById("projectEditGoalInput"),
    targetDateInput: document.getElementById("projectEditTargetDateInput"),
    reviewCadenceSelect: document.getElementById(
      "projectEditReviewCadenceSelect",
    ),
    archiveButton: document.getElementById("projectEditArchiveButton"),
  };
}

function getProjectDeleteDialogElements() {
  const dialog = document.getElementById("projectDeleteDialog");
  const message = document.getElementById("projectDeleteDialogBody");
  const actions = document.getElementById("projectDeleteDialogActions");
  if (!(dialog instanceof HTMLElement)) return null;
  if (!(message instanceof HTMLElement)) return null;
  if (!(actions instanceof HTMLElement)) return null;
  return { dialog, message, actions };
}

function isProjectSurfaceActive() {
  return !!getSelectedProjectKey();
}

function lockBodyScrollForProjectEditDrawer() {
  state.projectEditScrollLockY = window.scrollY;
  state.isProjectEditBodyLocked = true;
  document.body.style.position = "fixed";
  document.body.style.top = `-${state.projectEditScrollLockY}px`;
  document.body.style.width = "100%";
}

function unlockBodyScrollForProjectEditDrawer() {
  if (!state.isProjectEditBodyLocked) return;
  state.isProjectEditBodyLocked = false;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, state.projectEditScrollLockY);
}

function renderProjectDeleteDialog() {
  const refs = getProjectDeleteDialogElements();
  if (!refs) return;
  if (!state.projectDeleteDialogState) {
    refs.dialog.style.display = "none";
    hooks.DialogManager?.close("projectDeleteDialog");
    refs.message.textContent = "";
    refs.actions.innerHTML = "";
    return;
  }
  refs.dialog.style.display = "flex";
  hooks.DialogManager?.open("projectDeleteDialog", refs.dialog, {
    onEscape: () => {
      if (!state.isProjectDeletePending) {
        closeProjectDeleteDialog();
      }
    },
  });
  refs.message.textContent = state.projectDeleteDialogState.body || "";
  refs.actions.innerHTML = (state.projectDeleteDialogState.actions || [])
    .map(
      (action, index) => `
      <button
        type="button"
        class="${hooks.escapeHtml?.(action.className || "mini-btn")}"
        data-project-delete-action="${hooks.escapeHtml?.(action.value)}"
        ${index === 0 ? 'data-project-delete-default="true"' : ""}
      >
        ${hooks.escapeHtml?.(action.label)}
      </button>
    `,
    )
    .join("");

  window.requestAnimationFrame(() => {
    const defaultButton = refs.actions.querySelector(
      "[data-project-delete-default='true']",
    );
    if (defaultButton instanceof HTMLElement) {
      defaultButton.focus({ preventScroll: true });
    }
  });
}

function openProjectDeleteDialog(config) {
  state.projectDeleteDialogState = config;
  renderProjectDeleteDialog();
}

function closeProjectDeleteDialog() {
  state.projectDeleteDialogState = null;
  renderProjectDeleteDialog();
}

function renderProjectEditDrawer() {
  const refs = getProjectEditDrawerElements();
  if (!refs) return;

  const projectRecord = getProjectRecordByName(state.projectEditTargetProject);
  if (!projectRecord) {
    refs.meta.textContent = "Project not found.";
  } else {
    const openCount = Number(projectRecord.openTodoCount || 0);
    const totalCount = Number(projectRecord.todoCount || 0);
    const movedLabel =
      openCount === 1 ? "1 open task" : `${openCount} open tasks`;
    const totalLabel =
      totalCount === 1 ? "1 total task" : `${totalCount} total tasks`;
    refs.meta.textContent = `${movedLabel} \u2022 ${totalLabel}`;
    if (refs.input.value !== projectRecord.name) {
      refs.input.value = projectRecord.name;
    }

    // Populate metadata fields (optional — non-null-guarded)
    const meta = getProjectEditDrawerMetaElements();
    if (meta.descriptionInput instanceof HTMLElement) {
      meta.descriptionInput.value = projectRecord.description || "";
    }
    if (meta.statusSelect instanceof HTMLElement) {
      meta.statusSelect.value = projectRecord.status || "active";
    }
    if (meta.prioritySelect instanceof HTMLElement) {
      meta.prioritySelect.value = projectRecord.priority || "";
    }
    if (meta.areaInput instanceof HTMLElement) {
      meta.areaInput.value = projectRecord.area || "";
    }
    if (meta.goalInput instanceof HTMLElement) {
      meta.goalInput.value = projectRecord.goal || "";
    }
    if (meta.targetDateInput instanceof HTMLElement) {
      meta.targetDateInput.value = toDateInputValue(
        projectRecord.targetDate || "",
      );
    }
    if (meta.reviewCadenceSelect instanceof HTMLElement) {
      meta.reviewCadenceSelect.value = projectRecord.reviewCadence || "";
    }
    if (meta.archiveButton instanceof HTMLElement) {
      if (projectRecord.archived) {
        meta.archiveButton.textContent = "Unarchive Project";
        meta.archiveButton.setAttribute("data-onclick", "unarchiveProject()");
      } else {
        meta.archiveButton.textContent = "Archive Project";
        meta.archiveButton.setAttribute("data-onclick", "archiveProject()");
      }
    }
  }
}

function openProjectEditDrawer(
  opener = null,
  projectName = getSelectedProjectKey(),
) {
  const refs = getProjectEditDrawerElements();
  const normalized = hooks.normalizeProjectPath(projectName);
  const projectRecord = getProjectRecordByName(normalized);
  if (!refs || !projectRecord) {
    hooks.showMessage?.("todosMessage", "Project not found", "error");
    return;
  }

  if (state.isRailSheetOpen) {
    hooks.closeProjectsRailSheet?.({ restoreFocus: false });
  }

  applyUiAction("projectEdit/open", {
    opener,
    projectName: projectRecord.name,
  });
  refs.drawer.classList.add("project-edit-drawer--open");
  refs.drawer.setAttribute("aria-hidden", "false");
  refs.backdrop.classList.add("project-edit-drawer-backdrop--open");
  refs.backdrop.setAttribute("aria-hidden", "false");
  hooks.DialogManager?.open("projectEditDrawer", refs.drawer, {
    onEscape: () => closeProjectEditDrawer({ restoreFocus: true }),
  });
  renderProjectEditDrawer();
  lockBodyScrollForProjectEditDrawer();

  window.requestAnimationFrame(() => {
    refs.input.focus();
    refs.input.select();
  });
}

function closeProjectEditDrawer({ restoreFocus = true, force = false } = {}) {
  const refs = getProjectEditDrawerElements();
  if (!refs) return;
  if (state.isProjectDeletePending && !force) return;
  const lastProjectEditOpener = state.lastProjectEditOpener;

  if (state.projectDeleteDialogState) {
    closeProjectDeleteDialog();
  }
  applyUiAction("projectEdit/close");
  refs.drawer.classList.remove("project-edit-drawer--open");
  refs.drawer.setAttribute("aria-hidden", "true");
  refs.backdrop.classList.remove("project-edit-drawer-backdrop--open");
  refs.backdrop.setAttribute("aria-hidden", "true");
  hooks.DialogManager?.close("projectEditDrawer");
  refs.form.reset();
  refs.meta.textContent = "";
  unlockBodyScrollForProjectEditDrawer();

  if (restoreFocus) {
    const fallback = document.getElementById("projectViewActionsButton");
    const focusTarget =
      lastProjectEditOpener instanceof HTMLElement &&
      lastProjectEditOpener.isConnected
        ? lastProjectEditOpener
        : fallback instanceof HTMLElement
          ? fallback
          : null;
    focusTarget?.focus({ preventScroll: true });
  }
}

function syncProjectHeaderActions() {
  const button = document.getElementById("projectViewActionsButton");
  if (!(button instanceof HTMLElement)) return;
  const shouldShow = isProjectSurfaceActive();
  button.hidden = !shouldShow;
  button.setAttribute("aria-hidden", String(!shouldShow));
}

function replaceProjectRecord(projectRecord) {
  state.projectRecords = state.projectRecords.map((item) =>
    String(item.id) === String(projectRecord.id) ? projectRecord : item,
  );
}

function renameProjectLocally(selectedPath, renamedPath, updatedProject) {
  replaceProjectRecord(updatedProject);
  state.todos = state.todos.map((todo) => {
    // Only mutate category for legacy todos (those without a projectId)
    if (todo.projectId) return todo;
    return hooks.normalizeProjectPath(todo?.category || "") === selectedPath
      ? { ...todo, category: renamedPath }
      : todo;
  });

  state.customProjects = hooks.expandProjectTree(
    state.customProjects.map((path) =>
      hooks.normalizeProjectPath(path) === selectedPath ? renamedPath : path,
    ),
  );
  saveCustomProjects();
  updateProjectSelectOptions();
  updateCategoryFilter();
  renderProjectEditDrawer();
}

function removeProjectLocally(
  projectName,
  { taskDisposition = "unsorted" } = {},
) {
  const normalized = hooks.normalizeProjectPath(projectName);
  const removed = getProjectRecordByName(normalized);
  state.projectRecords = state.projectRecords.filter(
    (record) => hooks.normalizeProjectPath(record?.name) !== normalized,
  );
  state.customProjects = hooks.expandProjectTree(
    state.customProjects.filter(
      (path) => hooks.normalizeProjectPath(path) !== normalized,
    ),
  );
  saveCustomProjects();

  if (taskDisposition === "delete") {
    state.todos = state.todos.filter((todo) => {
      // Check by projectId (canonical) or category (legacy)
      if (removed?.id && String(todo.projectId || "") === String(removed.id)) {
        return false;
      }
      const todoProject = hooks.normalizeProjectPath(todo?.category || "");
      if (!todoProject) return true;
      return (
        todoProject !== normalized &&
        !todoProject.startsWith(`${normalized}${hooks.PROJECT_PATH_SEPARATOR}`)
      );
    });
  } else {
    state.todos = state.todos.map((todo) => {
      // Check by projectId (canonical) or category (legacy)
      const matchesById =
        removed?.id && String(todo.projectId || "") === String(removed.id);
      const todoProject = hooks.normalizeProjectPath(todo?.category || "");
      const matchesByCategory =
        todoProject === normalized ||
        todoProject.startsWith(`${normalized}${hooks.PROJECT_PATH_SEPARATOR}`);
      return matchesById || matchesByCategory
        ? { ...todo, category: null, headingId: null }
        : todo;
    });
  }

  if (removed?.id) {
    state.projectHeadingsByProjectId.delete(String(removed.id));
  }
  updateProjectSelectOptions();
  updateCategoryFilter();
  renderProjectEditDrawer();
}

function getProjectCrudModalElements() {
  const modal = document.getElementById("projectCrudModal");
  const form = document.getElementById("projectCrudForm");
  const title = document.getElementById("projectCrudModalTitle");
  const input = document.getElementById("projectCrudNameInput");
  const submit = document.getElementById("projectCrudSubmitButton");
  const cancel = document.getElementById("projectCrudCancelButton");
  if (!(modal instanceof HTMLElement)) return null;
  if (!(form instanceof HTMLFormElement)) return null;
  if (!(title instanceof HTMLElement)) return null;
  if (!(input instanceof HTMLInputElement)) return null;
  if (!(submit instanceof HTMLButtonElement)) return null;
  if (!(cancel instanceof HTMLButtonElement)) return null;
  return { modal, form, title, input, submit, cancel };
}

function openProjectCrudModal(mode, opener, initialProjectName = "") {
  const refs = getProjectCrudModalElements();
  if (!refs) return;

  applyUiAction("projectCrud/open", {
    mode,
    opener,
    initialProjectName,
  });

  refs.modal.style.display = "flex";
  hooks.DialogManager?.open("projectCrudModal", refs.modal, {
    onEscape: () => closeProjectCrudModal({ restoreFocus: true }),
  });
  refs.title.textContent = mode === "rename" ? "Rename project" : "New project";
  refs.submit.textContent = mode === "rename" ? "Save" : "Create";
  refs.input.value = initialProjectName || "";

  window.requestAnimationFrame(() => {
    refs.input.focus();
    refs.input.select();
  });
}

function closeProjectCrudModal({ restoreFocus = true } = {}) {
  const refs = getProjectCrudModalElements();
  if (!refs) return;
  const lastProjectCrudOpener = state.lastProjectCrudOpener;

  applyUiAction("projectCrud/close");
  refs.modal.style.display = "none";
  hooks.DialogManager?.close("projectCrudModal");
  refs.form.reset();

  if (restoreFocus) {
    if (lastProjectCrudOpener?.isConnected) {
      lastProjectCrudOpener.focus({ preventScroll: true });
    } else {
      const fallback = document.getElementById("dockNewProjectBtn");
      if (fallback instanceof HTMLElement) {
        fallback.focus({ preventScroll: true });
      }
    }
  }
}

async function submitProjectCrudModal() {
  const refs = getProjectCrudModalElements();
  if (!refs) return;

  const validation = validateProjectNameInput(refs.input.value, {
    emptyMessage: "Project name cannot be empty",
  });
  if (!validation.valid) {
    hooks.showMessage?.("todosMessage", validation.message, "error");
    return;
  }

  const nextName = validation.normalized;
  refs.submit.disabled = true;
  refs.cancel.disabled = true;

  try {
    let didSucceed = false;
    if (state.projectCrudMode === "rename") {
      didSucceed = await renameProjectByName(
        state.projectCrudTargetProject,
        nextName,
      );
    } else {
      didSucceed = await createProjectByName(nextName);
    }
    if (didSucceed) {
      closeProjectCrudModal({ restoreFocus: false });
    }
  } finally {
    refs.submit.disabled = false;
    refs.cancel.disabled = false;
  }
}

async function createProjectByName(projectName) {
  if (getAllProjects().includes(projectName)) {
    hooks.showMessage?.("todosMessage", "Project name already exists", "error");
    return false;
  }

  const created = await ensureProjectExists(projectName);
  if (!created) {
    return false;
  }

  if (!state.customProjects.includes(projectName)) {
    state.customProjects.push(projectName);
    state.customProjects = hooks.expandProjectTree(state.customProjects);
    saveCustomProjects();
  }

  await loadProjects();
  hooks.selectProjectFromRail?.(projectName);
  hooks.showMessage?.(
    "todosMessage",
    `Project "${projectName}" created`,
    "success",
  );
  return true;
}

async function renameProjectByName(fromProjectName, toProjectName) {
  const selectedPath = hooks.normalizeProjectPath(fromProjectName);
  const renamedPath = hooks.normalizeProjectPath(toProjectName);
  const activeProject = getSelectedProjectKey();
  if (!selectedPath || !renamedPath) {
    hooks.showMessage?.(
      "todosMessage",
      "Project name cannot be empty",
      "error",
    );
    return false;
  }
  if (renamedPath === selectedPath) {
    return true;
  }

  const targetRecord = getProjectRecordByName(selectedPath);
  if (!targetRecord) {
    hooks.showMessage?.("todosMessage", "Project not found", "error");
    return false;
  }

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/projects/${targetRecord.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renamedPath }),
      },
    );
    if (!response || !response.ok) {
      const data = response ? await hooks.parseApiBody(response) : {};
      hooks.showMessage?.(
        "todosMessage",
        data.error || "Failed to rename project",
        "error",
      );
      return false;
    }
    const updatedProject = await response.json();
    renameProjectLocally(selectedPath, renamedPath, updatedProject);
  } catch (error) {
    console.error("Rename project failed:", error);
    hooks.showMessage?.("todosMessage", "Failed to rename project", "error");
    return false;
  }

  if (activeProject === selectedPath) {
    hooks.selectProjectFromRail?.(renamedPath);
  } else {
    EventBus.dispatch("todos:changed", { reason: "project-selected" });
    hooks.updateHeaderFromVisibleTodos?.(hooks.getVisibleTodos?.() ?? []);
  }

  hooks.showMessage?.(
    "todosMessage",
    `Renamed project "${selectedPath}" to "${renamedPath}"`,
    "success",
  );
  return true;
}

async function deleteProjectByName(
  projectName,
  { taskDisposition = "unsorted" } = {},
) {
  const normalized = hooks.normalizeProjectPath(projectName);
  if (!normalized) return false;
  const projectRecord = getProjectRecordByName(normalized);
  if (!projectRecord) {
    hooks.showMessage?.("todosMessage", "Project not found", "error");
    return false;
  }

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/projects/${projectRecord.id}?taskDisposition=${encodeURIComponent(taskDisposition)}`,
      {
        method: "DELETE",
      },
    );
    if (!response || !response.ok) {
      const data = response ? await hooks.parseApiBody(response) : {};
      hooks.showMessage?.(
        "todosMessage",
        data.error || "Failed to delete project",
        "error",
      );
      return false;
    }
  } catch (error) {
    console.error("Delete project failed:", error);
    hooks.showMessage?.("todosMessage", "Failed to delete project", "error");
    return false;
  }

  removeProjectLocally(normalized, { taskDisposition });
  EventBus.dispatch("todos:changed", { reason: "project-selected" });
  hooks.updateHeaderFromVisibleTodos?.(hooks.getVisibleTodos?.() ?? []);

  hooks.showMessage?.(
    "todosMessage",
    `Deleted project "${normalized}"`,
    "success",
  );
  return true;
}

function createProject() {
  openProjectCrudModal("create", document.activeElement);
}

async function submitProjectEditDrawer() {
  const refs = getProjectEditDrawerElements();
  if (!refs) return;

  const validation = validateProjectNameInput(refs.input.value, {
    emptyMessage: "Project name cannot be empty",
  });
  if (!validation.valid) {
    hooks.showMessage?.("todosMessage", validation.message, "error");
    refs.input.focus();
    return;
  }

  refs.save.disabled = true;
  refs.cancel.disabled = true;
  refs.deleteButton.disabled = true;
  refs.close.disabled = true;

  try {
    // Collect metadata fields
    const meta = getProjectEditDrawerMetaElements();
    const metaPatch = {};
    if (meta.descriptionInput instanceof HTMLElement) {
      metaPatch.description =
        (meta.descriptionInput.value || "").trim() || null;
    }
    if (meta.statusSelect instanceof HTMLElement) {
      metaPatch.status = meta.statusSelect.value || "active";
    }
    if (meta.prioritySelect instanceof HTMLElement) {
      metaPatch.priority = meta.prioritySelect.value || null;
    }
    if (meta.areaInput instanceof HTMLElement) {
      metaPatch.area = (meta.areaInput.value || "").trim() || null;
    }
    if (meta.goalInput instanceof HTMLElement) {
      metaPatch.goal = (meta.goalInput.value || "").trim() || null;
    }
    if (meta.targetDateInput instanceof HTMLElement) {
      metaPatch.targetDate = toIsoFromDateInput(meta.targetDateInput.value);
    }
    if (meta.reviewCadenceSelect instanceof HTMLElement) {
      metaPatch.reviewCadence = meta.reviewCadenceSelect.value || null;
    }

    // If name didn't change but metadata did, just do a metadata PUT
    const selectedPath = hooks.normalizeProjectPath(
      state.projectEditTargetProject,
    );
    const renamedPath = validation.normalized;
    const projectRecord = getProjectRecordByName(selectedPath);

    if (projectRecord && Object.keys(metaPatch).length > 0) {
      // Capture active project BEFORE rename clears the filter value
      const activeProject = hooks.getSelectedProjectKey?.();
      // Always apply metadata via PUT
      const putBody = { name: renamedPath, ...metaPatch };
      const response = await hooks.apiCall(
        `${hooks.API_URL}/projects/${projectRecord.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(putBody),
        },
      );
      if (!response || !response.ok) {
        const data = response ? await hooks.parseApiBody(response) : {};
        hooks.showMessage?.(
          "todosMessage",
          data.error || "Failed to update project",
          "error",
        );
        return;
      }
      const updatedProject = await response.json();
      renameProjectLocally(selectedPath, renamedPath, updatedProject);
      if (selectedPath !== renamedPath) {
        if (activeProject === selectedPath) {
          hooks.selectProjectFromRail?.(renamedPath);
        } else {
          EventBus.dispatch("todos:changed", { reason: "project-selected" });
          hooks.updateHeaderFromVisibleTodos?.(hooks.getVisibleTodos?.() ?? []);
        }
      }
      hooks.showMessage?.(
        "todosMessage",
        `Project "${renamedPath}" updated`,
        "success",
      );
      closeProjectEditDrawer({ restoreFocus: false });
    } else {
      const didSucceed = await renameProjectByName(
        state.projectEditTargetProject,
        renamedPath,
      );
      if (didSucceed) {
        closeProjectEditDrawer({ restoreFocus: false });
      }
    }
  } finally {
    refs.save.disabled = false;
    refs.cancel.disabled = false;
    refs.deleteButton.disabled = false;
    refs.close.disabled = false;
  }
}

function confirmDeleteSelectedProject(
  projectName = state.projectEditTargetProject,
) {
  if (state.isProjectDeletePending) return;
  const normalized = hooks.normalizeProjectPath(projectName);
  const projectRecord = getProjectRecordByName(normalized);
  if (!normalized || !projectRecord) {
    hooks.showMessage?.("todosMessage", "Project not found", "error");
    return;
  }

  const openTodoCount = Number(projectRecord.openTodoCount || 0);
  if (openTodoCount > 0) {
    openProjectDeleteDialog({
      projectName: normalized,
      body: `"${hooks.getProjectLeafName(normalized)}" still has ${openTodoCount} open ${
        openTodoCount === 1 ? "task" : "tasks"
      }. Choose whether to keep them in Unsorted or delete them with the project.`,
      actions: [
        {
          value: "unsorted",
          label: "Delete project and move tasks to Unsorted",
          className: "add-btn",
        },
        {
          value: "delete",
          label: "Delete project and delete its tasks",
          className: "delete-btn",
        },
        { value: "cancel", label: "Cancel", className: "mini-btn" },
      ],
    });
    return;
  }

  openProjectDeleteDialog({
    projectName: normalized,
    body: `Delete "${hooks.getProjectLeafName(normalized)}"? This cannot be undone.`,
    actions: [
      { value: "unsorted", label: "Delete Project", className: "delete-btn" },
      { value: "cancel", label: "Cancel", className: "mini-btn" },
    ],
  });
}

async function handleProjectDeleteDialogAction(actionValue) {
  if (!state.projectDeleteDialogState || state.isProjectDeletePending) return;
  const projectName = state.projectDeleteDialogState.projectName;
  if (actionValue === "cancel") {
    if (state.isProjectDeletePending) return;
    closeProjectDeleteDialog();
    return;
  }

  const refs = getProjectDeleteDialogElements();
  if (!refs) return;
  state.isProjectDeletePending = true;
  refs.actions
    .querySelectorAll("button")
    .forEach((button) => (button.disabled = true));

  const drawerRefs = getProjectEditDrawerElements();
  if (drawerRefs) {
    drawerRefs.save.disabled = true;
    drawerRefs.cancel.disabled = true;
    drawerRefs.deleteButton.disabled = true;
    drawerRefs.close.disabled = true;
  }

  try {
    const didDelete = await deleteProjectByName(projectName, {
      taskDisposition: actionValue,
    });
    if (didDelete) {
      const normalized = hooks.normalizeProjectPath(projectName);
      closeProjectDeleteDialog();
      closeProjectEditDrawer({ restoreFocus: false, force: true });
      if (hooks.normalizeProjectPath(getSelectedProjectKey()) === normalized) {
        hooks.setSelectedProjectKey?.("", {
          reason: "project-deleted",
          skipApply: true,
        });
        hooks.selectWorkspaceView?.("home");
      }
      await Promise.all([hooks.loadTodos?.(), loadProjects()]);
      if (!getSelectedProjectKey()) {
        hooks.selectWorkspaceView?.("home");
      }
    }
  } finally {
    state.isProjectDeletePending = false;
    const latestDrawerRefs = getProjectEditDrawerElements();
    if (latestDrawerRefs) {
      latestDrawerRefs.save.disabled = false;
      latestDrawerRefs.cancel.disabled = false;
      latestDrawerRefs.deleteButton.disabled = false;
      latestDrawerRefs.close.disabled = false;
    }
    const latestDialogRefs = getProjectDeleteDialogElements();
    if (latestDialogRefs) {
      latestDialogRefs.actions
        .querySelectorAll("button")
        .forEach((button) => (button.disabled = false));
    }
  }
}

async function createSubproject() {
  const projectSelect = document.getElementById("todoProjectSelect");
  const parentPath = hooks.normalizeProjectPath(projectSelect?.value || "");
  if (!parentPath) {
    hooks.showMessage?.(
      "todosMessage",
      "Select a parent project first, then create a subproject",
      "error",
    );
    return;
  }

  const name = await hooks.showInputDialog?.(
    `Subproject name under "${parentPath}":`,
  );
  if (name === null || name === undefined) return;
  const childName = hooks.normalizeProjectPath(name);
  if (!childName) {
    hooks.showMessage?.(
      "todosMessage",
      "Subproject name cannot be empty",
      "error",
    );
    return;
  }
  const combinedPath = hooks.normalizeProjectPath(
    `${parentPath}${hooks.PROJECT_PATH_SEPARATOR}${childName}`,
  );
  if (!combinedPath || combinedPath.length > 50) {
    hooks.showMessage?.(
      "todosMessage",
      "Subproject path cannot exceed 50 characters",
      "error",
    );
    return;
  }
  const created = await ensureProjectExists(combinedPath);
  if (!created) return;
  if (!state.customProjects.includes(combinedPath)) {
    state.customProjects.push(combinedPath);
    state.customProjects = hooks.expandProjectTree(state.customProjects);
    saveCustomProjects();
    updateProjectSelectOptions();
    updateCategoryFilter();
  }
  if (projectSelect) {
    projectSelect.value = combinedPath;
  }
  await loadProjects();
  hooks.showMessage?.(
    "todosMessage",
    `Subproject "${combinedPath}" created`,
    "success",
  );
}

function renameProjectTree() {
  const projectSelect = document.getElementById("todoProjectSelect");
  const selectedPath = hooks.normalizeProjectPath(projectSelect?.value || "");
  if (!selectedPath) {
    hooks.showMessage?.("todosMessage", "Select a project to rename", "error");
    return;
  }
  openProjectCrudModal("rename", document.activeElement, selectedPath);
}

function renderProjectOptions(selectedProject = "") {
  return `<option value="">No project</option>${getAllProjects()
    .map((project) => hooks.renderProjectOptionEntry(project, selectedProject))
    .join("")}`;
}

function updateCategoryFilter() {
  const categories = getAllProjects();
  const filterSelect = document.getElementById("categoryFilter");
  if (!(filterSelect instanceof HTMLSelectElement)) {
    hooks.renderProjectsRail?.();
    return;
  }
  const currentValue = hooks.isInternalCategoryPath?.(filterSelect.value)
    ? ""
    : filterSelect.value;

  filterSelect.innerHTML =
    '<option value="">All Projects</option>' +
    categories
      .map((cat) => hooks.renderProjectOptionEntry(cat, currentValue))
      .join("");

  if (categories.includes(currentValue)) {
    filterSelect.value = currentValue;
  }

  hooks.renderProjectsRail?.();
}

function getSelectedProjectKey() {
  return hooks.getSelectedProjectKey?.() ?? "";
}

async function archiveProject(projectName) {
  const normalized = hooks.normalizeProjectPath(
    projectName || state.projectEditTargetProject || "",
  );
  const projectRecord = getProjectRecordByName(normalized);
  if (!projectRecord) {
    hooks.showMessage?.("todosMessage", "Project not found", "error");
    return;
  }
  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/projects/${projectRecord.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true, status: "archived" }),
      },
    );
    if (!response || !response.ok) {
      const data = response ? await hooks.parseApiBody(response) : {};
      hooks.showMessage?.(
        "todosMessage",
        data.error || "Failed to archive project",
        "error",
      );
      return;
    }
    const updatedProject = await response.json();
    replaceProjectRecord(updatedProject);
    renderProjectEditDrawer();
    hooks.showMessage?.(
      "todosMessage",
      `Project "${normalized}" archived`,
      "success",
    );
  } catch (error) {
    console.error("Archive project failed:", error);
    hooks.showMessage?.("todosMessage", "Failed to archive project", "error");
  }
}

async function unarchiveProject(projectName) {
  const normalized = hooks.normalizeProjectPath(
    projectName || state.projectEditTargetProject || "",
  );
  const projectRecord = getProjectRecordByName(normalized);
  if (!projectRecord) {
    hooks.showMessage?.("todosMessage", "Project not found", "error");
    return;
  }
  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/projects/${projectRecord.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false, status: "active" }),
      },
    );
    if (!response || !response.ok) {
      const data = response ? await hooks.parseApiBody(response) : {};
      hooks.showMessage?.(
        "todosMessage",
        data.error || "Failed to unarchive project",
        "error",
      );
      return;
    }
    const updatedProject = await response.json();
    replaceProjectRecord(updatedProject);
    renderProjectEditDrawer();
    hooks.showMessage?.(
      "todosMessage",
      `Project "${normalized}" unarchived`,
      "success",
    );
  } catch (error) {
    console.error("Unarchive project failed:", error);
    hooks.showMessage?.("todosMessage", "Failed to unarchive project", "error");
  }
}

export {
  projectStorageKey,
  loadCustomProjects,
  saveCustomProjects,
  loadProjects,
  getProjectRecordByName,
  getSelectedProjectRecord,
  getProjectHeadings,
  renderProjectHeadingCreateButton,
  loadHeadingsForProject,
  scheduleLoadSelectedProjectHeadings,
  createHeadingForSelectedProject,
  ensureProjectExists,
  getAllProjects,
  buildOpenTodoCountMapByProject,
  getProjectsForRail,
  refreshProjectCatalog,
  updateProjectSelectOptions,
  validateProjectNameInput,
  getProjectEditDrawerElements,
  getProjectDeleteDialogElements,
  isProjectSurfaceActive,
  lockBodyScrollForProjectEditDrawer,
  unlockBodyScrollForProjectEditDrawer,
  renderProjectDeleteDialog,
  openProjectDeleteDialog,
  closeProjectDeleteDialog,
  renderProjectEditDrawer,
  openProjectEditDrawer,
  closeProjectEditDrawer,
  syncProjectHeaderActions,
  replaceProjectRecord,
  renameProjectLocally,
  removeProjectLocally,
  getProjectCrudModalElements,
  openProjectCrudModal,
  closeProjectCrudModal,
  submitProjectCrudModal,
  createProjectByName,
  renameProjectByName,
  deleteProjectByName,
  createProject,
  submitProjectEditDrawer,
  confirmDeleteSelectedProject,
  handleProjectDeleteDialogAction,
  createSubproject,
  renameProjectTree,
  renderProjectOptions,
  updateCategoryFilter,
  getSelectedProjectKey,
  getProjectEditDrawerMetaElements,
  archiveProject,
  unarchiveProject,
};
