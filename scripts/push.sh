#!/usr/bin/env bash
set -euo pipefail

REPO="git@github.com:b0x41s/typing-game.git"
MSG="${1:-chore: update}"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || git init
git symbolic-ref -q HEAD >/dev/null 2>&1 || git checkout -b main
git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO"
else
  git remote add origin "$REPO"
fi

git add -A
git commit -m "$MSG" || echo "niets te committen"
git push -u origin main

