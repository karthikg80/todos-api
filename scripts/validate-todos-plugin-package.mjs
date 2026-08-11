import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.join(root, "plugins", "todos");
const manifestPath = path.join(pluginDir, ".codex-plugin", "plugin.json");
const skillPath = path.join(pluginDir, "skills", "today-planning", "SKILL.md");
const marketplacePath = path.join(
  root,
  ".agents",
  "plugins",
  "marketplace.json",
);

const expectedTools = [
  "list_today",
  "plan_today",
  "capture_task",
  "complete_task",
  "reschedule_task",
  "render_today_plan",
];

function parseJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveInsidePlugin(relativePath) {
  const resolved = path.resolve(pluginDir, relativePath);
  assert.ok(
    resolved === pluginDir || resolved.startsWith(`${pluginDir}${path.sep}`),
    `${relativePath} escapes the plugin package`,
  );
  assert.ok(fs.existsSync(resolved), `${relativePath} does not resolve`);
  return resolved;
}

function pngDimensions(filePath) {
  const png = fs.readFileSync(filePath);
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function packageFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? packageFiles(fullPath) : [fullPath];
  });
}

const manifest = parseJson(manifestPath);
assert.equal(manifest.name, "todos");
assert.equal(manifest.interface.displayName, "Todos");
assert.equal(
  manifest.interface.shortDescription,
  "Turn your tasks into a realistic daily plan and act on it from ChatGPT.",
);
assert.equal(
  manifest.interface.longDescription,
  "Connect your Todos account to see what is due, build a time- and energy-aware plan, capture new work, complete tasks, and reschedule the day without leaving your conversation.",
);
assert.deepEqual(manifest.interface.defaultPrompt, [
  "Plan my day. I have four hours and low energy.",
  "What is due or overdue today?",
  "Capture: call the dentist tomorrow.",
]);

resolveInsidePlugin(manifest.skills);
const mcpPath = resolveInsidePlugin(manifest.mcpServers);
const composerIcon = resolveInsidePlugin(manifest.interface.composerIcon);
const logo = resolveInsidePlugin(manifest.interface.logo);
const screenshots = manifest.interface.screenshots.map(resolveInsidePlugin);
assert.deepEqual(pngDimensions(composerIcon), { width: 256, height: 256 });
assert.deepEqual(pngDimensions(logo), { width: 512, height: 512 });
assert.deepEqual(pngDimensions(screenshots[0]), { width: 720, height: 870 });

const mcp = parseJson(mcpPath);
assert.deepEqual(mcp, {
  mcpServers: {
    todos: {
      type: "http",
      url: "https://todos.theafoundry.com/mcp/app",
    },
  },
});

const skill = fs.readFileSync(skillPath, "utf8");
const referencedTools = [...skill.matchAll(/`([a-z][a-z0-9_]+)`/g)]
  .map((match) => match[1])
  .filter((name) => name.includes("_"));
assert.deepEqual(
  [...new Set(referencedTools)].sort(),
  [...expectedTools].sort(),
);
assert.doesNotMatch(
  skill,
  /`(?:delete|archive|create_project|update_project|email|message)[a-z0-9_]*`/i,
);

const openAiYaml = fs.readFileSync(
  path.join(pluginDir, "skills", "today-planning", "agents", "openai.yaml"),
  "utf8",
);
assert.match(
  openAiYaml,
  /Help me work through today's plan one task at a time\./,
);
assert.match(openAiYaml, /https:\/\/todos\.theafoundry\.com\/mcp\/app/);

const marketplace = parseJson(marketplacePath);
const marketplacePlugin = marketplace.plugins.find(
  (entry) => entry.name === "todos",
);
assert.ok(marketplacePlugin, "Todos is missing from the local marketplace");
assert.deepEqual(marketplacePlugin.source, {
  source: "local",
  path: "./plugins/todos",
});

const textFiles = packageFiles(pluginDir).filter(
  (filePath) => !filePath.endsWith(".png"),
);
const forbidden = [
  [/\/Users\//, "absolute user path"],
  [/\/private\/tmp\//, "absolute temporary path"],
  [
    /\b(?:connector|asdk_app|integration)[_-][A-Za-z0-9_-]{8,}\b/i,
    "private integration ID",
  ],
  [
    /\b(?:access|refresh)[_-]?token\s*[:=]\s*["']?[A-Za-z0-9._-]{12,}/i,
    "OAuth token",
  ],
  [
    /\b(?:client[_-]?secret|authorization[_-]?code)\s*[:=]\s*["']?\S+/i,
    "secret",
  ],
];
for (const filePath of textFiles) {
  const contents = fs.readFileSync(filePath, "utf8");
  for (const [pattern, label] of forbidden) {
    assert.doesNotMatch(
      contents,
      pattern,
      `${path.relative(root, filePath)} contains a ${label}`,
    );
  }
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
assert.match(gitignore, /^plugins\/todos\/\.app\.json$/m);
assert.match(gitignore, /^plugins\/todos\/\.mcp\.local\.json$/m);

console.info(
  `Todos plugin package valid: ${textFiles.length + 3} files, ${expectedTools.length} tools, ${screenshots.length + 2} assets.`,
);
