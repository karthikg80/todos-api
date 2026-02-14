const base = require("./jest.config");

module.exports = {
  ...base,
  testMatch: [
    "**/src/app.test.ts",
    "**/src/authValidation.test.ts",
    "**/src/todoService.test.ts",
    "**/src/validation.test.ts",
    "**/src/aiContracts.test.ts",
    "**/src/prismaTodoService.error.test.ts",
    "**/src/api.contract.test.ts",
  ],
};
