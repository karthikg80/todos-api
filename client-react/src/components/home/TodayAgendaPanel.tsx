// client-react/src/components/home/TodayAgendaPanel.tsx
import { FocusPanel } from "./FocusPanel";
import type { AgendaItem } from "../../types/focusBrief";

interface Props {
  items: AgendaItem[];
  onTaskClick: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
}

export function TodayAgendaPanel({ items, onTaskClick, onToggle }: Props) {
  if (items.length === 0) {
    return (
      <FocusPanel title="Today's Agenda" color="accent" pinned>
        <p className="focus-panel__empty">Nothing scheduled for today.</p>
      </FocusPanel>
    );
  }

  return (
    <FocusPanel title="Today's Agenda" color="accent" pinned subtitle={`${items.length} tasks`}>
      <div className="focus-agenda">
        {items.map((item) => (
          <div key={item.id} className="focus-agenda__row">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => onToggle(item.id, !item.completed)}
              className="focus-agenda__checkbox"
            />
            <button
              className="focus-agenda__title"
              onClick={() => onTaskClick(item.id)}
            >
              {item.title}
            </button>
            <span className="focus-agenda__meta">
              {item.overdue ? (
                <span className="focus-agenda__overdue">overdue</span>
              ) : item.estimateMinutes ? (
                `${item.estimateMinutes}m`
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </FocusPanel>
  );
}
