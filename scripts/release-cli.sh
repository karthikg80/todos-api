#!/usr/bin/env bash
set -euo pipefail

# Release script for @karthikg80/td CLI package
# Usage: ./scripts/release-cli.sh [patch|minor|major]
#
# Prerequisites:
#   1. npm login (authenticated to npmjs.com)
#   2. gh CLI authenticated (for Homebrew formula update)

BUMP="${1:-patch}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_DIR="$REPO_ROOT/cli"

echo "==> Bumping version ($BUMP)..."
cd "$CLI_DIR"
NEW_VERSION=$(npm version "$BUMP" --no-git-tag-version | tr -d 'v')
echo "    New version: $NEW_VERSION"

echo "==> Installing dependencies..."
npm install --ignore-scripts

echo "==> Building..."
npm run build

echo "==> Verifying build..."
node dist/index.js --help > /dev/null 2>&1
echo "    Build OK"

echo "==> Publishing to npm..."
npm publish --access public

echo "==> Published @karthikg80/td@$NEW_VERSION to npm"

# Update Homebrew formula if tap repo exists
TAP_DIR="$HOME/dev/homebrew-tap"
if [ -d "$TAP_DIR" ]; then
  echo "==> Updating Homebrew formula..."
  TARBALL_URL="https://registry.npmjs.org/@karthikg80/td/-/td-${NEW_VERSION}.tgz"

  # Wait a moment for npm registry to propagate
  sleep 5

  SHA256=$(curl -sL "$TARBALL_URL" | shasum -a 256 | awk '{print $1}')

  cat > "$TAP_DIR/Formula/td.rb" << FORMULA
class Td < Formula
  desc "CLI for managing your todos — fast task management from the terminal"
  homepage "https://github.com/karthikg80/todos-api"
  url "$TARBALL_URL"
  sha256 "$SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["\#{libexec}/bin/*"]
  end

  test do
    assert_match "CLI for managing your todos", shell_output("\#{bin}/td --help")
  end
end
FORMULA

  cd "$TAP_DIR"
  git add Formula/td.rb
  git commit -m "Update td to $NEW_VERSION"
  git push
  echo "    Homebrew formula updated"
else
  echo "    Skipping Homebrew update (no tap repo at $TAP_DIR)"
  echo "    To enable: git clone git@github.com:karthikg80/homebrew-tap.git ~/dev/homebrew-tap"
fi

echo ""
echo "==> Done! Install with:"
echo "    npm install -g @karthikg80/td@$NEW_VERSION"
echo "    brew tap karthikg80/tap && brew install td"
