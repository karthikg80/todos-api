import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const HARNESS_DOCS_DIR = path.join(REPO_ROOT, "docs", "harness");
const MANIFEST_PATH = path.join(REPO_ROOT, "src", "agent", "agent-manifest.json");
const AGENT_DOC_PATH = path.join(REPO_ROOT, "docs", "agent-accessibility.md");
const MCP_DOC_PATH = path.join(REPO_ROOT, "docs", "assistant-mcp.md");
const MCP_CATALOG_PATH = path.join(REPO_ROOT, "src", "mcp", "mcpToolCatalog.ts");

const REQUIRED_INVARIANT_ROWS = [
  "Work only in a fresh worktree per issue",
  "Run `git status --porcelain` before start and before rebase/merge",
  "No native browser prompts in app code",
  "Session context should be acknowledged before edits",
];

async function walk(dir, filter = () => true) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath, filter)));
      continue;
    }
    if (entry.isFile() && filter(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(filePath) {
  return path.relative(REPO_ROOT, filePath);
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

function getManifestActions() {
  return readText(MANIFEST_PATH).then((raw) =>
    JSON.parse(raw).actions.map((action) => action.name),
  );
}

function extractCaseLabels(text) {
  return [...text.matchAll(/case\s+"([^"]+)":/g)].map((match) => match[1]);
}

export async function scanHarnessDrift() {
  const errors = [];
  const warnings = [];

  const [manifestActions, mcpCatalogText, agentDocText, mcpDocText] =
    await Promise.all([
      getManifestActions(),
      readText(MCP_CATALOG_PATH),
      readText(AGENT_DOC_PATH),
      readText(MCP_DOC_PATH),
    ]);

  const scopeMappedActions = new Set(extractCaseLabels(mcpCatalogText));
  const missingScopeMappings = manifestActions.filter(
    (action) => !scopeMappedActions.has(action),
  );
  if (missingScopeMappings.length > 0) {
    errors.push({
      code: "MCP_SCOPE_MAPPING_DRIFT",
      message:
        "Each manifest action must have an explicit scope mapping in src/mcp/mcpToolCatalog.ts.",
      actions: missingScopeMappings,
    });
  }

  const missingInAgentDocs = manifestActions.filter(
    (action) => !agentDocText.includes(`\`${action}\``),
  );
  if (missingInAgentDocs.length > 0) {
    errors.push({
      code: "AGENT_DOC_TOOL_DRIFT",
      message:
        "docs/agent-accessibility.md must mention every manifest action by name.",
      actions: missingInAgentDocs,
    });
  }

  const missingInMcpDocs = manifestActions.filter(
    (action) => !mcpDocText.includes(`\`${action}\``),
  );
  if (missingInMcpDocs.length > 0) {
    errors.push({
      code: "MCP_DOC_TOOL_DRIFT",
      message:
        "docs/assistant-mcp.md must mention every manifest action by name.",
      actions: missingInMcpDocs,
    });
  }

  const harnessReadme = await readText(path.join(HARNESS_DOCS_DIR, "README.md"));
  const harnessDocs = await walk(
    HARNESS_DOCS_DIR,
    (file) => file.endsWith(".md"),
  );
  const missingHarnessMapEntries = harnessDocs
    .map((file) => relative(file))
    .filter(
      (file) =>
        file !== "docs/harness/README.md" && !harnessReadme.includes(path.basename(file)),
    );
  if (missingHarnessMapEntries.length > 0) {
    errors.push({
      code: "HARNESS_DOC_MAP_DRIFT",
      message:
        "docs/harness/README.md must stay in sync with files under docs/harness/.",
      files: missingHarnessMapEntries,
    });
  }

  const invariantMatrix = await readText(
    path.join(HARNESS_DOCS_DIR, "INVARIANT_MATRIX.md"),
  );
  const missingInvariantRows = REQUIRED_INVARIANT_ROWS.filter(
    (row) => !invariantMatrix.includes(row),
  );
  if (missingInvariantRows.length > 0) {
    errors.push({
      code: "INVARIANT_MATRIX_DRIFT",
      message:
        "docs/harness/INVARIANT_MATRIX.md is missing required invariant rows.",
      rows: missingInvariantRows,
    });
  }

  const todoFixmeFiles = await walk(REPO_ROOT, (file) => {
    const rel = relative(file);
    return (
      /\.(md|js|ts|mjs|sh)$/.test(file) &&
      (rel.startsWith("docs/") ||
        rel.startsWith("scripts/") ||
        rel.startsWith("src/"))
    );
  });
  const todoMatches = [];
  for (const file of todoFixmeFiles) {
    const text = await readText(file);
    const pattern = /\b(?:TODO|FIXME)\b/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split("\n").length;
      todoMatches.push({
        file: relative(file),
        line,
        match: match[0],
      });
    }
  }
  if (todoMatches.length > 0) {
    warnings.push({
      code: "TODO_FIXME_PRESENT",
      message:
        "Load-bearing code and docs still contain TODO/FIXME markers. Review them in the cleanup report.",
      matches: todoMatches.map((m) => `${m.file}:${m.line}`),
    });
  }

  return { errors, warnings };
}

function toMarkdownSection(title, items, renderItem) {
  if (items.length === 0) {
    return `## ${title}\n\n- none\n`;
  }
  return `## ${title}\n\n${items.map(renderItem).join("\n")}\n`;
}

export async function writeCleanupReport() {
  const [drift, telemetryText, aiContractsText] = await Promise.all([
    scanHarnessDrift(),
    readText(path.join(REPO_ROOT, "src", "services", "decisionAssistTelemetry.ts")),
    readText(path.join(REPO_ROOT, "src", "validation", "aiContracts.ts")),
  ]);

  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const reportDir = path.join(
    REPO_ROOT,
    "artifacts",
    "harness",
    "cleanup-report",
    timestamp,
  );
  await fs.mkdir(reportDir, { recursive: true });

  const telemetryEvents = [
    ...telemetryText.matchAll(/"([^"]+)"/g),
  ].map((match) => match[1]).filter((value) => value.startsWith("ai_"));
  const surfaces = [
    ...aiContractsText.matchAll(/"([^"]+)"/g),
  ].map((match) => match[1]).filter((value) =>
    ["on_create", "task_drawer", "today_plan", "home_focus"].includes(value),
  );

  const report = {
    generatedAt: new Date().toISOString(),
    drift,
    telemetry: {
      events: [...new Set(telemetryEvents)],
      surfaces: [...new Set(surfaces)],
    },
  };

  const markdown = [
    "# Harness Cleanup Report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    toMarkdownSection("Drift Errors", drift.errors, (item) => {
      const extras = item.matches || item.actions || item.files || item.rows;
      return `- \`${item.code}\`: ${item.message}${
        extras ? ` (${extras.join(", ")})` : ""
      }`;
    }),
    toMarkdownSection("Drift Warnings", drift.warnings, (item) => {
      const extras = item.matches || item.actions || item.files || item.rows;
      return `- \`${item.code}\`: ${item.message}${
        extras ? ` (${extras.join(", ")})` : ""
      }`;
    }),
    "## Decision Assist Signals",
    "",
    `- surfaces: ${report.telemetry.surfaces.join(", ") || "none"}`,
    `- events: ${report.telemetry.events.join(", ") || "none"}`,
    "",
    "## Follow-up Rule",
    "",
    "- Every meaningful production bug or review finding should land as one of:",
    "- a new eval case",
    "- a new mechanical guard",
    "- or a durable docs update explaining the invariant",
    "",
  ].join("\n");

  await fs.writeFile(
    path.join(reportDir, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await fs.writeFile(path.join(reportDir, "report.md"), `${markdown}\n`);

  const latestDir = path.join(REPO_ROOT, "artifacts", "harness", "cleanup-report");
  await fs.mkdir(latestDir, { recursive: true });
  await fs.writeFile(
    path.join(latestDir, "latest.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await fs.writeFile(path.join(latestDir, "latest.md"), `${markdown}\n`);

  return {
    reportDir: relative(reportDir),
    report,
  };
}
