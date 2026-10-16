#!/usr/bin/env bash
# Empacota o Questlist desta máquina para levar a outro servidor (D177, docs/SERVIDOR.md).
#
#   bash scripts/servidor/empacotar.sh            # migração de verdade: para tudo aqui e não religa
#   bash scripts/servidor/empacotar.sh --ensaio   # ensaio: para o banco ~1 min, empacota e religa tudo
#   ... --cifrar                                  # cifra o pacote com senha (gpg), recomendado
#
# O pacote leva: o projeto (com .git e os segredos que ficam fora do git: .env.local,
# supabase/.env.local, supabase/signing_keys.json), downloads/ (APK), os volumes do banco e do
# Storage (cópia fiel, com contas e senhas), um pg_dump de segurança, o token e a config do túnel e
# a chave de assinatura do APK. Fica de fora o que se refaz: node_modules, android/, dist*.
#
# ATENÇÃO: o pacote tem senhas, tokens e os dados de todo mundo. Leve por cabo, pendrive ou scp,
# nunca por nuvem aberta. Na migração de verdade, o túnel daqui fica parado: dois computadores com
# o mesmo token dividiriam as visitas entre dois bancos diferentes.
set -euo pipefail

MODE=final
CIFRAR=0
for arg in "$@"; do
  case "$arg" in
    --ensaio) MODE=ensaio ;;
    --cifrar) CIFRAR=1 ;;
    -h | --help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 2
      ;;
  esac
done

cd "$(dirname "$0")/../.."
ROOT=$PWD
STAMP=$(date +%Y-%m-%d-%H%M)
NAME=questlist-servidor-$STAMP
WORK=$(mktemp -d "${TMPDIR:-/tmp}/questlist-pacote.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
OUT_DIR=${OUT_DIR:-$HOME}
PKG=$WORK/$NAME
umask 077
mkdir -p "$PKG/volumes" "$PKG/segredos"

CT=${CONTAINER:-$(command -v podman >/dev/null && echo podman || echo docker)}
DB=supabase_db_task_tracking
passo() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

passo "Conferindo o banco ($CT)"
"$CT" ps --format '{{.Names}}' | grep -qx "$DB" || {
  echo "O Supabase não está rodando (npm run db:start). Preciso dele de pé para o pg_dump." >&2
  exit 1
}
psql_() { "$CT" exec "$DB" psql -U postgres -d postgres -qAt -c "$1"; }
USERS=$(psql_ "select count(*) from auth.users")
TASKS=$(psql_ "select count(*) from public.tasks")
echo "Contas: $USERS · tarefas: $TASKS"

passo "Cópia de segurança do banco (pg_dump)"
"$CT" exec "$DB" pg_dump -U postgres -Fc -d postgres >"$PKG/banco.dump"
ls -lh "$PKG/banco.dump" | awk '{print $5}'

passo "Parando o app e o banco (para a cópia dos volumes ficar consistente)"
systemctl --user stop tasker-tunnel tasker-quick tasker-web tasker-powersync 2>/dev/null || true
npx supabase stop >/dev/null

passo "Copiando os volumes"
for vol in supabase_db_task_tracking supabase_storage_task_tracking; do
  if "$CT" volume inspect "$vol" >/dev/null 2>&1; then
    # Por um container: os donos dos arquivos (o usuário do Postgres) saem como dentro dele
    "$CT" run --rm -v "$vol:/dados:ro" -v "$PKG/volumes:/saida" docker.io/library/alpine:3.20 \
      tar -C /dados --numeric-owner -czpf "/saida/$vol.tar.gz" .
    echo "$vol: $(du -h "$PKG/volumes/$vol.tar.gz" | cut -f1)"
  else
    echo "$vol: não existe (pulado)"
  fi
done

if [ "$MODE" = ensaio ]; then
  passo "Ensaio: religando tudo aqui"
  npx supabase start >/dev/null
  systemctl --user start tasker-powersync tasker-web tasker-tunnel
fi

passo "Projeto (sem node_modules, android e builds)"
BASE=$(basename "$ROOT")
tar -C "$(dirname "$ROOT")" --exclude=node_modules \
  --exclude="$BASE/android" --exclude="$BASE/ios" --exclude="$BASE/dist" \
  --exclude="$BASE/dist-remote" --exclude="$BASE/.expo" --exclude="$BASE/test-results" \
  --exclude="$BASE/playwright-report" --exclude="$BASE/public/@powersync" \
  -czf "$PKG/projeto.tar.gz" "$BASE"
du -h "$PKG/projeto.tar.gz" | cut -f1

passo "Segredos de fora do projeto"
copy() { [ -e "$1" ] && cp -a "$1" "$PKG/segredos/$2" && echo "  $2" || echo "  (sem $1)"; }
copy "$HOME/.config/cloudflared/tasker.token" tasker.token
copy "$HOME/.cloudflared/config.yml" cloudflared-config.yml
copy "$HOME/.config/questlist" questlist-config
mkdir -p "$PKG/segredos/systemd-antigo"
cp -a "$HOME"/.config/systemd/user/tasker-*.service "$PKG/segredos/systemd-antigo/" 2>/dev/null || true

passo "Manifesto"
cat >"$PKG/MANIFESTO.txt" <<EOF
Pacote do Questlist gerado em $(date -Iseconds) por $(whoami)@$(hostname)
Commit: $(git -C "$ROOT" log -1 --format='%h %s')
Pasta original: $ROOT
Node: $(node -v) · Supabase CLI: $(npx supabase --version 2>/dev/null) · Container: $CT
Contas: $USERS · Tarefas: $TASKS
Modo: $MODE
EOF
cp "$ROOT/scripts/servidor/instalar.sh" "$PKG/instalar.sh"
(cd "$PKG" && find . -type f ! -name SHA256SUMS -exec sha256sum {} + >SHA256SUMS)

passo "Fechando o pacote"
FINAL=$OUT_DIR/$NAME.tar
tar -C "$WORK" -cf "$FINAL" "$NAME"
if [ "$CIFRAR" = 1 ]; then
  GPG_TTY=$(tty)
  export GPG_TTY
  gpg --symmetric --cipher-algo AES256 --output "$FINAL.gpg" "$FINAL"
  rm -f "$FINAL"
  FINAL=$FINAL.gpg
fi
cp "$ROOT/scripts/servidor/instalar.sh" "$OUT_DIR/instalar-questlist.sh"
chmod 600 "$FINAL"
sha256sum "$FINAL" >"$FINAL.sha256"

cat <<EOF

Pronto: $FINAL ($(du -h "$FINAL" | cut -f1))
Instalador: $OUT_DIR/instalar-questlist.sh

Leve os dois arquivos para o servidor (pendrive, cabo ou: scp "$FINAL" "$OUT_DIR/instalar-questlist.sh" usuario@servidor:)
e lá rode:  bash instalar-questlist.sh $(basename "$FINAL")
EOF
if [ "$MODE" = final ]; then
  cat <<EOF

Esta máquina ficou PARADA (banco, app e túnel), para não haver dois servidores com o mesmo
endereço. Para voltar a servir daqui (se a instalação nova der errado):
  npx supabase start && systemctl --user start tasker-powersync tasker-web tasker-tunnel
Quando o servidor novo estiver no ar, desligue de vez os serviços daqui:
  systemctl --user disable --now tasker-tunnel tasker-quick tasker-web tasker-powersync tasker-db
EOF
fi
