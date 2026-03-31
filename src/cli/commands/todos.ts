import { Command } from "commander";
import { ApiClient, ApiError } from "../client";
import { isLoggedIn } from "../config";
import {
  spinner,
  formatTodoTable,
  formatTodoDetail,
  printJson,
  printError,
  printSuccess,
} from "../output";

function requireAuth(): boolean {
  if (!isLoggedIn()) {
    printError("Not logged in. Run `td login` first.");
    process.exitCode = 1;
    return false;
  }
  return true;
}

export function registerTodoCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  // td add "title" [options]
  program
    .command("add")
    .description("Create a new todo")
    .argument("<title>", "Todo title")
    .option("-p, --priority <level>", "Priority: low, medium, high, urgent")
    .option(
      "-s, --status <status>",
      "Status: inbox, next, in_progress, waiting, scheduled, someday",
      "inbox",
    )
    .option("-d, --due <date>", "Due date (YYYY-MM-DD)")
    .option("--project <id>", "Project ID")
    .option("--description <text>", "Description")
    .option("-e, --energy <level>", "Energy: low, medium, high")
    .option("-t, --tags <tags>", "Comma-separated tags")
    .action(async (title: string, opts: any) => {
      const globalOpts = program.opts();
      if (!requireAuth()) return;

      try {
        const body: Record<string, any> = { title, status: opts.status };
        if (opts.priority) body.priority = opts.priority;
        if (opts.due) body.dueDate = opts.due;
        if (opts.project) body.projectId = opts.project;
        if (opts.description) body.description = opts.description;
        if (opts.energy) body.energy = opts.energy;
        if (opts.tags)
          body.tags = opts.tags.split(",").map((t: string) => t.trim());

        const s = spinner("Creating todo...").start();
        const client = getClient();
        const todo = await client.post("/todos", body);
        s.stop();

        if (globalOpts.json) {
          printJson(todo);
        } else {
          printSuccess(`Created: ${todo.title} [${todo.id.slice(0, 8)}]`);
        }
      } catch (err) {
        if (err instanceof ApiError) printError(err.message);
        else printError("Failed to create todo.");
        process.exitCode = 1;
      }
    });

  // td list [options]
  program
    .command("list")
    .alias("ls")
    .description("List todos")
    .option("-s, --status <status>", "Filter by status")
    .option("-p, --priority <level>", "Filter by priority")
    .option("--project <id>", "Filter by project ID")
    .option("--completed", "Include completed todos")
    .option("--archived", "Include archived todos")
    .option(
      "--sort <field>",
      "Sort by: order, createdAt, updatedAt, dueDate, priority, title",
    )
    .option("--order <dir>", "Sort direction: asc, desc")
    .option("-l, --limit <n>", "Max results", "50")
    .action(async (opts: any) => {
      const globalOpts = program.opts();
      if (!requireAuth()) return;

      try {
        const params = new URLSearchParams();
        if (opts.status) params.set("status", opts.status);
        if (opts.priority) params.set("priority", opts.priority);
        if (opts.project) params.set("projectId", opts.project);
        if (opts.completed) params.set("completed", "true");
        if (opts.archived) params.set("archived", "true");
        if (opts.sort) params.set("sortBy", opts.sort);
        if (opts.order) params.set("sortOrder", opts.order);
        if (opts.limit) params.set("limit", opts.limit);

        const query = params.toString();
        const path = `/todos${query ? `?${query}` : ""}`;

        const s = spinner("Fetching todos...").start();
        const client = getClient();
        const result = await client.get(path);
        s.stop();

        // API may return {data: [...], total: N} or just an array
        const todos = Array.isArray(result) ? result : result.data || [];

        if (globalOpts.json) {
          printJson(result);
        } else {
          console.log(formatTodoTable(todos));
          if (!Array.isArray(result) && result.total !== undefined) {
            console.log(`\n${todos.length} of ${result.total} todos`);
          }
        }
      } catch (err) {
        if (err instanceof ApiError) printError(err.message);
        else printError("Failed to list todos.");
        process.exitCode = 1;
      }
    });

  // td get <id>
  program
    .command("get")
    .description("Show todo details")
    .argument("<id>", "Todo ID (full or short)")
    .action(async (id: string) => {
      const globalOpts = program.opts();
      if (!requireAuth()) return;

      try {
        const s = spinner("Fetching todo...").start();
        const client = getClient();
        const todo = await client.get(`/todos/${id}`);
        s.stop();

        if (globalOpts.json) {
          printJson(todo);
        } else {
          console.log(formatTodoDetail(todo));
        }
      } catch (err) {
        if (err instanceof ApiError) printError(err.message);
        else printError("Failed to fetch todo.");
        process.exitCode = 1;
      }
    });

  // td complete <id>
  program
    .command("complete")
    .alias("done")
    .description("Mark a todo as complete")
    .argument("<id>", "Todo ID")
    .action(async (id: string) => {
      const globalOpts = program.opts();
      if (!requireAuth()) return;

      try {
        const s = spinner("Completing todo...").start();
        const client = getClient();
        const todo = await client.put(`/todos/${id}`, {
          completed: true,
          status: "done",
        });
        s.stop();

        if (globalOpts.json) {
          printJson(todo);
        } else {
          printSuccess(`Completed: ${todo.title}`);
        }
      } catch (err) {
        if (err instanceof ApiError) printError(err.message);
        else printError("Failed to complete todo.");
        process.exitCode = 1;
      }
    });

  // td update <id> [options]
  program
    .command("update")
    .description("Update a todo")
    .argument("<id>", "Todo ID")
    .option("--title <title>", "New title")
    .option("-p, --priority <level>", "Priority: low, medium, high, urgent")
    .option("-s, --status <status>", "Status")
    .option("-d, --due <date>", "Due date (YYYY-MM-DD)")
    .option("--project <id>", "Project ID")
    .option("--description <text>", "Description")
    .option("-e, --energy <level>", "Energy: low, medium, high")
    .option("--notes <text>", "Notes")
    .action(async (id: string, opts: any) => {
      const globalOpts = program.opts();
      if (!requireAuth()) return;

      try {
        const body: Record<string, any> = {};
        if (opts.title) body.title = opts.title;
        if (opts.priority) body.priority = opts.priority;
        if (opts.status) body.status = opts.status;
        if (opts.due) body.dueDate = opts.due;
        if (opts.project) body.projectId = opts.project;
        if (opts.description) body.description = opts.description;
        if (opts.energy) body.energy = opts.energy;
        if (opts.notes) body.notes = opts.notes;

        if (Object.keys(body).length === 0) {
          printError(
            "No fields to update. Use --title, --priority, --status, etc.",
          );
          process.exitCode = 1;
          return;
        }

        const s = spinner("Updating todo...").start();
        const client = getClient();
        const todo = await client.put(`/todos/${id}`, body);
        s.stop();

        if (globalOpts.json) {
          printJson(todo);
        } else {
          printSuccess(`Updated: ${todo.title} [${todo.id.slice(0, 8)}]`);
        }
      } catch (err) {
        if (err instanceof ApiError) printError(err.message);
        else printError("Failed to update todo.");
        process.exitCode = 1;
      }
    });

  // td delete <id>
  program
    .command("delete")
    .alias("rm")
    .description("Delete a todo")
    .argument("<id>", "Todo ID")
    .action(async (id: string) => {
      const globalOpts = program.opts();
      if (!requireAuth()) return;

      try {
        const s = spinner("Deleting todo...").start();
        const client = getClient();
        await client.delete(`/todos/${id}`);
        s.stop();

        if (globalOpts.json) {
          printJson({ deleted: true, id });
        } else {
          printSuccess(`Deleted todo ${id.slice(0, 8)}`);
        }
      } catch (err) {
        if (err instanceof ApiError) printError(err.message);
        else printError("Failed to delete todo.");
        process.exitCode = 1;
      }
    });
}
