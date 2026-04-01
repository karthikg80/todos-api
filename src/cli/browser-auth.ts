import http from "http";
import { URL } from "url";
import { execFile } from "child_process";
import { loadConfig, saveConfig, resolveApiUrl } from "./config";
import { spinner, printError } from "./output";

const AUTH_TIMEOUT_MS = 120_000; // 2 minutes

interface AuthResult {
  token: string;
  refreshToken: string;
  email?: string;
}

/**
 * Opens the browser for OAuth login and waits for the callback.
 *
 * Flow:
 * 1. Start a temporary HTTP server on a random port (localhost only)
 * 2. Open browser to {apiUrl}/auth/cli/google?port={port}
 * 3. Server does Google OAuth, then redirects to http://localhost:{port}/callback?token=...
 * 4. We receive tokens, store them, respond with success HTML, shut down
 */
export async function browserLogin(apiUrlOverride?: string): Promise<void> {
  const apiUrl = resolveApiUrl(apiUrlOverride);
  const s = spinner("Opening browser for login...").start();

  try {
    const result = await startCallbackServer(apiUrl);

    const config = loadConfig();
    config.accessToken = result.token;
    config.refreshToken = result.refreshToken;
    if (result.email) {
      config.user = { id: "", email: result.email };
    }
    saveConfig(config);

    s.succeed(`Logged in${result.email ? ` as ${result.email}` : ""}`);

    // Fetch full user info to update config
    try {
      const res = await fetch(`${apiUrl}/users/me`, {
        headers: { Authorization: `Bearer ${result.token}` },
      });
      if (res.ok) {
        const user = (await res.json()) as {
          id?: string;
          userId?: string;
          email?: string;
          name?: string;
        };
        const updated = loadConfig();
        updated.user = {
          id: user.id || user.userId || "",
          email: user.email || result.email || "",
          name: user.name,
        };
        saveConfig(updated);
      }
    } catch {
      // Non-critical — we already have the tokens
    }
  } catch (err) {
    s.fail("Login failed");
    if (err instanceof Error) {
      printError(err.message);
    }
    process.exitCode = 1;
  }
}

function startCallbackServer(apiUrl: string): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      try {
        const url = new URL(req.url, `http://localhost`);
        const token = url.searchParams.get("token");
        const refreshToken = url.searchParams.get("refreshToken");
        const email = url.searchParams.get("email") || undefined;
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(errorHtml(error));
          cleanup();
          if (!settled) {
            settled = true;
            reject(new Error(error));
          }
          return;
        }

        if (!token || !refreshToken) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(errorHtml("Missing tokens in callback"));
          cleanup();
          if (!settled) {
            settled = true;
            reject(new Error("Missing tokens in callback"));
          }
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(successHtml());
        cleanup();

        if (!settled) {
          settled = true;
          resolve({ token, refreshToken, email });
        }
      } catch (err) {
        res.writeHead(500);
        res.end("Internal error");
        cleanup();
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });

    // Listen on random port, localhost only
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start callback server"));
        return;
      }

      const port = addr.port;
      const loginUrl = `${apiUrl}/auth/cli/google?port=${port}`;

      openBrowser(loginUrl);

      // Update spinner text
      process.stderr.write(
        `\r\x1b[K  Waiting for authentication... (press Ctrl+C to cancel)\n`,
      );
    });

    // Timeout
    const timeout = setTimeout(() => {
      cleanup();
      if (!settled) {
        settled = true;
        reject(new Error("Login timed out. Please try again."));
      }
    }, AUTH_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      server.close();
    }
  });
}

function openBrowser(url: string): void {
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      execFile("open", [url]);
    } else if (platform === "win32") {
      execFile("cmd", ["/c", "start", "", url]);
    } else {
      execFile("xdg-open", [url]);
    }
  } catch {
    // If we can't open the browser, print the URL
    process.stderr.write(`\n  Open this URL in your browser:\n  ${url}\n\n`);
  }
}

function successHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><title>td - Login Successful</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa;">
  <div style="text-align: center;">
    <div style="font-size: 48px; margin-bottom: 16px;">&#10003;</div>
    <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 8px;">Logged in successfully</h1>
    <p style="color: #888; margin: 0;">You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;
}

function errorHtml(message: string): string {
  const safe = message.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!DOCTYPE html>
<html>
<head><title>td - Login Failed</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa;">
  <div style="text-align: center;">
    <div style="font-size: 48px; margin-bottom: 16px;">&#10007;</div>
    <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 8px;">Login failed</h1>
    <p style="color: #f87171; margin: 0;">${safe}</p>
    <p style="color: #888; margin: 16px 0 0;">Please try again in your terminal.</p>
  </div>
</body>
</html>`;
}
