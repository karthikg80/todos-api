const DEFAULT_DB_REQUIRED_TEST_PATTERNS = [
  'src/auth.api.test.ts',
  'src/authService.test.ts',
  'src/prismaTodoService.test.ts',
];

function getConfiguredPatterns(): string[] {
  const raw = process.env.DB_REQUIRED_TESTS?.trim();
  if (!raw) {
    return DEFAULT_DB_REQUIRED_TEST_PATTERNS;
  }

  return raw
    .split(',')
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
}

export function shouldSetupDatabaseForArgs(args: string[]): boolean {
  const patterns = getConfiguredPatterns();
  const hasExplicitTestSelection = args.some((arg) => arg.endsWith('.ts'));

  if (!hasExplicitTestSelection) {
    return true;
  }

  return args.some((arg) => patterns.some((pattern) => arg.includes(pattern)));
}

export function isDbRequiredTestPath(testPath: string): boolean {
  const patterns = getConfiguredPatterns();
  return patterns.some((pattern) => testPath.endsWith(pattern) || testPath.includes(pattern));
}
