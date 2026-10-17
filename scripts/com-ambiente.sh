#!/usr/bin/env bash
# Roda um comando com as portas e nomes do ambiente desta pasta (D178). Usado pelos serviços:
#   bash scripts/com-ambiente.sh node scripts/serve.mjs
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/ambiente.sh
exec "$@"
