#!/usr/bin/env bash
# Cria o ambiente alpha (pré-produção) no servidor, ao lado da produção (D178, docs/AMBIENTES.md).
# Rode no servidor, como o seu usuário, depois do instalar.sh:
#
#   bash ~/projects/task_tracking/scripts/servidor/criar-alpha.sh            # com cópia da produção
#   bash ~/projects/task_tracking/scripts/servidor/criar-alpha.sh --vazio    # banco novo, sem dados
#
# O alpha fica em ~/projects/task_tracking-alpha (clone próprio do GitHub, segue a main), com
# Supabase próprio (projeto task_tracking_alpha, portas 544xx, segredos próprios), PowerSync na
# 8096, web na 8091 e os serviços tasker-alpha-*. Um timer atualiza a cada 5 min com a main.
# Endereço: https://alpha-questlist.wavdev.org (falta criar a rota no painel da Cloudflare; o script
# explica no fim). Pode rodar de novo: não recria o que já existe.
set -euo pipefail

VAZIO=0
for arg in "$@"; do
  case "$arg" in
    --vazio) VAZIO=1 ;;
    -h | --help)
      sed -n '2,13p' "$0"
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $arg" >&2
      exit 2
      ;;
  esac
done

PROD=$HOME/projects/task_tracking
ALPHA=$HOME/projects/task_tracking-alpha
REPO=https://github.com/willianvaler/tasker.git
passo() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
[ -d "$PROD" ] || {
  echo "Não achei a produção em $PROD (rode o instalar.sh antes)." >&2
  exit 1
}

passo "Código (clone da main em $ALPHA)"
if [ ! -d "$ALPHA/.git" ]; then
  git clone --quiet "$REPO" "$ALPHA"
fi
cd "$ALPHA"
git fetch --quiet --tags origin
git checkout --quiet --detach origin/main
git log -1 --format='%h %s'

passo "Configuração do ambiente"
umask 077
if [ ! -f .ambiente.local ]; then
  cat >.ambiente.local <<'EOF'
# Ambiente alpha (pré-produção) no servidor (D178)
AMBIENTE=alpha
SERVICO=tasker-alpha
WEB_PORT=8091
POWERSYNC_PORT=8096
WEB_URL=https://alpha-questlist.wavdev.org
EOF
fi
# Chave publicável do app (a padrão do CLI, pública de propósito)
[ -f .env.local ] || cp "$PROD/.env.local" .env.local

passo "Dependências (npm ci)"
npm ci --no-audit --no-fund >/dev/null

if [ ! -f supabase/.env.local ]; then
  passo "Segredos próprios do alpha (diferentes da produção)"
  npx supabase gen signing-key --algorithm ES256 2>/dev/null | python3 -c '
import json, sys
jwk = json.loads(next(l for l in sys.stdin if l.strip().startswith("{")))
json.dump([jwk], open("supabase/signing_keys.json", "w"))'
  chmod 600 supabase/signing_keys.json
  cat >supabase/.env.local <<EOF
# Supabase do alpha (D178): outro projeto, outras portas e segredos próprios (nunca no git)
SUPABASE_PROJECT_ID=task_tracking_alpha
SUPABASE_API_PORT=54421
SUPABASE_DB_PORT=54422
SUPABASE_DB_SHADOW_PORT=54420
SUPABASE_DB_POOLER_PORT=54429
SUPABASE_STUDIO_PORT=54423
SUPABASE_LOCAL_SMTP_PORT=54424
SUPABASE_ANALYTICS_PORT=54427
SUPABASE_AUTH_SITE_URL=https://alpha-questlist.wavdev.org
SUPABASE_AUTH_EXTERNAL_URL=https://alpha-questlist.wavdev.org/supabase/auth/v1
SUPABASE_AUTH_JWT_ISSUER=https://alpha-questlist.wavdev.org/supabase/auth/v1
SUPABASE_AUTH_ADDITIONAL_REDIRECT_URLS=https://alpha-questlist.wavdev.org,https://alpha-questlist.wavdev.org/**,questlist://
SUPABASE_AUTH_JWT_SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
SUPABASE_AUTH_SECRET_KEY=sb_secret_$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')
SUPABASE_AUTH_SIGNING_KEYS_PATH=./signing_keys.json
EOF
fi

passo "Serviços (tasker-alpha-*)"
UNITS=$HOME/.config/systemd/user
mkdir -p "$UNITS"
# Tudo passa pelo scripts/com-ambiente.sh: portas e nomes vêm do .ambiente.local e do supabase/.env.local
RUN="/usr/bin/bash scripts/com-ambiente.sh"
cat >"$UNITS/tasker-alpha-db.service" <<EOF
[Unit]
Description=Supabase do Questlist alpha

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$ALPHA
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStartPre=/bin/sh -c 'for i in \$(seq 60); do docker info >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1'
# Sem Studio e logs: o alpha economiza memória. As funções sobem (leitura de foto, D219)
ExecStart=$RUN npx supabase start -x studio,vector,logflare
ExecStop=$RUN npx supabase stop
TimeoutStartSec=900

[Install]
WantedBy=default.target
EOF
cat >"$UNITS/tasker-alpha-powersync.service" <<EOF
[Unit]
Description=Questlist alpha: PowerSync
After=tasker-alpha-db.service
Wants=tasker-alpha-db.service

[Service]
WorkingDirectory=$ALPHA
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/bash scripts/powersync.sh
ExecStop=/usr/bin/docker stop tasker-alpha-powersync
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
cat >"$UNITS/tasker-alpha-web.service" <<EOF
[Unit]
Description=Questlist alpha: web (dist-remote + proxy do Supabase)
After=tasker-alpha-db.service

[Service]
WorkingDirectory=$ALPHA
ExecStart=$RUN $(command -v node) scripts/serve.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
cat >"$UNITS/tasker-alpha-atualizar.service" <<EOF
[Unit]
Description=Questlist alpha: atualizar com a main do GitHub

[Service]
Type=oneshot
WorkingDirectory=$ALPHA
Environment=PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/bash scripts/servidor/atualizar.sh
TimeoutStartSec=1800
EOF
cat >"$UNITS/tasker-alpha-atualizar.timer" <<EOF
[Unit]
Description=Questlist alpha: procurar versão nova a cada 5 min

[Timer]
OnBootSec=3min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload

if [ "$VAZIO" = 1 ]; then
  passo "Banco novo (vazio)"
  systemctl --user start tasker-alpha-db
else
  passo "Banco: cópia da produção"
  bash scripts/servidor/alpha-copiar-producao.sh --sim
fi

passo "Web do alpha"
bash scripts/deploy.sh >/dev/null 2>&1 || true
systemctl --user enable --now tasker-alpha-db tasker-alpha-powersync tasker-alpha-web tasker-alpha-atualizar.timer
systemctl --user restart tasker-alpha-web tasker-alpha-powersync

passo "Túnel"
CONFIG=$HOME/.cloudflared/config.yml
if [ -f "$CONFIG" ] && ! grep -q 'alpha-questlist.wavdev.org' "$CONFIG"; then
  python3 - "$CONFIG" <<'EOF'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace("  - service: http_status:404", "  - hostname: alpha-questlist.wavdev.org\n    service: http://localhost:8091\n  - service: http_status:404")
open(p, "w").write(s)
EOF
  systemctl --user restart tasker-tunnel
fi

passo "Conferindo"
for _ in $(seq 30); do curl -sf -o /dev/null http://127.0.0.1:8091/ && break; sleep 2; done
curl -sf -o /dev/null http://127.0.0.1:8091/supabase/auth/v1/.well-known/jwks.json && echo "  ok  alpha em http://127.0.0.1:8091" || echo "  FALHOU  (journalctl --user -u tasker-alpha-web)"
for _ in $(seq 60); do curl -sf -o /dev/null http://127.0.0.1:8096/probes/liveness && break; sleep 2; done
curl -sf -o /dev/null http://127.0.0.1:8096/probes/liveness && echo "  ok  PowerSync do alpha" || echo "  FALHOU  (journalctl --user -u tasker-alpha-powersync)"
if curl -sf -o /dev/null https://alpha-questlist.wavdev.org/; then
  echo "  ok  https://alpha-questlist.wavdev.org"
else
  cat <<'EOF'

Falta a rota no painel da Cloudflare (uma vez):
  Zero Trust → Networks → Tunnels → o túnel do tasker → Public Hostnames → Add a public hostname
    Subdomain: alpha   Domain: wavdev.org   Type: HTTP   URL: localhost:8091
EOF
fi
