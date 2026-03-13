import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");
const CLIENT_DIR = path.join(REPO_ROOT, "client");
const TESTS_UI_DIR = path.join(REPO_ROOT, "tests", "ui");
const HARNESS_DOCS_DIR = path.join(REPO_ROOT, "docs", "harness");
const MANIFEST_PATH = path.join(REPO_ROOT, "src", "agent", "agent-manifest.json");
const AGENT_DOC_PATH = path.join(REPO_ROOT, "docs", "agent-accessibility.md");
const MCP_DOC_PATH = path.join(REPO_ROOT, "docs", "assistant-mcp.md");
const MCP_CATALOG_PATH = path.join(REPO_ROOT, "src", "mcp", "mcpToolCatalog.ts");
const CONTEXT_ACK_PATH = path.join(REPO_ROOT, ".codex", "context-ack.json");

const REQUIRED_CONTEXT_DOCS = [
  "AGENTS.md",
  "docs/WORKFLOW.md",
  "docs/architecture/AGENT_RULES.md",
  "docs/harness/README.md",
  "docs/harness/SESSION_FLOW.md",
  "docs/harness/INVARIANT_MATRIX.md",
];

const REQUIRED_INVARIANT_ROWS = [
  "Work only in a fresh worktree per issue",
  "Run `git status --porcelain` before start and before rebase/merge",
  "Event delegation only for dynamic UI",
  "`#categoryFilter` + `filterTodos()` is the canonical filter path",
  "Always use `setSelectedProjectKey(...)` for project selection",
  "No `page.waitForTimeout()` in UI tests",
  "No native browser prompts in app code",
  "Session context should be acknowledged before edits",
];

const ALLOWED_NATIVE_PROMPT_FILES = new Set([
  "client/modules/overlayManager.js",
]);

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

function lineNumberFromIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

async function collectMatches(files, pattern) {
  const matches = [];
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        file: relative(file),
        line: lineNumberFromIndex(text, match.index),
        match: match[0],
      });
    }
  }
  return matches;
}

function getChangedAppFiles() {
  try {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", "HEAD", "--", "client", "src"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).trim();
    if (!output) {
      return [];
    }
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function loadContextAck() {
  try {
    const raw = await fs.readFile(CONTEXT_ACK_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getManifestActions() {
  return readText(MANIFEST_PATH).then((raw) =>
    JSON.parse(raw).actions.map((action) => action.name),
  );
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

function normalizeMatch(match) {
  return `${match.file}:${match.line}`;
}

export async function scanArchitectureInvariants() {
  const errors = [];
  const warnings = [];

  const uiSpecFiles = await walk(TESTS_UI_DIR, (file) => file.endsWith(".spec.ts"));
  const appJsFiles = await walk(CLIENT_DIR, (file) => file.endsWith(".js"));

  const waitForTimeoutMatches = await collectMatches(
    uiSpecFiles,
    /page\.waitForTimeout\(/g,
  );
  if (waitForTimeoutMatches.length > 0) {
    errors.push({
      code: "WAIT_FOR_TIMEOUT_FORBIDDEN",
      message:
        "UI tests must not use page.waitForTimeout(). Use deterministic waits instead.",
      matches: waitForTimeoutMatches.map(normalizeMatch),
    });
  }

  const filterDefinitionMatches = await collectMatches(
    appJsFiles,
    /function\s+filterTodos\s*\(/g,
  );
  if (
    filterDefinitionMatches.length !== 1 ||
    filterDefinitionMatches[0]?.file !== "client/modules/filterLogic.js"
  ) {
    errors.push({
      code: "FILTER_PIPELINE_DRIFT",
      message:
        "filterTodos() must be defined exactly once in client/modules/filterLogic.js.",
      matches: filterDefinitionMatches.map(normalizeMatch),
    });
  }

  const projectSelectionDefinitionMatches = await collectMatches(
    appJsFiles,
    /function\s+setSelectedProjectKey\s*\(/g,
  );
  if (
    projectSelectionDefinitionMatches.length !== 1 ||
    projectSelectionDefinitionMatches[0]?.file !==
      "client/modules/filterLogic.js"
  ) {
    errors.push({
      code: "PROJECT_SELECTION_DRIFT",
      message:
        "setSelectedProjectKey() must be defined exactly once in client/modules/filterLogic.js.",
      matches: projectSelectionDefinitionMatches.map(normalizeMatch),
    });
  }

  const directSelectedProjectAssignments = await collectMatches(
    appJsFiles.filter(
      (file) => relative(file) !== "client/modules/filterLogic.js",
    ),
    /\bselectedProjectKey\s*=/g,
  );
  if (directSelectedProjectAssignments.length > 0) {
    errors.push({
      code: "PROJECT_SELECTION_BYPASS",
      message:
        "Do not assign selectedProjectKey directly outside filterLogic.js. Route project switching through setSelectedProjectKey(...).",
      matches: directSelectedProjectAssignments.map(normalizeMatch),
    });
  }

  const indexHtml = await readText(path.join(REPO_ROOT, "client", "index.html"));
  if (!indexHtml.includes('data-oninput="filterTodos()"')) {
    errors.push({
      code: "CATEGORY_FILTER_ONINPUT_DRIFT",
      message:
        'The category filter input must keep data-oninput="filterTodos()" in client/index.html.',
    });
  }
  if (!indexHtml.includes('data-onchange="filterTodos()"')) {
    errors.push({
      code: "CATEGORY_FILTER_ONCHANGE_DRIFT",
      message:
        'The category filter input must keep data-onchange="filterTodos()" in client/index.html.',
    });
  }

  const nativePromptMatches = await collectMatches(
    appJsFiles,
    /\b(?:window\.)?(?:prompt|confirm|alert)\s*\(/g,
  );
  const disallowedNativePromptMatches = nativePromptMatches.filter(
    (match) => !ALLOWED_NATIVE_PROMPT_FILES.has(match.file),
  );
  if (disallowedNativePromptMatches.length > 0) {
    errors.push({
      code: "NATIVE_PROMPT_FORBIDDEN",
      message:
        "Native browser prompt/confirm/alert usage is forbidden outside the overlay-manager fallback.",
      matches: disallowedNativePromptMatches.map(normalizeMatch),
    });
  }
  const allowedNativePromptMatches = nativePromptMatches.filter((match) =>
    ALLOWED_NATIVE_PROMPT_FILES.has(match.file),
  );
  if (allowedNativePromptMatches.length > 0) {
    warnings.push({
      code: "NATIVE_PROMPT_FALLBACK_PRESENT",
      message:
        "OverlayManager still contains native prompt/confirm fallback paths. Keep new prompt usage out of app code and retire this fallback later.",
      matches: allowedNativePromptMatches.map(normalizeMatch),
    });
  }

  const isCi =
    process.env.CI === "1" ||
    process.env.CI === "true" ||
    process.env.CODEX_CI === "1";
  if (!isCi) {
    const changedAppFiles = getChangedAppFiles();
    if (changedAppFiles.length > 0) {
      const contextAck = await loadContextAck();
      const docsRead = Array.isArray(contextAck?.docsRead)
        ? contextAck.docsRead
        : [];
      const missingDocs = REQUIRED_CONTEXT_DOCS.filter(
        (docPath) => !docsRead.includes(docPath),
      );
      const hasAcknowledgedInvariants = Array.isArray(
        contextAck?.acknowledgedInvariants,
      )
        ? contextAck.acknowledgedInvariants.length > 0
        : false;
      if (!contextAck || missingDocs.length > 0 || !hasAcknowledgedInvariants) {
        errors.push({
          code: "MISSING_CONTEXT_ACK",
          message:
            "App code changed without a complete .codex/context-ack.json. Initialize the session artifacts from .codex/templates/ before editing.",
          details: {
            changedAppFiles,
            missingDocs,
          },
        });
      }
    }
  }

  return { errors, warnings };
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
        rel.startsWith("src/") ||
        rel.startsWith("client/"))
    );
  });
  const todoMatches = await collectMatches(todoFixmeFiles, /\b(?:TODO|FIXME)\b/g);
  if (todoMatches.length > 0) {
    warnings.push({
      code: "TODO_FIXME_PRESENT",
      message:
        "Load-bearing code and docs still contain TODO/FIXME markers. Review them in the cleanup report.",
      matches: todoMatches.map(normalizeMatch),
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
  const [architecture, drift, telemetryText, aiContractsText] = await Promise.all([
    scanArchitectureInvariants(),
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
    architecture,
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
    toMarkdownSection("Architecture Errors", architecture.errors, (item) => {
      const extras = item.matches || item.actions || item.files || item.rows;
      return `- \`${item.code}\`: ${item.message}${
        extras ? ` (${extras.join(", ")})` : ""
      }`;
    }),
    toMarkdownSection("Architecture Warnings", architecture.warnings, (item) => {
      const extras = item.matches || item.actions || item.files || item.rows;
      return `- \`${item.code}\`: ${item.message}${
        extras ? ` (${extras.join(", ")})` : ""
      }`;
    }),
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
