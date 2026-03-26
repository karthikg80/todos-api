import http from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../client");
const vendorRoots = [
  {
    prefix: "/vendor/chrono-node/",
    root: path.resolve(__dirname, "../node_modules/chrono-node/dist/esm"),
  },
];
const port = Number.parseInt(process.env.UI_PORT || "4173", 10);

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

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url || "/";
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
      // Route-aware fallback for the 3-page split
      const decoded = decodeURIComponent((req.url || "/").split("?")[0]);
      if (decoded === "/auth") {
        filePath = path.join(root, "public", "auth.html");
      } else if (decoded === "/app" || decoded.startsWith("/app/")) {
        filePath = path.join(root, "public", "app.html");
      } else {
        filePath = path.join(root, "public", "index.html");
      }
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
