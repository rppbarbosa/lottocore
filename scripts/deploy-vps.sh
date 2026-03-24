#!/usr/bin/env bash
# Deploy na VPS — padrão alinhado ao Nexus (sothia-legal-nexus/deploy.sh):
#   git pull origin main → docker compose build → up -d → ps
# Uso: na raiz do repositório: ./scripts/deploy-vps.sh
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

echo -e "${YELLOW}A construir imagens e a recriar contentores...${NC}"
docker compose build
docker compose up -d

echo ""
echo -e "${YELLOW}Estado dos contentores:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}Deploy concluído.${NC}"
