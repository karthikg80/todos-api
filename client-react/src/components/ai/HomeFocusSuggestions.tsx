import { useState, useEffect, useCallback } from "react";
import type { Todo } from "../../types";
import * as aiApi from "../../api/ai";
import type { FocusSuggestion } from "../../api/ai";

interface Props {
  todos: Todo[];
  onTodoClick: (id: string) => void;
}

export function HomeFocusSuggestions({ todos, onTodoClick }: Props) {
  const [suggestions, setSuggestions] = useState<FocusSuggestion[]>([]);
  const [aiSuggestionId, setAiSuggestionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState("");

  useEffect(() => {
    if (todos.length === 0) {
      setLoading(false);
      return;
    }

    const candidates = todos
      .filter((t) => !t.completed)
      .map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate,
      }));

    aiApi
      .fetchFocusSuggestions(candidates)
      .then((result) => {
        setSuggestions(result.suggestions);
        setAiSuggestionId(result.aiSuggestionId);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [todos]);

  const handleApply = useCallback(
    async (suggestion: FocusSuggestion) => {
      setActioningId(suggestion.suggestionId);
      try {
        await aiApi.applyFocusSuggestion(aiSuggestionId);
        onTodoClick(suggestion.todoId);
        setSuggestions([]);
      } catch {}
      setActioningId("");
    },
    [aiSuggestionId, onTodoClick],
  );

  const handleDismiss = useCallback(async () => {
    setActioningId("dismiss-all");
    try {
      await aiApi.dismissFocusSuggestion(aiSuggestionId);
      setSuggestions([]);
    } catch {}
    setActioningId("");
  }, [aiSuggestionId]);

  if (loading) {
    return (
      <div className="home-ai-suggestions home-ai-suggestions--loading">
        Loading focus suggestions…
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="home-ai-suggestions">
      <div className="home-ai-suggestions__header">
        <span className="home-ai-suggestions__title">AI Focus Suggestions</span>
        <button
          className="mini-btn"
          onClick={handleDismiss}
          disabled={actioningId === "dismiss-all"}
        >
          {actioningId === "dismiss-all" ? "Dismissing…" : "Dismiss all"}
        </button>
      </div>
      {suggestions.map((s) => (
        <div key={s.suggestionId} className="home-ai-suggestion">
          <div className="home-ai-suggestion__content">
            <span className="home-ai-suggestion__task-title">{s.title}</span>
            {s.summary && (
              <span className="home-ai-suggestion__reason">{s.summary}</span>
            )}
            {s.confidence > 0 && (
              <span className="home-ai-suggestion__confidence">
                {Math.round(s.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <div className="home-ai-suggestion__actions">
            <button
              className="btn home-ai-suggestion__apply"
              onClick={() => handleApply(s)}
              disabled={actioningId === s.suggestionId}
            >
              {actioningId === s.suggestionId ? "…" : "Use focus"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
