import React from "react";
/**
 * Typed mock helpers for tests that need Response-like objects.
 *
 * The vitest `vi.mock()` for `apiCall` returns plain objects that don't
 * satisfy the `Response` interface, causing TS2345 errors. These helpers
 * build properly-typed fakes so we don't need `@ts-nocheck` in test files.
 */

/**
 * Build a minimal Response-like object for mocking apiCall.
 *
 * Usage:
 *   vi.mocked(apiCall).mockResolvedValue(mockResponse({ ok: true, body: { token: "abc" } }));
 */
export function mockResponse<T = unknown>(options: {
  ok?: boolean;
  status?: number;
  body?: T;
  jsonError?: Error;
  /** Custom json function override — use only when body/jsonError are insufficient. */
  jsonFn?: () => Promise<T>;
}): Response {
  const { ok = true, status = 200, body, jsonError, jsonFn } = options;
  return {
    ok,
    status,
    json: jsonFn ?? (async () => {
      if (jsonError) throw jsonError;
      return body as Promise<T>;
    }),
  } as unknown as Response;
}

/**
 * Build a Response-like object that rejects on .json().
 */
export function mockResponseJsonError(error: Error): Response {
  return mockResponse({ ok: false, jsonError: error });
}

/**
 * Typed createElement wrapper for test files that render with mocked props.
 *
 * React.createElement has complex overloads that fail when mocked props don't
 * match the component's expected prop types (e.g. missing required fields,
 * extra mock fields, vi.fn() instead of callbacks). This wrapper accepts any
 * component and any props object, suppressing the overload resolution errors.
 *
 * Usage:
 *   import { ce } from '../test-helpers';
 *   render(ce(MyComponent, { someProp: vi.fn() }));
 */
export function ce(
  Component: React.ComponentType<any> | string,
  props?: Record<string, unknown> | null,
  ...children: React.ReactNode[]
): React.ReactElement {
  return React.createElement(Component, props, ...children);
}
