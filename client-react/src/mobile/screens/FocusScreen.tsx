import { useMemo } from "react";
import type { Todo, Project, User } from "../../types";
import { MobileHeader } from "../MobileHeader";
import { CardCarousel } from "../components/CardCarousel";
import { useFocusBrief } from "../../hooks/useFocusBrief";
import { RightNowPanel } from "../../components/home/RightNowPanel";
import { TodayAgendaPanel } from "../../components/home/TodayAgendaPanel";
import { PanelRenderer } from "../../components/home/PanelRenderer";
import type { ReactNode } from "react";

interface Props {
  todos: Todo[];
  projects: Project[];
  user: User | null;
  onTodoClick: (id: string) => void;
  onToggleTodo: (id: string, completed: boolean) => void;
  onAvatarClick: () => void;
  onSnoozeTodo: (id: string) => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function FocusScreen({ todos, projects, user, onTodoClick, onToggleTodo, onAvatarClick }: Props) {
  const { brief, loading, error } = useFocusBrief();

  const openTodos = useMemo(() => todos.filter((t) => !t.completed && !t.archived), [todos]);
  const todayCount = useMemo(() => {
    const now = new Date(new Date().toDateString());
    return openTodos.filter((t) => t.dueDate && new Date(t.dueDate) <= now).length;
  }, [openTodos]);
  const overdueCount = useMemo(() => {
    const now = new Date(new Date().toDateString());
    return openTodos.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;
  }, [openTodos]);

  const subtitle = `${todayCount} tasks today${overdueCount ? ` · ${overdueCount} overdue` : ""}`;

  const cards = useMemo(() => {
    if (!brief) return [];
    const result: ReactNode[] = [];

    result.push(
      <RightNowPanel
        key="rightNow"
        data={brief.pinned.rightNow}
        provenance={brief.pinned.rightNowProvenance}
        onTaskClick={onTodoClick}
      />,
    );

    result.push(
      <TodayAgendaPanel
        key="todayAgenda"
        items={brief.pinned.todayAgenda}
        provenance={brief.pinned.todayAgendaProvenance}
        onTaskClick={onTodoClick}
        onToggle={onToggleTodo}
      />,
    );

    for (const panel of brief.rankedPanels) {
      const node = (
        <PanelRenderer
          key={panel.type}
          panel={panel}
          onTaskClick={onTodoClick}
          onSelectProject={() => {}}
        />
      );
      result.push(node);
    }

    return result;
  }, [brief, onTodoClick, onToggleTodo]);

  return (
    <div className="m-screen m-screen--focus">
      <MobileHeader
        title={getGreeting()}
        subtitle={subtitle}
        user={user}
        onAvatarClick={onAvatarClick}
      />
      {loading && !brief && (
        <div className="m-carousel">
          <div className="m-carousel__skeleton" />
        </div>
      )}
      {error && !brief && (
        <div className="m-focus__error">
          <p>Failed to load focus brief.</p>
        </div>
      )}
      {cards.length > 0 && <CardCarousel>{cards}</CardCarousel>}
    </div>
  );
}
