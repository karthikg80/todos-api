import { useState, useRef, useEffect } from "react";
import type { CreateTodoDto, Project } from "../../types";

type CaptureMode = "task" | "project";

interface Props {
  open: boolean;
  projects: Project[];
  onClose: () => void;
  onCreateTask: (dto: CreateTodoDto) => Promise<unknown>;
  onCreateProject: (name: string) => Promise<unknown>;
}

function formatDueDateChip(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function QuickCapture({ open, projects, onClose, onCreateTask, onCreateProject }: Props) {
  const [mode, setMode] = useState<CaptureMode>("task");
  const [title, setTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedDueDate, setSelectedDueDate] = useState<string | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(""); setSelectedProjectId(null); setSelectedPriority(null);
      setSelectedDueDate(null); setShowProjectPicker(false); setMode("task");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (mode === "task") {
      const dto: CreateTodoDto = { title: trimmed };
      if (selectedProjectId) dto.projectId = selectedProjectId;
      if (selectedPriority) dto.priority = selectedPriority as CreateTodoDto["priority"];
      if (selectedDueDate) dto.dueDate = selectedDueDate;
      await onCreateTask(dto);
    } else {
      await onCreateProject(trimmed);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  if (!open) return null;

  return (
    <>
      <div className="m-capture__backdrop" onClick={onClose} />
      <div className="m-capture" role="dialog" aria-modal="true" aria-label="Quick capture">
        <div className="m-bottom-sheet__handle-bar" />
        <div className="m-capture__tabs">
          <button className={`m-capture__tab${mode === "task" ? " m-capture__tab--active" : ""}`} onClick={() => setMode("task")}>Task</button>
          <button className={`m-capture__tab${mode === "project" ? " m-capture__tab--active" : ""}`} onClick={() => setMode("project")}>Project</button>
        </div>
        <input ref={inputRef} className="m-capture__input" type="text"
          placeholder={mode === "task" ? "What needs to be done?" : "Project name"}
          value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={handleKeyDown} />
        {mode === "task" && (
          <div className="m-capture__chips">
            <button className={`m-capture__chip${selectedProjectId ? " m-capture__chip--set" : ""}`}
              onClick={() => setShowProjectPicker(!showProjectPicker)}>
              ▤ {selectedProjectId ? projects.find((p) => p.id === selectedProjectId)?.name : "Project"}
            </button>
            <button className={`m-capture__chip${selectedPriority ? " m-capture__chip--set" : ""}`}
              onClick={() => {
                const cycle = [null, "low", "medium", "high", "urgent"];
                const idx = cycle.indexOf(selectedPriority);
                setSelectedPriority(cycle[(idx + 1) % cycle.length]);
              }}>
              ● {selectedPriority ?? "Priority"}
            </button>
            <button className={`m-capture__chip${selectedDueDate ? " m-capture__chip--set" : ""}`}
              onClick={() => dateInputRef.current?.showPicker()}>
              ◷ {selectedDueDate ? formatDueDateChip(selectedDueDate) : "Due date"}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
              value={selectedDueDate ?? ""}
              onChange={(e) => setSelectedDueDate(e.target.value || null)}
            />
          </div>
        )}
        {showProjectPicker && (
          <div className="m-capture__picker">
            <div className="m-capture__picker-label">Select project</div>
            {projects.filter((p) => p.status === "active").map((p) => (
              <button key={p.id}
                className={`m-capture__picker-item${p.id === selectedProjectId ? " m-capture__picker-item--selected" : ""}`}
                onClick={() => { setSelectedProjectId(p.id); setShowProjectPicker(false); }}>
                {p.name}
              </button>
            ))}
          </div>
        )}
        <button className="m-capture__submit" disabled={!title.trim()} onClick={handleSubmit}>
          {mode === "task" ? "Add Task" : "Add Project"}
        </button>
      </div>
    </>
  );
}
