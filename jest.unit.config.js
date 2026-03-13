const base = require("./jest.config");

module.exports = {
  ...base,
  testMatch: [
    "**/src/app.test.ts",
    "**/src/authValidation.test.ts",
    "**/src/todoService.test.ts",
    "**/src/validation.test.ts",
    "**/src/aiContracts.test.ts",
    "**/src/aiService.test.ts",
    "**/src/prismaTodoService.error.test.ts",
    "**/src/api.contract.test.ts",
    "**/src/aiQuotaService.test.ts",
    "**/src/aiApplyService.test.ts",
    "**/src/agentRouter.test.ts",
    "**/src/mcpRouter.test.ts",
    "**/src/mcpPublicRouter.test.ts",
    "**/src/mcpOAuthService.test.ts",
    "**/src/agentIdempotencyService.test.ts",
  ],
};
