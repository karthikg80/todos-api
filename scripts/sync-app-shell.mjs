#!/usr/bin/env node
// sync-app-shell.mjs — Keeps the shared app shell in sync across HTML targets.
//
// Usage:
//   node scripts/sync-app-shell.mjs          # rewrite targets in-place
//   node scripts/sync-app-shell.mjs --check  # exit 1 if any target is stale

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const FRAGMENT_PATH = resolve(ROOT, "client/shell/app-shell.fragment");

const TARGETS = [
  { id: "index", path: resolve(ROOT, "client/index.html") },
  { id: "app", path: resolve(ROOT, "client/public/app.html") },
];

// Marker pairs that delimit generated regions in target files.
// Content between BEGIN and END is replaced on each sync.
const REGIONS = ["app-shell", "app-overlays"];

// ---------------------------------------------------------------------------
// Conditional processing
// ---------------------------------------------------------------------------
// Fragment can contain:
//   <!-- IF:index -->...<!-- ENDIF:index -->
//   <!-- IF:app -->...<!-- ENDIF:app -->
// When generating for target "index", IF:index blocks are kept (markers
// stripped) and IF:app blocks are removed entirely, and vice versa.

function processConditionals(html, targetId) {
  // Keep blocks for targetId (unwrap markers)
  const keepRe = new RegExp(
    `[ \\t]*<!-- IF:${targetId} -->\\n?([\\s\\S]*?)[ \\t]*<!-- ENDIF:${targetId} -->\\n?`,
    "g",
  );
  let result = html.replace(keepRe, "$1");

  // Remove blocks for other targets
  for (const t of TARGETS) {
    if (t.id === targetId) continue;
    const stripRe = new RegExp(
      `[ \\t]*<!-- IF:${t.id} -->\\n?[\\s\\S]*?<!-- ENDIF:${t.id} -->\\n?`,
      "g",
    );
    result = result.replace(stripRe, "");
  }

  return result;
}

// ---------------------------------------------------------------------------
// Region extraction from fragment
// ---------------------------------------------------------------------------
// Fragment is divided into named sections:
//   <!-- SECTION:app-shell -->
//   ...content...
//   <!-- ENDSECTION:app-shell -->

function extractSection(fragmentHtml, sectionName) {
  const re = new RegExp(
    `<!-- SECTION:${sectionName} -->\\n([\\s\\S]*?)<!-- ENDSECTION:${sectionName} -->`,
  );
  const m = fragmentHtml.match(re);
  if (!m) {
    throw new Error(
      `Fragment is missing section "${sectionName}". ` +
        `Expected <!-- SECTION:${sectionName} --> / <!-- ENDSECTION:${sectionName} --> markers.`,
    );
  }
  return m[1];
}

// ---------------------------------------------------------------------------
// Target rewriting
// ---------------------------------------------------------------------------

function replaceRegion(targetHtml, regionName, newContent) {
  const re = new RegExp(
    `([ \\t]*<!-- BEGIN:${regionName} -->)\\n[\\s\\S]*?([ \\t]*<!-- END:${regionName} -->)`,
  );
  const m = targetHtml.match(re);
  if (!m) {
    throw new Error(
      `Target is missing region "${regionName}". ` +
        `Expected <!-- BEGIN:${regionName} --> / <!-- END:${regionName} --> markers.`,
    );
  }
  return targetHtml.replace(re, `$1\n${newContent}$2`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const checkMode = process.argv.includes("--check");

const fragment = readFileSync(FRAGMENT_PATH, "utf8");

let staleCount = 0;

for (const target of TARGETS) {
  let html = readFileSync(target.path, "utf8");

  for (const region of REGIONS) {
    const sectionRaw = extractSection(fragment, region);
    const sectionProcessed = processConditionals(sectionRaw, target.id);
    html = replaceRegion(html, region, sectionProcessed);
  }

  const current = readFileSync(target.path, "utf8");

  if (html !== current) {
    if (checkMode) {
      console.error(`STALE: ${target.path}`);
      staleCount++;
    } else {
      writeFileSync(target.path, html, "utf8");
      console.log(`SYNCED: ${target.path}`);
    }
  } else {
    console.log(`OK: ${target.path} (up to date)`);
  }
}

if (checkMode && staleCount > 0) {
  console.error(
    `\n${staleCount} file(s) out of sync. Run "npm run shell:sync" to fix.`,
  );
  process.exit(1);
}
