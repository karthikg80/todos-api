// client-react/src/components/home/RightNowPanel.tsx
import { FocusPanel } from "./FocusPanel";
import type { RightNow } from "../../types/focusBrief";

interface Props {
  data: RightNow;
  onTaskClick: (id: string) => void;
}

export function RightNowPanel({ data, onTaskClick }: Props) {
  if (data.urgentItems.length === 0 && !data.topRecommendation) {
    return null;
  }

  return (
    <FocusPanel title="Right Now" color="danger" pinned>
      {data.urgentItems.map((item, i) => (
        <div key={i} className="focus-urgent-banner">
          <span className="focus-urgent-banner__dot" />
          <div>
            <strong>{item.dueDate} — {item.title}.</strong>{" "}
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
          <div className="focus-recommendation__reasoning">{data.topRecommendation.reasoning}</div>
        </button>
      )}
    </FocusPanel>
  );
}
