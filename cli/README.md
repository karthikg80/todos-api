# td — Todo CLI

Fast task management from your terminal.

## Install

```bash
# npm
npm install -g @karthikg80/td

# Homebrew
brew tap karthikg80/tap
brew install td
```

## Setup

```bash
td config set api-url https://your-server.example.com
td login
```

## Commands

### Authentication

```bash
td login          # Log in with email + password
td logout         # Clear stored credentials
td whoami         # Show current user info
```

### Todos

```bash
td add "Buy groceries"                       # Quick add (inbox)
td add "Deploy v2" -p high -s next           # With priority + status
td add "Write tests" -d 2026-04-15 -e low    # With due date + energy

td list                                       # List open todos
td list --status next --priority high         # Filtered
td list --completed                           # Include done
td list --json                                # Machine-readable output
td ls                                         # Alias for list

td get <id>                                   # Detail view
td complete <id>                              # Mark as done
td done <id>                                  # Alias for complete

td update <id> --title "New title"            # Update fields
td update <id> -p urgent -s in_progress       # Change priority + status

td delete <id>                                # Delete a todo
td rm <id>                                    # Alias for delete
```

### Global flags

```bash
--json          # Output raw JSON (pipe-friendly)
--no-color      # Disable terminal colors
--api-url <url> # Override API URL for this command
```

## Configuration

Config is stored in `~/.td/config.json`.

```bash
td config set api-url http://localhost:3000   # Set API URL
td config show                                # Print current config
```

**Resolution order** (highest wins):
1. `--api-url` flag
2. `TD_API_URL` environment variable
3. `~/.td/config.json`
4. Default: `http://localhost:3000`

## Auth

Login stores a JWT locally with auto-refresh. Tokens are saved with `0600` permissions (user-only read/write).

```bash
td login    # Prompts for email + password
td logout   # Clears tokens locally + server-side
```
