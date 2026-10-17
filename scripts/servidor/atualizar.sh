#!/usr/bin/env bash
# Atualiza o ambiente desta pasta no servidor (D178, docs/AMBIENTES.md).
#
#   bash scripts/servidor/atualizar.sh              # alpha: vai para a última main do GitHub
#   bash scripts/servidor/atualizar.sh v2026.10.17  # produção: vai para essa tag
#   ... --forcar                                    # refaz mesmo se já estiver na versão
#
# Passos: busca no GitHub, troca de versão, instala dependências (se o package-lock mudou),
# aplica as migrações novas do banco, publica a web e reinicia os serviços deste ambiente.
# O alpha roda isto sozinho a cada 5 min (tasker-alpha-atualizar.timer); a produção, só pelo
# `npm run promover` (no PC) ou à mão.
set -euo pipefail
# QUESTLIST_RAIZ: o promover roda a versão nova deste script de fora da pasta (a instalada pode
# ser antiga demais para conhecer as regras da nova)
cd "${QUESTLIST_RAIZ:-$(dirname "$0")/../..}"
# Só o nome do ambiente por enquanto: o resto (scripts/ambiente.sh) vem da versão nova, depois do
# checkout (a instalada pode nem ter esse arquivo)
AMBIENTE=$(sed -n 's/^AMBIENTE=//p' .ambiente.local 2>/dev/null || true)
AMBIENTE=${AMBIENTE:-producao}

ALVO=""
FORCAR=0
for arg in "$@"; do
  case "$arg" in
    --forcar) FORCAR=1 ;;
    -*)
      echo "Opção desconhecida: $arg" >&2
      exit 2
      ;;
    *) ALVO=$arg ;;
  esac
done
if [ "$AMBIENTE" = producao ] && [ -z "$ALVO" ]; then
  echo "Produção só vai para uma tag: bash scripts/servidor/atualizar.sh vAAAA.MM.DD" >&2
  exit 2
fi

# Um por vez (o timer do alpha não atropela uma atualização à mão)
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/questlist-atualizar-$AMBIENTE.lock"
flock -n 9 || {
  echo "Outra atualização do $AMBIENTE está rodando."
  exit 0
}

git fetch --quiet --tags --force origin
if [ -n "$ALVO" ]; then
  REF=$(git rev-parse --verify --quiet "refs/tags/$ALVO^{commit}") || {
    echo "Tag $ALVO não existe no GitHub." >&2
    exit 1
  }
else
  REF=$(git rev-parse origin/main)
fi
ATUAL=$(git rev-parse HEAD)
if [ "$REF" = "$ATUAL" ] && [ "$FORCAR" = 0 ]; then
  [ -t 1 ] && echo "$AMBIENTE já está em $(git log -1 --format='%h %s')"
  exit 0
fi

echo "==> $AMBIENTE: $(git log -1 --format='%h' "$ATUAL") → $(git log -1 --format='%h %s' "$REF")"
LOCK_ANTES=$(git rev-parse "$ATUAL:package-lock.json")
git checkout --quiet --detach "$REF"
source scripts/ambiente.sh

if [ "$(git rev-parse HEAD:package-lock.json)" != "$LOCK_ANTES" ] || [ ! -d node_modules ] || [ "$FORCAR" = 1 ]; then
  echo "==> Dependências (npm ci)"
  npm ci --no-audit --no-fund >/dev/null
fi

echo "==> Migrações do banco"
npx supabase migration up

echo "==> Web e serviços"
bash scripts/deploy.sh
systemctl --user restart "$SERVICO-powersync.service"

for _ in $(seq 30); do curl -sf -o /dev/null "http://127.0.0.1:$WEB_PORT/" && break; sleep 2; done
curl -sf -o /dev/null "http://127.0.0.1:$WEB_PORT/supabase/auth/v1/.well-known/jwks.json" || {
  echo "ATENÇÃO: o app não respondeu depois de atualizar (journalctl --user -u $SERVICO-web)" >&2
  exit 1
}
echo "==> $AMBIENTE no ar em $(git log -1 --format='%h %s') ($WEB_URL)"
if command -v questlist-telegram >/dev/null; then
  questlist-telegram "Questlist $AMBIENTE: $(git log -1 --format='%h %s')" >/dev/null 2>&1 || true
fi
