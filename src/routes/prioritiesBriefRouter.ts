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
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function createPrioritiesBriefRouter({
  todoService,
  projectService,
  resolveUserId,
}: PrioritiesBriefRouterDeps): Router {
  const router = Router();

  router.get("/priorities-brief", async (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req, res);
      if (!userId) return;

      // Serve from cache if still fresh
      const cached = cache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        return res.json({
          html: cached.html,
          generatedAt: cached.generatedAt,
          cached: true,
        });
      }

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
      const generatedAt = new Date().toISOString();

      cache.set(userId, {
        html,
        generatedAt,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return res.json({ html, generatedAt, cached: false });
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
  router.post("/priorities-brief/refresh", (req: Request, res: Response) => {
    const userId = resolveUserId(req, res);
    if (!userId) return;
    cache.delete(userId);
    return res.json({ ok: true });
  });

  return router;
}
