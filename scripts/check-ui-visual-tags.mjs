import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const TESTS_DIR = path.join(ROOT, 'tests', 'ui');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
      continue;
    }
    if (entry.isFile() && full.endsWith('.spec.ts')) {
      files.push(full);
    }
  }
  return files;
}

function hasScreenshotAssertion(text) {
  return text.includes('toHaveScreenshot(');
}

function hasVisualTag(text) {
  return text.includes('@visual');
}

async function main() {
  const files = await walk(TESTS_DIR);
  const missingTag = [];

  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    if (hasScreenshotAssertion(text) && !hasVisualTag(text)) {
      missingTag.push(path.relative(ROOT, file));
    }
  }

  if (missingTag.length > 0) {
    console.error('Found snapshot assertions without @visual tag:');
    for (const file of missingTag) {
      console.error(`- ${file}`);
    }
    process.exit(1);
  }

  const packageJson = JSON.parse(await fs.readFile(PACKAGE_JSON, 'utf8'));
  const fastScript = packageJson?.scripts?.['test:ui:fast'] || '';
  if (!String(fastScript).includes('--grep-invert @visual')) {
    console.error('test:ui:fast must exclude @visual tests with --grep-invert @visual');
    process.exit(1);
  }

  console.log('Visual tagging guard passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
