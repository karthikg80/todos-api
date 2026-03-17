import http from "http";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:3000";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mcpCall(
  token: string,
  method: string,
  args: any,
  id: number | string,
) {
  const start = Date.now();
  const res = await fetch(`${API_BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name: method,
        arguments: args,
      },
    }),
  });

  const end = Date.now();
  const data: any = await res.json();
  return { timeMs: end - start, data, status: res.status };
}

async function runTest() {
  console.log(`1. Waiting for server to start on ${API_BASE}...`);

  let ready = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${API_BASE}/healthz`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch (e) {
      // ignore
    }
    await delay(1000);
  }

  if (!ready) throw new Error("Server did not become ready");

  const email = `stress-${randomUUID().slice(0, 8)}@example.com`;
  const password = "Password123!";

  console.log(`2. Registering and obtaining MCP token for ${email}...`);
  await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Stress Tester" }),
  });

  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginData: any = await loginRes.json();
  const appToken = loginData.token;

  const mcpTokenRes = await fetch(`${API_BASE}/auth/mcp/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appToken}`,
    },
    body: JSON.stringify({
      scopes: ["tasks.read", "tasks.write", "projects.read", "projects.write"],
      assistantName: "StressTestBot",
      clientId: "stress-client",
    }),
  });
  const mcpTokenData: any = await mcpTokenRes.json();
  const mcpToken = mcpTokenData.token;

  console.log(
    "3. Connecting to MCP SSE endpoint (simulating client connection)...",
  );
  const req = http.get(`${API_BASE}/mcp`, {
    headers: {
      Authorization: `Bearer ${mcpToken}`,
      Accept: "text/event-stream",
    },
  });

  const connected = new Promise((resolve, reject) => {
    req.on("response", (res) => {
      res.on("data", (chunk) => {
        if (chunk.toString().includes(": connected")) resolve(true);
      });
    });
    req.on("error", reject);
  });

  await connected;
  console.log("   SSE Connected.");

  console.log("\n--- SCENARIO 1: Bulk Project Creation (10 Concurrent) ---");
  let reqId = 1000;
  const projectPromises = [];
  for (let i = 0; i < 10; i++) {
    projectPromises.push(
      mcpCall(
        mcpToken,
        "create_project",
        {
          name: `Stress Project ${i}`,
          goal: "Testing system capacity",
        },
        reqId++,
      ),
    );
  }

  const projectResults = await Promise.all(projectPromises);
  const avgProjTime =
    projectResults.reduce((sum, r) => sum + r.timeMs, 0) /
    projectResults.length;
  console.log(`   Created 10 projects. Avg Time: ${avgProjTime.toFixed(2)}ms`);

  const projectIds = projectResults
    .map((r) => r.data.result?.structuredContent?.data?.project?.id)
    .filter(Boolean);

  console.log("\n--- SCENARIO 2: Bulk Task Creation (50 Concurrent) ---");
  const taskPromises = [];
  for (let i = 0; i < 50; i++) {
    const projectId = projectIds[i % projectIds.length];
    taskPromises.push(
      mcpCall(
        mcpToken,
        "create_task",
        {
          title: `Stress Task ${i}`,
          status: i % 2 === 0 ? "todo" : "doing",
          projectId,
        },
        reqId++,
      ),
    );
  }

  const taskResults = await Promise.all(taskPromises);
  const avgTaskTime =
    taskResults.reduce((sum, r) => sum + r.timeMs, 0) / taskResults.length;
  console.log(`   Created 50 tasks. Avg Time: ${avgTaskTime.toFixed(2)}ms`);

  const taskIds = taskResults
    .map((r) => r.data.result?.structuredContent?.data?.result?.id)
    .filter(Boolean);

  console.log("\n--- SCENARIO 3: Creating Subtasks (Depth testing) ---");
  if (taskIds.length > 0) {
    const parentId = taskIds[0];
    const subtaskRes = await mcpCall(
      mcpToken,
      "add_subtask",
      {
        taskId: parentId,
        title: "Level 1 Subtask",
      },
      reqId++,
    );
    console.log(`   L1 Subtask created in ${subtaskRes.timeMs}ms`);

    // Some systems allow deep nesting, some dont. Let's see if we can nest a subtask inside a subtask
    const subtaskId =
      subtaskRes.data.result?.structuredContent?.data?.subtask?.id;
    if (subtaskId) {
      const subtaskRes2 = await mcpCall(
        mcpToken,
        "add_subtask",
        {
          taskId: subtaskId, // Trying to attach to a subtask
          title: "Level 2 Subtask",
        },
        reqId++,
      );

      console.log(
        `   L2 Subtask Attempt:`,
        subtaskRes2.data.result?.isError
          ? subtaskRes2.data.result?.structuredContent?.error?.message ||
              "Failed"
          : "Success",
      );
    }
  }

  console.log(
    "\n--- SCENARIO 4: Test Edge Cases (Pagination, Invalid Data) ---",
  );
  const listRes = await mcpCall(
    mcpToken,
    "list_tasks",
    { limit: 100 },
    reqId++,
  );
  console.log(
    `   list_tasks (100 limit) returned ${listRes.data.result?.structuredContent?.data?.tasks?.length || 0} items in ${listRes.timeMs}ms`,
  );

  const badRes = await mcpCall(mcpToken, "create_task", { title: "" }, reqId++); // Empty title
  console.log(
    `   Empty title handled: ${badRes.data.result?.isError ? "Yes (Rejected)" : "No (Accepted)"} - Error: ${badRes.data.result?.structuredContent?.error?.code}`,
  );

  console.log(
    "\n--- SCENARIO 5: AI Planner Functionality (plan_project, analyze_work_graph) ---",
  );
  if (projectIds.length > 0) {
    const pId = projectIds[0];
    const planRes = await mcpCall(
      mcpToken,
      "plan_project",
      { projectId: pId, mode: "suggest" },
      reqId++,
    );
    console.log(
      `   plan_project call took ${planRes.timeMs}ms (Enabled/Working: ${planRes.data.result?.isError ? "No, " + planRes.data.result?.structuredContent?.error?.message : "Yes"})`,
    );

    const analyzeRes = await mcpCall(
      mcpToken,
      "analyze_work_graph",
      {},
      reqId++,
    );
    console.log(
      `   analyze_work_graph took ${analyzeRes.timeMs}ms (Enabled/Working: ${analyzeRes.data.result?.isError ? "No, " + analyzeRes.data.result?.structuredContent?.error?.message : "Yes"})`,
    );

    const weeklyRes = await mcpCall(
      mcpToken,
      "weekly_review",
      { mode: "suggest" },
      reqId++,
    );
    console.log(
      `   weekly_review took ${weeklyRes.timeMs}ms (Enabled/Working: ${weeklyRes.data.result?.isError ? "No, " + weeklyRes.data.result?.structuredContent?.error?.message : "Yes"})`,
    );
  }

  console.log("\n--- Stress Test Completed Successfully ---");
  process.exit(0);
}

runTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
