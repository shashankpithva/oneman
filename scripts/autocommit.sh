#!/usr/bin/env bash
# OneMan hands-off auto-commit + push watcher (macOS / Linux).
#
# Run this ONCE. It watches the repo folder and, whenever ANY file changes,
# automatically stages, commits, and pushes to GitHub. You never type a git
# command again.
#
# Usage:
#   chmod +x scripts/autocommit.sh
#   ./scripts/autocommit.sh
#
# Optional overrides (env vars):
#   ONEMAN_REPO_DIR  path to repo      (default: parent of this script)
#   ONEMAN_BRANCH    branch to push    (default: main)
#   ONEMAN_INTERVAL  seconds per check (default: 10)
#   ONEMAN_REMOTE    git remote name   (default: origin)

set -uo pipefail

REPO_DIR="${ONEMAN_REPO_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${ONEMAN_BRANCH:-main}"
INTERVAL="${ONEMAN_INTERVAL:-10}"
REMOTE="${ONEMAN_REMOTE:-origin}"

cd "$REPO_DIR" || { echo "[oneman] repo dir not found: $REPO_DIR"; exit 1; }

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[oneman] $REPO_DIR is not a git repo. Run: git init && git remote add origin <url>"
  exit 1
fi

echo "[oneman] watching $REPO_DIR  (branch: $BRANCH, every ${INTERVAL}s)"
echo "[oneman] auto-commit + push is ON. Press Ctrl+C to stop."

while true; do
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    files=$(git diff --cached --name-only | tr '\n' ' ' | sed 's/ *$//')
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    git commit -q -m "Auto update ${ts}" -m "Files: ${files}" 2>/dev/null
    # Stay in sync with remote, then push.
    git pull --rebase --autostash "$REMOTE" "$BRANCH" >/dev/null 2>&1
    if git push "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
      echo "[oneman] pushed ${ts}  ->  ${files}"
    else
      echo "[oneman] committed locally at ${ts}, but PUSH failed (auth/network?). Will retry next change."
    fi
  fi
  sleep "$INTERVAL"
done
