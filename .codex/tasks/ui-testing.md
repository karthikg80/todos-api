Project: Static HTML/CSS site (no build). Serve locally on port 4173.

After any UI change:
- Update/add Playwright visual tests for affected pages (desktop + mobile).
- Disable animations in tests.
- Run: CSS lint, HTML validation, link crawl, Playwright tests in CI.
- Update screenshots only when change is intentional (note why in commit/PR).
Never delete tests to make CI pass.
