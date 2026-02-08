// Set NODE_ENV before any imports
process.env.NODE_ENV = 'test';

import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { shouldSetupDatabaseForArgs } from './dbTestConfig';

// Load environment variables
dotenv.config();

/**
 * Jest global setup - runs once before all tests.
 * Ensures test database schema is up to date.
 */
export default async function globalSetup() {
  if (process.env.SKIP_DB_SETUP === 'true') {
    console.log('\n⏭️  Skipping test database setup (SKIP_DB_SETUP=true)\n');
    return;
  }

  if (!shouldSetupDatabaseForArgs(process.argv.slice(2))) {
    console.log('\n⏭️  Skipping test database setup (no DB-backed tests selected)\n');
    process.env.SKIP_DB_TEST_SETUP = 'true';
    return;
  }

  console.log('\n🔧 Setting up test database...\n');

  // Set database URL to test database
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

  try {
    // Push schema to test database (idempotent, no migrations in test)
    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL_TEST,
      },
    });

    console.log('\n✅ Test database ready\n');
  } catch (error) {
    console.error('\n❌ Failed to set up test database:', error);
    throw error;
  }
}
