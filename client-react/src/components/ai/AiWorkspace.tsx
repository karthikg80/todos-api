import { useState, useEffect, useCallback } from "react";
import * as aiApi from "../../api/ai";

interface AiUsage {
  used: number;
  limit: number;
  remaining: number;
}

export function AiWorkspace() {
  const [brainDump, setBrainDump] = useState("");
  const [planResult, setPlanResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [activeTab, setActiveTab] = useState<"braindump" | "usage">(
    "braindump",
  );

  useEffect(() => {
    aiApi
      .getAiUsage()
      .then(setUsage)
      .catch(() => {});
  }, []);

  const handleGeneratePlan = useCallback(async () => {
    const text = brainDump.trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    setPlanResult(null);
    try {
      const result = await aiApi.generatePlanFromGoal(text);
      setPlanResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      // Refresh usage
      aiApi
        .getAiUsage()
        .then(setUsage)
        .catch(() => {});
    }
  }, [brainDump, loading]);

  return (
    <div id="aiWorkspace" className="ai-workspace">
      <div className="ai-workspace__tabs">
        <button
          className={`ai-workspace__tab${activeTab === "braindump" ? " ai-workspace__tab--active" : ""}`}
          onClick={() => setActiveTab("braindump")}
        >
          Brain Dump
        </button>
        <button
          className={`ai-workspace__tab${activeTab === "usage" ? " ai-workspace__tab--active" : ""}`}
          onClick={() => setActiveTab("usage")}
        >
          Usage
        </button>
      </div>

      {activeTab === "braindump" && (
        <div className="ai-workspace__body">
          <p className="ai-workspace__hint">
            Write down your thoughts, goals, or a brain dump. AI will help turn
            it into an actionable plan.
          </p>
          <textarea
            id="brainDumpInput"
            className="ai-workspace__textarea"
            placeholder="What's on your mind? Describe a goal, project idea, or brain dump…"
            value={brainDump}
            onChange={(e) => setBrainDump(e.target.value)}
            rows={6}
          />
          <button
            id="brainDumpPlanButton"
            className="btn ai-workspace__btn"
            onClick={handleGeneratePlan}
            disabled={!brainDump.trim() || loading}
          >
            {loading ? "Generating…" : "Generate Plan"}
          </button>
          {error && (
            <div id="aiWorkspaceStatus" className="ai-workspace__error">
              {error}
            </div>
          )}
          {planResult && (
            <div className="ai-workspace__result">
              <h4>Plan Result</h4>
              <pre className="ai-workspace__pre">{planResult}</pre>
            </div>
          )}
        </div>
      )}

      {activeTab === "usage" && (
        <div className="ai-workspace__body">
          {usage ? (
            <div className="ai-usage">
              <div className="ai-usage__bar">
                <div
                  className="ai-usage__fill"
                  style={{
                    width: `${Math.min(100, (usage.used / usage.limit) * 100)}%`,
                  }}
                />
              </div>
              <div className="ai-usage__stats">
                <span>
                  {usage.used} / {usage.limit} used today
                </span>
                <span>{usage.remaining} remaining</span>
              </div>
            </div>
          ) : (
            <p className="ai-workspace__hint">Loading usage data…</p>
          )}
        </div>
      )}
    </div>
  );
}
