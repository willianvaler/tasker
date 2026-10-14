# Operações

Como o Questlist roda nesta máquina e como guardar e recuperar os dados.

## O que está rodando

| Serviço (systemd de usuário) | O que é |
|---|---|
| `tasker-db` | Supabase local (`npx supabase start`, containers no Podman). Postgres em `127.0.0.1:54322` |
| `tasker-powersync` | PowerSync Open Edition (container `tasker-powersync`, porta 8095). Lê a réplica lógica do Postgres (publicação `powersync`) e guarda os buckets no banco `powersync_storage` do mesmo servidor |
| `tasker-web` | `scripts/serve.mjs` na porta 8787: a web publicada (`dist-remote/`) e os repasses `/supabase` e `/powersync` |
| `tasker-tunnel` | Túnel da Cloudflare para `tasker.wavdev.org` (token em `~/.config/cloudflared/tasker.token`) |
| `tasker-quick` | Túnel provisório `*.trycloudflare.com` (`npm run endereco`) |

`systemctl --user status tasker-db tasker-powersync tasker-web tasker-tunnel tasker-quick`. O linger está ligado: sobem no boot, sem login.

## Backup

O que importa é o banco `postgres` (dados e contas). O `powersync_storage` é derivado e se refaz sozinho.

```bash
podman exec supabase_db_task_tracking pg_dump -U postgres -Fc -d postgres > backup-$(date +%F).dump
```

Guarde fora da máquina. Rotina sugerida: diário, mantendo 14.

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

## Mudou o banco?

1. Migração nova em `supabase/migrations/` e `npx supabase migration up` (não `db:reset`, que apaga as contas).
2. Tabela nova sincronizável: `alter publication powersync add table ...` na migração, consulta em `powersync/sync-config.yaml`, tabela em `src/lib/sync/schema.ts` e colunas graváveis no `WRITABLE` de `src/lib/sync/connector.ts`.
3. `systemctl --user restart tasker-powersync` (relê o `sync-config.yaml`) e `npm run deploy`.
