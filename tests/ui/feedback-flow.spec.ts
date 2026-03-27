import { expect, test } from "@playwright/test";
import { ensureTodosStorageState } from "./helpers/storage-state";
import fs from "node:fs/promises";

/**
 * Inject cached auth localStorage entries so standalone feedback pages
 * pass their auth gate without needing a running API server.
 */
async function setupAuthForStandalonePage(
  page: import("@playwright/test").Page,
) {
  const storageStatePath = await ensureTodosStorageState();
  const raw = await fs.readFile(storageStatePath, "utf8");
  type StorageState = {
    origins?: Array<{
      origin?: string;
      localStorage?: Array<{ name: string; value: string }>;
    }>;
  };
  const state = JSON.parse(raw) as StorageState;
  const entries = state.origins?.[0]?.localStorage || [];

  await page.addInitScript((localStorageEntries) => {
    for (const entry of localStorageEntries) {
      window.localStorage.setItem(entry.name, entry.value);
    }
  }, entries);
}

test.describe("Feedback flow", () => {
  test("submits structured feedback on standalone page and shows confirmation", async ({
    page,
  }) => {
    let submittedPayload: Record<string, unknown> | null = null;

    await page.route("**/api/feedback", async (route) => {
      if (route.request().method() === "POST") {
        submittedPayload = JSON.parse(
          route.request().postData() || "{}",
        ) as Record<string, unknown>;

        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "feedback-1",
            status: "new",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
      }
    });

    await setupAuthForStandalonePage(page);
    await page.goto("/feedback/new");
    await expect(page.locator("#feedbackForm")).toBeVisible();

    await page.locator("#feedbackType").selectOption("feature");
    await page.locator("#feedbackTitle").fill("Make planning easier");
    await page
      .locator("#feedbackQuestionOne")
      .fill("I am trying to sketch next week's plan.");
    await page
      .locator("#feedbackQuestionTwo")
      .fill("It takes too many manual clicks to group related work.");
    await page
      .locator("#feedbackQuestionThree")
      .fill("Suggested bundles for today and upcoming work would help.");
    await page
      .locator("#feedbackScreenshotUrl")
      .fill("https://example.com/feedback/planning.png");

    await page.getByRole("button", { name: "Send feedback" }).click();

    await expect(page.locator("#feedbackConfirmation")).toBeVisible();
    await expect(page.locator("#feedbackConfirmationTitle")).toHaveText(
      "Feature request sent",
    );
    expect(submittedPayload).not.toBeNull();
    expect(submittedPayload).toMatchObject({
      type: "feature",
      title: "Make planning easier",
      screenshotUrl: "https://example.com/feedback/planning.png",
    });
    expect(typeof submittedPayload?.body).toBe("string");
    expect(String(submittedPayload?.body)).toContain(
      "What are you trying to do?",
    );
  });

  test("feedback list page shows user submissions", async ({ page }) => {
    await page.route("**/api/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "fb-1",
            type: "bug",
            title: "Button doesn't work",
            status: "triaged",
            githubIssueUrl: null,
            createdAt: "2026-03-27T10:00:00.000Z",
            updatedAt: "2026-03-27T10:00:00.000Z",
          },
          {
            id: "fb-2",
            type: "feature",
            title: "Add dark mode",
            status: "promoted",
            githubIssueUrl: "https://github.com/example/repo/issues/42",
            createdAt: "2026-03-26T10:00:00.000Z",
            updatedAt: "2026-03-26T10:00:00.000Z",
          },
        ]),
      });
    });

    await setupAuthForStandalonePage(page);
    await page.goto("/feedback");
    await expect(page.locator(".feedback-list")).toBeVisible();

    const items = page.locator(".feedback-list__item");
    await expect(items).toHaveCount(2);
    await expect(items.first().locator(".feedback-list__title")).toHaveText(
      "Button doesn't work",
    );
    await expect(items.first().locator(".feedback-list__status")).toHaveText(
      "Under review",
    );
    await expect(items.nth(1).locator(".feedback-list__link")).toHaveAttribute(
      "href",
      "https://github.com/example/repo/issues/42",
    );
  });
});
