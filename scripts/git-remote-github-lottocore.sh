#!/usr/bin/env bash
# Define origin como SSH com host alias github-lottocore (ver docs/DEPLOY.md e ~/.ssh/config na VPS).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
REPO="${LOTTOCORE_GITHUB_REPO:-rppbarbosa/lottocore}"
if [[ ! -f "$HOME/.ssh/lottocore_deploy" ]]; then
  echo "Falta ~/.ssh/lottocore_deploy — veja docs/DEPLOY.md (deploy key)." >&2
  exit 1
fi
git remote set-url origin "git@github-lottocore:${REPO}.git"
echo "origin -> git@github-lottocore:${REPO}.git"
git remote -v
