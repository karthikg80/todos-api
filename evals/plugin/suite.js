const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const contract = require("../../dist/mcp/appContract");
const resource = require("../../dist/mcp/todayPlanResource");

const phase1Golden = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../mcp/native-golden-prompts.json"),
    "utf8",
  ),
);
const phase2Golden = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "today-plan-golden-prompts.json"),
    "utf8",
  ),
);

module.exports = {
  name: "plugin",
  description:
    "Deterministic contract and conversational-sequence evals for the Phase 2 Today Plan MCP App.",
  trials: [
    {
      id: "plugin-phase1-golden-preservation",
      type: "regression",
      description:
        "The sealed Phase 1 golden cases remain available as complete text-only workflows.",
      async run({ writeJson }) {
        assert.equal(phase1Golden.length, 8);
        for (const entry of phase1Golden) {
          assert.ok(Array.isArray(entry.expectedTools));
          assert.ok(!entry.expectedTools.includes("render_today_plan"));
        }
        writeJson("phase1-golden.json", phase1Golden);
        return { caseCount: phase1Golden.length, textOnlyCompatible: true };
      },
    },
    {
      id: "plugin-phase2-golden-sequences",
      type: "capability",
      description:
        "Phase 2 direct, indirect, follow-up, write, negative, injection, fallback, and component sequences are internally consistent.",
      async run({ writeJson }) {
        const toolNames = new Set(
          contract.buildNativeAppToolsList().map((tool) => tool.name),
        );
        const categories = new Set();
        for (const entry of phase2Golden) {
          categories.add(entry.category);
          for (const name of [
            ...entry.expectedTools,
            ...(entry.forbiddenTools || []),
          ]) {
            assert.ok(
              toolNames.has(name),
              `Unknown tool in ${entry.id}: ${name}`,
            );
          }
          const renderIndex = entry.expectedTools.indexOf("render_today_plan");
          if (renderIndex >= 0) {
            assert.ok(
              entry.expectedTools.slice(0, renderIndex).includes("plan_today"),
              `${entry.id} renders before plan_today`,
            );
          }
        }
        for (const required of [
          "direct",
          "indirect",
          "follow-up",
          "write",
          "negative",
          "prompt-injection",
          "fallback",
          "component-follow-up",
        ]) {
          assert.ok(categories.has(required), `Missing ${required} case`);
        }
        writeJson("phase2-golden.json", phase2Golden);
        return { caseCount: phase2Golden.length, categories: [...categories] };
      },
    },
    {
      id: "plugin-six-tool-resource-contract",
      type: "regression",
      description:
        "Exactly one new tool and one versioned resource extend the frozen Phase 1 profile.",
      async run({ writeJson }) {
        const tools = contract.buildNativeAppToolsList();
        assert.deepEqual(
          tools.map((tool) => tool.name),
          [
            "list_today",
            "plan_today",
            "capture_task",
            "complete_task",
            "reschedule_task",
            "render_today_plan",
          ],
        );
        const uiTools = tools.filter((tool) => tool._meta.ui);
        assert.equal(uiTools.length, 1);
        assert.equal(uiTools[0].name, "render_today_plan");
        assert.equal(
          uiTools[0]._meta.ui.resourceUri,
          contract.TODAY_PLAN_RESOURCE_URI,
        );
        assert.equal(
          resource.TODAY_PLAN_RESOURCE_DESCRIPTOR.mimeType,
          "text/html;profile=mcp-app",
        );
        assert.deepEqual(resource.TODAY_PLAN_RESOURCE_META.ui.csp, {
          connectDomains: [],
          resourceDomains: [],
        });
        writeJson("contract.json", {
          tools,
          resources: [resource.TODAY_PLAN_RESOURCE_DESCRIPTOR],
        });
        return { toolCount: tools.length, resourceCount: 1 };
      },
    },
    {
      id: "plugin-portable-widget-boundary",
      type: "capability",
      description:
        "The self-contained component uses portable MCP Apps methods and has no private network client or host-specific dependency.",
      async run({ writeJson }) {
        const html = resource.buildTodayPlanWidgetHtml(
          "https://todos.example/",
        );
        assert.match(html, /ui\/initialize/);
        assert.match(html, /tools\/call/);
        assert.match(html, /ui\/open-link/);
        assert.doesNotMatch(html, /window\.openai/);
        assert.doesNotMatch(html, /fetch\s*\(|XMLHttpRequest|<iframe/i);
        assert.doesNotMatch(html, /\/api\//i);
        writeJson("widget-boundary.json", {
          resourceUri: contract.TODAY_PLAN_RESOURCE_URI,
          mimeType: resource.TODAY_PLAN_RESOURCE_MIME_TYPE,
          csp: resource.TODAY_PLAN_RESOURCE_META.ui.csp,
          bridgeMethods: ["ui/initialize", "tools/call", "ui/open-link"],
        });
        return { portableBridge: true, directNetworkAccess: false };
      },
    },
  ],
};
