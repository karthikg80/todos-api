import { useState, useCallback } from "react";
import * as aiApi from "../../api/ai";

interface Props {
  todoId: string;
  todoTitle: string;
}

export function AiDrawerAssist({ todoId, todoTitle }: Props) {
  const [critiqueResult, setCritiqueResult] = useState<string[] | null>(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownDone, setBreakdownDone] = useState(false);
  const [error, setError] = useState("");

  const handleCritique = useCallback(async () => {
    setCritiqueLoading(true);
    setError("");
    setCritiqueResult(null);
    try {
      const result = await aiApi.critiqueTask(todoId, todoTitle);
      setCritiqueResult(result.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCritiqueLoading(false);
    }
  }, [todoId, todoTitle]);

  const handleBreakdown = useCallback(async () => {
    setBreakdownLoading(true);
    setError("");
    try {
      await aiApi.breakdownTask(todoId);
      setBreakdownDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBreakdownLoading(false);
    }
  }, [todoId]);

  return (
    <div className="ai-drawer-assist">
      <div className="ai-drawer-assist__header">Task refinement</div>
      <div className="ai-drawer-assist__actions">
        <button
          className="btn ai-drawer-assist__btn"
          onClick={handleCritique}
          disabled={critiqueLoading}
        >
          {critiqueLoading ? "Reviewing…" : "Sharpen the wording"}
        </button>
        <button
          className="btn ai-drawer-assist__btn"
          onClick={handleBreakdown}
          disabled={breakdownLoading || breakdownDone}
        >
          {breakdownLoading
            ? "Building steps…"
            : breakdownDone
              ? "Subtasks created"
              : "Draft subtasks"}
        </button>
      </div>

      {error && <p className="ai-drawer-assist__error">{error}</p>}

      {critiqueResult && critiqueResult.length > 0 && (
        <div id="aiCritiquePanel" className="ai-drawer-assist__critique">
          <div className="ai-drawer-assist__critique-title">Suggested edits</div>
          <ul className="ai-drawer-assist__suggestions">
            {critiqueResult.map((s, i) => (
              <li key={i} className="ai-drawer-assist__suggestion">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {critiqueResult && critiqueResult.length === 0 && (
        <p className="ai-drawer-assist__success">
          This task already reads clearly.
        </p>
      )}
    </div>
  );
}
