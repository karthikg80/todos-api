import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildNativeAppToolsList,
  TODAY_PLAN_RESOURCE_URI,
} from "./mcp/appContract";

const root = path.resolve(__dirname, "..");

describe("Phase 3 installable plugin package", () => {
  it("passes package integrity validation", () => {
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts", "validate-todos-plugin-package.mjs")],
      { cwd: root, encoding: "utf8" },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Todos plugin package valid");
  });

  it("does not alter the accepted Phase 2 runtime contract", () => {
    expect(buildNativeAppToolsList().map((tool) => tool.name)).toEqual([
      "list_today",
      "plan_today",
      "capture_task",
      "complete_task",
      "reschedule_task",
      "render_today_plan",
    ]);
    expect(TODAY_PLAN_RESOURCE_URI).toBe("ui://todos/today-plan/v1.html");

    const snapshot = readFileSync(
      path.join(root, "test", "fixtures", "mcp-app-metadata.phase2.json"),
    );
    expect(createHash("sha256").update(snapshot).digest("hex")).toBe(
      "9aaa5b358c3342a9b83a966e9be290af93b2ea53228bea9c94270dc32dcb140c",
    );
  });
});
