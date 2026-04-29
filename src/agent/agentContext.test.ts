import { randomUUID } from "crypto";
import type { Request } from "express";

import { getAgentRequestContext } from "./agentContext";

jest.mock("crypto", () => ({
  randomUUID: jest.fn(),
}));

function createRequest(headers: Record<string, string> = {}): Request {
  return {
    header(name: string) {
      return headers[name.toLowerCase()];
    },
    requestId: headers["request-id"],
  } as unknown as Request;
}

describe("getAgentRequestContext", () => {
  it("prefers the canonical request id on the express request", () => {
    const req = createRequest({
      "request-id": "req-shared-123",
      "x-agent-request-id": "legacy-agent-id",
      "x-agent-name": "agent-runner",
    });

    expect(getAgentRequestContext(req)).toEqual({
      actor: "agent-runner",
      requestId: "req-shared-123",
    });
  });

  it("falls back to the legacy agent header when no request id exists", () => {
    const req = createRequest({
      "x-agent-request-id": "legacy-agent-id",
    });

    expect(getAgentRequestContext(req)).toEqual({
      actor: "unknown-agent",
      requestId: "legacy-agent-id",
    });
  });

  it("generates a request id when neither header is present", () => {
    const mockedRandomUuid = jest.mocked(randomUUID);
    mockedRandomUuid.mockReturnValue("generated-request-id");

    const req = createRequest();

    expect(getAgentRequestContext(req)).toEqual({
      actor: "unknown-agent",
      requestId: "generated-request-id",
    });
  });
});
