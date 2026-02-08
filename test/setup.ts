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

  const testDatabaseUrl = process.env.DATABASE_URL_TEST;
  if (!testDatabaseUrl) {
    throw new Error('DATABASE_URL_TEST must be set for integration tests');
  }

  // Defensive guard against destructive reset targeting non-test DBs.
  const lowerUrl = testDatabaseUrl.toLowerCase();
  if (!lowerUrl.includes('test')) {
    throw new Error('Refusing to reset database because DATABASE_URL_TEST does not look like a test database');
  }

  // Set database URL to test database
  process.env.DATABASE_URL = testDatabaseUrl;

  try {
    // Reset and apply migrations for deterministic test schema.
    execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
      },
    });

    console.log('\n✅ Test database ready\n');
  } catch (error) {
    console.error('\n❌ Failed to set up test database:', error);
    throw error;
  }
}
