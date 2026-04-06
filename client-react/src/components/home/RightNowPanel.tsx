// client-react/src/components/home/RightNowPanel.tsx
import { FlipCard } from "./FlipCard";
import { TarotCardFront, TarotCardBack } from "./TarotCard";
import { CardBackContent } from "./CardBack";
import { FlameArt } from "./pixel-art";
import type { RightNow, PanelProvenance } from "../../types/focusBrief";

interface Props {
  data: RightNow;
  provenance?: PanelProvenance;
  onTaskClick: (id: string) => void;
}

export function RightNowPanel({ data, provenance, onTaskClick }: Props) {
  if (!data.narrative && data.urgentItems.length === 0 && !data.topRecommendation) {
    return null;
  }

  const front = (
    <TarotCardFront
      name="The Flame"
      subtitle="Your priorities right now"
      numeral="I"
      source="ai"
      illustration={<FlameArt size={64} />}
      hero
    >
      {data.narrative && <p className="tarot-narrative">{data.narrative}</p>}
      {data.topRecommendation && (
        <button
          className="tarot-action-band"
          onClick={() => onTaskClick(data.topRecommendation!.taskId)}
          style={{
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
            fontFamily: "inherit",
          }}
        >
          <div className="tarot-action-band__label">Strongest action</div>
          <div className="tarot-action-band__title">{data.topRecommendation.title}</div>
          <div className="tarot-action-band__reason">{data.topRecommendation.reasoning}</div>
        </button>
      )}
    </TarotCardFront>
  );

  const back = (
    <TarotCardBack
      name="The Flame"
      numeral="I"
      source="ai"
      illustration={<FlameArt size={80} />}
    >
      <CardBackContent
        provenance={provenance}
        reason="Pinned — always visible. Urgent items and your strongest next action."
      />
    </TarotCardBack>
  );

  return <FlipCard front={front} back={back} />;
}
