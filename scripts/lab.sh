#!/usr/bin/env bash
# Lab: ambiente experimental isolado neste PC (D178, docs/AMBIENTES.md). Uma cópia do projeto
# (git worktree em ../task_tracking-lab, branch "lab") com Supabase próprio e mínimo (portas 553xx,
# sem Studio, funções, logs nem PowerSync) e a web na 8083. Mexer nele não afeta o desenvolvimento
# principal nem o banco dele.
#
#   npm run lab -- criar     # cria a pasta, instala e sobe o banco (uma vez)
#   npm run lab -- web       # abre o app do lab em http://localhost:8083
#   npm run lab -- subir     # sobe o banco do lab (depois de reiniciar o PC)
#   npm run lab -- parar     # para o banco do lab (os dados ficam)
#   npm run lab -- zerar     # apaga os dados do lab e recria o banco com as migrações
#   npm run lab -- apagar    # para tudo e remove a pasta (o branch "lab" fica no git)
#
# Para trazer um experimento para o projeto: commit no branch "lab" e, no principal,
# `git merge lab` (ou `git cherry-pick`). Para começar de novo da main: `git -C ../task_tracking-lab
# reset --hard main`.
set -euo pipefail
cd "$(dirname "$0")/.."
MAIN=$PWD
LAB=$(dirname "$MAIN")/task_tracking-lab
EXCLUIR=studio,edge-runtime,vector,logflare,imgproxy
cmd=${1:-}

supabase_lab() { (cd "$LAB" && npx supabase "$@"); }

case "$cmd" in
  criar)
    if [ ! -d "$LAB" ]; then
      if git show-ref --quiet refs/heads/lab; then
        git worktree add "$LAB" lab
      else
        git worktree add "$LAB" -b lab main
      fi
    fi
    cat >"$LAB/.ambiente.local" <<'EOF'
# Lab: ambiente experimental deste PC (D178)
AMBIENTE=lab
SERVICO=tasker-lab
WEB_PORT=8083
WEB_URL=http://localhost:8083
EOF
    cat >"$LAB/.env.local" <<'EOF'
# App do lab: Supabase próprio na 55321, sem PowerSync (o app fala direto com o servidor)
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
EOF
    cat >"$LAB/supabase/.env.local" <<'EOF'
# Supabase do lab (D178): outro projeto e outras portas. Chaves padrão (nada sai deste PC)
SUPABASE_PROJECT_ID=task_tracking_lab
SUPABASE_API_PORT=55321
SUPABASE_DB_PORT=55322
SUPABASE_DB_SHADOW_PORT=55320
SUPABASE_DB_POOLER_PORT=55329
SUPABASE_STUDIO_PORT=55323
SUPABASE_LOCAL_SMTP_PORT=55324
SUPABASE_ANALYTICS_PORT=55327
SUPABASE_AUTH_JWT_ISSUER=http://127.0.0.1:55321/auth/v1
SUPABASE_AUTH_SITE_URL=http://localhost:8083
SUPABASE_AUTH_EXTERNAL_URL=http://127.0.0.1:55321/auth/v1
SUPABASE_AUTH_ADDITIONAL_REDIRECT_URLS=http://localhost:8083,http://localhost:8083/**
EOF
    (cd "$LAB" && npm ci --no-audit --no-fund >/dev/null)
    supabase_lab start -x "$EXCLUIR" >/dev/null
    echo "Lab pronto em $LAB (branch lab). Abra com: npm run lab -- web"
    echo "E-mails do lab (confirmação, senha): http://127.0.0.1:55324"
    ;;
  web) cd "$LAB" && exec npx expo start --web --port 8083 ;;
  subir) supabase_lab start -x "$EXCLUIR" >/dev/null && echo "Banco do lab no ar (55321)" ;;
  parar) supabase_lab stop >/dev/null && echo "Banco do lab parado (dados guardados)" ;;
  zerar)
    read -r -p "Apagar os dados do lab e recriar o banco? [s/N] " ok
    [ "$ok" = s ] || exit 1
    supabase_lab db reset
    ;;
  apagar)
    read -r -p "Parar o lab, apagar o banco dele e remover $LAB? [s/N] " ok
    [ "$ok" = s ] || exit 1
    supabase_lab stop --no-backup >/dev/null 2>&1 || true
    git worktree remove --force "$LAB"
    echo "Lab removido. O branch \"lab\" continua no git (git branch -D lab para apagar)."
    ;;
  *)
    sed -n '2,18p' "$0"
    exit 2
    ;;
esac
