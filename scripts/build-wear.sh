#!/usr/bin/env bash
# App do relógio Wear OS (D287, wear/): companheiro do Modo Treino do celular. Sai assinado com a
# MESMA chave do APK do celular (~/.config/questlist/, criada pelo npm run apk): a Data Layer só
# liga o relógio ao celular com o mesmo pacote e a mesma assinatura. Deixa em
# downloads/questlist-wear.apk (o relógio não instala pelo navegador: vai por adb, docs/RELOGIO.md).
#
# `npm run wear -- --install [ip:porta]`: instala no relógio conectado por adb (Wi-Fi).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

export JAVA_HOME="${JAVA_HOME:-$(ls -d "$HOME"/.local/share/android-build/jdk-17* 2>/dev/null | head -1)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
[ -x "$JAVA_HOME/bin/java" ] || { echo "JDK 17 não encontrado (veja docs/OPERACOES.md)"; exit 1; }

KEYSTORE="$HOME/.config/questlist/release.keystore"
SECRETS="$HOME/.config/questlist/keystore.env"
[ -f "$KEYSTORE" ] || { echo "Sem a chave em $KEYSTORE: rode npm run apk antes (a mesma chave assina os dois)"; exit 1; }
# shellcheck disable=SC1090
source "$SECRETS"

CODE="$(git rev-list --count HEAD)"
COMMIT="$(git log -1 --format=%h)"
VERSION="$(node -p "require('./app.json').expo.version")"

(cd wear && ./gradlew --no-daemon -q assembleRelease \
  -PwearVersionCode="$CODE" -PwearVersionName="$VERSION ($COMMIT)" \
  -Pandroid.injected.signing.store.file="$KEYSTORE" \
  -Pandroid.injected.signing.store.password="$STORE_PASSWORD" \
  -Pandroid.injected.signing.key.alias=questlist \
  -Pandroid.injected.signing.key.password="$STORE_PASSWORD")

OUT="${APK_OUT:-$ROOT/downloads}"
mkdir -p "$OUT"
cp wear/app/build/outputs/apk/release/app-release.apk "$OUT/questlist-wear.apk"
echo "Relógio pronto: $OUT/questlist-wear.apk ($(($(stat -c %s "$OUT/questlist-wear.apk") / 1024 / 1024)) MB, código $CODE)"

if [ "${1:-}" = --install ]; then
  if [ -n "${2:-}" ]; then adb connect "$2"; fi
  SERIAL="${2:-}"
  adb ${SERIAL:+-s "$SERIAL"} install -r "$OUT/questlist-wear.apk"
fi
