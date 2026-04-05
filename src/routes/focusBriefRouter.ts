// =============================================================================
// focusBriefRouter.ts — GET /ai/focus-brief
// Generates a structured focus brief using server-computed panels and LLM output.
// Response is cached per-user for 4 hours and served stale-while-refresh.
// =============================================================================

import { Router, Request, Response } from "express";
import { callLlm, LlmProviderNotConfiguredError } from "../services/llmService";
import { ITodoService } from "../interfaces/ITodoService";
import { IProjectService } from "../interfaces/IProjectService";
import {
  FocusBriefResponse,
  LlmFocusOutput,
  PanelData,
  PanelType,
  RankedPanel,
  WhatNextPanelData,
} from "../types/focusBrief";
import {
  computeTodayAgenda,
  computeUnsorted,
  computeDueSoon,
  computeBacklogHygiene,
  computeProjectsToNudge,
  computeTrackOverview,
  computeRescueMode,
} from "../services/focusBriefService";

interface Deps {
  todoService: ITodoService;
  projectService?: IProjectService;
  resolveUserId: (req: Request, res: Response) => string | null;
}

interface CacheEntry {
  brief: FocusBriefResponse;
  expiresAt: number;
  refreshPromise: Promise<void> | null;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function buildSystemPrompt(todayISO: string): string {
  return `You are a personal productivity assistant. Today is ${todayISO}.

Analyze the user's open tasks and projects and return a JSON object (no markdown fences, no explanation — raw JSON only) with this exact shape:

{
  "rightNow": {
    "urgentItems": [
      { "title": "task title", "dueDate": "YYYY-MM-DD", "reason": "one sentence" }
    ],
    "topRecommendation": {
      "title": "task title",
      "taskId": "task id string",
      "reasoning": "2-3 sentences. Be direct. Name the actual risk or dependency."
    }
  },
  "whatNext": [
    {
      "id": "task id",
      "title": "task title",
      "reason": "why this matters right now",
      "impact": "low|medium|high",
      "effort": "e.g. 30m, 2h, half-day"
    }
  ],
  "panelRanking": [
    { "type": "dueSoon|unsorted|backlogHygiene|projectsToNudge|trackOverview|rescueMode|whatNext", "reason": "why this panel is relevant" }
  ]
}

Rules:
- urgentItems: tasks that are overdue OR have priority=urgent AND due within 7 days. Max 3. Omit if none.
- topRecommendation: the single most impactful task. Omit (null) if no open tasks.
- whatNext: 3-5 high-impact task recommendations ordered by impact. Use actual task ids and titles.
- panelRanking: ordered list of all panel types relevant to the user's situation. Include "whatNext" as a panel type.
- Do not fabricate tasks or projects. Only use data provided.
- Return null for topRecommendation if there are no open tasks.`;
}

function buildUserPrompt(todos: any[], projects: any[], today: Date): string {
  const todayISO = today.toISOString().split("T")[0];
  const taskLines = todos
    .slice(0, 40)
    .map((t: any) => {
      const parts: string[] = [
        `id:${t.id}`,
        `"${String(t.title || "").replace(/"/g, "'")}"`,
      ];
      if (t.priority) parts.push(`priority:${t.priority}`);
      if (t.dueDate) parts.push(`due:${String(t.dueDate).split("T")[0]}`);
      if (t.estimateMinutes) parts.push(`est:${t.estimateMinutes}m`);
      if (t.status) parts.push(`status:${t.status}`);
      if (t.waitingOn)
        parts.push(`waiting_on:${String(t.waitingOn).slice(0, 60)}`);
      if (t.category) parts.push(`project:${String(t.category).slice(0, 40)}`);
      return `- ${parts.join(" ")}`;
    })
    .join("\n");

  const projectLines = (Array.isArray(projects) ? projects : [])
    .map((p: any) => {
      const parts: string[] = [`"${String(p.name || "").replace(/"/g, "'")}"`];
      parts.push(`open_tasks:${p.openTaskCount ?? p.taskCount ?? 0}`);
      if (p.goal) parts.push(`goal:${String(p.goal).slice(0, 80)}`);
      return `- ${parts.join(" ")}`;
    })
    .join("\n");

  return `Today: ${todayISO}\n\nOpen tasks:\n${taskLines || "(none)"}\n\nProjects:\n${projectLines || "(none)"}`;
}

async function generateLlmOutput(
  todos: any[],
  projects: any[],
  today: Date,
): Promise<LlmFocusOutput> {
  const todayISO = today.toISOString().split("T")[0];
  const systemPrompt = buildSystemPrompt(todayISO);
  const userPrompt = buildUserPrompt(todos, projects, today);

  const raw = await callLlm({
    systemPrompt,
    userPrompt,
    maxTokens: 1500,
    temperature: 0.3,
  });

  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  return JSON.parse(cleaned) as LlmFocusOutput;
}

function assembleBrief(
  llmOutput: LlmFocusOutput,
  todos: any[],
  projects: any[],
  today: Date,
  cached: boolean,
  isStale: boolean,
  expiresAt: number,
  generatedAt: string,
): FocusBriefResponse {
  const todayAgenda = computeTodayAgenda(todos, today);

  // Compute all server-side panels
  const panelMap = new Map<PanelType, PanelData>([
    ["unsorted", computeUnsorted(todos)],
    ["dueSoon", computeDueSoon(todos, today)],
    ["backlogHygiene", computeBacklogHygiene(todos, today)],
    ["projectsToNudge", computeProjectsToNudge(projects, todos, today)],
    ["trackOverview", computeTrackOverview(todos, today)],
    ["rescueMode", computeRescueMode(todos, today)],
  ]);

  // Build whatNext panel from LLM output
  const whatNextPanel: WhatNextPanelData = {
    type: "whatNext",
    items: llmOutput.whatNext ?? [],
  };
  panelMap.set("whatNext", whatNextPanel);

  // Build ranked panels using LLM ranking
  const ranking = llmOutput.panelRanking ?? [];
  const rankedPanels: RankedPanel[] = [];
  const seen = new Set<PanelType>();

  for (const entry of ranking) {
    const data = panelMap.get(entry.type);
    if (data && !seen.has(entry.type)) {
      rankedPanels.push({ type: entry.type, reason: entry.reason, data });
      seen.add(entry.type);
    }
  }

  // Append any panels not mentioned by LLM ranking
  for (const [type, data] of panelMap) {
    if (!seen.has(type)) {
      rankedPanels.push({ type, reason: "", data });
    }
  }

  return {
    pinned: {
      rightNow: llmOutput.rightNow ?? {
        urgentItems: [],
        topRecommendation: null,
      },
      todayAgenda,
    },
    rankedPanels,
    generatedAt,
    expiresAt: new Date(expiresAt).toISOString(),
    cached,
    isStale,
  };
}

export function createFocusBriefRouter({
  todoService,
  projectService,
  resolveUserId,
}: Deps): Router {
  const router = Router();

  async function generateEntry(userId: string): Promise<CacheEntry> {
    const today = new Date();

    const [todosResult, projectsResult] = await Promise.allSettled([
      todoService.findAll(userId, { completed: false }),
      projectService ? projectService.findAll(userId) : Promise.resolve([]),
    ]);

    const todos = todosResult.status === "fulfilled" ? todosResult.value : [];
    const projects =
      projectsResult.status === "fulfilled" ? projectsResult.value : [];

    const llmOutput = await generateLlmOutput(todos, projects, today);
    const generatedAt = new Date().toISOString();
    const expiresAt = Date.now() + CACHE_TTL_MS;

    const brief = assembleBrief(
      llmOutput,
      todos,
      projects,
      today,
      false,
      false,
      expiresAt,
      generatedAt,
    );

    return { brief, expiresAt, refreshPromise: null };
  }

  function startBackgroundRefresh(userId: string, existingEntry: CacheEntry) {
    if (existingEntry.refreshPromise) return existingEntry.refreshPromise;

    const refreshPromise = (async () => {
      try {
        const nextEntry = await generateEntry(userId);
        cache.set(userId, nextEntry);
      } catch (err) {
        const current = cache.get(userId);
        if (current) {
          cache.set(userId, { ...current, refreshPromise: null });
        }
        console.error("focus-brief background refresh error:", err);
      }
    })();

    cache.set(userId, { ...existingEntry, refreshPromise });
    return refreshPromise;
  }

  router.get("/focus-brief", async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req, res);
      if (!userId) return;

      const cached = cache.get(userId);

      if (cached && cached.expiresAt > Date.now()) {
        const response: FocusBriefResponse = {
          ...cached.brief,
          cached: true,
          isStale: false,
        };
        return res.json(response);
      }

      if (cached) {
        startBackgroundRefresh(userId, cached);
        const response: FocusBriefResponse = {
          ...cached.brief,
          cached: true,
          isStale: true,
        };
        return res.json(response);
      }

      const freshEntry = await generateEntry(userId);
      cache.set(userId, freshEntry);
      return res.json(freshEntry.brief);
    } catch (err) {
      if (err instanceof LlmProviderNotConfiguredError) {
        return res.status(503).json({ error: err.message });
      }
      console.error("focus-brief error:", err);
      return res.status(500).json({ error: "Failed to generate focus brief" });
    }
  });

  router.post("/focus-brief/refresh", (req: Request, res: Response) => {
    const userId = resolveUserId(req, res);
    if (!userId) return;

    const existing = cache.get(userId);
    if (!existing) {
      return res.json({ ok: true, refreshInFlight: false });
    }

    const staleEntry: CacheEntry = { ...existing, expiresAt: 0 };
    cache.set(userId, staleEntry);
    startBackgroundRefresh(userId, staleEntry);
    return res.json({ ok: true, refreshInFlight: true });
  });

  return router;
}
