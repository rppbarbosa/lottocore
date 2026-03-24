#!/usr/bin/env bash
# Importa dados de um PostgreSQL local (ou outro ambiente) para o contentor
# lottocore-postgres-prod na VPS. Útil quando a produção tem users=0 e você
# já tem dados no PC (mesmo esquema / migrações compatíveis).
#
# No seu PC (exemplo — ajuste porta/senha ao seu .env local):
#   pg_dump -h 127.0.0.1 -p 5433 -U bingo -d bingo -Fc -f lottocore-local.dump
#   scp lottocore-local.dump root@IP_DA_VPS:/tmp/
#
# Na VPS, na raiz do repositório:
#   chmod +x scripts/import-pg-dump-into-docker.sh
#   ./scripts/import-pg-dump-into-docker.sh /tmp/lottocore-local.dump
#
# Aviso: --clean remove objetos existentes na base bingo antes de restaurar.
# Pare o backend se quiser evitar escritas durante a importação:
#   docker compose stop backend
set -euo pipefail

CONTAINER="${LOTTOCORE_POSTGRES_CONTAINER:-lottocore-postgres-prod}"
DB_USER="${POSTGRES_USER:-bingo}"
DB_NAME="${POSTGRES_DB:-bingo}"

if [[ $# -lt 1 ]] || [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  echo "Uso: $0 <ficheiro.dump|ficheiro.sql>"
  echo "  formato custom (-Fc) → pg_restore --clean --if-exists"
  echo "  .sql (texto)        → psql -f (use dump completo; pode falhar se o esquema divergir)"
  exit 1
fi

DUMP="$(realpath "$1")"
if [[ ! -f "$DUMP" ]]; then
  echo "Erro: ficheiro não encontrado: $DUMP"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Erro: contentor $CONTAINER não está a correr."
  exit 1
fi

BASENAME="$(basename "$DUMP")"
docker cp "$DUMP" "$CONTAINER:/tmp/$BASENAME"

echo "A importar para $CONTAINER, base $DB_NAME (isto pode demorar)…"

if [[ "$DUMP" == *.sql ]]; then
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "/tmp/$BASENAME"
else
  set +e
  docker exec "$CONTAINER" pg_restore \
    --no-owner \
    --clean \
    --if-exists \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    "/tmp/$BASENAME"
  rc=$?
  set -e
  # 0 = OK, 1 = avisos não fatais (comum com --clean)
  if [[ "$rc" -gt 1 ]]; then
    echo "Erro: pg_restore saiu com código $rc"
    docker exec "$CONTAINER" rm -f "/tmp/$BASENAME"
    exit "$rc"
  fi
fi

docker exec "$CONTAINER" rm -f "/tmp/$BASENAME"

echo "--- Após importação: contagem de utilizadores ---"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM users;"

echo "Feito. Se parou o backend: docker compose start backend"
