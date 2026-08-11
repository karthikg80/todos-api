import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const contract = require(path.join(repoRoot, "dist/mcp/appContract.js"));
const resource = require(path.join(repoRoot, "dist/mcp/todayPlanResource.js"));

const snapshot = {
  server: {
    name: contract.MCP_APP_SERVER_NAME,
    version: contract.MCP_APP_SERVER_VERSION,
    instructions: contract.MCP_APP_SERVER_INSTRUCTIONS,
  },
  tools: contract.buildNativeAppToolsList(),
  resources: [resource.TODAY_PLAN_RESOURCE_DESCRIPTOR],
  resourceContents: [
    {
      uri: contract.TODAY_PLAN_RESOURCE_URI,
      mimeType: resource.TODAY_PLAN_RESOURCE_MIME_TYPE,
      _meta: resource.TODAY_PLAN_RESOURCE_META,
    },
  ],
};

const outputPath = path.join(
  repoRoot,
  "test/fixtures/mcp-app-metadata.phase2.json",
);
const formattedSnapshot = await format(JSON.stringify(snapshot), {
  parser: "json",
});
fs.writeFileSync(outputPath, formattedSnapshot, "utf8");
console.info(path.relative(repoRoot, outputPath));
