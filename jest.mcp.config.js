const base = require("./jest.config");

module.exports = {
  ...base,
  testMatch: [
    "**/src/api.contract.test.ts",
    "**/src/agentRouter.test.ts",
    "**/src/mcpRouter.test.ts",
    "**/src/mcpPublicRouter.test.ts",
    "**/src/mcpOAuthService.test.ts",
    "**/src/agentIdempotencyService.test.ts",
  ],
};
