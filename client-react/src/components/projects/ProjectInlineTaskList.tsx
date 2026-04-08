import type { CreateTodoDto, Heading, Todo, UpdateTodoDto } from "../../types";
import { ProjectInlineTaskRow } from "./ProjectInlineTaskRow";
import { SearchBar } from "../shared/SearchBar";
import { IconPlus } from "../shared/Icons";

interface Props {
  projectId: string;
  headings: Heading[];
  visibleTodos: Todo[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewTask: () => void;
  selectedIds: Set<string>;
  isBulkMode: boolean;
  onSelect: (id: string) => void;
  onSave: (id: string, dto: UpdateTodoDto) => Promise<unknown>;
  onAddTodo: (dto: CreateTodoDto) => Promise<unknown>;
  onRequestDeleteTodo: (id: string) => void;
  quickAddTitle: string;
  onQuickAddTitleChange: (v: string) => void;
  quickAddHeadingId: string | null;
  onQuickAddHeadingChange: (id: string | null) => void;
  onQuickAddSubmit: () => void;
}

export function ProjectInlineTaskList({
  projectId,
  headings,
  visibleTodos,
  searchQuery,
  onSearchChange,
  onNewTask,
  selectedIds,
  isBulkMode,
  onSelect,
  onSave,
  onAddTodo,
  onRequestDeleteTodo,
  quickAddTitle,
  onQuickAddTitleChange,
  quickAddHeadingId,
  onQuickAddHeadingChange,
  onQuickAddSubmit,
}: Props) {
  return (
    <section className="project-editor__panel">
      <div className="project-editor__toolbar">
        <div>
          <h2 className="project-editor__rail-title">Task list</h2>
          <p className="project-editor__field-label">
            Edit tasks inline. Open the drawer for full detail when needed.
          </p>
        </div>
        <div className="project-editor__toolbar-actions">
          <SearchBar
            inputId="projectEditorTaskSearch"
            value={searchQuery}
            onChange={onSearchChange}
            shortcutHint="/"
          />
          <button
            type="button"
            className="btn btn--primary"
            id="projectEditorAddTask"
            onClick={onNewTask}
          >
            <IconPlus /> Add task
          </button>
        </div>
      </div>

      <div className="project-editor__task-list">
        {visibleTodos.map((todo, index) => (
          <ProjectInlineTaskRow
            key={todo.id}
            index={index}
            todo={todo}
            projectId={projectId}
            headings={headings}
            isBulkMode={isBulkMode}
            selected={selectedIds.has(todo.id)}
            onSelect={onSelect}
            onSave={onSave}
            onAddTodo={onAddTodo}
            onRequestDeleteTodo={onRequestDeleteTodo}
          />
        ))}
      </div>

      <div className="project-editor__panel project-editor__quick-add">
        <h2 className="project-editor__rail-title">Quick add</h2>
        <p className="project-editor__field-label">
          Capture work without leaving the page.
        </p>
        <div className="project-editor__toolbar-actions">
          <input
            type="text"
            className="project-editor__input"
            placeholder="Add a task, reminder, or follow-up"
            value={quickAddTitle}
            onChange={(e) => onQuickAddTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onQuickAddSubmit();
            }}
          />
          <select
            className="project-editor__select"
            value={quickAddHeadingId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onQuickAddHeadingChange(v === "" ? null : v);
            }}
            aria-label="Section for new task"
          >
            <option value="">Backlog</option>
            {headings.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--primary"
            id="projectEditorQuickAddCreate"
            onClick={onQuickAddSubmit}
          >
            Create
          </button>
        </div>
      </div>
    </section>
  );
}
