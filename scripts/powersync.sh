#!/usr/bin/env bash
# Sobe o PowerSync local (container) ligado ao Postgres do Supabase local.
# Nesta máquina é o Podman; no CI, CONTAINER=docker e DETACH=1 (fica rodando em segundo plano).
set -euo pipefail
cd "$(dirname "$0")/.."
# Portas e nomes do ambiente desta pasta (produção, alpha ou lab, D178)
source scripts/ambiente.sh
PG=postgresql://postgres:postgres@127.0.0.1:$SUPABASE_DB_PORT
PORT=$POWERSYNC_PORT

# Armazenamento dos buckets num banco à parte do mesmo servidor
psql_() { "$CONTAINER" exec "$DB_CONTAINER" psql -U postgres -qAt "$@"; }
psql_ -c "select 1 from pg_database where datname = 'powersync_storage'" | grep -q 1 \
  || psql_ -c "create database powersync_storage"

"$CONTAINER" rm -f "$POWERSYNC_CONTAINER" >/dev/null 2>&1 || true
args=(run --rm --name "$POWERSYNC_CONTAINER" --network host
  -e PS_SOURCE_PG_URI="$PG/postgres"
  -e PS_STORAGE_PG_URI="$PG/powersync_storage"
  -e PS_JWKS_URI="http://127.0.0.1:$SUPABASE_API_PORT/auth/v1/.well-known/jwks.json"
  -e PS_PORT="$PORT"
  -v "$PWD/powersync:/config:ro,Z"
  docker.io/journeyapps/powersync-service:latest start -c /config/config.yaml)
if [ "${DETACH:-}" = 1 ]; then
  "$CONTAINER" "${args[0]}" -d "${args[@]:1}" >/dev/null
  # Espera ficar de pé (até 2 min)
  for _ in $(seq 60); do
    curl -sf "http://127.0.0.1:$PORT/probes/liveness" >/dev/null && exit 0
    sleep 2
  done
  echo "PowerSync não subiu" >&2
  "$CONTAINER" logs "$POWERSYNC_CONTAINER" | tail -30 >&2
  exit 1
fi
exec "$CONTAINER" "${args[@]}"
