# GitHub Project Setup Checklist

This note records the GitHub-native task board setup work for `todos-api`.

## Commands Attempted

These commands were run from the task worktree and did not fully complete the setup because GitHub API access was not available from this environment:

```bash
gh auth status
gh label list --limit 200
gh label create "type:feature" --color 1f883d --description "Feature work"
gh project create --owner karthikg80 --title "Todos App Delivery"
gh project create --owner @me --title "Todos App Delivery"
```

Observed results:

- `gh auth status` succeeded and confirmed an authenticated session for `karthikg80`.
- `gh label list --limit 200` failed with `error connecting to api.github.com`.
- `gh label create ...` failed with `error connecting to api.github.com`.
- `gh project create --owner karthikg80 ...` failed with `unknown owner type`.
- `gh project create --owner @me ...` failed with `error connecting to api.github.com`.

## Web Fallback Completed

The remaining GitHub setup was completed through the GitHub web UI:

- Created the requested workflow labels.
- Created the `Todos App Delivery` project.
- Added project fields:
  - `Status`
  - `Priority`
  - `Type`
  - `Area`
  - `Agent`
  - `Brief Required`
- Updated `Status` options to:
  - `Backlog`
  - `Ready`
  - `In Progress`
  - `In Review`
  - `Blocked`
  - `Done`
- Created saved views:
  - `Agent Queue`
  - `Delivery Board`
  - `Ready for Codex`
  - `Ready for Claude`
  - `Needs Brief Update`
- Enabled repo issue auto-add for `todos-api` via the project workflow filter `is:issue is:open`.

## Remaining Manual Follow-Up

No manual follow-up is required for the baseline operating model.

Optional validation:

- Confirm in normal repo use that the enabled `Pull request linked to issue` workflow gives the linked-PR behavior you want for this project. If the team later wants linked pull requests added as separate project items under a stricter rule, add a dedicated PR auto-add workflow in the GitHub UI.
