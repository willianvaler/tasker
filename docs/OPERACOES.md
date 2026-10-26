# Operações

Como o Questlist roda nesta máquina e como guardar e recuperar os dados.

## O que está rodando

| Serviço (systemd de usuário) | O que é |
|---|---|
| `tasker-db` | Supabase local (`npx supabase start`, containers no Podman). Postgres em `127.0.0.1:54322` |
| `tasker-powersync` | PowerSync Open Edition (container `tasker-powersync`, porta 8095). Lê a réplica lógica do Postgres (publicação `powersync`) e guarda os buckets no banco `powersync_storage` do mesmo servidor |
| `tasker-web` | `scripts/serve.mjs` na porta 8081: a web publicada (`dist-remote/`) e os repasses `/supabase` e `/powersync` |
| `tasker-tunnel` | Túnel da Cloudflare para `tasker.wavdev.org` (token em `~/.config/cloudflared/tasker.token`) |
| `tasker-quick` | Túnel provisório `*.trycloudflare.com` (`npm run endereco`) |

`systemctl --user status tasker-db tasker-powersync tasker-web tasker-tunnel tasker-quick`. O linger está ligado: sobem no boot, sem login.

## Segurança (D175)

O túnel só expõe a porta 8081 (`tasker-web`). O resto (Postgres 54322, Studio 54323, Mailpit 54324, PowerSync 8095) não sai da máquina: o `ufw` recusa por padrão o que chega da rede (`DEFAULT_INPUT_POLICY="DROP"`; só o KDE Connect tem porta aberta). Não abra essas portas no firewall nem crie rotas para elas no painel da Cloudflare.

**Portão do `/supabase`** (`scripts/supabase-gate.mjs`, usado pelo `serve.mjs`): só passam auth, rest, realtime e storage (nunca `/auth/v1/admin`, `/pg`, `/functions`...); `apikey` só a publicável; `Authorization: Bearer` só a publicável ou um login ES256 assinado por uma chave do JWKS do Auth local, com papel `authenticated`/`anon` e dentro da validade. Recusas aparecem no log: `journalctl --user -u tasker-web | grep Recusado`.

**CSP e CORS (D212).** As páginas saem com `Content-Security-Policy-Report-Only` (a política está no `serve.mjs`): só o próprio endereço, WASM e workers do sync, estilos embutidos. As violações chegam em `/csp-report` e vão para o log (`journalctl --user -u tasker-web | grep CSP`). Testada para valer com o build de produção: nenhuma violação. Depois de alguns dias sem nada no log, ligue o bloqueio com `CSP_ENFORCE=1` no serviço (`systemctl --user edit tasker-web`, `Environment=CSP_ENFORCE=1`, e reinicie). O CORS do `/supabase` e do `/powersync` só libera o próprio endereço: outra origem fica sem os cabeçalhos `Access-Control-*`, o preflight dela recebe 403 e o websocket dela é derrubado; o app do celular não manda `Origin` e passa normalmente.

**Segredos próprios desta máquina.** A chave secreta, o segredo de JWT e a chave de assinatura padrão do CLI são públicos (estão na documentação do Supabase). Por isso esta máquina usa os seus, fora do git:

- `supabase/.env.local`: `SUPABASE_AUTH_JWT_SECRET`, `SUPABASE_AUTH_SECRET_KEY` (`sb_secret_...`) e `SUPABASE_AUTH_SIGNING_KEYS_PATH=./signing_keys.json`;
- `supabase/signing_keys.json`: chave ES256 dos logins (`npx supabase gen signing-key --algorithm ES256`, guardada como lista `[{...}]`, permissão 600).

Para valer (ou depois de trocar): `npx supabase stop && npx supabase start` (os dados ficam nos volumes), atualize a `storage_key` (seção Anexos), `systemctl --user restart tasker-powersync tasker-web` e confira com `npx supabase status` que a chave secreta não é mais a padrão. Ninguém precisa entrar de novo: as sessões ficam no banco, e na próxima renovação automática (em até 1 h) o app recebe um token assinado pela chave nova; até lá, os tokens antigos são recusados (o PowerSync registra `PSYNC_S2101` no log e o app fica sem sincronizar). Para não esperar, saia e entre de novo. A chave publicável continua a padrão: ela é pública de propósito e vai dentro do app.

**O PC.** O túnel sai daqui para a Cloudflare (nada entra pelo roteador). Mesmo assim: mantenha o sistema atualizado, deixe o ufw ligado, use senha forte e 2FA no RustDesk e na conta da Cloudflare, e faça backups (seção Backup) fora da máquina. Se o app crescer, o caminho é tirá-lo deste PC: um servidor dedicado ou uma VM, ou o Supabase hospedado (`PUBLICACAO.md`).

**HTTPS** é configurado no painel do **domínio** `wavdev.org` na Cloudflare, não no túnel: SSL/TLS → Edge Certificates → "Always Use HTTPS" ligado e "Minimum TLS Version" 1.2. O endereço de origem do túnel continua `http://localhost:8081`: o trecho Cloudflare → PC já vai cifrado dentro do túnel, e o `serve.mjs` não tem certificado (com `https://` na origem, o túnel não conecta).

## Levar para outro servidor

Passo a passo em `docs/SERVIDOR.md` (`scripts/servidor/empacotar.sh` e `instalar.sh`, D177).

## Backup

O que importa é o banco `postgres` (dados e contas). O `powersync_storage` é derivado e se refaz sozinho.

```bash
podman exec supabase_db_task_tracking pg_dump -U postgres -Fc -d postgres > backup-$(date +%F).dump
```

Guarde fora da máquina. Rotina: diário, mantendo 14. No servidor, `bash scripts/servidor/backup.sh --instalar` liga o timer `tasker-backup.timer` (03:30, em `~/backups/<ambiente>/`, D213); a política de privacidade conta com ele (dados excluídos saem das cópias em até 30 dias). Copiar para fora do servidor continua sendo à mão.

## Restauração

```bash
systemctl --user stop tasker-powersync
podman exec -i supabase_db_task_tracking pg_restore -U postgres -d postgres --clean --if-exists < backup-AAAA-MM-DD.dump
# O PowerSync refaz os buckets do zero a partir do banco restaurado
podman exec supabase_db_task_tracking psql -U postgres -c "drop database if exists powersync_storage"
systemctl --user start tasker-powersync
```

Os aparelhos recebem o estado restaurado no próximo sync. O que estava na fila deles e ainda não tinha subido é enviado depois e passa pelas mesmas regras (ação repetida não roda duas vezes, `run_once`).

**Cuidado:** `npm run db:reset` recria o banco a partir das migrações e apaga todas as contas, inclusive as de quem testa pelo endereço remoto.

## Lixeira e retenção

- Apagar pasta, página, tarefa, responsável ou comentário guarda uma cópia em `deleted_items`; tudo o que saiu na mesma exclusão volta junto por `restore_deleted` (tela Lixeira, no Perfil ou na paleta). Fica **30 dias** (cron `questlist-trash`, 03:23).
- Exclusão de conta não passa pela lixeira e apaga o que a pessoa já tinha na lixeira.
- Chaves de idempotência da fila (`applied_ops`): 30 dias (cron `questlist-applied-ops`, 03:17).
- Tombstones do sync: o PowerSync cuida (o aparelho é avisado de que a linha saiu). Compactação do armazenamento: `podman exec tasker-powersync node service/lib/entry.js compact -c /config/config.yaml`, quando o `powersync_storage` crescer.

## Anexos (Storage)

Os arquivos ficam no bucket privado `attachments` do Storage local (container `supabase_storage_task_tracking`, ligado em `supabase/config.toml`). O backup do banco **não** leva os arquivos: copie também o volume do Storage (`podman volume ls | grep storage`).

Arquivo de anexo removido, ou de tarefa cuja lixeira venceu, entra em `public.storage_garbage`; o cron `questlist-storage-garbage` (a cada 10 min) apaga pela API do Storage, se `app_config` tiver o endereço e a chave de serviço. **A chave não vai para o repositório**: configure direto no banco, uma vez por máquina (e de novo se as chaves do Supabase local mudarem):

```bash
KEY=$(npx supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')
printf "insert into public.app_config values ('storage_url', 'http://supabase_kong_task_tracking:8000/storage/v1'), ('storage_key', '%s') on conflict (key) do update set value = excluded.value;\n" "$KEY" \
  | podman exec -i supabase_db_task_tracking psql -U postgres -d postgres
```

Sem isso, a fila só cresce (nada se perde; apaga quando configurar). Em produção, `storage_url` é `https://<projeto>.supabase.co/storage/v1`.

## Fotos dos exercícios (AC3.10, D274)

As duas fotos de cada exercício da free-exercise-db (873 do catálogo) ficam no bucket público `exercise-photos` (480 px em `<id>/0.jpg` e `1.jpg`, miniatura de 160 px em `mini/<id>/…`, uns 60 MB). Quem sobe é o `node scripts/exercicios/fotos.mjs`, com a chave de serviço do `supabase status` da pasta: baixa do GitHub uma vez (cache em `data/exercicios/cache/fotos/`), reduz com o `jimp-compact` e envia. O `atualizar.sh` roda com `--se-faltar` a cada atualização: compara o `versao.txt` do bucket e só sobe se a lista ou os tamanhos mudaram (a primeira vez leva alguns minutos). Falhar não derruba a atualização; o app só não mostra as fotos. A lista de quem tem foto que o app usa é o `src/lib/gym/exercise-photos.json` (versionado; regere com `--so-lista` se o catálogo mudar). As fotos não entram no backup do banco: dá para subir de novo a qualquer hora.

## Leitura de fotos (Gemini, V9)

**Foto da nota** e **Foto de uma lista** chamam a Edge Function `read-photo`, que manda a foto ao Gemini (API do Google AI Studio). O portão do `/supabase` só deixa passar essa função, e só com login de verdade. A chave **não vai para o repositório**: fica em `supabase/functions/.env` (no `.gitignore`), que o `supabase start` carrega:

```bash
# no servidor, uma vez (e de novo se trocar a chave)
cat > supabase/functions/.env <<'FIM'
GEMINI_API_KEY=<chave do aistudio.google.com>
# opcional: outro modelo (padrão gemini-3.8-flash; o flash-lite tem mais cota grátis)
# GEMINI_MODEL=gemini-3.5-flash-lite
FIM
npx supabase stop && npx supabase start   # os dados ficam; o app fica fora por ~1 min
```

Sem chave, a função responde "a leitura de fotos ainda não foi ligada no servidor". Neste PC de desenvolvimento o arquivo tem `PHOTO_READER=fake` (leitura de exemplo, usada pelos testes E2E). Cada leitura fica em `public.photo_reads` (quem, quando, deu certo ou não); o limite é `public.photo_read_limit()` (100 por mês, provisório). Plano gratuito do Gemini: poucas leituras por minuto e por dia (veja em aistudio.google.com/rate-limit); quando estoura, o app diz "ocupado, tente em um minuto". Para trocar por um plano pago, basta ativar o faturamento na mesma chave. A foto da nota fica no bucket privado `receipts` (o backup do Storage acima vale para ele também).

## APK do Android (fora da loja)

`npm run apk` compila o último commit (numa cópia à parte, `~/.cache/questlist-apk-src`, para nada editado no meio entrar no build) e publica `downloads/questlist.apk` + `downloads/apk.json`, que o `scripts/serve.mjs` entrega em `https://questlist.wavdev.org/downloads/`. O Perfil (na web e no Android) mostra o botão de baixar ou o aviso de versão nova. Não precisa de deploy nem de reiniciar nada: o servidor lê a pasta a cada pedido.

- **Ferramentas** (já instaladas nesta máquina, fora do sistema): JDK 17 em `~/.local/share/android-build/jdk-17*` e Android SDK em `~/Android/Sdk` (plataforma 36, build-tools 36, NDK e CMake que o Gradle baixou). Leva uns 10 min do zero; depois, menos.
- **Chave de assinatura:** `~/.config/questlist/release.keystore`, com a senha em `~/.config/questlist/keystore.env` (criadas no primeiro build, **fora do repositório**). Faça backup das duas: com outra chave, o Android não instala por cima e quem tem o app precisa desinstalar (perde o que não sincronizou).
- **Endereços:** o APK fala com `https://questlist.wavdev.org/supabase` e `/powersync` (mude com `QUESTLIST_URL=... npm run apk`).
- **Arquitetura:** `arm64-v8a` e `armeabi-v7a` (celulares de entrada que rodam em 32 bits, como Motorolas com chip Unisoc). Para um emulador x86_64: `APK_ARCHS=armeabi-v7a,arm64-v8a,x86_64 npm run apk`.
- **Versão:** o código da versão é o número de commits; o app instalado compara com o `apk.json` para avisar que há versão nova.
- Push (notificação vinda do servidor) não funciona no APK: precisa do Firebase, que depende da conta do dono. Os avisos do timer (locais) funcionam.

## Mudou o banco?

1. Migração nova em `supabase/migrations/` e `npx supabase migration up` (não `db:reset`, que apaga as contas).
2. Tabela nova sincronizável: `alter publication powersync add table ...` na migração, consulta em `powersync/sync-config.yaml`, tabela em `src/lib/sync/schema.ts` e colunas graváveis no `WRITABLE` de `src/lib/sync/connector.ts`.
3. `systemctl --user restart tasker-powersync` (relê o `sync-config.yaml`) e `npm run deploy`.
