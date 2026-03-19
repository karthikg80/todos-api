// =============================================================================
// prioritiesBriefRouter.ts — GET /ai/priorities-brief
// Generates an opinionated HTML priorities digest using the configured LLM.
// Response is cached per-user for 4 hours. POST /refresh busts the cache.
// =============================================================================

import { Router, Request, Response } from "express";
import { callLlm, LlmProviderNotConfiguredError } from "../services/llmService";
import { ITodoService } from "../interfaces/ITodoService";
import { IProjectService } from "../interfaces/IProjectService";

interface PrioritiesBriefRouterDeps {
  todoService: ITodoService;
  projectService?: IProjectService;
  resolveUserId: (req: Request, res: Response) => string | null;
}

interface CacheEntry {
  html: string;
  generatedAt: string;
  staleAt: string;
  expiresAt: string;
  staleAtMs: number;
  expiresAtMs: number;
}

const cache = new Map<string, CacheEntry>();
const refreshJobs = new Map<string, Promise<CacheEntry>>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function resetPrioritiesBriefCacheForTests() {
  cache.clear();
  refreshJobs.clear();
}

export function createPrioritiesBriefRouter({
  todoService,
  projectService,
  resolveUserId,
}: PrioritiesBriefRouterDeps): Router {
  const router = Router();

  function buildCacheEntry(html: string, generatedAt = new Date()): CacheEntry {
    const generatedAtMs = generatedAt.getTime();
    const staleAtMs = generatedAtMs + CACHE_TTL_MS;
    return {
      html,
      generatedAt: generatedAt.toISOString(),
      staleAt: new Date(staleAtMs).toISOString(),
      expiresAt: new Date(staleAtMs).toISOString(),
      staleAtMs,
      expiresAtMs: staleAtMs,
    };
  }

  async function generatePrioritiesBriefForUser(
    userId: string,
  ): Promise<CacheEntry> {
    // Fetch tasks and projects in parallel; tolerate individual failures
    const [todosResult, projectsResult] = await Promise.allSettled([
      todoService.findAll(userId, { completed: false }),
      projectService ? projectService.findAll(userId) : Promise.resolve([]),
    ]);

    const todos = todosResult.status === "fulfilled" ? todosResult.value : [];
    const projects =
      projectsResult.status === "fulfilled" ? projectsResult.value : [];

    const todayISO = new Date().toISOString().split("T")[0];

    // Build compact task context (<=40 tasks to keep token count low)
    const taskLines = (Array.isArray(todos) ? todos : [])
      .slice(0, 40)
      .map((t: any) => {
        const parts: string[] = [
          `"${String(t.title || "").replace(/"/g, "'")}"`,
        ];
        if (t.priority) parts.push(`priority:${t.priority}`);
        if (t.dueDate) parts.push(`due:${String(t.dueDate).split("T")[0]}`);
        if (t.estimateMinutes) parts.push(`est:${t.estimateMinutes}m`);
        if (t.waitingOn)
          parts.push(`waiting_on:${String(t.waitingOn).slice(0, 60)}`);
        if (t.status) parts.push(`status:${t.status}`);
        if (t.category)
          parts.push(`project:${String(t.category).slice(0, 40)}`);
        return `- ${parts.join(" ")}`;
      })
      .join("\n");

    const projectLines = (Array.isArray(projects) ? projects : [])
      .map((p: any) => {
        const open = Number(p.openTaskCount ?? p.taskCount ?? 0);
        const parts: string[] = [
          `"${String(p.name || "").replace(/"/g, "'")}"`,
        ];
        parts.push(`area:${p.area ?? "none"}`);
        parts.push(`open_tasks:${open}`);
        if (p.goal) parts.push(`goal:${String(p.goal).slice(0, 80)}`);
        return `- ${parts.join(" ")}`;
      })
      .join("\n");

    const systemPrompt = `You are a personal productivity assistant generating an HTML priorities digest.
Output ONLY the inner HTML — no outer wrapper, no markdown fences, no explanation.
Use only these CSS classes (already defined in the app's stylesheet):

  .lbl             — section label: <div class="lbl">Section title</div>
  .urgent          — red urgent banner:
                     <div class="urgent"><div class="dot-lg r"></div><div><strong>Date — Task.</strong> One sentence context.</div></div>
  .warn            — amber warning:
                     <div class="warn"><div class="dot-lg a"></div><div><strong>Project has 0 tasks.</strong> One sentence.</div></div>
  .track           — 3-column grid: <div class="track"><div>col1</div><div>col2</div><div>col3</div></div>
  .col-head.now    — amber header:  <div class="col-head now">This week</div>
  .col-head.soon   — blue header:   <div class="col-head soon">Next 2 weeks</div>
  .col-head.after  — gray header:   <div class="col-head after">After [month]</div>
  .col-body        — column body:   <div class="col-body">...</div>
  .item            — row in column: <div class="item"><div class="dot r"></div>Task title (Xm)</div>
  dot colors:        r=red  a=amber  g=green  b=blue  p=purple
  .card            — single action: <div class="card"><div class="row"><span class="rn">&#8594;</span><div>
                     <div class="rt">Task title</div><div class="rb">2-3 sentences reasoning.</div></div></div></div>

Output structure (omit a section if nothing to show):
1. Urgent banners — .urgent per task with priority=urgent or overdue dueDate. Max 3.
   Include the due date and one concrete reason why it matters.
2. Three-column track with label "What to do across three tracks" —
   put ALL open tasks in This week / Next 2 weeks / After [next month name].
3. Warn card — only for projects with open_tasks:0. Max 2.
4. Single most impactful card — pick ONE task, write opinionated 2-3 sentence reasoning.
   Name the actual dependency or risk. Be direct. Do not hedge.

Rules:
- Use actual task titles. Use actual due dates. Name who is blocking it.
- Do not fabricate tasks or projects. Only use the data provided.
- Estimate labels in .item rows: format (30m) or (1h).
- Today is ${todayISO}.`;

    const userPrompt = `Open tasks:\n${taskLines || "(none)"}\n\nProjects:\n${projectLines || "(none)"}`;

    const html = await callLlm({
      systemPrompt,
      userPrompt,
      maxTokens: 1500,
      temperature: 0.3,
    });

    return buildCacheEntry(html);
  }

  function getResponsePayload(
    entry: CacheEntry,
    {
      cached,
      isStale,
      refreshInFlight,
    }: {
      cached: boolean;
      isStale: boolean;
      refreshInFlight: boolean;
    },
  ) {
    return {
      html: entry.html,
      generatedAt: entry.generatedAt,
      staleAt: entry.staleAt,
      expiresAt: entry.expiresAt,
      cached,
      isStale,
      refreshInFlight,
    };
  }

  function startRefresh(userId: string): Promise<CacheEntry> {
    const existing = refreshJobs.get(userId);
    if (existing) return existing;

    const refreshJob = generatePrioritiesBriefForUser(userId)
      .then((entry) => {
        cache.set(userId, entry);
        return entry;
      })
      .finally(() => {
        refreshJobs.delete(userId);
      });

    refreshJobs.set(userId, refreshJob);
    return refreshJob;
  }

  router.get("/priorities-brief", async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req, res);
      if (!userId) return;

      const cached = cache.get(userId);
      const now = Date.now();
      if (cached) {
        const isStale = cached.staleAtMs <= now;
        if (isStale && !refreshJobs.has(userId)) {
          void startRefresh(userId).catch((err) => {
            console.error("priorities-brief background refresh error:", err);
          });
        }

        return res.json(
          getResponsePayload(cached, {
            cached: true,
            isStale,
            refreshInFlight: refreshJobs.has(userId),
          }),
        );
      }

      const entry = refreshJobs.has(userId)
        ? await refreshJobs.get(userId)!
        : await startRefresh(userId);
      return res.json(
        getResponsePayload(entry, {
          cached: false,
          isStale: false,
          refreshInFlight: false,
        }),
      );
    } catch (err) {
      if (err instanceof LlmProviderNotConfiguredError) {
        return res.status(503).json({ error: err.message });
      }
      console.error("priorities-brief error:", err);
      return res
        .status(500)
        .json({ error: "Failed to generate priorities brief" });
    }
  });

  // Cache-bust endpoint
  router.post(
    "/priorities-brief/refresh",
    async (req: Request, res: Response) => {
      try {
        const userId = resolveUserId(req, res);
        if (!userId) return;

        const cached = cache.get(userId) || null;
        if (!refreshJobs.has(userId)) {
          void startRefresh(userId).catch((err) => {
            console.error("priorities-brief forced refresh error:", err);
          });
        }

        if (!cached) {
          const entry = await refreshJobs.get(userId)!;
          return res.json({
            ok: true,
            refreshStarted: true,
            ...getResponsePayload(entry, {
              cached: false,
              isStale: false,
              refreshInFlight: false,
            }),
          });
        }

        return res.status(202).json({
          ok: true,
          refreshStarted: true,
          ...getResponsePayload(cached, {
            cached: true,
            isStale: cached.staleAtMs <= Date.now(),
            refreshInFlight: true,
          }),
        });
      } catch (err) {
        if (err instanceof LlmProviderNotConfiguredError) {
          return res.status(503).json({ error: err.message });
        }
        console.error("priorities-brief refresh error:", err);
        return res
          .status(500)
          .json({ error: "Failed to refresh priorities brief" });
      }
    },
  );

  return router;
}
