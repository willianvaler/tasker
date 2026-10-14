#!/usr/bin/env bash
# Publica a versão web para acesso remoto: build em dist-remote/ (Supabase pelo mesmo endereço, em
# /supabase, sync em /powersync) e reinicia o servidor. O túnel (tasker-tunnel.service) não precisa reiniciar.
# --clear: o cache do Metro guarda os EXPO_PUBLIC_* do último build (o do E2E usa outros)
set -euo pipefail
cd "$(dirname "$0")/.."
EXPO_PUBLIC_SUPABASE_URL=/supabase EXPO_PUBLIC_POWERSYNC_URL=/powersync EXPO_PUBLIC_WEB_URL=https://tasker.wavdev.org \
  npx expo export --platform web --clear --output-dir dist-remote >/dev/null
systemctl --user restart tasker-web.service
echo "Publicado: $(git log -1 --format='%h %s')"
