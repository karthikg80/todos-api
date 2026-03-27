import { expect, test } from "@playwright/test";
import { openTodosViewWithStorageState } from "./helpers/todos-view";

test.describe("Feedback flow", () => {
  test("submits structured feedback and shows confirmation", async ({
    page,
  }) => {
    let submittedPayload: Record<string, unknown> | null = null;

    await page.route("**/feedback", async (route) => {
      submittedPayload = JSON.parse(
        route.request().postData() || "{}",
      ) as Record<string, unknown>;

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "feedback-1",
          userId: "user-1",
          type: submittedPayload?.type || "feature",
          title: submittedPayload?.title || "Requested improvement",
          body: submittedPayload?.body || "",
          screenshotUrl: submittedPayload?.screenshotUrl || null,
          attachmentMetadata: submittedPayload?.attachmentMetadata || null,
          pageUrl: submittedPayload?.pageUrl || null,
          userAgent: submittedPayload?.userAgent || null,
          appVersion: submittedPayload?.appVersion || null,
          status: "new",
          triageSummary: null,
          severity: null,
          dedupeKey: null,
          githubIssueNumber: null,
          githubIssueUrl: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await openTodosViewWithStorageState(page, {
      name: "Feedback Tester",
      email: "user@example.com",
    });

    await page.waitForFunction(() => {
      const switchView = (
        window as Window & {
          switchView?: (view: string) => void;
        }
      ).switchView;
      return (
        typeof switchView === "function" &&
        document.getElementById("todosView")?.classList.contains("active")
      );
    });
    await page.evaluate(() =>
      (window as Window & { switchView: (view: string) => void }).switchView(
        "feedback",
      ),
    );
    await expect(page.locator("#todosView")).toHaveClass(/active/);
    await expect(page.locator("#feedbackPane")).toBeVisible();
    await expect(page.locator("#todosScrollRegion")).toBeHidden();

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
    await page.locator("#feedbackAttachment").setInputFiles({
      name: "planning.png",
      mimeType: "image/png",
      buffer: Buffer.from("fake-image"),
    });

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
      appVersion: "1.6.0",
    });
    expect(typeof submittedPayload?.body).toBe("string");
    expect(String(submittedPayload?.body)).toContain(
      "What are you trying to do?",
    );
    expect(String(submittedPayload?.pageUrl)).toContain("/");
    expect(typeof submittedPayload?.userAgent).toBe("string");
    expect(submittedPayload?.attachmentMetadata).toMatchObject({
      name: "planning.png",
      type: "image/png",
      size: 10,
    });

    await page
      .locator("#feedbackConfirmation")
      .getByRole("button", { name: "Back to workspace" })
      .click();
    await expect(page.locator("#feedbackPane")).toBeHidden();
    await expect(page.locator("#todosScrollRegion")).toBeVisible();
  });
});
