import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutput = path.join(root, "plugins", "todos", ".app.json");
const args = process.argv.slice(2);

function fail(message) {
  console.error(message);
  console.error(
    "Usage: npm run configure:plugin-app -- plugin_asdk_app_<registered-id> [--output <path>]",
  );
  process.exit(1);
}

const outputIndex = args.indexOf("--output");
let outputPath = defaultOutput;
if (outputIndex !== -1) {
  const outputArg = args[outputIndex + 1];
  if (!outputArg) {
    fail("--output requires a path.");
  }
  outputPath = path.resolve(process.cwd(), outputArg);
  args.splice(outputIndex, 2);
}

if (args.length > 1) {
  fail("Expected one registered app ID.");
}

const suppliedId = args[0] ?? process.env.TODOS_PLUGIN_APP_ID;
if (!suppliedId) {
  fail(
    "Pass the registered ChatGPT app ID or set TODOS_PLUGIN_APP_ID before running this command.",
  );
}

const match = /^(?:plugin_)?(asdk_app_[a-f0-9]{32})$/i.exec(suppliedId);
if (!match) {
  fail(
    "Expected a ChatGPT-registered app ID in plugin_asdk_app_<32 hex characters> or asdk_app_<32 hex characters> form.",
  );
}

const appId = match[1].toLowerCase();
const appKey = `dev-${appId.slice("asdk_app_".length)}`;
const mapping = {
  apps: {
    [appKey]: {
      id: appId,
    },
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const temporaryPath = `${outputPath}.tmp-${process.pid}`;
try {
  fs.writeFileSync(temporaryPath, `${JSON.stringify(mapping, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, outputPath);
} finally {
  fs.rmSync(temporaryPath, { force: true });
}

console.info(`Wrote registered Todos app mapping to ${outputPath}`);
