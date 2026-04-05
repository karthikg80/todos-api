// client-react/src/components/home/TodayAgendaPanel.tsx
import { FlipCard } from "./FlipCard";
import { CardBack } from "./CardBack";
import { SunriseArt } from "./pixel-art";
import type { AgendaItem, PanelProvenance } from "../../types/focusBrief";

interface Props {
  items: AgendaItem[];
  provenance: PanelProvenance;
  onTaskClick: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
}

function dotColor(item: AgendaItem): string {
  if (item.overdue) return "var(--danger)";
  if (item.estimateMinutes != null && item.estimateMinutes <= 15) return "var(--success, #4ade80)";
  return "var(--accent)";
}

export function TodayAgendaPanel({ items, provenance, onTaskClick, onToggle }: Props) {
  const back = (
    <CardBack
      provenance={provenance}
      reason="Pinned — your day at a glance."
      pixelArt={<SunriseArt size={64} />}
    />
  );

  if (items.length === 0) {
    const front = (
      <div className="panel-today-agenda">
        <div className="panel-today-agenda__header">
          <SunriseArt size={18} />
          <span className="panel-today-agenda__title">Today's Agenda</span>
        </div>
        <p className="focus-panel__empty">Nothing scheduled for today.</p>
      </div>
    );
    return <FlipCard front={front} back={back} />;
  }

  const front = (
    <div className="panel-today-agenda">
      <div className="panel-today-agenda__header">
        <SunriseArt size={18} />
        <span className="panel-today-agenda__title">Today's Agenda</span>
        <span className="panel-today-agenda__subtitle">{items.length} tasks</span>
      </div>

      <div className="timeline">
        <div className="timeline__line" />
        {items.map((item) => (
          <div key={item.id} className="timeline__item">
            <div
              className="timeline__dot"
              style={{ background: dotColor(item) }}
            />
            <div className="timeline__content">
              <button
                className={`timeline__title${item.completed ? " timeline__title--done" : ""}`}
                onClick={() => onTaskClick(item.id)}
              >
                {item.title}
              </button>
              <span className="timeline__meta">
                {item.overdue ? (
                  <span className="timeline__overdue">overdue</span>
                ) : item.estimateMinutes ? (
                  `${item.estimateMinutes}m`
                ) : null}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return <FlipCard front={front} back={back} />;
}
