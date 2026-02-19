(function initLintHeuristics(globalScope) {
  var escapeHtml = globalScope.Utils
    ? globalScope.Utils.escapeHtml
    : function (t) {
        var d = document.createElement("div");
        d.textContent = t;
        return d.innerHTML;
      };

  var LINT_VAGUE_WORDS =
    /\b(stuff|things|misc|various|other|update|fix|do|handle|work on|check|look at|deal with|email)\b/i;
  var LINT_VAGUE_WORDS_ON_CREATE = /\b(follow up|follow-up)\b/i;
  var LINT_URGENCY_WORDS =
    /\b(today|tomorrow|this week|by |before |urgent|asap|soon|deadline)\b/i;

  /**
   * Inspect a set of todo fields and return the single highest-priority lint
   * issue found, or null when everything looks fine.
   *
   * Priority order (first match wins):
   *   title_too_short > vague_title > missing_due_date >
   *   too_many_highs  > big_task_no_subtasks
   */
  function lintTodoFields(fields) {
    var opts = fields || {};
    var title = opts.title || "";
    var dueDate = opts.dueDate || "";
    var priority = opts.priority || "";
    var subtasks = opts.subtasks || [];
    var allTodos = opts.allTodos || [];
    var surface = opts.surface || "";

    var trimmed = title.trim();
    if (trimmed.length < 5) {
      return {
        code: "title_too_short",
        message: "Title is too brief — add more detail.",
      };
    }
    if (
      LINT_VAGUE_WORDS.test(trimmed) ||
      (surface === "on_create" && LINT_VAGUE_WORDS_ON_CREATE.test(trimmed))
    ) {
      return {
        code: "vague_title",
        message: "Title sounds vague — be more specific.",
      };
    }
    if (LINT_URGENCY_WORDS.test(trimmed) && !dueDate) {
      return {
        code: "missing_due_date",
        message: "Title implies urgency — consider setting a due date.",
      };
    }
    var activeHighs = allTodos.filter(function (t) {
      return t && t.priority === "high" && !t.completed;
    }).length;
    if (priority === "high" && activeHighs >= 5) {
      return {
        code: "too_many_highs",
        message:
          "You already have " + activeHighs + " high-priority tasks open.",
      };
    }
    if (trimmed.length > 60 && subtasks.length === 0) {
      return {
        code: "big_task_no_subtasks",
        message: "Long task — consider breaking it into subtasks.",
      };
    }
    return null;
  }

  /**
   * Render a single lint chip for the given issue.  Returns an HTML string.
   * Buttons carry data-ai-lint-action so the delegated click handler can pick
   * them up without any direct listener on the chip element.
   */
  function renderLintChip(issue) {
    if (!issue) return "";
    return (
      '<div class="ai-lint-chip" data-lint-code="' +
      escapeHtml(issue.code) +
      '" role="status">' +
      '    <span class="ai-lint-chip__icon" aria-hidden="true">⚠</span>' +
      '    <span class="ai-lint-chip__message">' +
      escapeHtml(issue.message) +
      "</span>" +
      '    <button type="button" class="ai-lint-chip__action" data-ai-lint-action="fix">Fix</button>' +
      '    <button type="button" class="ai-lint-chip__action ai-lint-chip__action--secondary" data-ai-lint-action="review">Review</button>' +
      "</div>"
    );
  }

  globalScope.LintHeuristics = {
    LINT_VAGUE_WORDS: LINT_VAGUE_WORDS,
    LINT_VAGUE_WORDS_ON_CREATE: LINT_VAGUE_WORDS_ON_CREATE,
    LINT_URGENCY_WORDS: LINT_URGENCY_WORDS,
    lintTodoFields: lintTodoFields,
    renderLintChip: renderLintChip,
  };
})(window);
