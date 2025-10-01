#!/usr/bin/env bash
set -euo pipefail

msg=${1:-"chore: update"}

git add -A
git commit -m "$msg" || echo "niets te committen"
git push
