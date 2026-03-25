// =============================================================================
// taskPicker.js — Inline task search-and-select picker for depends-on fields.
// Renders selected tasks as removable chips + a search input with dropdown.
// All user-supplied text is escaped via the escapeHtml parameter before
// interpolation into markup, matching the sanitisation pattern used by
// drawerUi.js and the rest of the frontend.
// =============================================================================

import { illustrationPickerEmpty } from "./illustrations.js";

/**
 * Mount a task picker inside a container element.
 *
 * @param {HTMLElement} container — The element to render the picker into.
 * @param {object} opts
 * @param {string[]} opts.selectedIds — Initial selected task IDs.
 * @param {function(): object[]} opts.getTodos — Returns the full todo list from state.
 * @param {string} [opts.excludeId] — Task ID to exclude from results (self).
 * @param {function(string[]): void} opts.onChange — Called with updated ID array on change.
 * @param {function(string): string} [opts.escapeHtml] — HTML escape helper.
 * @returns {{ destroy: () => void, getSelectedIds: () => string[] }}
 */
export function mountTaskPicker(container, opts) {
  const {
    selectedIds: initialIds = [],
    getTodos,
    excludeId = "",
    onChange,
    escapeHtml = (s) => String(s),
  } = opts;

  let selectedIds = [...initialIds];
  let highlightIndex = -1;
  let matches = [];

  // ── Build DOM ──
  container.textContent = "";
  container.classList.add("task-picker");

  const chipsWrap = document.createElement("div");
  chipsWrap.className = "task-picker__chips";
  container.appendChild(chipsWrap);

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "task-picker__search";
  searchInput.placeholder = "Search tasks by title\u2026";
  searchInput.setAttribute("autocomplete", "off");
  container.appendChild(searchInput);

  const dropdown = document.createElement("div");
  dropdown.className = "task-picker__dropdown";
  dropdown.setAttribute("role", "listbox");
  container.appendChild(dropdown);

  // ── Render chips (safe: all text passed through escapeHtml) ──
  function renderChips() {
    const todos = getTodos();
    chipsWrap.textContent = "";
    selectedIds.forEach((id) => {
      const todo = todos.find((t) => t.id === id);
      const label = todo ? todo.title : id.slice(0, 8) + "\u2026";

      const chip = document.createElement("span");
      chip.className = "task-picker__chip";
      chip.dataset.taskPickerId = id;

      const text = document.createTextNode(label);
      chip.appendChild(text);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "task-picker__chip-remove";
      btn.dataset.taskPickerRemove = id;
      btn.setAttribute("aria-label", "Remove");
      btn.textContent = "\u00d7";
      chip.appendChild(btn);

      chipsWrap.appendChild(chip);
    });
  }

  // ── Search & dropdown ──
  function searchTasks(query) {
    if (!query) {
      matches = [];
      dropdown.textContent = "";
      dropdown.classList.remove("task-picker__dropdown--open");
      highlightIndex = -1;
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const todos = getTodos();

    matches = todos
      .filter((t) => !selectedIds.includes(t.id) && t.id !== excludeId)
      .map((t) => {
        const title = String(t.title || "");
        const titleLower = title.toLowerCase();
        let score = -1;
        if (titleLower.startsWith(normalizedQuery)) score = 0;
        else if (titleLower.includes(normalizedQuery)) score = 1;
        if (score === -1) return null;
        return { id: t.id, title, score, completed: !!t.completed };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
      .slice(0, 8);

    highlightIndex = matches.length > 0 ? 0 : -1;
    renderDropdown();
  }

  function renderDropdown() {
    dropdown.textContent = "";
    if (matches.length === 0) {
      if (searchInput.value.trim()) {
        const empty = document.createElement("div");
        empty.className = "task-picker__empty";
        // Hardcoded SVG + label — no user input, safe for innerHTML
        empty.innerHTML = illustrationPickerEmpty() + "No matching tasks";
        dropdown.appendChild(empty);
        dropdown.classList.add("task-picker__dropdown--open");
      }
      return;
    }

    matches.forEach((m, i) => {
      const opt = document.createElement("div");
      opt.className = "task-picker__option";
      if (i === highlightIndex)
        opt.classList.add("task-picker__option--active");
      if (m.completed) opt.classList.add("task-picker__option--done");
      opt.dataset.taskPickerSelect = m.id;
      opt.setAttribute("role", "option");
      opt.textContent = m.title;
      dropdown.appendChild(opt);
    });
    dropdown.classList.add("task-picker__dropdown--open");
  }

  function selectTask(id) {
    if (!id || selectedIds.includes(id)) return;
    selectedIds.push(id);
    searchInput.value = "";
    matches = [];
    dropdown.textContent = "";
    dropdown.classList.remove("task-picker__dropdown--open");
    highlightIndex = -1;
    renderChips();
    onChange(selectedIds);
  }

  function removeTask(id) {
    selectedIds = selectedIds.filter((sid) => sid !== id);
    renderChips();
    onChange(selectedIds);
  }

  // ── Events ──
  searchInput.addEventListener("input", () => {
    searchTasks(searchInput.value.trim());
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (matches.length > 0) {
        highlightIndex = Math.min(highlightIndex + 1, matches.length - 1);
        renderDropdown();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (matches.length > 0) {
        highlightIndex = Math.max(highlightIndex - 1, 0);
        renderDropdown();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && matches[highlightIndex]) {
        selectTask(matches[highlightIndex].id);
      }
    } else if (e.key === "Escape") {
      matches = [];
      dropdown.textContent = "";
      dropdown.classList.remove("task-picker__dropdown--open");
      highlightIndex = -1;
    }
  });

  // Close dropdown on outside click
  function onDocClick(e) {
    if (!container.contains(e.target)) {
      dropdown.textContent = "";
      dropdown.classList.remove("task-picker__dropdown--open");
      highlightIndex = -1;
    }
  }
  document.addEventListener("click", onDocClick, true);

  // Delegated clicks for chips and dropdown options
  container.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-task-picker-remove]");
    if (removeBtn) {
      e.preventDefault();
      removeTask(removeBtn.dataset.taskPickerRemove);
      return;
    }
    const optionEl = e.target.closest("[data-task-picker-select]");
    if (optionEl) {
      e.preventDefault();
      selectTask(optionEl.dataset.taskPickerSelect);
    }
  });

  // Initial render
  renderChips();

  return {
    destroy() {
      document.removeEventListener("click", onDocClick, true);
      container.textContent = "";
    },
    getSelectedIds() {
      return [...selectedIds];
    },
  };
}
