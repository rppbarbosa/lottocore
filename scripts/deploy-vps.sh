#!/usr/bin/env bash
# Deploy na pasta do repositório (projeto Compose: lottocore — ver name: no docker-compose.yml).
# git pull → volumes nomeados → docker compose build → up -d
# Uso: na raiz do repositório: ./scripts/deploy-vps.sh
# Atalho legado: ./scripts/deploy-root-merged.sh pode chamar este script.
# Com Traefik (Host por domínio no Compose): use ./scripts/deploy-vps-traefik.sh e DOMAIN no .env.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [[ ! -f docker-compose.yml ]]; then
  echo -e "${RED}Erro: docker-compose.yml não encontrado. Corra o script a partir da raiz do repositório LottoCore.${NC}"
  exit 1
fi

if [[ ! -f .env ]]; then
  echo -e "${RED}Falta .env na raiz. Copie env.production.template para .env e preencha os valores.${NC}"
  exit 1
fi

echo -e "${YELLOW}Atualizando código (git pull origin main)...${NC}"
if ! git pull origin main; then
  echo -e "${RED}Erro no git pull. Verifique conflitos ou ligação ao remoto.${NC}"
  exit 1
fi
echo -e "${GREEN}Código atualizado.${NC}"

echo -e "${YELLOW}Garantir volumes nomeados (docker-compose.yml usa external: true)...${NC}"
docker volume inspect lottocore_pgdata >/dev/null 2>&1 || docker volume create lottocore_pgdata
docker volume inspect lottocore_uploads >/dev/null 2>&1 || docker volume create lottocore_uploads

echo -e "${YELLOW}A construir imagens e a recriar contentores...${NC}"
docker compose build
docker compose up -d

echo ""
echo -e "${YELLOW}Estado dos contentores:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}Deploy concluído.${NC}"
