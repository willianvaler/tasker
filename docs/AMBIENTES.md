# Ambientes: produção, alpha e lab

| Ambiente | Onde | Endereço | Versão | Dados |
|---|---|---|---|---|
| **Produção** | Servidor, `~/projects/task_tracking` | https://tasker.wavdev.org | Uma tag `vAAAA.MM.DD` | Os de verdade |
| **Alpha** (pré-produção) | Servidor, `~/projects/task_tracking-alpha` | https://alpha.tasker.wavdev.org | A última `main` (atualiza sozinho a cada 5 min) | Cópia da produção, quando você pedir |
| **Desenvolvimento** | PC, `~/projects/task_tracking` | http://localhost:8082 | O que está sendo feito | Banco local de testes |
| **Lab** (experimental) | PC, `~/projects/task_tracking-lab` (branch `lab`) | http://localhost:8083 | O que você quiser testar | Banco próprio, mínimo |

Cada pasta diz qual ambiente ela é em dois arquivos fora do git: `.ambiente.local` (nome, prefixo dos serviços, portas da web e do sync, endereço) e `supabase/.env.local` (projeto e portas do Supabase, segredos). Sem eles, valem os da produção. Os scripts carregam isso por `scripts/ambiente.sh` (D178).

| | Produção | Alpha | Lab |
|---|---|---|---|
| Supabase (API / banco) | 54321 / 54322 | 54421 / 54422 | 55321 / 55322 |
| PowerSync | 8095 | 8096 | (sem) |
| Web | 8081 | 8091 | 8083 |
| Serviços | `tasker-*` | `tasker-alpha-*` | (à mão) |

## O caminho de uma versão

1. Desenvolve no PC e faz `git push` na `main`.
2. Em até 5 minutos, o alpha atualiza sozinho (`tasker-alpha-atualizar.timer` → `scripts/servidor/atualizar.sh`): baixa a `main`, instala dependências se mudaram, aplica as migrações no banco do alpha e publica. Se o Telegram estiver configurado no servidor, avisa.
3. Testa em https://alpha.tasker.wavdev.org.
4. Aprovado? No PC: `npm run promover`. Ele mostra o que muda (commits e migrações), pede confirmação, cria a tag do dia no commit que está **no alpha** e atualiza a produção.

Voltar a produção para uma versão anterior: no servidor, `cd ~/projects/task_tracking && bash scripts/servidor/atualizar.sh vAAAA.MM.DD`. Cuidado: uma migração que já rodou não é desfeita.

## Alpha

- Criar (uma vez, no servidor): `bash ~/projects/task_tracking/scripts/servidor/criar-alpha.sh` (com cópia da produção) ou `--vazio`.
- Rota no painel da Cloudflare (uma vez): Zero Trust → Networks → Tunnels → túnel do tasker → Public Hostnames → Add: subdomínio `alpha`, domínio `wavdev.org`, tipo HTTP, URL `localhost:8091`.
- Recopiar os dados da produção: `cd ~/projects/task_tracking-alpha && bash scripts/servidor/alpha-copiar-producao.sh`. Apaga os dados do alpha. A produção fica pausada de 10 a 30 segundos (os pedidos esperam e seguem). No alpha, todos entram de novo, com o mesmo e-mail e senha; o alpha nunca manda push.
- Segredos próprios: um login do alpha não vale na produção, e vice-versa.
- Sem Studio, funções e logs, para economizar memória no servidor.
- Logs: `journalctl --user -u tasker-alpha-web` (ou `-db`, `-powersync`, `-atualizar`).

## Lab (PC)

`npm run lab -- criar`, depois `npm run lab -- web`. O lab é uma cópia do projeto no branch `lab`, com banco próprio (sem PowerSync: o app fala direto com o banco). Experimento que deu certo: commit no `lab` e `git merge lab` (ou `cherry-pick`) no principal. Comandos: `subir`, `parar`, `zerar`, `apagar` (veja `scripts/lab.sh`).
