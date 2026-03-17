import http from "http";
import { randomUUID } from "crypto";

const API_BASE = `http://localhost:${process.env.PORT ?? 3000}`;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  const port = process.env.PORT || 3000;
  const apiBase = `http://localhost:${port}`;

  console.log(`1. Waiting for server to start on ${apiBase}...`);

  let ready = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${apiBase}/healthz`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch (e) {
      // ignore
    }
    await delay(1000);
  }

  if (!ready) {
    throw new Error("Server did not become ready");
  }

  const email = `testmcp-${randomUUID().slice(0, 8)}@example.com`;
  const password = "Password123!";

  console.log(`2. Registering user: ${email}...`);
  const registerRes = await fetch(`${apiBase}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "MCP Tester" }),
  });

  if (!registerRes.ok) {
    const err = await registerRes.text();
    throw new Error(`Registration failed: ${err}`);
  }

  const loginRes = await fetch(`${apiBase}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const loginData: any = await loginRes.json();
  const appToken = loginData.token;

  console.log("3. Fetching MCP token...");
  const mcpTokenRes = await fetch(`${apiBase}/auth/mcp/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appToken}`,
    },
    body: JSON.stringify({
      scopes: ["tasks.read", "tasks.write", "projects.read", "projects.write"],
      assistantName: "TestScript",
      clientId: "test-client",
    }),
  });

  if (!mcpTokenRes.ok) {
    const err = await mcpTokenRes.text();
    throw new Error(`Failed to get MCP token: ${err}`);
  }

  const mcpTokenData: any = await mcpTokenRes.json();
  const mcpToken = mcpTokenData.token;

  console.log("4. Connecting to MCP SSE endpoint...");
  const req = http.get(`${apiBase}/mcp`, {
    headers: {
      Authorization: `Bearer ${mcpToken}`,
      Accept: "text/event-stream",
    },
  });

  req.on("response", (res) => {
    console.log(`SSE Status: ${res.statusCode}`);

    res.on("data", async (chunk) => {
      const str = chunk.toString();
      console.log(`SSE Message Received: ${str.trim()}`);

      if (str.includes(": connected")) {
        console.log("5. Sending POST /mcp (tools/list)...");

        try {
          const mcpPostRes = await fetch(`${apiBase}/mcp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${mcpToken}`,
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "tools/list",
            }),
          });

          const mcpPostData: any = await mcpPostRes.json();
          console.log(
            `Tools Response:\n${JSON.stringify(
              mcpPostData.result.tools.map((t: any) => t.name),
              null,
              2,
            )}`,
          );

          console.log("\n--- SUCCESS! Test Completed. ---");
          process.exit(0);
        } catch (e) {
          console.error(e);
          process.exit(1);
        }
      }
    });
  });

  req.on("error", (e) => {
    console.error("SSE Error:", e);
    process.exit(1);
  });
}

runTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
