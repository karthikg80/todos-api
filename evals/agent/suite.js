const assert = require("node:assert/strict");

const request = require("supertest");

const {
  buildProject,
  createAgentEvalApp,
} = require("../shared/app-harness");

const USER_ID = "default-user";
const PROJECT_ID = "00000000-0000-4000-8000-000000000001";

module.exports = {
  name: "agent",
  description:
    "Deterministic evals for the internal /agent runtime surface and envelopes.",
  trials: [
    {
      id: "agent-manifest-discovery",
      type: "regression",
      description:
        "The runtime manifest still exposes the expected agent actions and read/write metadata.",
      async run({ writeJson }) {
        const project = buildProject(PROJECT_ID, "Platform", USER_ID);
        const { app } = createAgentEvalApp({ projects: [project] });

        const response = await request(app).get("/agent/manifest").expect(200);
        writeJson("manifest.json", response.body);

        assert.equal(response.body.ok, true);
        assert.equal(response.body.action, "manifest");
        assert.ok(
          response.body.data.manifest.actions.some(
            (action) => action.name === "plan_project" && action.enabled,
          ),
        );
        assert.ok(
          response.body.data.manifest.actions.some(
            (action) => action.name === "analyze_work_graph" && action.readOnly,
          ),
        );

        return {
          actionCount: response.body.data.manifest.actions.length,
        };
      },
    },
    {
      id: "agent-read-envelope",
      type: "regression",
      description:
        "Read actions return structured envelopes and respect the seeded task state.",
      async run({ writeJson }) {
        const { app, todoService } = createAgentEvalApp();

        await todoService.create(USER_ID, {
          title: "Ship report",
          category: "Work",
          status: "next",
        });
        await todoService.create(USER_ID, {
          title: "Home errand",
          category: "Home",
          status: "next",
        });

        const response = await request(app)
          .post("/agent/read/list_tasks")
          .send({ project: "Work" })
          .expect(200);

        writeJson("response.json", response.body);
        assert.equal(response.body.ok, true);
        assert.equal(response.body.action, "list_tasks");
        assert.equal(response.body.readOnly, true);
        assert.equal(response.body.data.tasks.length, 1);
        assert.equal(response.body.data.tasks[0].title, "Ship report");
        assert.ok(response.body.trace.requestId);

        return {
          requestId: response.body.trace.requestId,
          titles: response.body.data.tasks.map((task) => task.title),
        };
      },
    },
    {
      id: "agent-write-idempotency-replay",
      type: "capability",
      description:
        "Write actions replay deterministically when the same idempotency key is reused.",
      async run({ writeJson }) {
        const { app } = createAgentEvalApp();

        const first = await request(app)
          .post("/agent/write/create_task")
          .set("Idempotency-Key", "eval-agent-task-1")
          .send({ title: "Agent created task" })
          .expect(201);
        const replay = await request(app)
          .post("/agent/write/create_task")
          .set("Idempotency-Key", "eval-agent-task-1")
          .send({ title: "Agent created task" })
          .expect(201);

        writeJson("first-response.json", first.body);
        writeJson("replay-response.json", replay.body);

        assert.equal(replay.body.trace.replayed, true);
        assert.equal(replay.body.data.task.id, first.body.data.task.id);

        return {
          taskId: first.body.data.task.id,
          replayed: replay.body.trace.replayed,
        };
      },
    },
    {
      id: "agent-planner-apply-flow",
      type: "capability",
      description:
        "Planner-backed agent writes still route through the canonical runtime and return structured results.",
      async run({ writeJson }) {
        const project = buildProject(PROJECT_ID, "Vacation", USER_ID, {
          goal: "Plan anniversary vacation",
        });
        const { app, todoService } = createAgentEvalApp({ projects: [project] });

        const response = await request(app)
          .post("/agent/write/ensure_next_action")
          .send({
            projectId: project.id,
            mode: "apply",
          })
          .expect(200);

        writeJson("response.json", response.body);

        assert.equal(response.body.ok, true);
        assert.equal(response.body.action, "ensure_next_action");
        assert.equal(response.body.data.result.projectId, project.id);
        assert.equal(response.body.data.result.hasNextAction, true);

        const tasks = await todoService.findAll(USER_ID, {
          archived: false,
          projectId: project.id,
        });
        assert.ok(tasks.some((task) => task.status === "next"));

        return {
          created: response.body.data.result.created,
          taskTitle: response.body.data.result.task?.title,
        };
      },
    },
  ],
};
