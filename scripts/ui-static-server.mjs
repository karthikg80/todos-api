import http from "http";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../client");
const reactRoot = resolveFirstBuildRoot(
  [path.resolve(__dirname, "../client-react/dist"), path.resolve(__dirname, "../dist")],
  "index.html",
);
const landingRoot = resolveFirstBuildRoot(
  [path.resolve(__dirname, "../client-react/dist-landing"), path.resolve(__dirname, "../dist-landing")],
  "index.html",
);
const authRoot = resolveFirstBuildRoot(
  [path.resolve(__dirname, "../client-react/dist-auth"), path.resolve(__dirname, "../dist-auth")],
  "index.html",
);
const vendorRoots = [
  {
    prefix: "/vendor/chrono-node/",
    root: path.resolve(__dirname, "../node_modules/chrono-node/dist/esm"),
  },
];
const port = Number.parseInt(process.env.UI_PORT || "4173", 10);

function resolveFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function resolveFirstBuildRoot(candidates, entryFile) {
  for (const candidate of candidates) {
    if (fsSync.existsSync(path.join(candidate, entryFile))) {
      return candidate;
    }
  }

  return resolveFirstExistingPath(candidates);
}

function resolveFirstExistingFile(candidates) {
  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function safePathForRoot(requestPath, baseRoot) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, "");
  const resolved = path.resolve(baseRoot, normalized || "index.html");
  if (!resolved.startsWith(baseRoot)) {
    return null;
  }
  return resolved;
}

function safePath(requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);

  for (const vendorRoot of vendorRoots) {
    if (!decoded.startsWith(vendorRoot.prefix)) continue;
    const relativePath = decoded.slice(vendorRoot.prefix.length);
    return safePathForRoot(relativePath, vendorRoot.root);
  }

  return safePathForRoot(decoded, root);
}

// Standalone page routes — map product URLs to their HTML files
const standaloneRoutes = {
  "/auth": resolveFirstExistingFile([
    path.join(authRoot, "auth.html"),
    path.join(authRoot, "index.html"),
    path.join(root, "public", "auth.html"),
  ]),
  "/feedback": resolveFirstExistingFile([
    path.join(landingRoot, "index.html"),
    path.join(reactRoot, "index.html"),
    path.join(root, "public", "feedback.html"),
  ]),
  "/feedback/new": resolveFirstExistingFile([
    path.join(landingRoot, "index.html"),
    path.join(root, "public", "feedback-new.html"),
  ]),
};

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url || "/";
    const pathname = urlPath.split("?")[0];

    // Mock API endpoints — return empty data so the React app can render.
    const apiHandlers = {
      "POST:/auth/login": () =>
        JSON.stringify({
          token: "mock",
          refreshToken: "mock",
          user: { id: "mock-user", name: "Test User", email: "test@example.com" },
        }),
      "POST:/auth/refresh": () => JSON.stringify({ token: "mock", refreshToken: "mock" }),
      "GET:/users/me": () =>
        JSON.stringify({
          id: "mock-user",
          name: "Test User",
          email: "test@example.com",
          onboardingCompletedAt: new Date().toISOString(),
          onboardingStep: 4,
        }),
      "GET:/users/me/settings": () => JSON.stringify({}),
      "GET:/todos": () => JSON.stringify([]),
      "GET:/projects": () => JSON.stringify([]),
      "GET:/tuneup": () => JSON.stringify({ stale: [], staleByCategory: [], myopic: [], myopicByCategory: [] }),
      "GET:/ai/focus-brief": () =>
        JSON.stringify({
          pinned: {
            rightNow: { narrative: "No tasks to focus on right now.", urgentItems: [], topRecommendation: null },
            todayAgenda: [],
            rightNowProvenance: { source: "deterministic" },
            todayAgendaProvenance: { source: "deterministic" },
          },
          rankedPanels: [],
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          cached: false,
          isStale: false,
        }),
      "GET:/activity": () => JSON.stringify({ entries: [] }),
      "GET:/search": () => JSON.stringify({ results: [] }),
      "GET:/agent-profiles": () => JSON.stringify([]),
    };

    const apiMethod = (req.method || "GET").toUpperCase();
    const apiHandlerKey = `${apiMethod}:${pathname}`;

    const handler = apiHandlers[apiHandlerKey] || apiHandlers[`GET:${pathname}`];
    if (handler) {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(handler());
      return;
    }

    const apiPaths = ["/users", "/todos", "/projects", "/tuneup", "/ai/", "/activity", "/search", "/auth/", "/agent-profiles"];
    const isApiPath = apiPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (["POST", "PUT", "PATCH", "DELETE"].includes(apiMethod) && isApiPath) {
      if (req.readable) {
        await new Promise((resolve) => {
          req.on("data", () => {});
          req.on("end", resolve);
        });
      }
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (pathname === "/") {
      const landingFile = resolveFirstExistingFile([
        path.join(landingRoot, "landing.html"),
        path.join(landingRoot, "index.html"),
        path.join(root, "index.html"),
      ]);
      if (landingFile && fsSync.existsSync(landingFile)) {
        const body = await fs.readFile(landingFile);
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(body);
        return;
      }
    }

    const standaloneFile = standaloneRoutes[pathname];
    if (standaloneFile && fsSync.existsSync(standaloneFile)) {
      const body = await fs.readFile(standaloneFile);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(body);
      return;
    }

    if (pathname === "/app-classic" || pathname.startsWith("/app-classic/")) {
      const relative = pathname.replace(/^\/app-classic\/?/, "") || "app.html";
      const classicRoot = path.join(root, "public");
      const classicFile = safePathForRoot(relative, classicRoot);
      if (classicFile) {
        try {
          const stat = await fs.stat(classicFile);
          if (stat.isFile()) {
            const ext = path.extname(classicFile).toLowerCase();
            const body = await fs.readFile(classicFile);
            res.writeHead(200, {
              "Content-Type": contentTypes[ext] || "application/octet-stream",
              "Cache-Control": "no-store",
            });
            res.end(body);
            return;
          }
        } catch {
          // File not found — fall through to SPA fallback
        }
      }
      const fallback = path.join(classicRoot, "app.html");
      const body = await fs.readFile(fallback);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(body);
      return;
    }

    if (pathname === "/app-react" || pathname.startsWith("/app-react/")) {
      const newPath = pathname.replace(/^\/app-react/, "/app") || "/app";
      const qs = urlPath.includes("?") ? urlPath.slice(urlPath.indexOf("?")) : "";
      res.writeHead(302, { Location: newPath + qs });
      res.end();
      return;
    }

    if (pathname === "/app" || pathname.startsWith("/app/")) {
      const relative = pathname.replace(/^\/app\/?/, "") || "index.html";
      const reactFile = safePathForRoot(relative, reactRoot);
      if (reactFile) {
        try {
          const stat = await fs.stat(reactFile);
          if (stat.isFile()) {
            const ext = path.extname(reactFile).toLowerCase();
            const body = await fs.readFile(reactFile);
            res.writeHead(200, {
              "Content-Type": contentTypes[ext] || "application/octet-stream",
              "Cache-Control": "no-store",
            });
            res.end(body);
            return;
          }
        } catch {
          // File not found — fall through to SPA fallback
        }
      }
      const fallback = path.join(reactRoot, "index.html");
      const body = await fs.readFile(fallback);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(body);
      return;
    }

    let filePath = safePath(urlPath);

    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<h1>404 — Page not found</h1><p>Use /app/ for the React app, /auth for auth, or / for the landing page.</p>",
      );
      return;
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
    } catch {
      filePath = path.join(root, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const body = await fs.readFile(filePath);

    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`UI static server listening on http://127.0.0.1:${port}`);
});
