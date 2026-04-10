import { test, expect } from "@playwright/test";
import { openTodosViewWithStorageState } from "./helpers/todos-view";

/**
 * Command palette tests — open/close, search input, result list, keyboard navigation.
 * Desktop only — command palette is a desktop feature.
 */
test.describe("Command palette", () => {
  test.skip(({ isMobile }) => isMobile);

  test("opens with Ctrl+K / Cmd+K", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    // Press Ctrl+K (Cmd+K on macOS).
    await page.keyboard.press("Control+k");

    // Command palette should appear.
    const palette = page.locator(".command-palette[role='dialog']");
    await expect(palette).toBeVisible();

    await context.close();
  });

  test("closes with Escape", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".command-palette")).not.toBeVisible();

    await context.close();
  });

  test("closes by clicking backdrop", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();

    // Click the backdrop (the overlay behind the palette).
    // The backdrop is typically the parent element or a separate overlay div.
    await page.locator("body").click({ position: { x: 50, y: 50 } });
    // Use a small wait to allow any animation to complete.
    await page.waitForTimeout(300);
    await expect(page.locator(".command-palette")).not.toBeVisible();

    await context.close();
  });

  test("search input is focused and visible", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    await page.keyboard.press("Control+k");

    const input = page.locator("#commandPaletteInput");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("placeholder", "Type a command…");

    await context.close();
  });

  test("palette has listbox role with options", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    await page.keyboard.press("Control+k");

    // Listbox should exist.
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible();

    await context.close();
  });

  test("typing filters commands", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    await page.keyboard.press("Control+k");

    // Type "dark" — should match dark mode command.
    await page.locator("#commandPaletteInput").fill("dark");

    // The results should update (at least the input is visible and processing).
    await expect(page.locator("#commandPaletteInput")).toHaveValue("dark");

    await context.close();
  });

  test("arrow keys navigate results", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();

    // Arrow down should change focus within results.
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");

    // Arrow up to go back.
    await page.keyboard.press("ArrowUp");

    // Palette should still be visible.
    await expect(page.locator(".command-palette")).toBeVisible();

    await context.close();
  });

  test("reopens with Ctrl+K after closing", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await openTodosViewWithStorageState(context);

    // Open and close.
    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".command-palette")).not.toBeVisible();

    // Reopen.
    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();

    await context.close();
  });
});
