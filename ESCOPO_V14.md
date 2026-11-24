# ESCOPO V14 — Motor de automações e conector Smart Life (Tuya)

> Instruções para o Claude Code. Leia `CLAUDE.md`, `AGENTS.md` e os escopos anteriores antes de começar. Em conflito, **este escopo vence** os anteriores (regra do `CLAUDE.md`).

> **Pedido do dono (24/11/2026):** "montar um motor de automação (gatilho, condição, ação) e ir de Smart Life para ter integração com mais tipos de aparelhos; ligar o ar-condicionado pelo app". O controle em uso é o Smart Controle Universal Positivo (infravermelho por Wi-Fi). Inspirações de função: apps de automação do Android (Automate Android Pro, Bixby Routines) e o Home Assistant. **Nada de código foi copiado**; só o comportamento (função), como nos escopos V11 e V12. Qualquer biblioteca nova passa pela checagem de licença e entra no `NOTICE.md`.

**Convenção (padrão):** decisão tomada sem o dono. Todas voltam na tabela do §12 para ele confirmar ou trocar.

**Pacote V14–V16:** este escopo é a base. O V15 reúne os demais itens (contexto do celular, câmeras, casa, saúde, estudo, captura, integrações). O V16 traz o editor avançado e os Processos (BPM leve) e **reaproveita o motor deste escopo**. Por isso o §6 exige um *registro de tipos de passo* que o V16 vai usar.

---

## 0. O que o Questlist já tem (e o que falta)

| Tema | Hoje | Falta |
|---|---|---|
| Gatilhos de banco | Existem para permissão entre projetos (D307), data de início (D308), marco (D315), lixeira de imagens (D324) e ligação do material (D327) | Nenhum gatilho é configurável pela pessoa |
| Chamada de função externa | `pg_net` + Edge Function `send-email` (D320) | Fila de eventos, executor, tentativas e limites |
| Notificações | No app e push para reservas (D311, D313, D319) | Confirmar em AU0 se o push parte do servidor |
| Fluxo | Grafo de dependências entre tarefas, só leitura no celular (D114, D116) | Não é executável e **não muda** neste escopo |
| Jogo | XP, dano, ouro e itens são calculados só pelo servidor (V8) | Automação não pode tocar nesses valores (§1) |
| Webhooks e API pública | Não existem; estão no backlog C | Webhook de entrada e de saída (§7) |
| Dispositivos | Nada | Conector Tuya (§8) |
| Restrições | V11 §9: o app **não roda código de terceiros** e "o banco é a fonte da verdade". D318: campo calculado não entra em consulta nem em automação | Seguidas à risca (§1) |

---

## 1. Princípios e limites (valem para tudo neste escopo)

1. **Banco é a fonte da verdade.** As regras vivem no banco, e a execução é **no servidor**. O aparelho só edita e consulta, e funciona offline como nos outros módulos (a regra editada offline sobe na fila).
2. **Sem código da pessoa.** Condições e textos usam uma linguagem **pequena e fechada**, no mesmo estilo de `lib/query/` (OB7) e `lib/formula/` (V12 §8). Nada de JavaScript, SQL ou `eval`. Isso cumpre o V11 §9.
3. **Automação nunca grava XP, ouro, dano, nível, sequência ou itens.** Esses valores são regra do servidor, só por funções `security definer` (V8). Nenhuma ação do §5 chama essas funções.
4. **Mesmo poder da dona da regra.** A regra só age no que a dona pode (`can()`, nunca comparação de cargo). A ação roda "como" a dona e fica marcada no registro com origem `automacao`.
5. **Sem laço e sem enxurrada.** Profundidade máxima, taxa por regra e por pessoa, cooldown, desligamento automático depois de falhas seguidas e um botão **Pausar todas** (§6.5).
6. **Tudo o que sai do sistema é limitado, assinado e auditado.** Isso vale para webhook e para comando de dispositivo.
7. **Segredo nunca volta para o aparelho.** Chaves da Tuya, tokens e segredos de webhook ficam cifrados no servidor. O cliente só vê "conectado" ou "não conectado".

---

## 2. Modelo de uma automação

Uma **regra** tem:

- **Nome** (até 80 caracteres), **ativa** (sim ou não) e **dona**.
- **1 gatilho** (§3).
- **Condições** (§4): zero ou mais, em árvore com E, OU e NÃO.
- **Ações** (§5): de 1 a 20 passos em sequência. Os passos podem ter blocos **SE / SENÃO** e **ESPERAR**.
- **Limites** (§6.4): cooldown e "não executar se atrasar mais que X minutos".

A definição fica em `automation_rules.definition` (jsonb, com campo `v` de versão do formato). **A validação é feita no banco** por trigger `BEFORE INSERT/UPDATE`, que chama a função `automation_validate`, e não só no cliente. Isso importa porque o sync (PowerSync) grava direto na tabela.

### 2.1 Variáveis e textos com `{{ }}`

- Espaços: `evento.*` (dados do gatilho), `usuario.*` (nome, nível e sequência, só leitura), `agora`, `hook.*` (corpo do webhook de entrada), `var.*` (definidas por um passo) e `dispositivo.*`.
- Sintaxe: `{{evento.titulo}}`. Filtros permitidos, e só estes: `|data`, `|hora`, `|corta:N` e `|padrao:"texto"`.
- Os **nomes canônicos são em pt-BR**, com apelidos em inglês e espanhol resolvidos por `tr()` (mesmo padrão do `lib/formula/`). Os testes cobrem os três idiomas.
- Variável que não existe vira texto vazio e **registra aviso** na execução. Não derruba o passo.
- Corpo de webhook é montado como **objeto JSON**: os valores têm `{{ }}`, e o escape é automático. Não se concatena texto cru (evita injeção).
- Limite de 2.000 caracteres por texto depois de expandido.

### 2.2 Tabelas (todas com RLS e pgTAP, revogando `insert/update` de `anon` e `authenticated` e concedendo só as colunas do cliente)

| Tabela | Conteúdo | Cliente escreve | Sync |
|---|---|---|---|
| `automation_rules` | Regra (§2). Colunas do servidor: `trigger_type`, `next_run_at`, `consecutive_failures`, `disabled_reason` | `name`, `enabled`, `definition` | Sim, só da dona |
| `automation_events` | Fila de eventos (outbox) | Nada | Não (sem grant ao cliente) |
| `automation_runs` | Uma execução por (regra, evento): status, passos, tempos, erros | Nada | **Não**; lido por RPC online |
| `automation_hooks` | Webhook de entrada: `token_hash`, último uso | Nada (RPC) | Não |
| `connectors` | Conta ligada (tipo `tuya`), status, último sucesso | Nada (RPC) | Só `status` |
| `connector_secrets` | Segredos cifrados (Vault ou pgsodium) | **Nada, nem leitura** | Não |
| `devices` | Dispositivos descobertos: nome, categoria, capacidades, último estado | `name`, `hidden`, `sensitive` | Sim |
| `device_commands` | Fila de comandos para a nuvem ou para a ponte | Nada | Não |
| `bridges` | Ponte doméstica: `token_hash`, `last_seen_at` | Nada (RPC) | Não |

Cada tabela sincronizável entra na publicação `powersync`, no `sync-config.yaml`, no `lib/sync/schema.ts` e, quando tiver coluna editável, na lista `WRITABLE` do `connector.ts` (regra do `CLAUDE.md`).

---

## 3. Gatilhos

Cada gatilho tem um *id estável*, o payload que oferece em `evento.*` e a origem. **O catálogo é um registro** (§6.3): módulos novos registram seus eventos sem mexer no motor.

| Gatilho | Quando dispara | Variáveis principais | Origem |
|---|---|---|---|
| `tarefa.criada` | Tarefa nova (fora de importação em massa) | id, título, lista, projeto, etiquetas, vencimento | Trigger de banco |
| `tarefa.concluida` | Tarefa concluída | idem, mais `concluida_em` | Trigger de banco |
| `tarefa.atrasada` | O vencimento passou e a tarefa está aberta | idem, mais `atraso_min` | Varredura por marca d'água (§6.2) |
| `tarefa.vencendo` | Faltam N minutos para o vencimento (N de 5 a 1.440) | idem, mais `faltam_min` | Varredura por marca d'água |
| `sequencia.em_risco` | A sequência corre risco de quebrar (se o módulo existir) | dias, hora limite | Evento do jogo (somente leitura) |
| `nivel.subiu` | Subiu de nível (se o módulo existir) | nível novo | Evento do jogo (somente leitura) |
| `boss.derrotado` | Boss derrotado (se o módulo existir) | nome do boss | Evento do jogo (somente leitura) |
| `marco.atingido` | Marco do projeto concluído (D315) | projeto, marco | Trigger de banco |
| `horario` | Hora do dia e dias da semana, no fuso IANA da pessoa | `agora` | Agendador (§6.2) |
| `intervalo` | A cada N horas (N de 1 a 24) | `agora` | Agendador |
| `webhook` | Chamada ao URL de entrada (§7.2) | `hook.*` | Rota pública |
| `manual` | Botão **Executar agora** e atalho | — | App |

**Regras do catálogo:**

- Eventos de módulos que ainda não existem entram **quando o módulo existir** (V6 treino, V9 gasto, V13 sessão de estudo). O inventário AU0 confirma o que existe hoje.
- Eventos do jogo são **de leitura**. O motor só *consome* o evento. Ele nunca influencia o cálculo (§1.3).
- Importação em massa (Todoist, Habitica, CSV, plano de estudos do V13) **não emite eventos**. O trigger olha o parâmetro `questlist.bulk` (§6.2).
- Gatilhos de estado de dispositivo, geofence, Wi-Fi e bateria ficam no V15 (CT1 a CT3).

---

## 4. Condições

- Árvore com **E, OU e NÃO**, com no máximo 3 níveis e 10 comparações por regra.
- Operadores: `=`, `≠`, `<`, `≤`, `>`, `≥`, `contém`, `começa com`, `está em (lista)`, `está vazio`.
- Campos: qualquer variável do §2.1.
- Condições prontas, sem precisar escrever expressão: **janela de horário** (das HH:MM às HH:MM, atravessando a meia-noite), **dias da semana**, **projeto é**, **lista é**, **etiqueta contém**, **nível ≥ N**.
- Funções permitidas (lista fechada e pura, sem E/S): `hoje()`, `agora()`, `dias_ate(data)`, `tamanho(x)`, `contem(x, y)`, `minimo`, `maximo`, `arredonda`. O parser reaproveita `lib/formula/` (V12 §8), com os mesmos nomes nos três idiomas.
- **Campo calculado do V12 não entra** em condição nem em ação (D318). Só valores guardados.
- Avaliação com orçamento de 1.000 nós e sem efeito colateral. Erro de tipo vira "condição falsa" **mais um aviso** no registro. Nunca interrompe a execução.

---

## 5. Ações

Cada ação é um *tipo de passo* no registro (§6.3), com parâmetros validados no banco.

| Ação | Parâmetros | Limites e efeitos |
|---|---|---|
| `notificar` | título (80), corpo (240), canal (app, push ou os dois) | Até 10 por hora por regra. Respeita o horário silencioso da pessoa, se existir (a confirmar em AU0) |
| `criar_tarefa` | título, destino (lista ou projeto), vencimento (data ou `+N dias`), etiquetas, `evitar_duplicar` | Até 20 por execução. Marca `origem = 'automacao'` e `created_by_rule`. **Não dá XP nem ouro** (V14-4) |
| `atualizar_tarefa` | tarefa do gatilho ou por id; adicionar ou remover etiqueta, mover de lista, definir vencimento | **Não conclui, não apaga e não reabre** tarefa (V14-5) |
| `enviar_webhook` | URL, método, cabeçalhos, corpo (§7.1) | §7.1 |
| `comandar_dispositivo` | dispositivo, comando e parâmetros (§8.5) | §8.5 |
| `esperar` | de 1 minuto a 7 dias | Persistente: o estado fica no banco e sobrevive a reinício |
| `executar_regra` | outra regra da mesma dona | Profundidade máxima 3 e sem ciclo (§6.4) |
| `definir_variavel` | nome, valor (texto ou expressão) | Vale só para a execução; até 20 variáveis |
| `se / senão` | condição (§4) e dois blocos de passos | Aninhamento até 3 |
| `parar` | motivo opcional | Encerra a execução com sucesso |
| `alternar_modo_jogo` | Desligado, Leve ou Completo (V8) | Só se o V8 existir; é preferência, não recompensa |

---

## 6. Execução

### 6.1 Fluxo

```
trigger de banco ─▶ automation_emit() ─▶ automation_events (outbox)
varredura / agendador ─────────────────▶        │
                                                ▼
                       executor (Edge Function `automation-run`)
                       reivindica com FOR UPDATE SKIP LOCKED
                                                │
        avalia regras que casam ─▶ automation_runs ─▶ passos (registro de tipos)
```

- O executor é uma **Edge Function** chamada por `pg_net` na inserção do evento (precedente D320) mais um **varredor a cada minuto** para tentativas, esperas e agendamentos. O agendador a usar (`pg_cron` ou outro) é confirmado em AU0, porque o V5 não define onde rodam jobs.
- A função de função (§6.3) é **pura**: dado o estado e o passo, devolve o novo estado. Facilita testar e reaproveitar no V16.
- **Idempotência:** `unique (rule_id, event_id)` em `automation_runs`. Cada passo com efeito externo leva uma chave `(run_id, indice_do_passo)` repassada ao comando ou webhook. Eventos são entregues *pelo menos uma vez*. Ações são *no máximo uma vez* por chave.
- **Tentativas:** erro de rede ou 5xx tenta de novo depois de 1 min, 5 min e 30 min (máximo 3). Erro permanente (4xx, validação, sem permissão) não tenta de novo.
- **Falha:** a execução fica `falhou`, a regra soma `consecutive_failures` e **desliga sozinha com 10 falhas seguidas** (`disabled_reason = 'falhas'`), avisando a dona uma vez.

### 6.2 Emissão, agendamento e desempenho

- `automation_emit(user_id, tipo, payload)` é `security definer` com `search_path = ''`. Ela **sai na primeira linha sem gravar nada** se a pessoa não tem regra ativa daquele tipo (índice parcial em `(owner_id, trigger_type) where enabled`) ou se `current_setting('questlist.bulk', true) = '1'`. Assim, quem não usa automação **não paga nada**. Meta: sobrecarga menor que 1 ms por evento sem regra, medida e registrada.
- Importações e operações em massa definem `questlist.bulk = '1'` na transação.
- `tarefa.atrasada` e `tarefa.vencendo` **não varrem a tabela de tarefas inteira**. Usam uma marca d'água (`automation_scan_state.last_scan_at`) e consultam só a janela `(last_scan_at, now()]` com junção às regras ativas daquele tipo, apoiada em índice por vencimento. `dedupe_key` (`tarefa_id|vencimento`) impede evento repetido.
- `horario` e `intervalo`: cada regra tem `next_run_at`. O varredor pega `where enabled and next_run_at <= now() ... for update skip locked limit 200` e recalcula o próximo disparo no fuso IANA da dona.
- **Disparo atrasado:** se o servidor ficou fora e o disparo atrasou mais que o limite da regra (padrão **15 min**), o motor **não executa** e registra `perdido`. Ligar o ar às 19h com 3 horas de atraso é pior que não ligar.
- Retenção: `automation_events` 7 dias, `automation_runs` 30 dias. O job de limpeza roda no mesmo varredor.

### 6.3 Registro de tipos (a base do V16)

`lib/automation/registry.ts` (módulo puro, em `lib/`, com `tr()`):

- Cada **gatilho**, **condição** e **ação** declara: `id`, esquema dos parâmetros, `validate`, `execute(contexto, params) → resultado`, rótulos nos três idiomas e se tem **efeito externo** (exige chave de idempotência).
- O executor **só conhece o registro**, nunca os tipos concretos.
- O V16 registra novos passos (tarefa humana, gateway etc.) **sem alterar o executor**.

### 6.4 Limites (valores padrão, ajustáveis só pelo dono do app em configuração do servidor)

| Limite | Padrão |
|---|---|
| Passos por regra | 20 |
| Profundidade de `executar_regra` | 3, e **sem ciclo** (detectado ao salvar e na execução) |
| Execuções por regra por hora | 60 |
| Execuções por pessoa por hora | 600 |
| Tempo ativo por execução (sem contar esperas) | 30 s |
| Tamanho do evento | 8 KB |
| Cooldown da regra | opcional, de 0 a 24 h (padrão 0) |
| Falhas seguidas até desligar | 10 |

Ao estourar o limite, a execução vira `limitada` (não `falhou`) e aparece no histórico.

### 6.5 Controles da pessoa

- **Pausar todas as automações** (interruptor único, vale na hora e inclusive para execuções em espera).
- Cada regra tem **Testar** (*dry-run*: avalia gatilho simulado, condições e textos e valida dispositivos, **sem efeito externo**, e mostra o que faria) e **Executar agora**.
- **Histórico por regra:** últimas 50 execuções, passo a passo, com tempo e erro. O texto de erro é amigável, e o detalhe técnico fica recolhido.

---

## 7. Webhooks

### 7.1 Saída (ação `enviar_webhook`)

- Só **HTTPS**. Métodos GET, POST, PUT, PATCH e DELETE. Cabeçalhos livres, exceto `Host`, `Content-Length` e `X-Questlist-*`.
- **Anti-SSRF:** resolve o DNS, **bloqueia** loopback, rede privada, *link-local*, CGNAT, endereços de metadados de nuvem e os equivalentes IPv6, **conecta no IP já validado** (contra *DNS rebinding*) e **não segue redirecionamento** para destino não validado.
- Tempo máximo 10 s. Resposta lida até 64 KB. O registro guarda só 2 KB.
- Assinatura: `X-Questlist-Signature: t=<timestamp>,v1=<hmac-sha256(secret, t + "." + corpo)>`. O segredo é por regra, cifrado, e é mostrado uma vez na criação (pode ser trocado).
- Segredos em cabeçalhos (por exemplo `Authorization`) ficam cifrados e **nunca voltam ao cliente**.
- **Destinos na rede local não são alcançáveis** daqui (por causa do bloqueio de IP privado). Eles passam pela ponte doméstica (§8.6).
- Serve também para Discord (webhook de canal), Home Assistant exposto e IFTTT, sem conector próprio.

### 7.2 Entrada (gatilho `webhook`)

- URL `https://<domínio>/hooks/<token>`. Token de 32 bytes aleatórios, guardado só como *hash*, mostrado **uma vez**, com opção de trocar. Opcional: exigir a assinatura HMAC no corpo.
- Corpo JSON ou formulário, até 16 KB, com profundidade máxima 4 níveis. Vira `hook.*`.
- Resposta **sempre mínima** (`202` sem eco) e sem diferenciar token inválido de regra desativada (evita sondagem).
- Segue as regras de rota pública do `CLAUDE.md`: passa pelo `serve.mjs`, é limitada pelo `scripts/rate-limit.mjs` (padrão 30 por minuto por token e 120 por minuto por IP), e a Edge Function entra na lista `FUNCTIONS` do `scripts/supabase-gate.mjs`.
- Isto **não é** a "API aberta" do V11 §9: é um URL por regra, só aciona aquela regra e não lê dados.

---

## 8. Conector Smart Life (Tuya)

> **Contexto:** o Smart Controle Universal Positivo é um controle infravermelho por Wi-Fi que funciona com o app Positivo Casa Inteligente. Há relatos de que ele também funciona no Smart Life e no app Tuya, **o que ainda não está confirmado**. Também existe uma integração de Home Assistant específica da Positivo, o que sugere que a conta e a nuvem da Positivo podem ser separadas da Tuya. Por isso a primeira tarefa é um teste, não código (SL0).

### 8.1 SL0 — Spike e portão de decisão (pré-requisito de SL1 a SL5)

Entrega: um documento `docs/SPIKE_SMARTLIFE.md` com os resultados abaixo. **Sem esse documento aprovado pelo dono, SL1 não começa.**

1. **O controle aparece no Smart Life?** Refazer o pareamento do Positivo no Smart Life (reset e adicionar). Registrar se funciona. Se **não** funcionar, listar as saídas e pedir decisão: (a) integração da Positivo via ponte, (b) trocar por um controle IR Tuya genérico.
2. **Chaves da Tuya:** criar o projeto na plataforma de desenvolvedores da Tuya, ligar a conta do Smart Life e **registrar o data center correto** e o que foi preciso fazer.
3. **Comando real:** enviar por API (Explorer) *ligar*, *desligar*, *temperatura* e *modo* ao ar-condicionado e medir o tempo de resposta.
4. **Cota e custo:** registrar a duração do período de teste, a regra de extensão e a mensagem de erro de assinatura vencida. Há relatos públicos de teste gratuito curto e de planos pagos caros. Medir quantas chamadas por dia um uso normal consome.
5. **Termos de uso:** conferir se o uso pessoal por API é permitido e registrar o trecho.
6. **Estado do IR:** documentar o que a API devolve do estado do ar (se o estado é lido ou só o último comando enviado).
7. **Fixtures:** gravar respostas reais (sem segredos) em `lib/devices/tuya/__fixtures__/` para os testes (sem rede no CI).
8. **Protocolo local (para a ponte):** avaliar as opções (protocolo local da Tuya, ou a API do Home Assistant) quanto a licença, manutenção e se atendem controles IR. Escolher uma e justificar.

### 8.2 Conexão (SL1)

- **Chaves próprias:** cada pessoa cria o projeto na Tuya e informa *Access ID*, *Access Secret*, o **data center** e liga a conta do Smart Life. O Questlist **não opera uma conta Tuya central** (V14-1). Motivo: cota e custo por conta, termos e região.
- Os segredos vão para `connector_secrets` (cifrados) por RPC `connector_connect()`. O cliente recebe só `status` (`conectado`, `erro`, `assinatura_vencida`, `desconectado`) e `last_ok_at`.
- A validação faz uma chamada de teste. Falha mostra a causa em português claro.
- **`assinatura_vencida`:** faixa fixa na tela com os passos para estender o período, e as automações que usam dispositivo ficam **pausadas** (não falhando em loop).
- Dados de dispositivo (por exemplo se alguém está em casa) são dados pessoais: entram na **exportação** e na **exclusão de conta**, com aviso de privacidade antes de conectar (LGPD).
- **Ajuda em 3 idiomas** com o passo a passo ilustrado.

### 8.3 Descoberta e modelo de dispositivo (SL2)

- Lista os dispositivos e os subdispositivos infravermelhos do hub. Guarda `external_id`, nome, categoria, capacidades e estado.
- As capacidades são normalizadas em um modelo próprio, independente da Tuya: `ligar`, `temperatura {min,max,passo}`, `modo[]`, `ventilador[]`, `brilho`, `cor`. A tradução fica em `lib/devices/tuya/` (módulo puro, testado com as fixtures).
- Categorias aceitas no V14: **tomada ou interruptor, lâmpada, ar-condicionado IR, TV IR (ligar e volume)**. Outras categorias aparecem como "sem suporte" (padrão) mas há um **modo avançado** para comando por código de instrução, validado contra as funções que o próprio dispositivo declara.
- O nome, o ocultar e o marcador **sensível** são editáveis pela pessoa.

### 8.4 Estado

- **Dispositivos IR são de mão única:** a nuvem aceita o comando, mas o aparelho de ar não informa se ligou. O app mostra **"estado presumido: último comando às HH:MM"**, nunca "ligado" como fato. O botão manual não esconde isso.
- Dispositivos com estado real (tomada, lâmpada) usam leitura sob demanda com cache de 60 s e atualização de fundo no máximo a cada 15 min, **só** para o que está numa regra ativa ou aberto na tela. Isso protege a cota da Tuya.
- Mensagens em tempo real da Tuya ficam para depois (V15 CT1+).

### 8.5 Comandos (SL3)

- Ação `comandar_dispositivo`: `ligar`, `desligar`, `alternar`, `definir` (temperatura, modo, ventilador, brilho, cor).
- Validação **no servidor** contra as capacidades guardadas (temperatura dentro de [min, max], modo permitido). Valor inválido falha **antes** de chamar a Tuya.
- **Sensível:** dispositivo marcado como sensível só aceita **desligar** vindo de automação. *Ligar* exige a pessoa no app (V14-6). Fechaduras e portões **não são aceitos** neste escopo.
- **Limite de taxa:** 6 comandos por minuto por dispositivo e 2.000 por dia por conexão (ajustável), com fila e *backoff*.
- **Validade do comando:** todo comando de automação tem TTL (padrão **10 min** desde o gatilho). Comando que não foi executado a tempo é descartado e registrado. Nada de ligar o ar horas depois.
- Tudo grava em `device_commands` (com a chave de idempotência) e aparece no histórico.

### 8.6 Ponte doméstica (SL4)

Para controlar sem depender da nuvem da Tuya (cujo teste gratuito é curto) e para alcançar a rede local (Home Assistant, outros aparelhos).

- **Processo leve** no servidor caseiro. Faz **conexão de saída** (sem abrir porta no roteador), por canal Realtime ou consulta periódica de `device_commands` da dona.
- Autentica com um **token de ponte** (`bridges.token_hash`), com permissão mínima: só ler os comandos da dona e gravar o resultado, via RPC. Token revogável e trocável.
- **Heartbeat** a cada 30 s (`last_seen_at`). A tela mostra *Ponte online ou offline*.
- Executa o comando pelo protocolo escolhido em SL0. Devolve o resultado e o estado.
- **Comando com TTL vencido não é executado** (§8.5).
- Quando a ponte está online, a regra pode escolher **Nuvem** ou **Ponte** por dispositivo, com **fallback automático** de uma para a outra dentro do TTL.
- Se a ponte aproveitar código de terceiros, vale a regra do projeto: licença conferida e `NOTICE.md` atualizado. Código copyleft não entra (mesma linha do `HABITICA.md`).

### 8.7 Tela Dispositivos (SL5)

- Em Configurações → Conectores → Smart Life: conexão, ponte e lista de dispositivos.
- Cartão por dispositivo: nome, categoria, selo *online/offline*, selo *estado presumido*, botões manuais (ligar, desligar, temperatura) e **último comando**. Os botões manuais passam pelos mesmos limites.
- Atalhos de dispositivo na tela inicial ficam no V15 (widgets).

---

## 9. Interface das automações

- **Configurações → Automações:** lista com nome, gatilho em uma frase, interruptor, última execução e selo de erro.
- **Editor em formulário:** *Quando…* (gatilho), *Se…* (condições), *Então…* (ações), no celular e na web. O editor visual de grafo vem no **V16** (Processos), e as regras do V14 continuam sendo regras simples.
- **Modelos internos** (curados pelo app, não da Comunidade):
  1. Ao concluir uma tarefa, desligar uma tomada.
  2. Todo dia às 22:30, desligar o ar-condicionado.
  3. Todo dia às 19:00, se há tarefas atrasadas, notificar.
  4. Ao subir de nível, enviar mensagem a um webhook (Discord).
  5. Webhook de entrada cria uma tarefa.
- **Uso:** mostra "uso desta hora: N de 600" e os limites no editor.
- **Ajuda em 3 idiomas:** o que é gatilho, condição e ação, limites, como testar e como ler o histórico.
- **Acessibilidade:** o editor funciona por teclado e leitor de tela.

---

## 10. Fora deste escopo

- **Geofence, Wi-Fi, bateria, NFC/QR e estado de dispositivo como gatilho:** V15 (CT1 a CT6).
- **Câmeras:** V15 (CM).
- **Fluxos visuais, tarefas humanas, gateways e funções:** V16.
- **Automações de projeto ou de time:** só pessoais agora (V14-3), por causa de permissão, de quem "executa" e do custo.
- **Compartilhar automações na Comunidade (V10):** conteúdo executável de terceiros (V14-10).
- **Código da pessoa (JavaScript, SQL, scripts):** fora, por decisão do V11 §9.
- **API pública geral e servidor MCP:** V15 (IG2, IG3).
- **IA no texto:** fora (V12-8).
- **Fechaduras, portões e alarmes:** fora (§8.5).
- **Conectores além de Tuya e webhook** (Discord interativo, Home Assistant nativo etc.): V15.
- **Mensagens em tempo real da Tuya (assinatura de eventos):** depois.

---

## 11. Ordem sugerida

| Id | Tarefa | Depende de |
|---|---|---|
| AU0 | Inventário (eventos que existem, push de servidor, agendador, horário silencioso, IDs em uso) e `docs/INVENTARIO_AUTOMACAO.md` | — |
| SL0 | Spike Smart Life/Tuya e portão de decisão (§8.1) | — |
| AU1 | Tabelas `automation_*` com RLS, pgTAP, validação por trigger e sync | AU0 |
| AU2 | Registro de tipos (§6.3) + `automation_emit` + outbox + executor mínimo (ação `notificar`) | AU1 |
| AU3 | Catálogo de gatilhos e condições (§3, §4), variáveis e `{{ }}` (§2.1) | AU2 |
| AU4 | Demais ações: criar e atualizar tarefa, definir variável, se/senão, parar (§5) | AU3 |
| AU5 | Agendador, varredura por marca d'água, `esperar` persistente, tentativas e perdidos (§6.2) | AU4 |
| AU6 | Limites, anti-laço, desligamento por falha, **Pausar todas**, dry-run e histórico (§6.4, §6.5) | AU5 |
| AU7 | Editor em formulário, lista, modelos e Ajuda (§9) | AU6 |
| AU8 | Webhook de saída com anti-SSRF e assinatura (§7.1) | AU6 |
| AU9 | Webhook de entrada com token, limite e rota pública (§7.2) | AU6 |
| SL1 | Conexão Tuya: segredos cifrados, validação, status e faixa de assinatura vencida (§8.2) | SL0, AU1 |
| SL2 | Descoberta e modelo de dispositivo, tradução com fixtures (§8.3) | SL1 |
| SL3 | Comandos na nuvem e ação `comandar_dispositivo`, com sensível, TTL e taxa (§8.5) | SL2, AU6 |
| SL4 | Ponte doméstica (§8.6) | SL3 |
| SL5 | Tela Dispositivos e estado presumido (§8.4, §8.7) | SL3 |

**Prefixos de ID** (`AU`, `SL`) devem ser conferidos contra `STATUS.md` e `PENDENTES.md` em AU0. Se colidirem, renomear aqui antes de começar.

**Requisitos de teste (valem para todas as tarefas):**

- Ajuda em três idiomas, i18n (`parity.test.ts`) e testes E2E. Nomes de variáveis e funções testados nos três idiomas.
- Registro em `STATUS`, `PENDENTES`, `FEITOS` e `DECISIONS`, um commit por tarefa com o ID no fim. **Atualizar a frase de escopos do `CLAUDE.md` para "até ESCOPO_V16".**
- Antes de concluir: `lint` e `typecheck` (regra do `AGENTS.md`). Pacotes novos só com `npx expo install`. Preferir módulos do Expo.
- Tabela nova: RLS e pgTAP com **dono, estranho e leitor**, privilégio por coluna, e **prova de que `connector_secrets`, `automation_events` e `device_commands` não são legíveis pelo cliente**. Funções `security definer` com `search_path = ''`.
- **Motor:** testes de unidade do registro e de cada passo (função pura); idempotência (mesmo evento duas vezes gera uma execução); laço (A chama B chama A é recusado ao salvar e na execução); limites de taxa; atraso acima do limite vira `perdido`; falha do executor no meio de uma execução **retoma sem duplicar efeito**; dois executores concorrentes não processam o mesmo evento.
- **Anti-SSRF:** casos para `127.0.0.1`, `10.x`, `172.16.x`, `192.168.x`, `169.254.169.254`, `100.64.x`, IPv6 (`::1`, `fc00::/7`, `fe80::/10`, endereço IPv4 mapeado), redirecionamento para IP interno e *DNS rebinding*.
- **Webhook de entrada:** limite de pedidos, resposta mínima, token trocado deixa de valer na hora.
- **Dispositivos:** as traduções da Tuya testadas contra as fixtures, sem rede no CI; comando fora da faixa recusado antes da chamada; TTL vencido descartado; dispositivo sensível só desliga.
- **Desempenho (medir e registrar em `STATUS`):** sobrecarga de `automation_emit` sem regra menor que 1 ms; importação de 5.000 tarefas gera **0 eventos**; executor com no mínimo 20 execuções por segundo sustentadas no servidor de destino; varredura de atrasadas em menos de 50 ms com 100 mil tarefas.

---

## 12. Decisões do dono

Todas com resposta **(padrão)** até o dono responder. O Claude Code registra a resposta em `DECISIONS.md`.

| # | Pergunta | Padrão |
|---|---|---|
| V14-1 | Quem fornece a conta da Tuya? | **Cada pessoa**, com as chaves próprias. O app não opera conta Tuya central |
| V14-2 | Ponte doméstica entra neste escopo? | **Sim**, depois da nuvem (SL4). A tecnologia é decidida em SL0 |
| V14-3 | Automações de projeto ou de time? | **Só pessoais** agora |
| V14-4 | Tarefa criada por automação dá XP e ouro? | **Não**, para impedir farm de XP |
| V14-5 | Automação pode concluir, reabrir ou apagar tarefas? | **Não** |
| V14-6 | Dispositivo marcado como sensível | Automação **só desliga**; ligar exige a pessoa |
| V14-7 | Webhook de entrada e saída entram? | **Sim**, e **não** contam como "API aberta" do V11 §9. API pública e MCP ficam no V15 |
| V14-8 | Limites | 20 passos, 60 execuções por hora por regra, 600 por pessoa, profundidade 3, retenção de 30 dias, desligar com 10 falhas seguidas, perdido após 15 min de atraso, TTL de comando de 10 min |
| V14-9 | Linguagem de condições | Reaproveita o parser de `lib/formula/`. **Campo calculado continua fora** (D318) |
| V14-10 | Compartilhar automações na Comunidade (V10) | **Fora** |
| V14-11 | Editor | **Formulário** no V14. Editor visual vem no V16 |
| V14-12 | Nome do módulo | **Automações** |
| V14-13 | Fallback se o Positivo não funcionar no Smart Life | Decidir em SL0: ponte com a integração da Positivo ou **controle IR Tuya genérico** |
| V14-14 | Estado do ar-condicionado | **Presumido**, sempre rotulado como último comando |
| V14-15 | Quem paga a cota da Tuya | **A própria pessoa**, com aviso de assinatura vencida |

---

## 13. Critérios de aceite por tarefa

**AU0**
- Existe `docs/INVENTARIO_AUTOMACAO.md` listando: eventos disponíveis e onde nascem; se existe push a partir do servidor; qual agendador existe; se há horário silencioso; IDs `AU*`/`SL*` livres.
- Cada item incerto deste escopo marcado "(a confirmar em AU0)" tem resposta no documento. Se algum contradiz o escopo, o Claude Code **para e pergunta ao dono**.

**SL0**
- O documento do §8.1 existe, com os 8 pontos respondidos e as fixtures gravadas sem segredo.
- Há um comando real (ligar e desligar o ar) executado e registrado. Há uma recomendação escrita (nuvem, ponte, fallback) e **a aprovação do dono** consta em `DECISIONS.md`.

**AU1**
- Todas as tabelas do §2.2 existem com RLS. O cliente **não consegue** ler `connector_secrets`, `automation_events` e `device_commands`. Testes pgTAP passam em `npm run db:test`.
- Salvar `definition` inválida (passo desconhecido, mais de 20 passos, ciclo de `executar_regra`) é recusado **pelo banco**, mesmo com escrita direta pelo sync.

**AU2**
- Um evento de teste cria uma execução e dispara `notificar`. O mesmo evento entregue duas vezes **não** repete a notificação.
- O executor só conhece o registro: adicionar um tipo de passo de teste **não** exige mudar o executor (teste automatizado).
- Pessoa sem regra ativa: nenhum evento é gravado.

**AU3**
- Todos os gatilhos do §3 que dependem de módulos existentes disparam em teste E2E. `{{evento.titulo|corta:40}}` funciona e variável inexistente vira vazio com aviso.
- Condições E/OU/NÃO com até 3 níveis avaliam corretamente, inclusive janela de horário que cruza a meia-noite.

**AU4**
- Criar, atualizar tarefa, se/senão, definir variável e parar funcionam. Tarefa criada por regra **não gera XP nem ouro** (teste).
- Nenhuma ação consegue concluir, reabrir ou apagar tarefa (teste de tentativa por definição manipulada).

**AU5**
- Regra `horario` às 19:00 no fuso da pessoa dispara em 19:00 ±1 min. Servidor parado por mais de 15 min: o disparo vira `perdido`.
- `esperar` de 1 hora sobrevive a reinício do executor e retoma no tempo. `tarefa.atrasada` dispara uma vez por tarefa.

**AU6**
- Estourar 60 execuções por hora em uma regra marca `limitada` sem erro. 10 falhas seguidas desligam a regra e avisam uma vez.
- **Pausar todas** interrompe também as execuções em espera. *Testar* mostra o que faria **sem nenhum efeito externo** (verificado por *mock* de rede).

**AU7**
- A pessoa cria, edita, ativa e testa uma regra só pelo formulário, no celular e na web, com teclado e leitor de tela. Os 5 modelos funcionam. Ajuda em pt, en e es.

**AU8**
- Todos os casos de bloqueio do §11 (anti-SSRF) falham com mensagem clara. Assinatura HMAC verificável com um exemplo de código na Ajuda. Segredo de cabeçalho nunca aparece em resposta de API nem no histórico.

**AU9**
- URL com token válido cria uma execução e responde 202 sem corpo útil. Token trocado deixa de valer na hora. Excesso de pedidos recebe 429 pelo `rate-limit.mjs`. Corpo acima de 16 KB é recusado.

**SL1**
- Conexão válida mostra `conectado`. Chave errada mostra erro claro. O cliente **nunca** recebe o segredo (teste pgTAP e E2E). `assinatura_vencida` mostra a faixa e pausa as regras com dispositivo.
- Exportar e excluir a conta incluem os dados de dispositivo.

**SL2**
- Os dispositivos de teste (tomada, lâmpada, controle IR com ar-condicionado) aparecem com as capacidades normalizadas. A tradução passa nos testes com as fixtures, sem rede.

**SL3**
- Uma regra liga o ar, define 23 °C no modo frio e desliga, ponta a ponta, em condições reais. Temperatura fora da faixa é recusada **antes** da chamada.
- Comando com TTL vencido é descartado. Dispositivo sensível recusa *ligar* vindo de regra. A taxa de 6 por minuto é respeitada sob carga.

**SL4**
- Com a ponte online, o comando executa localmente e devolve o resultado. Ponte offline: *fallback* para a nuvem dentro do TTL, ou descarte registrado.
- Token de ponte revogado deixa de funcionar na hora. Nenhuma porta é aberta no roteador.

**SL5**
- A tela mostra online/offline, estado presumido com horário e último comando. Botões manuais respeitam os mesmos limites e aparecem no histórico.
