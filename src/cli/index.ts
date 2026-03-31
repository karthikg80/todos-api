#!/usr/bin/env node

import { Command } from "commander";
import { ApiClient } from "./client";
import { registerAuthCommands } from "./commands/auth";
import { registerTodoCommands } from "./commands/todos";

const program = new Command();

program
  .name("td")
  .description("CLI for managing your todos")
  .version("1.0.0")
  .option("--json", "Output raw JSON")
  .option("--no-color", "Disable colors")
  .option("--api-url <url>", "Override API base URL");

// Lazy-init client so global --api-url flag is resolved first
function getClient(): ApiClient {
  return new ApiClient(program.opts().apiUrl);
}

registerAuthCommands(program, getClient);
registerTodoCommands(program, getClient);

program.parseAsync(process.argv).catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
