const base = require("./jest.config");

module.exports = {
  ...base,
  testMatch: [
    "**/src/ai.api.integration.test.ts",
    "**/src/auth.api.test.ts",
    "**/src/authService.test.ts",
    "**/src/prismaTodoService.test.ts",
  ],
};
