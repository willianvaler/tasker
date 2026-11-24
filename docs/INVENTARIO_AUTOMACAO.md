# Inventário para o motor de automações (AU0, ESCOPO_V14)

Levantado em 24/11/2026, na `main` em `ac9a404`, para responder os pontos "(a confirmar em AU0)" do
ESCOPO_V14 antes do AU1. Decisões do dono em D332 (`DECISIONS.md`).

## 1. Automações que já existem (D143) e a decisão (a)

O ESCOPO_V14 §0 diz que "nenhum gatilho é configurável pela pessoa". **Não é verdade:** desde a M6
(V3 §2.8, D143) há automações **de projeto**, em `supabase/migrations/20261133000000_automacoes.sql`
e na tela `/automacoes/[id]`. O dono escolheu **absorver** essas automações no motor novo (D332, opção (a)).

| Peça (D143) | Como é hoje |
|---|---|
| Tabela | `automation_rules` (mesmo nome que o V14 pede): `folder_id` (pasta raiz), `page_id` opcional, **1 gatilho e 1 ação** (`trigger`, `action`, `params`), `enabled`, `created_by`, `runs`, `last_run_at` |
| Registro | `automation_log` (`rule_id`, `task_id`, `ok`, `message`) |
| Gatilhos | `task_done`, `task_ready`, `task_assigned`, `page_done` (pelo trigger `task_events_automations` em `task_events`) e `task_overdue` (cron `questlist-automacoes-prazo`, de hora em hora, no máximo 1 vez a cada 20 h por regra e tarefa) |
| Ações | `create_task`, `assign`, `notify`, `add_label`, `move`, `rest_timer` (em `_automation_act`) |
| Execução | **Síncrona**, dentro da transação de quem disparou, com o cargo de quem disparou; encadeamento até 3 (`app.automation_depth`); uma vez por regra e tarefa na operação (`app.automation_seen`); erro vira linha em `automation_log` sem desfazer nada |
| Permissão | Ver: membro do projeto. Criar/editar: `automation.manage` (Dono e Gerente) |
| Limite | 20 regras por projeto |
| Volume | No banco local, 34 regras (dos testes E2E). **Na produção, a contar** (o acesso ao banco do servidor ficou para o dono liberar) |

### O que a absorção pede (proposta para o AU1, a confirmar com o dono)

1. **Escopo da regra:** a regra nova tem `scope` = `pessoal` (dona = `owner_id`, V14-3) ou `projeto`
   (`folder_id` da pasta raiz, como na D143). As de projeto continuam pedindo `automation.manage` e
   aparecem para os membros. O V14-3 ("só pessoais") passa a valer para **o que é novo**: gatilhos de
   horário, webhook e dispositivo são só de regra pessoal; regra de projeto fica com os gatilhos de
   tarefa da D143 e as ações que não saem do app.
2. **Quem executa a regra de projeto:** hoje é quem disparou. Proposta: passa a ser **quem criou a
   regra** (como no V14 §1.4), com `can()` checado na hora da ação; se a pessoa saiu do projeto ou
   perdeu o cargo, a ação falha e aparece no histórico.
3. **Síncrono → fila:** as ações passam a rodar pelo executor (segundos depois, não na mesma
   transação). O `move` e o `add_label` deixam de aparecer "na hora" para quem concluiu. Encadeamento e
   "uma vez por regra e tarefa" viram a profundidade 3 e a idempotência `(rule_id, event_id)` do V14.
4. **Migração dos dados:** cada linha de `automation_rules` vira uma regra `projeto` com
   `definition = {v:1, gatilho, passos:[ação]}`; `automation_log` vira `automation_runs` (os últimos
   30 dias, pela retenção do V14). Nomes de gatilho e ação ganham os ids do registro
   (`task_done` → `tarefa.concluida`, `notify` → `notificar` etc.). `page_done`, `task_ready`,
   `task_assigned`, `assign`, `move` e `rest_timer` entram no catálogo do V14 (não estavam nele).
5. **XP (V14-4):** hoje a tarefa criada por automação dá XP ao ser concluída, como qualquer outra.
   Com o V14-4, passa a não dar (marca `created_by_rule`). Vale também para as de projeto migradas.
6. **Tela:** `/automacoes/[id]` (do projeto) e a nova Configurações → Automações usam o mesmo
   editor (AU7), filtrado pelo escopo.

## 2. Eventos que existem hoje e onde nascem

| Gatilho do V14 | Existe? | Onde nasce |
|---|---|---|
| `tarefa.criada` | Sim | `task_events.kind = 'created'` (trigger nas tarefas, migração `20261114000000_eventos_tarefa.sql`) |
| `tarefa.concluida` | Sim | `task_events.kind = 'completed'` |
| `tarefa.atrasada` | Parcial | Hoje só por varredura de hora em hora (`run_overdue_automations`, junta todas as tarefas da pasta: **não usa marca d'água**). O V14 pede marca d'água + `dedupe_key` |
| `tarefa.vencendo` | Não | Novo (a varredura de lembretes `send_task_reminders`, cron por minuto, é a referência de janela por horário) |
| `sequencia.em_risco` | Não como evento | A sequência é calculada no `game_state`; não há aviso de "em risco". Fica para depois, quando houver evento |
| `nivel.subiu` | Sim, no retorno | `_grant_event` devolve `level_up` (migração `20261156000000_modo_jogo.sql`); não grava evento: precisa emitir ali |
| `boss.derrotado` | Sim | `bosses.defeated_at` e o `boss_defeated` do retorno de `_grant_event` |
| `marco.atingido` | Sim | `milestones.done_at` passa a ter valor (E6, D315) |
| `horario`, `intervalo` | Não | Novos (agendador, §4) |
| `webhook`, `manual` | Não | Novos |
| Ficou pronta, atribuída, lista concluída | Sim | `task_events` `ready`/`assigned` e a conta de "lista concluída" da D143 (entram no catálogo pela absorção) |

`task_events.kind` aceita: `created`, `restored`, `renamed`, `assigned`, `unassigned`, `started`,
`stopped`, `ready`, `blocked`, `completed`, `reopened`, `forced`, `dependency_added`,
`dependency_removed`, `moved`, `deleted`. **Só existe para tarefas de projeto e pasta** (`root_id`); é o
ponto natural para o `automation_emit` dos gatilhos de tarefa.

**Importação em massa:** não há sinal `questlist.bulk`. Importar (Habitica, Todoist, plano de estudos)
passa por `create_from_template` e pelo `create_tasks_batch`, os mesmos caminhos do uso normal. O AU2
precisa ligar `set_config('questlist.bulk', '1', true)` nesses caminhos quando vierem da importação
(parâmetro novo no RPC) e o `automation_emit` sai na primeira linha com ele.

## 3. Push a partir do servidor

**Existe.** Toda linha em `notifications` dispara `notifications_send_push` (trigger, `pg_net` →
Edge Function `push`, migração `20261016000000_fase6_push.sql`), se a pessoa tem aparelho registrado.
Já há o `kind = 'automation'` nas notificações (D143). Para o canal "só no app" da ação `notificar`,
o trigger precisa de uma exceção (por exemplo `payload.push = false`).

## 4. Agendador

**`pg_cron` 1.6.4** instalado, com 17 jobs (lembretes por minuto, `refresh_cycles` a cada 15 min,
automações de prazo de hora em hora, retenções de madrugada). **`pg_net` 0.20.4** também. O
varredor de 1 minuto do V14 §6.1 vira um job `pg_cron` que chama o executor por `pg_net` (mesmo
desenho do `email-retry`, D320).

## 5. Horário silencioso

**Não existe** (nem preferência, nem coluna). A ação `notificar` segue sem ele, como o V14 §5 prevê
("se existir"). Fica anotado como item possível do V15.

## 6. Segredos cifrados

**`supabase_vault` 0.3.1** instalado (e `pgsodium` disponível). `connector_secrets` (SL1) e os
segredos de webhook (AU8) usam o Vault: a tabela guarda o id do segredo, e só funções `security
definer` leem `vault.decrypted_secrets`.

## 7. IDs livres

`AU*` e `SL*` não aparecem no `STATUS.md` nem no `PENDENTES.md`: os prefixos do V14 ficam como estão.
A próxima decisão é a **D332**.

## 8. Pendências deste inventário

- **Contagem das automações na produção:** quantas regras D143 estão ativas e de que tipos (a consulta
  ao banco do servidor precisa da permissão do dono). Muda só o cuidado da migração, não o desenho.
- **Itens 1 a 6 da §1 (absorção):** proposta, a confirmar com o dono antes do AU1.
