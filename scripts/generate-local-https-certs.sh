#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CERT_DIR="$ROOT_DIR/.local/certs"
CERT_FILE="$CERT_DIR/dev.todos.karthikg.in.pem"
KEY_FILE="$CERT_DIR/dev.todos.karthikg.in-key.pem"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is required. Install it first with: brew install mkcert"
  exit 1
fi

mkdir -p "$CERT_DIR"

mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" \
  dev.todos.karthikg.in localhost 127.0.0.1 ::1

echo "Generated local TLS certs:"
echo "  $CERT_FILE"
echo "  $KEY_FILE"
