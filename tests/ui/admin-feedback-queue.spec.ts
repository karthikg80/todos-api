import { expect, test } from "@playwright/test";
import { openTodosViewWithStorageState } from "./helpers/todos-view";

function buildFeedback(overrides: Record<string, unknown> = {}) {
  return {
    id: "feedback-1",
    userId: "user-1",
    type: "bug",
    title: "Task drawer crashes",
    body: "What happened?\nTask drawer crashed.\n\nWhat did you expect?\nA save.\n\nWhat were you doing right before it happened?\nEditing notes.",
    screenshotUrl: "https://example.com/bug.png",
    attachmentMetadata: {
      name: "bug.png",
      type: "image/png",
      size: 2048,
      lastModified: 1710000000000,
    },
    pageUrl: "https://app.example.com/?view=todos",
    userAgent: "Playwright Browser",
    appVersion: "1.6.0",
    status: "new",
    classification: null,
    triageConfidence: null,
    normalizedTitle: null,
    normalizedBody: null,
    impactSummary: null,
    reproSteps: [],
    expectedBehavior: null,
    actualBehavior: null,
    proposedOutcome: null,
    agentLabels: [],
    missingInfo: [],
    triageSummary: "Likely reproducible",
    severity: "medium",
    dedupeKey: null,
    duplicateCandidate: false,
    matchedFeedbackIds: [],
    matchedGithubIssueNumber: null,
    matchedGithubIssueUrl: null,
    duplicateOfFeedbackId: null,
    duplicateOfGithubIssueNumber: null,
    duplicateOfGithubIssueUrl: null,
    duplicateReason: null,
    githubIssueNumber: null,
    githubIssueUrl: null,
    promotedAt: null,
    reviewedByUserId: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: "2026-03-20T18:00:00.000Z",
    updatedAt: "2026-03-20T18:00:00.000Z",
    user: {
      id: "user-1",
      email: "reporter@example.com",
      name: "Reporter",
    },
    reviewer: null,
    ...overrides,
  };
}

test.describe("Admin feedback queue", () => {
  test("filters feedback, shows detail, and updates review state", async ({
    page,
  }) => {
    let patchPayload: Record<string, unknown> | null = null;
    let triageCalled = false;
    let linkDuplicatePayload: Record<string, unknown> | null = null;
    let promotePayload: Record<string, unknown> | null = null;
    const bugFeedback = buildFeedback();
    const featureFeedback = buildFeedback({
      id: "feedback-2",
      type: "feature",
      title: "Add planning bundles",
      body: "What are you trying to do?\nPlan next week.\n\nWhat is hard today?\nToo many manual steps.\n\nWhat would make this better?\nSuggested bundles.",
      status: "triaged",
      createdAt: "2026-03-20T19:00:00.000Z",
      updatedAt: "2026-03-20T19:00:00.000Z",
    });

    await page.route("**/admin/users", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/admin/feedback?*", async (route) => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get("type");
      const status = url.searchParams.get("status");
      let items = [featureFeedback, bugFeedback];
      if (type) {
        items = items.filter((item) => item.type === type);
      }
      if (status) {
        items = items.filter((item) => item.status === status);
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(items),
      });
    });

    await page.route("**/admin/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([featureFeedback, bugFeedback]),
      });
    });

    await page.route("**/admin/feedback/feedback-1/triage", async (route) => {
      triageCalled = true;
      Object.assign(bugFeedback, {
        classification: "bug",
        triageConfidence: 0.93,
        normalizedTitle: "Task drawer crashes on save",
        normalizedBody:
          "Bug report describing a task drawer save crash while editing notes.",
        impactSummary: "Users cannot save task edits from the drawer.",
        reproSteps: ["Edit notes in the task drawer.", "Press save."],
        expectedBehavior: "The task should save successfully.",
        actualBehavior: "The task drawer crashes on save.",
        proposedOutcome:
          "Stabilize drawer save handling and preserve note edits.",
        agentLabels: ["feedback:bug", "source:bug", "has:screenshot"],
        missingInfo: [],
        triageSummary:
          'Bug feedback from "Task drawer crashes" on https://app.example.com/?view=todos.',
        dedupeKey: "abc123dedupekeyxyz789012",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(bugFeedback),
      });
    });

    await page.route(
      "**/admin/feedback/feedback-1/promotion-preview",
      async (route) => {
        if (!bugFeedback.normalizedTitle) {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Feedback must be triaged before promotion",
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            issueType: "bug",
            title: bugFeedback.normalizedTitle,
            body: [
              "## Summary",
              "Bug feedback from task drawer crash.",
              "",
              "## Steps To Reproduce",
              "- Open the task drawer",
              "- Edit notes",
              "- Press save",
              "",
              "## Context",
              "- Source feedback IDs: `feedback-1`",
            ].join("\n"),
            labels: ["bug", "triaged-by-agent", "ui"],
            sourceFeedbackIds: ["feedback-1"],
            canPromote: !bugFeedback.duplicateCandidate,
            duplicateCandidate: bugFeedback.duplicateCandidate,
            duplicateReason: bugFeedback.duplicateReason,
            existingGithubIssueNumber: bugFeedback.githubIssueNumber,
            existingGithubIssueUrl: bugFeedback.githubIssueUrl,
          }),
        });
      },
    );

    await page.route(
      "**/admin/feedback/feedback-2/promotion-preview",
      async (route) => {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Feedback must be triaged before promotion",
          }),
        });
      },
    );

    await page.route("**/admin/feedback/feedback-1/promote", async (route) => {
      const payload = JSON.parse(route.request().postData() || "{}") as Record<
        string,
        unknown
      >;
      promotePayload = payload;

      Object.assign(bugFeedback, {
        duplicateCandidate: true,
        matchedFeedbackIds: ["feedback-2"],
        matchedGithubIssueNumber: 405,
        matchedGithubIssueUrl:
          "https://github.com/karthikg80/todos-api/issues/405",
        duplicateReason: "Matching dedupe key with normalized feedback",
      });
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Duplicate candidate found",
          feedbackRequest: bugFeedback,
        }),
      });
    });

    await page.route("**/admin/feedback/feedback-1", async (route) => {
      if (route.request().method() === "PATCH") {
        const payload = JSON.parse(
          route.request().postData() || "{}",
        ) as Record<string, unknown>;
        if (payload.duplicateOfFeedbackId) {
          linkDuplicatePayload = payload;
          Object.assign(bugFeedback, {
            status: payload.status,
            duplicateCandidate: false,
            duplicateOfFeedbackId: payload.duplicateOfFeedbackId,
            duplicateReason: payload.duplicateReason,
            matchedFeedbackIds: [],
            matchedGithubIssueNumber: null,
            matchedGithubIssueUrl: null,
          });
        } else {
          patchPayload = payload;
          Object.assign(bugFeedback, {
            status: patchPayload.status,
            rejectionReason: patchPayload.rejectionReason,
          });
        }
        Object.assign(bugFeedback, {
          reviewedByUserId: "admin-1",
          reviewedAt: "2026-03-20T20:00:00.000Z",
          reviewer: {
            id: "admin-1",
            email: "admin@example.com",
            name: "Admin",
          },
        });
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(bugFeedback),
      });
    });

    await page.route("**/admin/feedback/feedback-2", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(featureFeedback),
      });
    });

    await openTodosViewWithStorageState(page, {
      name: "Admin Reviewer",
      email: "admin@example.com",
    });

    await page.evaluate(() => {
      const adminTab = document.getElementById("adminNavTab");
      if (adminTab instanceof HTMLElement) {
        adminTab.style.display = "block";
      }
      document.body.classList.add("is-admin-user");
      (window as Window & { switchView: (view: string) => void }).switchView(
        "admin",
      );
    });

    await expect(page.locator("#adminView")).toHaveClass(/active/);
    await expect(page.locator("#adminFeedbackList")).toContainText(
      "Add planning bundles",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "Plan next week.",
    );

    await page
      .locator(".admin-filter-group")
      .filter({ hasText: "Type" })
      .getByRole("button", { name: "bug", exact: true })
      .click();
    await expect(page.locator("#adminFeedbackList")).toContainText(
      "Task drawer crashes",
    );
    await expect(page.locator("#adminFeedbackList")).not.toContainText(
      "Add planning bundles",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "Task drawer crashed.",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "https://app.example.com/?view=todos",
    );

    await page
      .locator("#adminFeedbackDetail")
      .getByRole("button", { name: "Run triage", exact: true })
      .click();
    expect(triageCalled).toBe(true);
    await expect(page.locator("#adminMessage")).toContainText(
      "Feedback triage updated",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "Task drawer crashes on save",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "Users cannot save task edits from the drawer.",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "feedback:bug",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "Create GitHub issue",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "triaged-by-agent",
    );

    await page
      .locator("#adminFeedbackDetail")
      .getByRole("button", { name: "Create GitHub issue", exact: true })
      .click();
    expect(promotePayload).toEqual({
      ignoreDuplicateSuggestion: false,
    });
    await expect(page.locator("#adminMessage")).toContainText(
      "Duplicate candidate found",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "feedback-2",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText("#405");

    await page
      .locator("#adminFeedbackDetail")
      .getByRole("button", { name: "Link matched feedback", exact: true })
      .click();

    expect(linkDuplicatePayload).toEqual({
      status: "triaged",
      duplicateOfFeedbackId: "feedback-2",
      duplicateReason: "Matching dedupe key with normalized feedback",
    });
    await expect(page.locator("#adminMessage")).toContainText(
      "Feedback linked as duplicate",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "Confirmed feedback duplicate",
    );

    await page
      .locator("#adminFeedbackRejectionReason")
      .fill("Missing enough detail to act on this safely");
    await page
      .locator("#adminFeedbackDetail")
      .getByRole("button", { name: "Reject", exact: true })
      .click();

    expect(patchPayload).toEqual({
      status: "rejected",
      rejectionReason: "Missing enough detail to act on this safely",
    });
    await expect(page.locator("#adminMessage")).toContainText(
      "Feedback marked rejected",
    );
    await expect(page.locator("#adminFeedbackDetail")).toContainText(
      "Missing enough detail to act on this safely",
    );
  });
});
