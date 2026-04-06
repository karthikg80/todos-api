import { AgentActivityFeed } from "../home/AgentActivityFeed";

interface Props {
  onBack: () => void;
}

export function AgentActivityView({ onBack }: Props) {
  return (
    <>
      <header className="app-header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <span className="app-header__title">Agent Activity</span>
      </header>
      <div className="app-content">
        <AgentActivityFeed standalone />
      </div>
    </>
  );
}
