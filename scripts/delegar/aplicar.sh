#!/bin/sh
# Aplica o resultado de uma tarefa delegada na árvore de trabalho (sem commit).
#   scripts/delegar/aplicar.sh <nome>    # a pasta .delegar/<nome>/
# Fusão de três vias (o HEAD pode ter andado desde a delegação) e, com i18n, mescla o fragmento
# nos locales do momento.
set -e
repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
dir=$repo/.delegar/${1:?uso: aplicar.sh <nome>}
[ -f "$dir/resultado.patch" ] || { echo "sem resultado.patch em $dir" >&2; exit 1; }
cd "$repo"
[ -s "$dir/resultado.patch" ] && git apply -3 "$dir/resultado.patch"
if [ -f "$dir/i18n-fragmento.json" ]; then
  node scripts/delegar/mesclar-i18n.mjs "$dir/i18n-fragmento.json"
  npx prettier --log-level warn --write src/i18n/locales/*.json
fi
git status --short
