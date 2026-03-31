import pc from "picocolors";
import Table from "cli-table3";

// Spinner — lightweight CJS-compatible alternative to ora (which is ESM-only)
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  start(): this {
    if (!process.stderr.isTTY) return this;
    this.interval = setInterval(() => {
      const symbol = SPINNER_FRAMES[this.frame % SPINNER_FRAMES.length];
      process.stderr.write(`\r${pc.cyan(symbol)} ${this.text}`);
      this.frame++;
    }, 80);
    return this;
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stderr.write("\r\x1b[K"); // clear line
    }
  }

  succeed(msg?: string): void {
    this.stop();
    if (process.stderr.isTTY) {
      process.stderr.write(`\r${pc.green("✓")} ${msg || this.text}\n`);
    }
  }

  fail(msg?: string): void {
    this.stop();
    process.stderr.write(`\r${pc.red("✗")} ${msg || this.text}\n`);
  }
}

export function spinner(text: string): Spinner {
  return new Spinner(text);
}

// Priority display
const PRIORITY_COLORS: Record<string, (s: string) => string> = {
  urgent: pc.red,
  high: pc.yellow,
  medium: pc.blue,
  low: pc.dim,
};

export function colorPriority(priority: string | null | undefined): string {
  if (!priority) return pc.dim("—");
  const colorFn = PRIORITY_COLORS[priority] || pc.white;
  return colorFn(priority);
}

// Status display
const STATUS_SYMBOLS: Record<string, string> = {
  done: pc.green("✓"),
  cancelled: pc.red("✗"),
  in_progress: pc.yellow("●"),
  next: pc.cyan("→"),
  waiting: pc.magenta("⏳"),
  scheduled: pc.blue("📅"),
  someday: pc.dim("☁"),
  inbox: pc.dim("○"),
};

export function statusSymbol(status: string | null | undefined): string {
  if (!status) return pc.dim("○");
  return STATUS_SYMBOLS[status] || pc.dim(status);
}

// Short ID (first 8 chars, like git)
export function shortId(id: string): string {
  return pc.dim(id.slice(0, 8));
}

// Todo table
export function formatTodoTable(
  todos: any[],
  opts?: { noColor?: boolean },
): string {
  if (todos.length === 0) return pc.dim("No todos found.");

  const table = new Table({
    head: ["ID", "Status", "Title", "Priority", "Due"].map((h) =>
      opts?.noColor ? h : pc.bold(h),
    ),
    style: { head: [], border: [] },
    colWidths: [10, 4, 40, 10, 12],
    wordWrap: true,
  });

  for (const todo of todos) {
    table.push([
      shortId(todo.id),
      statusSymbol(todo.status),
      todo.title || "",
      colorPriority(todo.priority),
      formatDate(todo.dueDate),
    ]);
  }

  return table.toString();
}

// Todo detail view
export function formatTodoDetail(todo: any): string {
  const lines: string[] = [
    `${pc.bold("ID:")}       ${todo.id}`,
    `${pc.bold("Title:")}    ${todo.title}`,
    `${pc.bold("Status:")}   ${statusSymbol(todo.status)} ${todo.status || "—"}`,
    `${pc.bold("Priority:")} ${colorPriority(todo.priority)}`,
  ];

  if (todo.description) {
    lines.push(`${pc.bold("Desc:")}     ${todo.description}`);
  }
  if (todo.dueDate) {
    lines.push(`${pc.bold("Due:")}      ${todo.dueDate}`);
  }
  if (todo.project?.name) {
    lines.push(`${pc.bold("Project:")}  ${todo.project.name}`);
  }
  if (todo.tags?.length) {
    lines.push(`${pc.bold("Tags:")}     ${todo.tags.join(", ")}`);
  }
  if (todo.notes) {
    lines.push(`${pc.bold("Notes:")}    ${todo.notes}`);
  }
  lines.push(`${pc.bold("Created:")}  ${todo.createdAt || "—"}`);
  lines.push(`${pc.bold("Updated:")}  ${todo.updatedAt || "—"}`);

  return lines.join("\n");
}

// User detail
export function formatUserInfo(user: any): string {
  const lines = [
    `${pc.bold("ID:")}    ${user.id || user.userId}`,
    `${pc.bold("Email:")} ${user.email}`,
  ];
  if (user.name) lines.push(`${pc.bold("Name:")}  ${user.name}`);
  if (user.role) lines.push(`${pc.bold("Role:")}  ${user.role}`);
  if (user.plan) lines.push(`${pc.bold("Plan:")}  ${user.plan}`);
  return lines.join("\n");
}

// Date formatting
function formatDate(date: string | null | undefined): string {
  if (!date) return pc.dim("—");
  try {
    const d = new Date(date);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return pc.yellow("today");
    if (diffDays === 1) return pc.cyan("tomorrow");
    if (diffDays === -1) return pc.red("yesterday");
    if (diffDays < -1) return pc.red(`${Math.abs(diffDays)}d ago`);
    if (diffDays <= 7) return pc.cyan(`in ${diffDays}d`);
    return pc.dim(d.toISOString().slice(0, 10));
  } catch {
    return pc.dim(date);
  }
}

// JSON output mode
export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// Error display
export function printError(msg: string): void {
  console.error(`${pc.red("Error:")} ${msg}`);
}

// Success display
export function printSuccess(msg: string): void {
  console.log(`${pc.green("✓")} ${msg}`);
}
