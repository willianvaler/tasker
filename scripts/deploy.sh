#!/usr/bin/env bash
# Publica a versão web para acesso remoto: build em dist-remote/ (Supabase pelo mesmo endereço, em
# /supabase) e reinicia o servidor. O túnel (tasker-tunnel.service) não precisa reiniciar.
set -euo pipefail
cd "$(dirname "$0")/.."
EXPO_PUBLIC_SUPABASE_URL=/supabase EXPO_PUBLIC_WEB_URL=https://tasker.wavdev.org \
  npx expo export --platform web --output-dir dist-remote >/dev/null
systemctl --user restart tasker-web.service
echo "Publicado: $(git log -1 --format='%h %s')"
