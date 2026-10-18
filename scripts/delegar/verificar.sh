#!/bin/sh
# Verificação do delegar.sh: o mesmo que o CI cobra, só nos arquivos tocados (o tsc é do projeto).
#   verificar.sh [--i18n fragmento.json] [--jest caminho]... arquivos.ts...
# Com --i18n, aplica o fragmento nos três locales antes e roda o teste de paridade.
dir=$(dirname "$0")
frag=
jest=
while [ $# -gt 0 ]; do
  case $1 in
    --i18n) frag=$2; shift 2 ;;
    --jest) jest="$jest $2"; shift 2 ;;
    *) break ;;
  esac
done

if [ -n "$frag" ]; then
  # Parte dos locales do HEAD: uma chave renomeada no fragmento não deixa a antiga para trás.
  git checkout -q HEAD -- src/i18n/locales/ || exit 1
  node "$dir/mesclar-i18n.mjs" "$frag" || exit 1
  jest="$jest src/i18n/__tests__/parity.test.ts"
  npx prettier --log-level warn --write src/i18n/locales/*.json || exit 1
fi
[ $# -gt 0 ] && { npx prettier --log-level warn --write "$@" || exit 1; }
npx tsc --noEmit -p . || exit 1
[ $# -gt 0 ] && { npx eslint --max-warnings 0 "$@" || exit 1; }
if [ -n "$jest" ]; then
  # shellcheck disable=SC2086
  out=$(npx jest $jest 2>&1) || { echo "$out" | tail -60; exit 1; }
fi
echo "verificação ok"
