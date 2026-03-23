#!/usr/bin/env bash
# Uso na VPS, dentro da pasta do repositório: ./scripts/deploy-vps.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Falta .env na raiz. Copie env.production.template para .env e preencha os valores."
  exit 1
fi

git pull
docker compose build
docker compose up -d
docker compose ps
