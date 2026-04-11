#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done

  wait "${PIDS[@]:-}" 2>/dev/null || true
  exit "$exit_code"
}

trap cleanup EXIT INT TERM

if ! command -v caddy >/dev/null 2>&1; then
  echo "caddy is required. Install it first with: brew install caddy"
  exit 1
fi

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is required. Install it first with: brew install mkcert"
  exit 1
fi

if [[ ! -f ".local/certs/dev.todos.karthikg.in.pem" || ! -f ".local/certs/dev.todos.karthikg.in-key.pem" ]]; then
  echo "Local HTTPS certs are missing. Generate them first with: npm run https:certs"
  exit 1
fi

echo "Starting local Postgres..."
npm run db:start

BASE_URL="${BASE_URL:-https://dev.todos.karthikg.in}"
GOOGLE_REDIRECT_URI="${GOOGLE_REDIRECT_URI:-https://dev.todos.karthikg.in/auth/google/callback}"
EMAIL_FEATURES_ENABLED="${EMAIL_FEATURES_ENABLED:-false}"

declare -a PIDS=()

echo "Starting backend on :3000..."
BASE_URL="$BASE_URL" \
GOOGLE_REDIRECT_URI="$GOOGLE_REDIRECT_URI" \
EMAIL_FEATURES_ENABLED="$EMAIL_FEATURES_ENABLED" \
npm run dev &
PIDS+=($!)

echo "Starting React dev server on :5173..."
npm run dev:react &
PIDS+=($!)

echo "Starting HTTPS proxy on :443..."
npm run https:proxy &
PIDS+=($!)

echo
echo "Local HTTPS dev environment is starting."
echo "Open: https://dev.todos.karthikg.in/app/"
echo
echo "One-time prerequisites on this machine:"
echo "  mkcert -install"
echo "  echo '127.0.0.1 dev.todos.karthikg.in' | sudo tee -a /etc/hosts"
echo

wait -n "${PIDS[@]}"
