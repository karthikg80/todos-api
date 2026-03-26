// =============================================================================
// mcpSessionsUi.js — Load and render MCP assistant sessions in settings.
// All interpolated values are escaped via hooks.escapeHtml before innerHTML
// assignment, consistent with the project's rendering pattern.
// =============================================================================

import { state, hooks } from "./store.js";

let sessionsLoaded = false;

export async function loadMcpSessions() {
  if (!state.currentUser) return;
  const container = document.getElementById("mcpSessionsList");
  if (!(container instanceof HTMLElement)) return;

  try {
    const response = await fetch("/auth/mcp/sessions", {
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
      },
    });
    if (!response.ok) {
      container.innerHTML =
        '<div class="mcp-sessions-empty">Could not load sessions.</div>';
      return;
    }
    const data = await response.json();
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    renderMcpSessions(sessions);
    sessionsLoaded = true;
  } catch {
    container.innerHTML =
      '<div class="mcp-sessions-empty">Could not load sessions.</div>';
  }
}

function renderMcpSessions(sessions) {
  const container = document.getElementById("mcpSessionsList");
  const revokeAllBtn = document.getElementById("revokeAllSessionsBtn");
  if (!(container instanceof HTMLElement)) return;

  if (sessions.length === 0) {
    container.innerHTML =
      '<div class="mcp-sessions-empty">No assistants connected yet.</div>';
    if (revokeAllBtn instanceof HTMLElement)
      revokeAllBtn.style.display = "none";
    return;
  }

  if (revokeAllBtn instanceof HTMLElement) revokeAllBtn.style.display = "";

  const escapeHtml = hooks.escapeHtml || ((s) => String(s));
  // All values below are escaped — safe for innerHTML (project convention)
  container.innerHTML = sessions
    .map((session) => {
      const name = escapeHtml(
        session.clientName || session.clientId || "Unknown assistant",
      );
      const scopes = escapeHtml(
        Array.isArray(session.scopes)
          ? session.scopes.join(", ")
          : session.scope || "",
      );
      const lastUsed = session.lastUsedAt
        ? new Date(session.lastUsedAt).toLocaleDateString()
        : "Never";
      const sessionId = escapeHtml(session.id || session.tokenId || "");
      return `
        <div class="mcp-session-row" data-session-id="${sessionId}">
          <span class="mcp-session-row__name">${name}</span>
          <span class="mcp-session-row__meta">${scopes}</span>
          <span class="mcp-session-row__meta">Last used: ${escapeHtml(lastUsed)}</span>
          <button type="button" class="mcp-session-row__revoke"
                  data-onclick="revokeMcpSession('${sessionId}')">
            Revoke
          </button>
        </div>`;
    })
    .join("");
}

export async function revokeMcpSession(sessionId) {
  if (!state.currentUser || !sessionId) return;
  try {
    await fetch(`/auth/mcp/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
      },
    });
    await loadMcpSessions();
  } catch {
    // Session list will refresh on next settings open
  }
}

export async function revokeAllMcpSessions() {
  if (!state.currentUser) return;
  try {
    await fetch("/auth/mcp/sessions", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
      },
    });
    await loadMcpSessions();
  } catch {
    // Session list will refresh on next settings open
  }
}

export function initMcpSessionsUi() {
  sessionsLoaded = false;
}
