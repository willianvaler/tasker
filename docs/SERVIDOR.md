# Levar o Questlist para um servidor (Linux Mint)

Passo a passo para tirar o app do PC e pôr num servidor com **Linux Mint 22** (base Ubuntu 24.04). São dois scripts:

- `scripts/servidor/empacotar.sh`: roda **no PC atual** e gera um pacote com tudo;
- `scripts/servidor/instalar.sh`: roda **no servidor novo** e instala e configura tudo a partir do pacote.

## O que vai no pacote

| Item | Para quê |
|---|---|
| Projeto inteiro (com `.git`) | O código, mais os segredos que ficam fora do git: `.env.local`, `supabase/.env.local` e `supabase/signing_keys.json` (D175) |
| `downloads/` | O APK publicado (`/downloads/questlist.apk`) |
| Volumes do banco e do Storage | Cópia fiel: contas, senhas, tarefas e anexos |
| `banco.dump` | `pg_dump` de segurança (se a cópia dos volumes der problema) |
| Token e config do túnel | O mesmo `tasker.wavdev.org`, sem mexer no painel da Cloudflare |
| `~/.config/questlist/` | A chave que assina o APK (sem ela, o celular não aceita atualizar o app) |

Fica de fora o que se refaz sozinho: `node_modules`, `android/`, `dist*`.

**O pacote tem senhas, tokens e os dados de todo mundo.** Use `--cifrar` (pede uma senha) e leve por pendrive, cabo ou `scp`, nunca por nuvem aberta. Depois de instalar, apague as cópias.

## 1. Antes (no servidor novo)

1. Instale o Linux Mint 22 e crie o seu usuário (com sudo). Ligue o computador na rede por cabo, se der.
2. Anote o IP dele (`hostname -I`).
3. Opcional, mas recomendado: no seu PC, gere uma chave SSH (`ssh-keygen -t ed25519`, se ainda não tiver).

## 2. Ensaio (no PC atual, quando quiser)

```bash
bash scripts/servidor/empacotar.sh --ensaio
```

Para o banco por cerca de 1 minuto, gera o pacote em `~` e religa tudo. Serve para conferir o tamanho e o tempo (no teste de 16/10: 1,6 GB sem compressão, uns 3 minutos). Apague o pacote do ensaio depois.

## 3. Migração de verdade

No PC atual:

```bash
bash scripts/servidor/empacotar.sh --cifrar
```

Isso **para tudo no PC** (banco, app e túnel) e não religa: se os dois computadores ficarem ligados com o mesmo token, a Cloudflare divide as visitas entre dois bancos diferentes. O script mostra como religar o PC se a instalação nova der errado.

Copie para o servidor os dois arquivos que ele gerou em `~`:

```bash
scp ~/questlist-servidor-*.tar.gpg ~/instalar-questlist.sh seu-usuario@IP-DO-SERVIDOR:
```

No servidor (pelo terminal dele ou por `ssh seu-usuario@IP-DO-SERVIDOR`):

```bash
bash instalar-questlist.sh questlist-servidor-AAAA-MM-DD-HHMM.tar.gpg --chave-ssh "COLE AQUI o conteúdo de ~/.ssh/id_ed25519.pub do seu PC"
```

Ele pede a senha do sudo e a do pacote, e leva uns 15 a 30 minutos (a maior parte é baixar as imagens do Supabase). No fim, confere app, Supabase, PowerSync e o endereço público.

Depois:

1. Saia e entre de novo no servidor (ou reinicie) para o grupo `docker` valer.
2. Teste: entre no app pelo celular e pelo navegador, marque uma tarefa, abra um anexo.
3. Funcionou? No PC antigo, desligue de vez: `systemctl --user disable --now tasker-tunnel tasker-quick tasker-web tasker-powersync tasker-db`.
4. Apague o pacote do PC e do servidor.

## O que o instalador configura

- **Atualizações:** as de segurança instalam sozinhas (`unattended-upgrades`).
- **SSH:** login como root desligado e `fail2ban` contra tentativas de senha. Com `--chave-ssh`, só a sua chave entra (login por senha desligado). Por padrão, aceita SSH só da rede de casa; `--ssh-de-fora` libera de qualquer rede (só faça isso com chave).
- **Firewall (ufw):** recusa tudo o que chega, menos SSH e a porta 80, ambos só da rede de casa. O túnel não precisa de porta aberta (ele sai do servidor para a Cloudflare).
- **Docker:** as portas dos containers ficam só em `127.0.0.1`. Sem isso, o Docker passaria por fora do ufw e o Postgres apareceria na rede.
- **nginx:** `http://IP-DO-SERVIDOR` abre o app na rede de casa (repassa para o `serve.mjs`). O acesso de fora continua pelo túnel em `https://tasker.wavdev.org`. Para não instalar: `--sem-nginx`.
- **Serviços** (systemd do usuário, sobem no boot sem login): `tasker-db`, `tasker-powersync`, `tasker-web` e `tasker-tunnel`, como no PC.

## Diferenças em relação ao PC

- Container: **Docker** no servidor (no PC era o Podman). Os scripts aceitam os dois (`CONTAINER=docker`).
- Node **22** (o mesmo do CI); no PC era o 26.
- Para gerar o APK no servidor, falta o Android SDK e o JDK. Continue gerando no PC (`npm run apk`) e copie `downloads/` para o servidor, ou peça a instalação do SDK depois.
- O aviso no Telegram (`questlist-telegram`) não vai junto.

## Se algo falhar

- Logs: `journalctl --user -u tasker-web` (ou `tasker-db`, `tasker-powersync`, `tasker-tunnel`).
- O instalador pode rodar de novo: ele não apaga os volumes que já restaurou. O projeto existente é guardado em `task_tracking.antes-<data>`.
- Banco vazio ou com contagem diferente: restaure o `banco.dump` (docs/OPERACOES.md, "Restauração").
- Para voltar ao PC antigo: `npx supabase start && systemctl --user start tasker-powersync tasker-web tasker-tunnel` (e pare o túnel no servidor: `systemctl --user stop tasker-tunnel`).
