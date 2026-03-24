#!/usr/bin/env bash
# Deploy na VPS com overlay Traefik (roteamento por Host(DOMAIN)).
# Igual ideia ao Comissão 360: docker-compose.yml + docker-compose.traefik.yml
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [[ ! -f docker-compose.traefik.yml ]]; then
  echo -e "${RED}Falta docker-compose.traefik.yml na raiz do repositório.${NC}"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo -e "${RED}Falta .env. Copie env.production.template e defina DOMAIN, PUBLIC_APP_URL, etc.${NC}"
  exit 1
fi

if ! grep -qE '^DOMAIN=.' .env 2>/dev/null; then
  echo -e "${RED}Defina DOMAIN no .env (FQDN exclusivo do LottoCore, ex.: bingo.seudominio.com).${NC}"
  exit 1
fi

echo -e "${YELLOW}Atualizando código (git pull origin main)...${NC}"
git pull origin main
echo -e "${GREEN}Código atualizado.${NC}"

echo -e "${YELLOW}Build e up (compose + Traefik)...${NC}"
docker compose -f docker-compose.yml -f docker-compose.traefik.yml build
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d

echo ""
docker compose -f docker-compose.yml -f docker-compose.traefik.yml ps
echo -e "${GREEN}Deploy com Traefik concluído.${NC}"
