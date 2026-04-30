import { useState, useCallback, useEffect } from "react";
import { apiCall } from "../../../api/client";
import type { McpSessionSummary } from "../../../types";

export function IntegrationsTab() {
  const [sessions, setSessions] = useState<McpSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiCall("/auth/mcp/sessions");
      if (!res.ok) {
        throw new Error("Could not load sessions");
      }
      const data = (await res.json()) as { sessions?: McpSessionSummary[] };
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      setMessage("Could not load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const revoke = useCallback(async (id: string) => {
    const res = await apiCall("/auth/mcp/sessions/revoke", {
      method: "POST",
      body: JSON.stringify({ sessionId: id }),
    });
    if (!res.ok) {
      setMessage("Could not revoke session.");
      return;
    }
    setSessions((prev) => prev.filter((session) => session.id !== id));
  }, []);

  const revokeAll = useCallback(async () => {
    const res = await apiCall("/auth/mcp/sessions/revoke", {
      method: "POST",
      body: JSON.stringify({ revokeAll: true }),
    });
    if (!res.ok) {
      setMessage("Could not revoke sessions.");
      return;
    }
    setSessions([]);
  }, []);

  return (
    <section className="settings-section">
      <p className="settings-meta">
        Review connected assistants and revoke access when you no longer need
        it.
      </p>
      {message && <p className="settings-message">{message}</p>}
      {loading ? (
        <p className="settings-meta">Loading…</p>
      ) : sessions.length === 0 ? (
        <p id="mcpSessionsList" className="settings-meta">
          No assistants connected yet.
        </p>
      ) : (
        <>
          <div id="mcpSessionsList" className="mcp-sessions">
            {sessions.map((session) => (
              <div key={session.id} className="mcp-session">
                <div className="mcp-session__body">
                  <span className="mcp-session__name">
                    {session.assistantName ||
                      session.clientId ||
                      "Unknown assistant"}
                  </span>
                  <span className="mcp-session__meta">
                    {session.scopes.length > 0
                      ? session.scopes.join(", ")
                      : "No scopes recorded"}
                  </span>
                  <span className="mcp-session__date">
                    Last used{" "}
                    {session.lastUsedAt
                      ? new Date(session.lastUsedAt).toLocaleDateString()
                      : "never"}
                  </span>
                </div>
                <button className="btn" onClick={() => revoke(session.id)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
          <button className="btn btn--danger" onClick={revokeAll}>
            Revoke all
          </button>
        </>
      )}
    </section>
  );
}
