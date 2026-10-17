#!/usr/bin/env bash
# Promove para a produção a versão que está no alpha (D178, docs/AMBIENTES.md). Rode no PC:
#
#   npm run promover
#
# Mostra o que muda da produção para o alpha, pede confirmação, cria a tag vAAAA.MM.DD (com .2,
# .3 se houver mais de uma no dia) no commit do alpha, envia ao GitHub e atualiza a produção.
# Promove exatamente o que foi testado no alpha, não o que está na main agora.
set -euo pipefail
cd "$(dirname "$0")/.."
SERVIDOR=${QUESTLIST_SERVIDOR:-wav-server@192.168.0.106}
PROD=projects/task_tracking
ALPHA=projects/task_tracking-alpha

git fetch --quiet --tags origin
ALPHA_COMMIT=$(ssh "$SERVIDOR" "git -C $ALPHA rev-parse HEAD")
PROD_COMMIT=$(ssh "$SERVIDOR" "git -C $PROD rev-parse HEAD")
if [ "$ALPHA_COMMIT" = "$PROD_COMMIT" ]; then
  echo "A produção já está na mesma versão do alpha ($(git log -1 --format='%h %s' "$ALPHA_COMMIT"))."
  exit 0
fi
echo "Produção: $(git log -1 --format='%h %s' "$PROD_COMMIT" 2>/dev/null || echo "$PROD_COMMIT")"
echo "Alpha:    $(git log -1 --format='%h %s' "$ALPHA_COMMIT")"
echo
echo "Entra na produção:"
git log --oneline --no-decorate "$PROD_COMMIT..$ALPHA_COMMIT" | sed 's/^/  /'
NOVAS=$(git diff --name-only "$PROD_COMMIT" "$ALPHA_COMMIT" -- supabase/migrations | sed 's/^/  /')
[ -n "$NOVAS" ] && printf '\nMigrações do banco:\n%s\n' "$NOVAS"
echo
read -r -p "Promover para a produção? [s/N] " ok
[ "$ok" = s ] || exit 1

TAG=v$(date +%Y.%m.%d)
n=1
while git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; do
  n=$((n + 1))
  TAG=v$(date +%Y.%m.%d).$n
done
git tag -a "$TAG" "$ALPHA_COMMIT" -m "Produção $TAG"
git push --quiet origin "$TAG"
echo "Tag $TAG enviada. Atualizando a produção..."
ssh "$SERVIDOR" "cd $PROD && git fetch --quiet --tags --force origin \
  && git show $TAG:scripts/servidor/atualizar.sh > /tmp/questlist-atualizar.sh \
  && QUESTLIST_RAIZ=\$HOME/$PROD bash /tmp/questlist-atualizar.sh $TAG"
