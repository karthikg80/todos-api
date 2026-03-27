import { Router, Request, Response } from "express";
import { ITodoService } from "../interfaces/ITodoService";

interface CalendarRouterDeps {
  todoService: ITodoService;
  resolveUserId: (req: Request, res: Response) => string | null;
}

function padIcs(value: number): string {
  return String(value).padStart(2, "0");
}

function toIcsUtcTimestamp(d: Date = new Date()): string {
  return (
    `${d.getUTCFullYear()}` +
    padIcs(d.getUTCMonth() + 1) +
    padIcs(d.getUTCDate()) +
    "T" +
    padIcs(d.getUTCHours()) +
    padIcs(d.getUTCMinutes()) +
    padIcs(d.getUTCSeconds()) +
    "Z"
  );
}

function toIcsDateValue(dueDateValue: string | Date | null): string | null {
  if (!dueDateValue) return null;
  const d = new Date(dueDateValue);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}${padIcs(d.getMonth() + 1)}${padIcs(d.getDate())}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line: string, max = 75): string {
  if (line.length <= max) return line;
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += max) {
    chunks.push(line.slice(i, i + max));
  }
  return chunks.join("\r\n ");
}

interface TodoForIcs {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  dueDate?: string | Date | null;
  estimateMinutes?: number | null;
  priority?: string | null;
}

function buildIcsContent(todos: TodoForIcs[]): string {
  const dtStamp = toIcsUtcTimestamp();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//todos-api//Todos Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const todo of todos) {
    const eventDate = toIcsDateValue(todo.dueDate ?? null);
    if (!eventDate) continue;

    const summary = escapeIcsText(todo.title || "Untitled task");
    const detailParts: string[] = [];
    if (todo.description?.trim()) detailParts.push(todo.description.trim());
    if (todo.notes?.trim()) detailParts.push(todo.notes.trim());
    const description = escapeIcsText(detailParts.join("\n\n"));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(todo.id + "@todos-api")}`);
    lines.push(`DTSTAMP:${dtStamp}`);

    const estimatedMins = Number(todo.estimateMinutes || 0);
    if (estimatedMins > 0 && todo.dueDate) {
      const startDate = new Date(todo.dueDate);
      if (!isNaN(startDate.getTime())) {
        const endDate = new Date(startDate.getTime() + estimatedMins * 60_000);
        lines.push(`DTSTART:${toIcsUtcTimestamp(startDate)}`);
        lines.push(`DTEND:${toIcsUtcTimestamp(endDate)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${eventDate}`);
      }
    } else {
      lines.push(`DTSTART;VALUE=DATE:${eventDate}`);
    }

    lines.push(`SUMMARY:${summary}`);
    if (description) {
      lines.push(`DESCRIPTION:${description}`);
    }
    if (todo.priority === "high" || todo.priority === "urgent") {
      lines.push(`PRIORITY:${todo.priority === "urgent" ? "1" : "5"}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map((l) => foldIcsLine(l)).join("\r\n") + "\r\n";
}

export function createCalendarRouter({
  todoService,
  resolveUserId,
}: CalendarRouterDeps): Router {
  const router = Router();

  /**
   * GET /calendar/export.ics
   * Returns an ICS file of the user's upcoming todos with due dates.
   */
  router.get("/export.ics", async (req: Request, res: Response) => {
    const userId = resolveUserId(req, res);
    if (!userId) return;

    try {
      const todos = await todoService.findAll(userId);
      const withDueDates = todos.filter(
        (t: TodoForIcs) =>
          t.dueDate && !("completed" in t && (t as any).completed),
      );

      const icsContent = buildIcsContent(withDueDates);
      const now = new Date();
      const filename = `todos-${now.getFullYear()}-${padIcs(now.getMonth() + 1)}-${padIcs(now.getDate())}.ics`;

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(icsContent);
    } catch (err) {
      console.error("Calendar export failed:", err);
      res.status(500).json({ error: "Failed to generate calendar export" });
    }
  });

  return router;
}
