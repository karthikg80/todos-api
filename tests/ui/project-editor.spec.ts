import { test, expect } from "@playwright/test";

/**
 * Full project-editor flows (save project, section filter, inline tasks) need authenticated
 * storage state; see `.claude/skills/playwright-testing/SKILL.md`. Those behaviors are covered
 * in `client-react/src/components/projects/ProjectEditorView.test.tsx` for CI.
 */
test.describe("Project editor (smoke)", () => {
  test("React app preview serves /app/", async ({ page }) => {
    const res = await page.goto("/app/");
    expect(res?.ok()).toBeTruthy();
  });
});
