#!/usr/bin/env bash
# Copia os dados da produção para o alpha (D178). Rode na pasta do alpha, no servidor:
#
#   bash scripts/servidor/alpha-copiar-producao.sh
#
# Apaga o banco e os anexos do alpha e põe no lugar uma cópia dos da produção. Copia com a
# produção rodando e depois a "pausa" (não para) só para acertar a diferença, alguns segundos: os
# pedidos esperam e seguem.
# Depois limpa o que não pode valer no alpha: sessões (todo mundo entra de novo no alpha, com a
# mesma senha), aparelhos de push (o alpha nunca avisa o celular de ninguém), o endereço do push e
# o estado do PowerSync (refeito do zero).
set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/ambiente.sh
[ "$AMBIENTE" = alpha ] || {
  echo "Isto só roda na pasta do alpha (aqui é: $AMBIENTE)." >&2
  exit 1
}
if [ "${1:-}" != --sim ]; then
  read -r -p "Apagar os dados do alpha e copiar os da produção? [s/N] " ok
  [ "$ok" = s ] || exit 1
fi
PROD_ID=task_tracking
passo() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

passo "Parando o alpha"
systemctl --user stop tasker-alpha-web tasker-alpha-powersync 2>/dev/null || true
npx supabase stop --no-backup >/dev/null 2>&1 || true

despausar() { docker unpause "supabase_db_$PROD_ID" "supabase_storage_$PROD_ID" >/dev/null 2>&1 || true; }
trap despausar EXIT
for kind in db storage; do
  src=supabase_${kind}_$PROD_ID
  dst=supabase_${kind}_$SUPABASE_PROJECT_ID
  passo "Copiando $src → $dst"
  docker volume rm -f "$dst" >/dev/null 2>&1 || true
  docker volume create --label "com.supabase.cli.project=$SUPABASE_PROJECT_ID" \
    --label "com.docker.compose.project=$SUPABASE_PROJECT_ID" "$dst" >/dev/null
  # 1ª passada com a produção rodando (o grosso); 2ª com ela pausada, só a diferença. A pausa dá
  # uma fotografia consistente (como uma queda de energia: o Postgres se recupera pelo WAL)
  copiar() { docker run --rm -v "$src:/de:ro" -v "$dst:/para" alpine:3.20 sh -c \
    'apk add -q --no-cache rsync >/dev/null && rsync -a --delete /de/ /para/'; }
  copiar
  docker pause "$src" >/dev/null
  inicio=$(date +%s)
  copiar
  docker unpause "$src" >/dev/null
  echo "produção pausada por $(($(date +%s) - inicio)) s"
done
trap - EXIT

passo "Subindo o banco do alpha"
npx supabase start -x studio,edge-runtime,vector,logflare >/dev/null

passo "Limpando o que não vale no alpha"
KEY=$(npx supabase status -o env 2>/dev/null | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<SQL
delete from auth.refresh_tokens;
delete from auth.sessions;
delete from public.push_tokens;
delete from public.app_config where key in ('push_url', 'push_secret');
insert into public.app_config values
  ('storage_url', 'http://supabase_kong_$SUPABASE_PROJECT_ID:8000/storage/v1'),
  ('storage_key', '$KEY')
on conflict (key) do update set value = excluded.value;
select pg_drop_replication_slot(slot_name) from pg_replication_slots where not active;
SQL
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -qc 'drop database if exists powersync_storage'
docker exec "$DB_CONTAINER" psql -U postgres -d postgres -qAt \
  -c "select 'Contas: ' || (select count(*) from auth.users) || ' · tarefas: ' || (select count(*) from public.tasks)"

passo "Religando o alpha"
systemctl --user start tasker-alpha-db tasker-alpha-powersync tasker-alpha-web
echo "Pronto. No alpha, todos entram de novo (mesmo e-mail e senha da produção)."
