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
}): Response {
  const { ok = true, status = 200, body, jsonError } = options;
  return {
    ok,
    status,
    json: async () => {
      if (jsonError) throw jsonError;
      return body as Promise<T>;
    },
  } as unknown as Response;
}

/**
 * Build a Response-like object that rejects on .json().
 */
export function mockResponseJsonError(error: Error): Response {
  return mockResponse({ ok: false, jsonError: error });
}
