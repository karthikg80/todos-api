import { useCallback } from "react";
import type { Todo } from "../types";

function escapeIcs(text: string): string {
  return text.replace(/[\\;,\n]/g, (c) => (c === "\n" ? "\\n" : `\\${c}`));
}

function formatIcsDate(date: string): string {
  return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function useIcsExport() {
  return useCallback((todos: Todo[], filename = "todos.ics") => {
    const events = todos
      .filter((t) => t.dueDate)
      .map((t) => {
        const dtStart = formatIcsDate(t.dueDate!);
        return [
          "BEGIN:VEVENT",
          `UID:${t.id}@todos-app`,
          `DTSTART;VALUE=DATE:${dtStart.slice(0, 8)}`,
          `SUMMARY:${escapeIcs(t.title)}`,
          t.description
            ? `DESCRIPTION:${escapeIcs(t.description)}`
            : "",
          `STATUS:${t.completed ? "COMPLETED" : "NEEDS-ACTION"}`,
          "END:VEVENT",
        ]
          .filter(Boolean)
          .join("\r\n");
      });

    if (events.length === 0) return;

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Todos App//React Preview//EN",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);
}
