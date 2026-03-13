const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  validateDecisionAssistOutput,
} = require("../../dist/validation/aiContracts");
const {
  emitDecisionAssistTelemetry,
} = require("../../dist/services/decisionAssistTelemetry");
const { ValidationError } = require("../../dist/validation/validation");

const fixtureDir = path.join(process.cwd(), "src", "aiEval", "fixtures");

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
}

function captureTelemetry(event) {
  const lines = [];
  const originalInfo = console.info;
  console.info = (message) => {
    lines.push(String(message));
  };
  try {
    emitDecisionAssistTelemetry(event);
  } finally {
    console.info = originalInfo;
  }
  return lines;
}

module.exports = {
  name: "decision-assist",
  description:
    "Deterministic contract and telemetry evals for decision-assist surfaces.",
  trials: [
    {
      id: "task-drawer-valid-fixture",
      type: "regression",
      description:
        "The canonical valid task_drawer fixture remains accepted by the contract validator.",
      async run({ writeJson }) {
        const input = readFixture("task_drawer.valid.json");
        const result = validateDecisionAssistOutput(input);
        assert.equal(result.surface, "task_drawer");
        assert.equal(result.must_abstain, false);
        writeJson("input.json", input);
        return {
          surface: result.surface,
          suggestionCount: result.suggestions.length,
        };
      },
    },
    {
      id: "home-focus-valid-fixture",
      type: "regression",
      description:
        "The home_focus surface remains accepted and returns a focus_task suggestion.",
      async run({ writeJson }) {
        const input = readFixture("home_focus.valid.json");
        const result = validateDecisionAssistOutput(input);
        assert.equal(result.surface, "home_focus");
        assert.equal(result.suggestions[0]?.type, "focus_task");
        writeJson("input.json", input);
        return {
          surface: result.surface,
          suggestionType: result.suggestions[0]?.type,
        };
      },
    },
    {
      id: "invalid-unknown-type-fixture",
      type: "regression",
      description:
        "Malformed fixtures still fail with a validation error instead of passing silently.",
      async run({ writeJson }) {
        const input = readFixture("invalid.unknown_type.json");
        writeJson("input.json", input);
        let caught = null;
        try {
          validateDecisionAssistOutput(input);
        } catch (error) {
          caught = error;
        }
        assert.ok(caught instanceof ValidationError);
        assert.match(caught.message, /unsupported suggestion\.type/i);
        return {
          errorName: caught.name,
          message: caught.message,
        };
      },
    },
    {
      id: "today-plan-preview-shape",
      type: "capability",
      description:
        "Today plan outputs with planPreview remain accepted with ranked preview items.",
      async run({ writeJson }) {
        const input = readFixture("today_plan.valid.json");
        const result = validateDecisionAssistOutput(input);
        assert.equal(result.surface, "today_plan");
        assert.ok(result.planPreview);
        assert.ok((result.planPreview?.items.length ?? 0) > 0);
        assert.equal(result.planPreview?.items[0]?.rank, 1);
        writeJson("input.json", input);
        return {
          surface: result.surface,
          previewItems: result.planPreview?.items.length ?? 0,
        };
      },
    },
    {
      id: "telemetry-emits-machine-usable-shape",
      type: "capability",
      description:
        "Decision-assist telemetry remains structured and machine-readable for harness collection.",
      async run() {
        const lines = captureTelemetry({
          eventName: "ai_suggestion_generated",
          surface: "home_focus",
          suggestionId: "suggestion-1",
          suggestionCount: 2,
          selectedTodoIdsCount: 1,
          ts: "2026-03-12T00:00:00.000Z",
        });
        assert.equal(lines.length, 1);
        const payload = JSON.parse(lines[0]);
        assert.equal(payload.type, "ai_decision_assist_telemetry");
        assert.equal(payload.surface, "home_focus");
        assert.equal(payload.suggestionCount, 2);
        return payload;
      },
    },
  ],
};
