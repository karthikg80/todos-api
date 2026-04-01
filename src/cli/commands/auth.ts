import { Command } from "commander";
import { ApiClient, ApiError } from "../client";
import { loadConfig, saveConfig, clearAuth, isLoggedIn } from "../config";
import { promptInput, promptPassword } from "../auth";
import { browserLogin } from "../browser-auth";
import {
  spinner,
  formatUserInfo,
  printJson,
  printError,
  printSuccess,
} from "../output";

export function registerAuthCommands(
  program: Command,
  getClient: () => ApiClient,
): void {
  program
    .command("login")
    .description("Log in to your account (opens browser by default)")
    .option("--password", "Use email/password instead of browser OAuth")
    .action(async (opts: { password?: boolean }) => {
      try {
        if (isLoggedIn()) {
          const config = loadConfig();
          console.log(
            `Already logged in as ${config.user?.email || "unknown"}. Run \`td logout\` first.`,
          );
          return;
        }

        const globalOpts = program.opts();
        if (opts.password) {
          await passwordLogin(getClient, globalOpts.apiUrl);
        } else {
          await browserLogin(globalOpts.apiUrl);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          printError(err.message);
        } else {
          printError(err instanceof Error ? err.message : "Login failed.");
        }
        process.exitCode = 1;
      }
    });

  program
    .command("logout")
    .description("Log out and clear stored credentials")
    .action(async () => {
      try {
        if (!isLoggedIn()) {
          console.log("Not logged in.");
          return;
        }

        const config = loadConfig();
        const client = getClient();

        const s = spinner("Logging out...").start();
        try {
          await client.post("/auth/logout", {
            refreshToken: config.refreshToken,
          });
        } catch {
          // Server-side logout failure is not critical
        }

        clearAuth();
        s.succeed("Logged out.");
      } catch (err) {
        clearAuth();
        printSuccess("Logged out (locally).");
      }
    });

  program
    .command("whoami")
    .description("Show current user info")
    .action(async () => {
      const opts = program.opts();
      try {
        if (!isLoggedIn()) {
          printError("Not logged in. Run `td login` first.");
          process.exitCode = 1;
          return;
        }

        const s = spinner("Fetching user info...").start();
        const client = getClient();
        const user = await client.get("/users/me");
        s.stop();

        if (opts.json) {
          printJson(user);
        } else {
          console.log(formatUserInfo(user));
        }
      } catch (err) {
        if (err instanceof ApiError) {
          printError(err.message);
        } else {
          printError("Failed to fetch user info.");
        }
        process.exitCode = 1;
      }
    });
}

async function passwordLogin(
  getClient: () => ApiClient,
  apiUrlOverride?: string,
): Promise<void> {
  const email = await promptInput("Email: ");
  const password = await promptPassword("Password: ");

  if (!email || !password) {
    printError("Email and password are required.");
    process.exitCode = 1;
    return;
  }

  const s = spinner("Logging in...").start();
  const client = getClient();
  const result = await client.post("/auth/login", { email, password });

  const config = loadConfig();
  if (apiUrlOverride) config.apiUrl = apiUrlOverride;
  config.accessToken = result.accessToken;
  config.refreshToken = result.refreshToken;
  config.user = result.user || { id: result.userId, email };
  saveConfig(config);

  s.succeed(`Logged in as ${email}`);
}
