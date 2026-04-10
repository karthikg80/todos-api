import http from "http";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../client");
const reactRoot = resolveFirstBuildRoot([
  path.resolve(__dirname, "../client-react/dist"),
  path.resolve(__dirname, "../dist"),
], "index.html");
const landingRoot = resolveFirstBuildRoot([
  path.resolve(__dirname, "../client-react/dist-landing"),
  path.resolve(__dirname, "../dist-landing"),
], "index.html");
const authRoot = resolveFirstBuildRoot([
  path.resolve(__dirname, "../client-react/dist-auth"),
  path.resolve(__dirname, "../dist-auth"),
], "index.html");
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
    path.join(authRoot, "index.html"),
    path.join(root, "public", "auth.html"),
  ]),
  "/feedback": resolveFirstExistingFile([
    path.join(landingRoot, "index.html"),
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

    // Check standalone page routes first
    const standaloneFile = standaloneRoutes[pathname];
    if (standaloneFile) {
      const body = await fs.readFile(standaloneFile);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(body);
      return;
    }

    // Vanilla classic — serve from public/ with SPA fallback to app.html
    if (pathname === "/app-classic" || pathname.startsWith("/app-classic/")) {
      const relative =
        pathname.replace(/^\/app-classic\/?/, "") || "app.html";
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
      // SPA fallback — serve app.html for all /app-classic/* routes
      const fallback = path.join(classicRoot, "app.html");
      const body = await fs.readFile(fallback);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(body);
      return;
    }

    // Legacy /app-react redirect — 302 to /app, preserving sub-path
    if (pathname === "/app-react" || pathname.startsWith("/app-react/")) {
      const newPath = pathname.replace(/^\/app-react/, "/app") || "/app";
      const qs = urlPath.includes("?") ? urlPath.slice(urlPath.indexOf("?")) : "";
      res.writeHead(302, { Location: newPath + qs });
      res.end();
      return;
    }

    // React app — serve built assets or SPA fallback
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
      // SPA fallback — serve index.html for all /app/* routes
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
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request");
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
