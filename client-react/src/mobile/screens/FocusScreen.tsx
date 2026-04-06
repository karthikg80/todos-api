import { useMemo } from "react";
import type { Todo, Project, User } from "../../types";
import type { FocusBriefResponse } from "../../types/focusBrief";
import { MobileHeader } from "../MobileHeader";
import { CardCarousel } from "../components/CardCarousel";
import { SkeletonCard } from "../components/SkeletonCard";
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
  brief: FocusBriefResponse | null;
  briefLoading: boolean;
  briefError: string | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const SKELETON_CARDS: ReactNode[] = [
  <SkeletonCard key="skel-flame" name="The Flame" subtitle="Your priorities right now" numeral="I" source="ai" />,
  <SkeletonCard key="skel-dawn" name="The Dawn" subtitle="Today's agenda" numeral="II" source="sys" />,
];

export function FocusScreen({ todos, projects, user, onTodoClick, onToggleTodo, onAvatarClick, brief, briefLoading, briefError }: Props) {
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

  const showSkeleton = briefLoading && !brief;

  return (
    <div className="m-screen m-screen--focus">
      <MobileHeader
        title={getGreeting()}
        subtitle={subtitle}
        user={user}
        onAvatarClick={onAvatarClick}
      />
      {showSkeleton && <CardCarousel>{SKELETON_CARDS}</CardCarousel>}
      {briefError && !brief && (
        <div className="m-focus__error">
          <p>Failed to load focus brief.</p>
        </div>
      )}
      {cards.length > 0 && <CardCarousel>{cards}</CardCarousel>}
    </div>
  );
}
