// Set NODE_ENV before any imports
process.env.NODE_ENV = 'test';

import { prisma } from '../src/prismaClient';

/**
 * Jest setup file - runs before each test file.
 * Cleans up test database to ensure test isolation.
 */
beforeEach(async () => {
  // Clean up test database before each test
  await prisma.todo.deleteMany();
});
