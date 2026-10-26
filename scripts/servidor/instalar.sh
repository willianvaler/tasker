#!/usr/bin/env bash
# Instala o Questlist num servidor novo com Linux Mint 22 (ou Ubuntu 24.04) a partir do pacote do
# empacotar.sh (D177, docs/SERVIDOR.md). Rode como o seu usuário (não root), com sudo:
#
#   bash instalar-questlist.sh questlist-servidor-AAAA-MM-DD-HHMM.tar[.gpg]
#
# Opções:
#   --chave-ssh "ssh-ed25519 AAAA..."   autoriza essa chave no SSH e desliga o login por senha
#   --ssh-de-fora                       aceita SSH de qualquer rede (padrão: só da rede de casa)
#   --sem-nginx                         não instala o nginx (a entrada pela rede de casa)
#
# Instala e configura: atualizações automáticas de segurança, SSH (sem root, fail2ban), firewall
# (ufw: só SSH e a porta 80 da rede de casa), Docker (portas publicadas só em 127.0.0.1), Node 22,
# cloudflared (o túnel com o token do pacote), nginx (http://<ip-do-servidor> na rede de casa),
# o projeto, os volumes do banco e do Storage, o PowerSync e os serviços que sobem no boot.
# Pode rodar de novo: cada passo confere o que já existe.
set -euo pipefail

PKG_FILE=""
SSH_KEY=""
SSH_ANYWHERE=0
NGINX=1
while [ $# -gt 0 ]; do
  case "$1" in
    --chave-ssh)
      SSH_KEY=${2:?falta a chave depois de --chave-ssh}
      shift
      ;;
    --ssh-de-fora) SSH_ANYWHERE=1 ;;
    --sem-nginx) NGINX=0 ;;
    -h | --help)
      sed -n '2,19p' "$0"
      exit 0
      ;;
    -*)
      echo "Opção desconhecida: $1" >&2
      exit 2
      ;;
    *) PKG_FILE=$1 ;;
  esac
  shift
done

passo() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
aviso() { printf '\033[33m%s\033[0m\n' "$*"; }

[ "$(id -u)" -ne 0 ] || {
  echo "Rode como o seu usuário (o script usa sudo quando precisa), não como root." >&2
  exit 1
}
[ -n "$PKG_FILE" ] && [ -f "$PKG_FILE" ] || {
  echo "Uso: bash $0 questlist-servidor-....tar[.gpg]   (veja --help)" >&2
  exit 2
}
. /etc/os-release
CODENAME=${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}
case "$CODENAME" in
  noble | jammy) ;;
  *) aviso "Sistema não testado ($PRETTY_NAME, base '$CODENAME'). O esperado é Linux Mint 22 (noble)." ;;
esac
ME=$(id -un)
APP=$HOME/projects/task_tracking
sudo -v

# ---------------------------------------------------------------------------------------------
passo "Abrindo o pacote"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/questlist-instalar.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
SRC=$PKG_FILE
if [[ "$PKG_FILE" == *.gpg ]]; then
  command -v gpg >/dev/null || sudo apt-get install -y gnupg
  GPG_TTY=$(tty)
  export GPG_TTY
  gpg --decrypt --output "$WORK/pacote.tar" "$PKG_FILE"
  SRC=$WORK/pacote.tar
fi
tar -C "$WORK" -xf "$SRC"
PKG=$(find "$WORK" -maxdepth 1 -type d -name 'questlist-servidor-*' | head -1)
[ -n "$PKG" ] || {
  echo "Pacote sem a pasta questlist-servidor-*" >&2
  exit 1
}
(cd "$PKG" && sha256sum --quiet -c SHA256SUMS) || {
  echo "Pacote corrompido (SHA256SUMS não confere)." >&2
  exit 1
}
cat "$PKG/MANIFESTO.txt"
EXPECT_USERS=$(sed -n 's/^Contas: \([0-9]*\).*/\1/p' "$PKG/MANIFESTO.txt")

# ---------------------------------------------------------------------------------------------
passo "Pacotes do sistema"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git jq unzip rsync build-essential python3 \
  openssh-server ufw fail2ban unattended-upgrades acl
[ "$NGINX" = 1 ] && sudo apt-get install -y nginx
# Atualizações de segurança sozinhas
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";' | sudo tee /etc/apt/apt.conf.d/20auto-upgrades >/dev/null

# ---------------------------------------------------------------------------------------------
passo "Docker"
if ! command -v docker >/dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $CODENAME stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Porta publicada pelo Docker passa por fora do ufw: aqui todas ficam só em 127.0.0.1 (Postgres,
# Studio, Mailpit nunca aparecem na rede)
sudo mkdir -p /etc/docker
if ! sudo grep -q '"ip": "127.0.0.1"' /etc/docker/daemon.json 2>/dev/null; then
  echo '{ "ip": "127.0.0.1", "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "3" } }' |
    sudo tee /etc/docker/daemon.json >/dev/null
  sudo systemctl restart docker
fi
sudo systemctl enable --now docker
sudo usermod -aG docker "$ME"
# O grupo novo só vale no próximo login; até lá, permissão direta no socket (some no reboot, quando
# o grupo já vale). Sem reiniciar a sessão: isso derrubaria o terminal da área de trabalho
sudo setfacl -m "u:$ME:rw" /var/run/docker.sock

# ---------------------------------------------------------------------------------------------
passo "Node 22"
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

# ---------------------------------------------------------------------------------------------
passo "cloudflared"
if ! command -v cloudflared >/dev/null; then
  sudo mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' |
    sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y cloudflared
fi
cloudflared --version

# ---------------------------------------------------------------------------------------------
passo "Projeto em $APP"
mkdir -p "$(dirname "$APP")"
if [ -e "$APP" ]; then
  BACKUP="$APP.antes-$(date +%Y%m%d%H%M%S)"
  aviso "Já existe $APP: guardando em $BACKUP"
  mv "$APP" "$BACKUP"
fi
TMP_APP=$WORK/app
mkdir -p "$TMP_APP"
tar -C "$TMP_APP" -xzf "$PKG/projeto.tar.gz"
mv "$TMP_APP"/* "$APP"
chmod 600 "$APP/supabase/.env.local" "$APP/supabase/signing_keys.json" 2>/dev/null || true

passo "Segredos (túnel e chave do APK)"
install -d -m 700 "$HOME/.config/cloudflared" "$HOME/.cloudflared" "$HOME/.config/questlist"
[ -f "$PKG/segredos/tasker.token" ] && install -m 600 "$PKG/segredos/tasker.token" "$HOME/.config/cloudflared/tasker.token"
[ -f "$PKG/segredos/cloudflared-config.yml" ] && install -m 600 "$PKG/segredos/cloudflared-config.yml" "$HOME/.cloudflared/config.yml"
[ -d "$PKG/segredos/questlist-config" ] && cp -a "$PKG/segredos/questlist-config/." "$HOME/.config/questlist/"
[ -f "$HOME/.config/cloudflared/tasker.token" ] || aviso "Sem o token do túnel no pacote: copie para ~/.config/cloudflared/tasker.token"

# ---------------------------------------------------------------------------------------------
passo "Dependências do app (npm ci)"
cd "$APP"
npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------------------------
passo "Volumes do banco e do Storage"
for tarball in "$PKG"/volumes/*.tar.gz; do
  [ -e "$tarball" ] || continue
  vol=$(basename "$tarball" .tar.gz)
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    aviso "$vol já existe: mantido (apague com 'docker volume rm $vol' para restaurar do pacote)"
    continue
  fi
  docker volume create --label com.supabase.cli.project=task_tracking \
    --label com.docker.compose.project=task_tracking "$vol" >/dev/null
  docker run --rm -v "$vol:/dados" -v "$PKG/volumes:/entrada:ro" alpine:3.20 \
    tar -C /dados --numeric-owner -xzpf "/entrada/$vol.tar.gz"
  echo "$vol restaurado"
done

passo "Supabase (a primeira vez baixa as imagens, alguns minutos)"
npx supabase start
USERS=$(docker exec supabase_db_task_tracking psql -U postgres -qAt -c 'select count(*) from auth.users')
echo "Contas no banco: $USERS (no pacote: ${EXPECT_USERS:-?})"
if [ -n "${EXPECT_USERS:-}" ] && [ "$USERS" != "$EXPECT_USERS" ]; then
  aviso "A contagem não bate. O pacote tem também banco.dump (pg_dump); veja docs/OPERACOES.md, Restauração."
fi

passo "Web publicada (dist-remote)"
EXPO_PUBLIC_SUPABASE_URL=/supabase EXPO_PUBLIC_POWERSYNC_URL=/powersync EXPO_PUBLIC_WEB_URL=https://questlist.wavdev.org \
  npx expo export --platform web --clear --output-dir dist-remote >/dev/null
echo ok

# ---------------------------------------------------------------------------------------------
passo "Serviços (systemd do usuário, sobem no boot)"
UNITS=$HOME/.config/systemd/user
mkdir -p "$UNITS"
NODE=$(command -v node)
NPX=$(command -v npx)
cat >"$UNITS/tasker-db.service" <<EOF
[Unit]
Description=Supabase local do Questlist

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP
Environment=PATH=/usr/local/bin:/usr/bin:/bin
# O Docker é do sistema: espera ele aceitar comandos
ExecStartPre=/bin/sh -c 'for i in \$(seq 60); do docker info >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1'
ExecStart=$NPX supabase start
TimeoutStartSec=900

[Install]
WantedBy=default.target
EOF
cat >"$UNITS/tasker-powersync.service" <<EOF
[Unit]
Description=Questlist PowerSync (sync do banco local)
After=tasker-db.service
Wants=tasker-db.service

[Service]
WorkingDirectory=$APP
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=CONTAINER=docker
ExecStart=/usr/bin/bash scripts/powersync.sh
ExecStop=/usr/bin/docker stop tasker-powersync
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
cat >"$UNITS/tasker-web.service" <<EOF
[Unit]
Description=Questlist web (dist-remote + proxy do Supabase)
After=tasker-db.service

[Service]
WorkingDirectory=$APP
Environment=PORT=8081
ExecStart=$NODE scripts/serve.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
cat >"$UNITS/tasker-tunnel.service" <<EOF
[Unit]
Description=Túnel Cloudflare questlist.wavdev.org

[Service]
ExecStart=$(command -v cloudflared) tunnel --no-autoupdate --config $HOME/.cloudflared/config.yml run --token-file $HOME/.config/cloudflared/tasker.token
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
EOF
# Serviços do usuário sem login (linger) e o grupo docker valendo para eles
sudo loginctl enable-linger "$ME"
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user daemon-reload
systemctl --user enable tasker-db tasker-powersync tasker-web tasker-tunnel
systemctl --user restart tasker-db
systemctl --user restart tasker-powersync tasker-web
if [ -f "$HOME/.config/cloudflared/tasker.token" ]; then
  systemctl --user restart tasker-tunnel
else
  aviso "Túnel não iniciado (sem token)"
fi

# ---------------------------------------------------------------------------------------------
LAN=$(ip -o -4 route show scope link | awk '!/docker|br-|veth/ {print $1; exit}')
if [ "$NGINX" = 1 ]; then
  passo "nginx (entrada pela rede de casa: http://$(hostname -I | awk '{print $1}'))"
  sudo tee /etc/nginx/sites-available/questlist >/dev/null <<'EOF'
# Questlist na rede de casa: repassa para o serve.mjs (o mesmo que o túnel usa)
map $http_upgrade $connection_upgrade {
  default upgrade;
  ''      close;
}
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  client_max_body_size 30m;
  location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 1h;
  }
}
EOF
  sudo ln -sf /etc/nginx/sites-available/questlist /etc/nginx/sites-enabled/questlist
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl enable --now nginx
  sudo systemctl reload nginx
fi

# ---------------------------------------------------------------------------------------------
passo "SSH"
sudo install -d -m 755 /etc/ssh/sshd_config.d
{
  echo "# Questlist (instalar.sh)"
  echo "PermitRootLogin no"
  echo "MaxAuthTries 4"
  echo "X11Forwarding no"
} | sudo tee /etc/ssh/sshd_config.d/10-questlist.conf >/dev/null
if [ -n "$SSH_KEY" ]; then
  install -d -m 700 "$HOME/.ssh"
  touch "$HOME/.ssh/authorized_keys"
  grep -qxF "$SSH_KEY" "$HOME/.ssh/authorized_keys" || echo "$SSH_KEY" >>"$HOME/.ssh/authorized_keys"
  chmod 600 "$HOME/.ssh/authorized_keys"
  echo "PasswordAuthentication no" | sudo tee -a /etc/ssh/sshd_config.d/10-questlist.conf >/dev/null
  echo "Login por senha desligado: só a chave informada entra."
else
  aviso "SSH aceita senha. Recomendado: rode de novo com --chave-ssh \"\$(cat ~/.ssh/id_ed25519.pub)\" (do seu PC)."
fi
sudo sshd -t
sudo systemctl enable --now ssh
# No Mint 22 o SSH pode estar ativado por socket (sem o serviço rodando): reload falharia
sudo systemctl restart ssh || sudo systemctl restart ssh.socket || true
sudo systemctl enable --now fail2ban

# ---------------------------------------------------------------------------------------------
passo "Firewall (ufw)"
sudo ufw default deny incoming
sudo ufw default allow outgoing
if [ "$SSH_ANYWHERE" = 1 ] || [ -z "$LAN" ]; then
  sudo ufw allow OpenSSH
else
  sudo ufw allow from "$LAN" to any port 22 proto tcp comment 'SSH da rede de casa'
fi
if [ "$NGINX" = 1 ] && [ -n "$LAN" ]; then
  sudo ufw allow from "$LAN" to any port 80 proto tcp comment 'Questlist na rede de casa'
fi
# O Docker publica portas por fora do ufw (e o Supabase CLI pede 0.0.0.0, ignorando o
# daemon.json): o que chega da rede para um container é descartado; só o próprio servidor e os
# containers entre si passam (conferido em 17/10: Postgres e Studio estavam abertos na rede)
if ! sudo grep -q "BEGIN questlist-docker" /etc/ufw/after.rules; then
  cat <<'RULES' | sudo tee -a /etc/ufw/after.rules >/dev/null

# BEGIN questlist-docker: portas publicadas pelo Docker só para o próprio servidor
*filter
:DOCKER-USER - [0:0]
-A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
-A DOCKER-USER -i lo -j RETURN
-A DOCKER-USER -i docker0 -j RETURN
-A DOCKER-USER -i br-+ -j RETURN
-A DOCKER-USER -j DROP
COMMIT
# END questlist-docker
RULES
fi
sudo systemctl enable ufw
sudo ufw --force enable
sudo ufw reload
sudo ufw status verbose

# ---------------------------------------------------------------------------------------------
passo "Conferindo"
ok() { printf '  \033[32mok\033[0m  %s\n' "$*"; }
falha() { printf '  \033[31mFALHOU\033[0m  %s\n' "$*"; }
for _ in $(seq 30); do curl -sf -o /dev/null http://127.0.0.1:8081/ && break; sleep 2; done
curl -sf -o /dev/null http://127.0.0.1:8081/ && ok "app em http://127.0.0.1:8081" || falha "app (journalctl --user -u tasker-web)"
curl -sf -o /dev/null http://127.0.0.1:8081/supabase/auth/v1/.well-known/jwks.json && ok "Supabase pelo app" || falha "Supabase (npx supabase status)"
for _ in $(seq 60); do curl -sf -o /dev/null http://127.0.0.1:8095/probes/liveness && break; sleep 2; done
curl -sf -o /dev/null http://127.0.0.1:8095/probes/liveness && ok "PowerSync" || falha "PowerSync (journalctl --user -u tasker-powersync)"
sleep 5
curl -sf -o /dev/null https://questlist.wavdev.org/ && ok "https://questlist.wavdev.org pelo túnel" || falha "túnel (journalctl --user -u tasker-tunnel)"

cat <<EOF

Instalado. O app está em https://questlist.wavdev.org (e na rede de casa em http://$(hostname -I | awk '{print $1}')).
Pasta do projeto: $APP · operação: $APP/docs/OPERACOES.md e docs/SERVIDOR.md

Saia e entre de novo na sessão (ou reinicie) para o seu usuário usar o docker sem sudo.
Depois de conferir que tudo funciona, desligue os serviços no PC antigo:
  systemctl --user disable --now tasker-tunnel tasker-quick tasker-web tasker-powersync tasker-db
EOF
