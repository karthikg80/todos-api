// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { InstallBanner } from "./InstallBanner";

const DISMISSED_KEY = "mobile:installDismissed";

describe("InstallBanner", () => {
  beforeEach(() => {
    localStorage.removeItem(DISMISSED_KEY);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays hidden until beforeinstallprompt", () => {
    render(ce(InstallBanner));
    expect(screen.queryByText("Add to Home Screen")).toBeNull();
  });

  it("shows after beforeinstallprompt and dismiss persists", async () => {
    render(ce(InstallBanner));
    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    ev.preventDefault = vi.fn();
    ev.prompt = prompt;
    ev.userChoice = Promise.resolve({ outcome: "dismissed" });
    await act(async () => {
      window.dispatchEvent(ev);
    });
    expect(screen.getByText("Add to Home Screen")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Add to Home Screen")).toBeNull();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
  });

  it("install calls prompt and clears when accepted", async () => {
    render(ce(InstallBanner));
    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };
    ev.preventDefault = vi.fn();
    ev.prompt = prompt;
    ev.userChoice = Promise.resolve({ outcome: "accepted" });
    await act(async () => {
      window.dispatchEvent(ev);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install" }));
    });
    expect(prompt).toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText("Add to Home Screen")).toBeNull();
  });
});
