#!/usr/bin/env bash
# APK para Android instalado direto (U7, D155), sem loja e sem EAS: gera android/ (CNG, fora do
# git), compila o release assinado e deixa em downloads/questlist.apk + downloads/apk.json, que o
# scripts/serve.mjs entrega em https://tasker.wavdev.org/downloads/. O botão do Perfil lê o apk.json.
#
# Precisa do JDK 17 e do Android SDK 36 (docs/OPERACOES.md). A chave de assinatura e a senha ficam
# em ~/.config/questlist/ (NUNCA no repositório); se não existirem, são criadas. Perder a chave =
# quem instalou precisa desinstalar para instalar a próxima versão.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

export JAVA_HOME="${JAVA_HOME:-$(ls -d "$HOME"/.local/share/android-build/jdk-17* 2>/dev/null | head -1)}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
[ -x "$JAVA_HOME/bin/java" ] || { echo "JDK 17 não encontrado (veja docs/OPERACOES.md)"; exit 1; }

CONF="$HOME/.config/questlist"
KEYSTORE="$CONF/release.keystore"
SECRETS="$CONF/keystore.env"
mkdir -p "$CONF" && chmod 700 "$CONF"
if [ ! -f "$KEYSTORE" ]; then
  PASS="$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias questlist -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass "$PASS" -keypass "$PASS" -dname "CN=Questlist" >/dev/null 2>&1
  printf 'STORE_PASSWORD=%s\n' "$PASS" > "$SECRETS"
  chmod 600 "$KEYSTORE" "$SECRETS"
  echo "Chave de assinatura criada em $KEYSTORE (faça backup)"
fi
# shellcheck disable=SC1090
source "$SECRETS"

URL="${QUESTLIST_URL:-https://tasker.wavdev.org}"
export EXPO_PUBLIC_SUPABASE_URL="$URL/supabase"
export EXPO_PUBLIC_POWERSYNC_URL="$URL/powersync"
export EXPO_PUBLIC_WEB_URL="$URL"
export NODE_ENV=production
export EXPO_PUBLIC_APK_CODE="$(git rev-list --count HEAD)"
VERSION="$(node -p "require('./app.json').expo.version")"
CODE="$(git rev-list --count HEAD)"
COMMIT="$(git log -1 --format=%h)"
[ -z "$(git status --porcelain --untracked-files=no)" ] || echo "Aviso: há mudanças não commitadas; o APK sai do commit $COMMIT, sem elas"

# Compila o último commit numa cópia à parte (git worktree), nunca a pasta em que se trabalha: o
# Metro lia arquivo pela metade quando alguém editava durante o build
SRC="${APK_WORKTREE:-$HOME/.cache/questlist-apk-src}"
if [ ! -d "$SRC/.git" ] && [ ! -f "$SRC/.git" ]; then
  git worktree add -q --detach "$SRC" HEAD
else
  git -C "$SRC" checkout -q --detach "$(git rev-parse HEAD)"
  git -C "$SRC" reset -q --hard
fi
ln -sfn "$ROOT/node_modules" "$SRC/node_modules"
cp "$ROOT/.env.local" "$SRC/.env.local"
cd "$SRC"

# O cache do Metro guarda os EXPO_PUBLIC_* de outro build (o da web usa endereços relativos)
rm -rf "${TMPDIR:-/tmp}"/metro-* node_modules/.cache/metro 2>/dev/null || true
CI=1 npx expo prebuild --platform android --clean --no-install >/dev/null
sed -i -E "s/versionCode [0-9]+/versionCode $CODE/; s/versionName \"[^\"]+\"/versionName \"$VERSION ($COMMIT)\"/" \
  android/app/build.gradle

# Só arm64-v8a (praticamente todo Android atual): ~1/3 do tamanho do APK com as quatro arquiteturas
(cd android && ./gradlew --no-daemon -q assembleRelease \
  -PreactNativeArchitectures="${APK_ARCHS:-arm64-v8a}" \
  -Pandroid.injected.signing.store.file="$KEYSTORE" \
  -Pandroid.injected.signing.store.password="$STORE_PASSWORD" \
  -Pandroid.injected.signing.key.alias=questlist \
  -Pandroid.injected.signing.key.password="$STORE_PASSWORD")

OUT="${APK_OUT:-$ROOT/downloads}"
mkdir -p "$OUT"
cp android/app/build/outputs/apk/release/app-release.apk "$OUT/questlist.apk"
SIZE="$(stat -c %s "$OUT/questlist.apk")"
printf '{"version":"%s","versionCode":%s,"commit":"%s","size":%s,"builtAt":"%s"}\n' \
  "$VERSION" "$CODE" "$COMMIT" "$SIZE" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT/apk.json"
echo "APK pronto: downloads/questlist.apk ($((SIZE / 1024 / 1024)) MB, versão $VERSION ($COMMIT), código $CODE)"
