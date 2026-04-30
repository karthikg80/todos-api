import { AgentActivityFeed } from "../home/AgentActivityFeed";
import { ViewHeader } from "../layout/ViewHeader";

interface Props {
  onBack: () => void;
}

export function AgentActivityView({ onBack }: Props) {
  return (
    <>
      <ViewHeader
        crumb="Focus › Agent Activity"
        title="Agent Activity"
        back={{ onClick: onBack }}
      />
      <div className="app-content">
        <AgentActivityFeed standalone />
      </div>
    </>
  );
}
