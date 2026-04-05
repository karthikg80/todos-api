import { useState } from "react";
import type { Todo, Project } from "../../types";
import { useFocusBrief } from "../../hooks/useFocusBrief";
import { RightNowPanel } from "../home/RightNowPanel";
import { TodayAgendaPanel } from "../home/TodayAgendaPanel";
import { PanelRenderer } from "../home/PanelRenderer";

interface Props {
  todos?: Todo[];
  projects?: Project[];
  onTodoClick: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onEditTodo?: (id: string, updates: Record<string, unknown>) => void;
  onNavigate?: (view: "today" | "horizon" | "all") => void;
  onSelectProject: (id: string) => void;
  onUndo?: (action: { message: string; onUndo: () => void }) => void;
}

export function HomeDashboard({ onTodoClick, onToggleTodo, onSelectProject }: Props) {
  const { brief, loading, error, refreshing } = useFocusBrief();
  const [showMore, setShowMore] = useState(false);

  if (loading && !brief) {
    return (
      <div className="home-dashboard">
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !brief) {
    return (
      <div className="home-dashboard">
        <p>Failed to load focus brief.</p>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="home-dashboard">
        <p>Failed to load focus brief.</p>
      </div>
    );
  }

  return (
    <div data-testid="home-dashboard" className="home-dashboard">
      <RightNowPanel data={brief.pinned.rightNow} onTaskClick={onTodoClick} />
      <TodayAgendaPanel
        items={brief.pinned.todayAgenda}
        onTaskClick={onTodoClick}
        onToggle={onToggleTodo}
      />

      {brief.rankedPanels.length > 0 && (
        <>
          <div className="focus-divider">Surfaced for you</div>
          {brief.rankedPanels.slice(0, 3).map((panel) => (
            <PanelRenderer
              key={panel.type}
              panel={panel}
              onTaskClick={onTodoClick}
              onSelectProject={onSelectProject}
            />
          ))}
          {brief.rankedPanels.length > 3 && (
            <>
              {showMore &&
                brief.rankedPanels.slice(3).map((panel) => (
                  <PanelRenderer
                    key={panel.type}
                    panel={panel}
                    onTaskClick={onTodoClick}
                    onSelectProject={onSelectProject}
                  />
                ))}
              <button
                className="focus-disclosure"
                onClick={() => setShowMore((s) => !s)}
              >
                {showMore
                  ? "Show less ▴"
                  : `Show ${brief.rankedPanels.length - 3} more panels ▾`}
              </button>
            </>
          )}
        </>
      )}

      {(brief.isStale || refreshing) && (
        <p className="focus-panel__empty">Refreshing in background...</p>
      )}
    </div>
  );
}
