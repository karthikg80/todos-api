// client-react/src/components/home/RightNowPanel.tsx
import { FlipCard } from "./FlipCard";
import { CardBack } from "./CardBack";
import { FlameArt } from "./pixel-art";
import type { RightNow, PanelProvenance } from "../../types/focusBrief";

interface Props {
  data: RightNow;
  provenance: PanelProvenance;
  onTaskClick: (id: string) => void;
}

export function RightNowPanel({ data, provenance, onTaskClick }: Props) {
  if (data.urgentItems.length === 0 && !data.topRecommendation) {
    return null;
  }

  const front = (
    <div className="panel-right-now">
      <div className="panel-right-now__header">
        <FlameArt size={18} />
        <span className="panel-right-now__title">Right Now</span>
      </div>

      {data.urgentItems.map((item, i) => (
        <div key={i} className="focus-urgent-banner">
          <span className="focus-urgent-banner__dot" />
          <div>
            <strong>
              {item.dueDate} — {item.title}.
            </strong>{" "}
            <span className="focus-urgent-banner__reason">{item.reason}</span>
          </div>
        </div>
      ))}

      {data.topRecommendation && (
        <button
          className="focus-recommendation"
          onClick={() => onTaskClick(data.topRecommendation!.taskId)}
        >
          <div className="focus-recommendation__label">→ Strongest next action</div>
          <div className="focus-recommendation__title">{data.topRecommendation.title}</div>
          <div className="focus-recommendation__reasoning">
            {data.topRecommendation.reasoning}
          </div>
        </button>
      )}
    </div>
  );

  const back = (
    <CardBack
      provenance={provenance}
      reason="Pinned — always visible. Urgent items and your strongest next action."
      pixelArt={<FlameArt size={64} />}
    />
  );

  return <FlipCard front={front} back={back} />;
}
