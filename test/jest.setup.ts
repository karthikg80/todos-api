// Set NODE_ENV before any imports
process.env.NODE_ENV = "test";

import { prisma } from "../src/prismaClient";
import { isDbRequiredTestPath } from "./dbTestConfig";

/**
 * Jest setup file - runs before each test file.
 * Cleans up test database to ensure test isolation.
 */
beforeEach(async () => {
  if (process.env.SKIP_DB_SETUP === "true") {
    return;
  }

  const testPath = expect.getState().testPath || "";
  const requiresDb = isDbRequiredTestPath(testPath);

  if (!requiresDb) {
    return;
  }

  // Clean up test database before each test.
  // Order matters: delete child rows before parents to respect FK constraints.
  await prisma.aiSuggestionAppliedTodo.deleteMany();
  await prisma.aiSuggestion.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.subtask.deleteMany();
  await prisma.todo.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
});
