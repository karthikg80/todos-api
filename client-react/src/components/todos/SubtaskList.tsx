import { useState, useEffect, useCallback } from "react";
import { apiCall } from "../../api/client";
import type { Subtask } from "../../types";

interface Props {
  todoId: string;
}

export function SubtaskList({ todoId }: Props) {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    setLoading(true);
    apiCall(`/todos/${todoId}/subtasks`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setSubtasks(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [todoId]);

  const toggleSubtask = useCallback(
    async (subtaskId: string, completed: boolean) => {
      setSubtasks((prev) =>
        prev.map((s) => (s.id === subtaskId ? { ...s, completed } : s)),
      );
      try {
        const res = await apiCall(`/todos/${todoId}/subtasks/${subtaskId}`, {
          method: "PUT",
          body: JSON.stringify({ completed }),
        });
        if (res.ok) {
          const updated = await res.json();
          setSubtasks((prev) =>
            prev.map((s) => (s.id === subtaskId ? updated : s)),
          );
        }
      } catch {
        setSubtasks((prev) =>
          prev.map((s) =>
            s.id === subtaskId ? { ...s, completed: !completed } : s,
          ),
        );
      }
    },
    [todoId],
  );

  const addSubtask = useCallback(async () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    try {
      const res = await apiCall(`/todos/${todoId}/subtasks`, {
        method: "POST",
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        const created = await res.json();
        setSubtasks((prev) => [...prev, created]);
        setNewTitle("");
      }
    } catch {}
  }, [todoId, newTitle]);

  const deleteSubtask = useCallback(
    async (subtaskId: string) => {
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
      try {
        await apiCall(`/todos/${todoId}/subtasks/${subtaskId}`, {
          method: "DELETE",
        });
      } catch {}
    },
    [todoId],
  );

  if (loading) return <div className="subtask-loading">Loading subtasks…</div>;

  return (
    <div className="subtask-list">
      <div className="subtask-list__header">
        Subtasks
        {subtasks.length > 0 && (
          <span className="subtask-list__count">
            {subtasks.filter((s) => s.completed).length}/{subtasks.length}
          </span>
        )}
      </div>
      {subtasks.map((s) => (
        <div key={s.id} className="subtask-item">
          <input
            type="checkbox"
            checked={s.completed}
            onChange={(e) => toggleSubtask(s.id, e.target.checked)}
            className="subtask-checkbox"
          />
          <span
            className={`subtask-title${s.completed ? " subtask-title--done" : ""}`}
          >
            {s.title}
          </span>
          <button
            className="subtask-delete"
            onClick={() => deleteSubtask(s.id)}
            aria-label={`Delete subtask "${s.title}"`}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="subtask-add">
        <input
          className="subtask-add__input"
          type="text"
          placeholder="Add subtask…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addSubtask();
          }}
        />
      </div>
    </div>
  );
}
