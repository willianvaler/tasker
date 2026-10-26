# Ambiente desta pasta (D178): produção, alpha ou lab. Use com "source scripts/ambiente.sh".
# Lê os dois arquivos locais (fora do git) e completa o resto com os valores da produção:
#   .ambiente.local        AMBIENTE, SERVICO (prefixo dos serviços), WEB_PORT, POWERSYNC_PORT, WEB_URL
#   supabase/.env.local    SUPABASE_PROJECT_ID, SUPABASE_*_PORT, segredos (lidos também pelo CLI)
_raiz=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
set -a
# shellcheck disable=SC1091
[ -f "$_raiz/.ambiente.local" ] && . "$_raiz/.ambiente.local"
# shellcheck disable=SC1091
[ -f "$_raiz/supabase/.env.local" ] && . "$_raiz/supabase/.env.local"
set +a
export AMBIENTE=${AMBIENTE:-producao}
export SERVICO=${SERVICO:-tasker}
export WEB_PORT=${WEB_PORT:-8081}
export POWERSYNC_PORT=${POWERSYNC_PORT:-8095}
export WEB_URL=${WEB_URL:-https://questlist.wavdev.org}
export SUPABASE_PROJECT_ID=${SUPABASE_PROJECT_ID:-task_tracking}
export SUPABASE_API_PORT=${SUPABASE_API_PORT:-54321}
export SUPABASE_DB_PORT=${SUPABASE_DB_PORT:-54322}
export DB_CONTAINER=supabase_db_$SUPABASE_PROJECT_ID
export POWERSYNC_CONTAINER=$SERVICO-powersync
export CONTAINER=${CONTAINER:-$(command -v podman >/dev/null && echo podman || echo docker)}
unset _raiz
