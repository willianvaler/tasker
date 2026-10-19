#!/usr/bin/env bash
# Backup diário do banco deste ambiente (V5 §4, D213): pg_dump em ~/backups/<ambiente>/, guardando
# os últimos 14 (a política de privacidade promete que dados excluídos saem das cópias em até 30
# dias). Instalado como timer pelo `bash scripts/servidor/backup.sh --instalar`.
#   bash scripts/servidor/backup.sh             # faz um backup agora
#   bash scripts/servidor/backup.sh --instalar  # cria/atualiza o timer diário (03:30)
set -euo pipefail
cd "$(dirname "$0")/../.."
source scripts/ambiente.sh
DESTINO="$HOME/backups/$AMBIENTE"
MANTER=14

if [ "${1:-}" = "--instalar" ]; then
  RAIZ=$(pwd)
  UNIDADES="$HOME/.config/systemd/user"
  mkdir -p "$UNIDADES"
  cat > "$UNIDADES/$SERVICO-backup.service" <<UNIT
[Unit]
Description=Backup do banco do Questlist ($AMBIENTE)

[Service]
Type=oneshot
ExecStart=/usr/bin/env bash $RAIZ/scripts/servidor/backup.sh
UNIT
  cat > "$UNIDADES/$SERVICO-backup.timer" <<UNIT
[Unit]
Description=Backup diário do banco do Questlist ($AMBIENTE)

[Timer]
OnCalendar=*-*-* 03:30
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  systemctl --user daemon-reload
  systemctl --user enable --now "$SERVICO-backup.timer"
  echo "Timer $SERVICO-backup.timer ligado: backups em $DESTINO, guardando $MANTER"
  exit 0
fi

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"
ARQUIVO="$DESTINO/questlist-$(date +%F-%H%M).dump"
"$CONTAINER" exec "$DB_CONTAINER" pg_dump -U postgres -Fc -d postgres > "$ARQUIVO.parcial"
mv "$ARQUIVO.parcial" "$ARQUIVO"
chmod 600 "$ARQUIVO"
# Só os últimos $MANTER
ls -1t "$DESTINO"/questlist-*.dump | tail -n +$((MANTER + 1)) | xargs -r rm --
echo "Backup: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"
