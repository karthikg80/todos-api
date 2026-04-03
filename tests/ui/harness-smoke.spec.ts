import { test, expect } from "@playwright/test";
import { bootstrapTodosContext } from "./helpers/todos-view";

test("Harness session smoke bootstraps Todos and reaches idle state", async ({
  browser,
}) => {
  const { context, page } = await bootstrapTodosContext(browser);

  await expect(page.locator("#todosView")).toHaveClass(/active/);
  await expect(page.locator("#todosContent")).toBeVisible();
  await expect(page.locator("#todosListHeaderTitle")).toHaveText("Focus");

  await context.close();
});
