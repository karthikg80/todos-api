// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import * as apiClient from "../api/client";
import { useProjectHeadings } from "./useProjectHeadings";
import type { Heading } from "../types";

vi.mock("../api/client", () => ({
  apiCall: vi.fn(),
}));

const mockHeadings: Heading[] = [
  { id: "h1", name: "Backlog", projectId: "p1", sortOrder: 0 },
  { id: "h2", name: "In Progress", projectId: "p1", sortOrder: 1 },
];

describe("useProjectHeadings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty headings for null projectId", async () => {
    const { result } = renderHook(() => useProjectHeadings(null));
    expect(result.current.headings).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("returns empty headings for draft project", async () => {
    const { result } = renderHook(() => useProjectHeadings("draft-test"));
    expect(result.current.headings).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("fetches headings for a real project", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue({
      ok: true,
      json: async () => mockHeadings,
    });

    const { result } = renderHook(() => useProjectHeadings("p1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.headings).toEqual(mockHeadings);
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(apiClient.apiCall).mockRejectedValue(new Error("Network"));

    const { result } = renderHook(() => useProjectHeadings("p1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.headings).toEqual([]);
  });

  it("returns empty headings when API returns non-ok", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue({ ok: false });

    const { result } = renderHook(() => useProjectHeadings("p1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.headings).toEqual([]);
  });

  it("addHeading creates a new heading", async () => {
    const created: Heading = { id: "h3", name: "New", projectId: "p1", sortOrder: 2 };
    vi.mocked(apiClient.apiCall).mockResolvedValue({
      ok: true,
      json: async () => created,
    });

    const { result } = renderHook(() => useProjectHeadings("p1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const heading = await result.current.addHeading("New");
    expect(heading).toEqual(created);
    await waitFor(() => {
      expect(result.current.headings).toContainEqual(created);
    });
  });

  it("addHeading returns null for draft project", async () => {
    const { result } = renderHook(() => useProjectHeadings("draft-x"));
    const heading = await result.current.addHeading("Test");
    expect(heading).toBeNull();
  });

  it("addHeading returns null for empty name", async () => {
    const { result } = renderHook(() => useProjectHeadings("p1"));
    const heading = await result.current.addHeading("  ");
    expect(heading).toBeNull();
  });

  it("updateHeading updates an existing heading", async () => {
    const updated: Heading = { id: "h1", name: "Updated", projectId: "p1", sortOrder: 0 };
    vi.mocked(apiClient.apiCall).mockResolvedValue({
      ok: true,
      json: async () => updated,
    });

    const { result } = renderHook(() => useProjectHeadings("p1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const heading = await result.current.updateHeading("h1", { name: "Updated" });
    expect(heading).toEqual(updated);
  });

  it("deleteHeading removes a heading", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue({
      ok: true,
      json: async () => mockHeadings,
    });

    const { result } = renderHook(() => useProjectHeadings("p1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.mocked(apiClient.apiCall).mockResolvedValue({ ok: true });
    const deleted = await result.current.deleteHeading("h1");
    expect(deleted).toBe(true);
    await waitFor(() => {
      expect(result.current.headings).not.toContainEqual(
        expect.objectContaining({ id: "h1" }),
      );
    });
  });

  it("reorderHeadings updates order optimistically", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue({
      ok: true,
      json: async () => mockHeadings,
    });

    const { result } = renderHook(() => useProjectHeadings("p1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const reordered = [...mockHeadings].reverse();
    vi.mocked(apiClient.apiCall).mockResolvedValue({
      ok: true,
      json: async () => reordered,
    });

    const result2 = await result.current.reorderHeadings(reordered);
    expect(result2).toEqual(reordered);
  });

  it("reorderHeadings rolls back on failure", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue({
      ok: true,
      json: async () => mockHeadings,
    });

    const { result } = renderHook(() => useProjectHeadings("p1"));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const reordered = [...mockHeadings].reverse();
    vi.mocked(apiClient.apiCall).mockResolvedValue({ ok: false });

    await result.current.reorderHeadings(reordered);
    expect(result.current.headings).toEqual(mockHeadings);
  });
});
