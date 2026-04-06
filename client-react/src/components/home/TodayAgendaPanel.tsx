// client-react/src/components/home/TodayAgendaPanel.tsx
import { FlipCard } from "./FlipCard";
import { TarotCardFront, TarotCardBack } from "./TarotCard";
import { CardBackContent } from "./CardBack";
import { SunriseArt } from "./pixel-art";
import type { AgendaItem, PanelProvenance } from "../../types/focusBrief";

interface Props {
  items: AgendaItem[];
  provenance?: PanelProvenance;
  onTaskClick: (id: string) => void;
  onToggle: (id: string, completed: boolean) => void;
}

function dotColor(item: AgendaItem): string {
  if (item.overdue) return "var(--tarot-red)";
  if (item.estimateMinutes != null && item.estimateMinutes <= 15) return "var(--tarot-sage)";
  return "var(--tarot-gold)";
}

export function TodayAgendaPanel({ items, provenance, onTaskClick, onToggle: _onToggle }: Props) {
  const front = (
    <TarotCardFront
      name="The Dawn"
      subtitle="Today's agenda"
      numeral="II"
      source="sys"
      illustration={<SunriseArt size={64} />}
      accentPattern={{ mode: "flowField", seed: 102 }}
      illustrationCaption={`${items.length} task${items.length !== 1 ? "s" : ""}`}
      hero
    >
      {items.length === 0 ? (
        <p className="tarot-light-day">All clear. Enjoy your day.</p>
      ) : (
        <>
          <div className="timeline">
            <div className="timeline__line" />
            {items.map((item) => (
              <div key={item.id} className="timeline__item">
                <div className="timeline__dot" style={{ background: dotColor(item) }} />
                <div className="timeline__content">
                  <button className="timeline__title" onClick={() => onTaskClick(item.id)}>
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
          {items.length <= 2 && (
            <p className="tarot-light-day">Light day — room to get ahead.</p>
          )}
        </>
      )}
    </TarotCardFront>
  );

  const back = (
    <TarotCardBack
      name="The Dawn"
      numeral="II"
      source="sys"
      illustration={<SunriseArt size={80} />}
    >
      <CardBackContent
        provenance={provenance}
        reason="Pinned — your day at a glance."
      />
    </TarotCardBack>
  );

  return <FlipCard front={front} back={back} />;
}
