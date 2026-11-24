# ESCOPO V15 — Contexto do celular, casa, saúde, estudo, captura e integrações

> Instruções para o Claude Code. Leia `CLAUDE.md`, `AGENTS.md`, o `ESCOPO_V14.md` e os escopos anteriores antes de começar. Em conflito, **este escopo vence** os anteriores. O V14 vence este escopo apenas no que for do motor de automações.

> **Pedido do dono (24/11/2026):** reunir "todos os outros itens" do brainstorm sobre centralizar a vida no app: automações por contexto (Wi-Fi, localização e afins, no estilo das rotinas do Bixby e de apps de automação do Android), câmeras, casa e rotina, saúde, estudo, captura rápida e integrações. O dono quer usar o Questlist no lugar do Notion e do Habitica e controlar o que mais puder por ele.

As referências são as **funções** de outros apps (Automate Android Pro, Bixby Routines, Donetick, Anki, Obsidian Spaced Repetition, Home Assistant). **Nenhum código ou arte foi copiado.** Licenças novas entram no `NOTICE.md`.

**Convenção (padrão):** decisão tomada sem o dono. Todas voltam na tabela do §12.

**Dependência geral:** quase todos os gatilhos e ações daqui usam o **motor do V14** (registro de tipos §6.3, webhooks §7, dispositivos §8). Onde um item precisa de módulo que ainda não existe (V6 treino, V7 saúde, V8 jogo, V9 gastos, V10 comunidade, V12, V13), ele é marcado **"se existir"** e espera esse módulo.

---

## 0. O que o Questlist já tem ou já previu (para não duplicar)

| Tema | Situação | Consequência neste escopo |
|---|---|---|
| Web Clipper e Compartilhar do celular | OB15 **feito** (D305) | CP1 só **estende** (nova tarefa), não refaz |
| Google Agenda | Feed `.ics` existe. Mão dupla ficou para depois (V12 §1) | Fora daqui |
| Lembretes por local | Backlog C | Entra em CT1 |
| Webhooks e API pública | Backlog C. V11 §9 coloca "API aberta" fora | IG2 pede **decisão do dono** (V15-14) |
| IA no texto | V12-8: **fora**, por privacidade | AI1 só entra opcional e no aparelho (V15-16) |
| Repetição espaçada | V13 §10 deixou fora | ET1 entra aqui |
| Health Connect, Apple Saúde, Strava | V7 | SA1 usa a importação do V7 se existir |
| Receitas e dieta | V10 (bloco Bem-estar) | SA5 depende disso |
| Gastos e nota fiscal por foto | V9 | CS3 e CS5 reaproveitam |
| Bot do Discord | Nada no app | IG1 |
| Widgets de tela inicial | Não vi em nenhum escopo | CP3 (a confirmar em CT0) |

---

## 1. Princípios (valem para todo o V15)

1. **A execução continua no servidor** (V14 §1). O aparelho só **gera eventos** e **exibe**.
2. **Dados sensíveis são privados por padrão:** saúde, localização, câmeras e dispositivos. Ficam com RLS só da dona, entram na **exportação** e na **exclusão de conta**, **nunca** vão para a Comunidade (V10), para grafos ou páginas publicadas (V11) nem para amigos, salvo ação explícita da pessoa.
3. **Variáveis sensíveis ficam bloqueadas em webhooks, API e MCP.** `saude.*`, `local.*`, `camera.*` e `dispositivo.*` **não** aparecem em `{{ }}` de webhook de saída, na API nem no MCP, a menos que a pessoa libere **campo a campo** (V15-4). O bloqueio é feito no servidor.
4. **Sem rastreamento de posição.** O aparelho registra áreas (geofence) e só envia "entrou" ou "saiu" do **local X**, nunca trilha nem coordenadas do momento.
5. **A decisão de casamento de gatilho de contexto é feita no aparelho** (que rede, que local, que bateria). O servidor recebe só o identificador do local ou da rede cadastrada (apelido), e não o nome da rede.
6. **Android primeiro** para contexto (limites do iOS no §9). iOS entra onde a plataforma permite.
7. **Fora da regra do jogo:** nenhuma funcionalidade daqui concede XP, ouro, dano ou itens por conta própria. Onde o estudo conta para o jogo (ET2), é por **regra do servidor** (V8).
8. **Sem aviso médico oculto:** saúde mostra aviso fixo de que o app não é dispositivo médico.

---

## 2. Contexto do celular (gatilhos do V14)

Todos registram **tipos de gatilho** no registro do V14 (§6.3). O evento nasce no aparelho, sobe pela fila offline com o horário do aparelho e passa pelo `automation_emit`. Evento mais velho que o limite da regra (padrão 15 min) é registrado como **`perdido`** (V14 §6.2) e **não** aciona dispositivo.

### CT0 — Spike de plataforma (pré-requisito de CT1 a CT3)

`docs/SPIKE_CONTEXTO.md`, testado em **aparelho real** (o do dono), cobrindo:

1. Geofence com `expo-location`: permissões em dois passos, latência real, comportamento com o app encerrado, com economia de bateria e com otimização de bateria do fabricante (Samsung).
2. Leitura do **nome da rede Wi-Fi** no Android alvo: que permissão e que configuração do sistema exige, se o módulo do Expo oferece ou se é preciso biblioteca de terceiros (licença e *config plugin*).
3. `expo-battery`: eventos de nível e carregador.
4. `expo-widgets` no SDK 57 para Android (estado, limitações, tamanho).
5. Texto e requisitos da declaração de **localização em segundo plano** da Google Play (política vigente na data do spike).
6. Orçamento de bateria: consumo medido por 24 h com 5 locais e Wi-Fi.

Sem aprovação do dono do documento, CT1 a CT3 e CP3 não começam.

### CT1 — Locais, geofence e lembrete por local

- Tabela `places` (nome, ícone, latitude, longitude, raio de 100 m a 1.000 m), RLS só da dona, sync.
- **Gatilhos:** `local.entrou` e `local.saiu`, com `local.nome` (apelido) e `evento.em`.
- O aparelho registra as áreas com `expo-location` (geofencing + `TaskManager.defineTask` no escopo de topo, como a doc exige). **Máximo de 20 locais ativos** (limite do iOS, igual nos dois sistemas por simplicidade, V15-2). A tela mostra "N de 20".
- **Histerese:** ignora entra/sai do mesmo local em menos de 2 min.
- **Permissão em dois passos:** primeiro "enquanto usa o app", e a de segundo plano só quando a pessoa cria o primeiro local ou lembrete. Uma tela explica o motivo antes do pedido do sistema. Recusa não quebra o app: a função fica desligada com aviso.
- **Limites a explicar na Ajuda:** no Android, com o app encerrado pelo sistema, o evento pode **não chegar**; eventos em segundo plano levam **minutos**; guiar a pessoa a retirar o app da otimização de bateria.
- **Lembrete por local** (backlog C): a tarefa ganha "lembrar ao chegar em [local]". O **aparelho** dispara a notificação **local**, sem ida ao servidor, e funciona offline.
- Requer *development build* (iOS não suporta localização em segundo plano no Expo Go).

### CT2 — Wi-Fi (Android)

- Gatilhos `wifi.conectou` e `wifi.desconectou`. A pessoa cadastra **redes monitoradas** com apelido ("Casa", "Trabalho"). O aparelho casa o nome da rede **localmente** e sobe só o apelido (§1.5).
- Preferir módulo do Expo. Se o `expo-network` não oferecer o nome da rede, avaliar biblioteca de terceiros com licença conferida e justificativa em `DECISIONS.md`.
- iOS: fora (V15-1).
- Debounce de 30 s para quedas curtas de sinal.

### CT3 — Bateria e carregador

- Gatilhos `bateria.baixa` (limite de 5% a 50%), `carregador.conectado` e `carregador.desconectado`, com `expo-battery`.
- Disparo único por cruzamento do limite, sem repetir enquanto estiver abaixo.

### CT4 — Gatilho por link (QR e NFC)

- Cada regra com gatilho `manual` pode gerar um link `https://<domínio>/r/<token>`. Token de 32 bytes, guardado como *hash*, revogável, mostrado uma vez.
- **QR:** a tela mostra e imprime o código. **NFC:** a pessoa grava a mesma URL em uma etiqueta com qualquer app gravador. **O Questlist não precisa de biblioteca NFC**, porque o sistema abre o link e o link abre o app (link universal ou *deep link*). Se o app não estiver instalado, abre a web e pede login.
- Executa **como a pessoa logada**. Regra com `comandar_dispositivo` ou `enviar_webhook` mostra **tela de confirmação** antes (V15-19).
- Rota pública protegida por `scripts/rate-limit.mjs`. Resposta mínima.

### CT5 — Guia de integração com apps de automação

- Artigo de Ajuda (pt, en, es) com receitas de **chamar o Questlist** a partir de apps de automação do celular, usando o webhook de entrada (V14 §7.2) ou o link do CT4.
- Receitas **testadas** em pelo menos dois apps escolhidos pelo dono (padrão: Automate Android Pro e Bixby Routines, **se** oferecerem ação HTTP ou abrir link). O guia diz claramente o que cada app consegue.
- O Questlist **não** implementa controle de sistema do Android (SMS, Não Perturbe, brilho, notificações de outros apps). Isso é deixado a esses apps (§10).

---

## 3. Câmeras

> Privacidade em primeiro lugar. **O Questlist não grava nem armazena vídeo**, e câmera **não** é compartilhada com amigos nem times.

- **CM1 — Câmeras como atalho:** cadastro de câmera (nome, cômodo, app de origem, link ou *deep link*) na tela Dispositivos do V14. O botão abre o app da câmera. Sem vídeo dentro do Questlist. Firme neste escopo.
- **CM2 — Foto instantânea sob demanda:** se a câmera for Tuya e o SL0 mostrar API de *snapshot* dentro da cota, o botão "ver agora" busca **uma imagem**, mostra e **não guarda** (nem em disco nem no servidor). **Depende do resultado do SL0**; sem ele, fica adiado.
- **CM3 — Alerta de movimento como gatilho:** só se SL0/CM2 mostrarem que a Tuya oferece isso sem custo fora da cota. Caso contrário, **fica fora**.
- **Vídeo ao vivo embutido e gravação:** fora (V15-6).

---

## 4. Casa e rotina

- **CS1 — Equipamentos e manutenção.** Tabelas `equipments` (nome, cômodo, marca, modelo, data de compra, vínculo opcional com um `device` do V14) e `maintenance_plans` (equipamento, nome, intervalo em dias ou meses, **último feito**, próxima data). O plano cria a tarefa ("Limpar o filtro do ar"), e **a próxima data conta a partir de quando a pessoa concluiu** (padrão). Confirmar no inventário se a recorrência atual já suporta "N dias depois de concluir". Se não, esta tarefa inclui esse modo.
- **CS2 — Rodízio de tarefas domésticas.** Em lista ou projeto com membros (V10): tarefa recorrente com **responsável rotativo** (por vez ou por semana), contagem de **quem fez quanto** e opção **pular** ou **trocar** com aviso. Referência de função: Donetick (AGPL; **só ideia**, sem copiar código). XP segue as regras normais de tarefa do V8.
- **CS3 — Garantias e documentos.** Equipamento com nota fiscal (anexo ou vínculo com um lançamento do V9) e **fim da garantia** (data ou meses a partir da compra). Alertas 30 e 7 dias antes do fim. Anexos seguem os limites existentes.
- **CS4 — Despensa e compras (se existir lista compartilhada do V10).** Lista especial **Despensa** com item, quantidade e mínimo. O botão **acabou** ou ficar abaixo do mínimo adiciona o item à lista de compras, e marcar **comprado** atualiza o estoque. Compartilhável com o grupo. Sem leitura de código de barras (§10).
- **CS5 — Energia (só se o dispositivo informar potência ou energia).** A confirmação vem do SL2 do V14. Estimativa de kWh do mês e **custo estimado** com a tarifa em R$/kWh que a pessoa informar, e lançamento opcional no V9 (categoria "Energia", rótulo **estimado**). Aparelhos IR (ar-condicionado, TV) **não medem consumo**, e a tela diz isso. Sem dado de energia, esta tarefa **não é feita**.

---

## 5. Saúde (dados sensíveis)

> Dados de saúde são **dados pessoais sensíveis** pela LGPD. O Questlist **não é dispositivo médico**: não interpreta, não recomenda dose nem diagnostica. Aviso fixo em todas as telas do módulo.

### SA0 — Fundação de privacidade (pré-requisito de SA1 a SA5)

- **Consentimento explícito** na primeira vez que a pessoa ativa o módulo, com texto claro do que é guardado, onde e como apagar.
- Tabelas com RLS só da dona, sem visibilidade para amigos, times ou Comunidade, mesmo que a pessoa tenha o V10 ativo.
- Dados entram na **exportação** e na **exclusão de conta**. Variáveis `saude.*` ficam **bloqueadas** em webhook, API e MCP (§1.3).
- Anexos (exames) seguem o limite de espaço da pessoa (V4-4).

### Itens

- **SA1 — Sono:** registro (dormi, acordei) manual ou importado do Health Connect ou Apple Saúde **se o V7 existir**. Meta de horas, média da semana e gráfico simples.
- **SA2 — Água:** copos ou mL, meta diária, toques rápidos e lembretes por horário (via V14).
- **SA3 — Medicamentos:** cadastro com nome livre, horários e dias. O lembrete tem **Tomei, Pular, Adiar** e guarda o histórico. **Sem** bula, interação, dose ou recomendação. Por padrão, o **nome do medicamento fica oculto** na notificação e na tela de bloqueio (V15-7).
- **SA4 — Exames:** data, nome, valor, unidade, faixa de referência **digitada pela pessoa** e anexo (foto ou PDF). Gráfico por exame ao longo do tempo. Sem interpretação.
- **SA5 — Receita, compras e macros (se o V10 existir):** receita como anotação com propriedades (porções, ingredientes com quantidade e unidade). **Adicionar à lista de compras** junta e soma ingredientes de várias receitas quando as unidades são da mesma dimensão (g com kg, mL com L). Unidades caseiras (colher, xícara) ficam como estão. **Macros por porção** vêm da **tabela nutricional da própria pessoa** (cadastro manual ou CSV). Não há base nutricional externa (§10).

---

## 6. Estudo

- **ET1 — Repetição espaçada.**
  - **Cartões** nascem do texto das anotações: uma linha `pergunta ?:: resposta` vira um cartão (referência de função: o plugin de repetição espaçada do Obsidian e o Anki, sem copiar código). Uma tabela `cards` é refeita por trigger a partir do texto, no mesmo estilo da tabela `links` do V11.
  - **Revisões em log append-only** (`card_reviews`: cartão, nota 0–5, horário). O **estado do cartão** (intervalo, facilidade, próxima revisão) é **derivado no banco** a partir do log, para ficar determinístico entre aparelhos (banco é a fonte da verdade).
  - **Algoritmo:** SM-2 modificado (domínio público) como padrão (V15-9). FSRS fica avaliado depois, com licença conferida.
  - **Sessão de revisão** com "Hoje: N cartões", limites diários (novos 20 e revisões 200, ajustáveis) e funcionamento offline.
- **ET2 — Estudo e jogo (se o V8 existir).** Sessão de leitura (V13 ES7) e sessão de revisão (ET1) contam como atividade para sequência e XP por **regra do servidor**, com **teto diário** definido lá e **XP por sessão**, não por cartão (V15-10). Sem duplicar XP quando a sessão já for contada por outra regra.

---

## 7. Captura

- **CP1 — Compartilhar → nova tarefa.** O Compartilhar do celular (OB15) passa a oferecer **Nova tarefa**, além de anotação. O texto ou o título vira o título da tarefa, o link vai no corpo, imagem e PDF viram anexo (limites existentes) e a **lista de destino** é escolhida na hora. Inventário confirma o que OB15 já faz.
- **CP2 — E-mail → tarefa (adiado).** O V5 deixa indefinido o provedor de **saída**, e esta função precisa de um de **entrada**. **Fica adiado** até o provedor existir (V15-11). Requisitos para quando for feito: endereço pessoal com token, só remetentes cadastrados pela pessoa, limite de tamanho (5 KB de texto), assunto vira título, corpo vira notas e limite de pedidos.
- **CP3 — Widgets de tela inicial.** Widgets **Hoje** (próximas 5 tarefas) e **Nova tarefa**, mais botões de **regra manual** (V14) e de **dispositivo** (ligar e desligar). Usa `expo-widgets`, e o resultado do CT0 decide a plataforma. Segundo a documentação do Expo, o código do widget roda em um **ambiente isolado, sem hooks, sem estado do app e sem trabalho assíncrono**, então o app **empurra um instantâneo** dos dados. Exige *development build*. **Dispositivo marcado como sensível nunca aparece no widget** (V15-12).
- **CP4 — Captura rápida do sistema.** Atalho de "Nova tarefa" nas Configurações rápidas ou nos atalhos do app. **Só se existir módulo do Expo para isso.** Não vale adicionar dependência nativa de terceiros só por este atalho. Se não houver, **a tarefa é descartada** e registrada em `DECISIONS.md`. Antes, confirmar se já existe captura por voz e, se existir, não duplicar.

---

## 8. Integrações, API e IA local

### IG1 — Discord

- **Parte A (sem código novo, via V14):** notificações para um canal por **webhook de saída**. Entregar **2 modelos** no V14 §9 (nível e boss derrotado) e uma receita na Ajuda.
- **Parte B (opcional): bot de comandos.** Aplicação do Discord **própria do Questlist** (não reaproveitar nenhum bot pessoal). Só **slash commands**, o que dispensa a permissão privilegiada de leitura de mensagens.
  - `/hoje`, `/tarefa <texto>`, `/boss` e, **se o dono quiser**, `/concluir`.
  - **Vínculo** por código de 6 dígitos gerado no app, válido por 10 min. Desvincular a qualquer momento.
  - **Respostas efêmeras** (só quem pediu vê). Os comandos agem **como a pessoa vinculada**, via `can()`.
  - **Dados sensíveis (§1.3) nunca voltam no Discord.**
  - Token do bot em segredo do servidor, nunca no repositório. Limite de pedidos por pessoa.

### IG2 — API pública com tokens pessoais

- **Tokens pessoais** (guardados como *hash*, mostrados uma vez) com **escopo** `leitura` ou `escrita`, por recurso (tarefas, anotações, listas), revogáveis e com data de validade opcional. **Sem OAuth** e **sem apps de terceiros multiusuário** (V15-14).
- REST em JSON sobre **RPCs e views seguras** (não expor as tabelas diretamente), com OpenAPI gerado e limite de pedidos por token (padrão 60 por minuto).
- Registro de uso por token (último uso e contagem). Escritas ficam marcadas com `origem = 'api'`.
- **Isto contraria a frase "API aberta" do V11 §9 e implementa o backlog C.** Só entra com a confirmação do dono (V15-14).

### IG3 — Servidor MCP

- Programa **local** (processo `stdio`) que chama o IG2 com o token da pessoa. **Nenhuma superfície pública nova**: roda no computador da pessoa.
- Ferramentas: `listar_tarefas`, `criar_tarefa`, `atualizar_tarefa`, `buscar_anotacoes`, `criar_anotacao`, `anexar_a_anotacao`.
- **Por padrão não conclui nem apaga** (V15-15). **Não expõe** saúde, local, câmera nem dispositivos (§1.3).
- Documentar a configuração para clientes que suportam MCP (Claude, LM Studio, Ollama, conforme o suporte de cada um).

### AI1 — IA local opcional (desligada por padrão)

- **Assistente do dia** ("o que priorizar hoje") e **resumo da semana**.
- A **chamada é feita pelo aparelho** a um endpoint compatível com a API de chat que a **própria pessoa configura** (por exemplo LM Studio ou Ollama no PC ou no servidor dela). **Nenhum dado passa pelo servidor do Questlist nem vai a provedor externo.**
- O contexto é montado **no aparelho**, só com dados não sensíveis (§1.3), e o **prompt é visível e editável**. Nada é guardado além do texto gerado, que a pessoa pode salvar como anotação.
- **Limitações a mostrar:** na web, o navegador só chama endpoint **HTTPS**; no celular, endpoint HTTP local exige permitir tráfego em texto claro via *config plugin* em `app.json`, e isso só ocorre quando a pessoa ativa a função.
- **Esta tarefa muda o V12-8** ("IA no texto: fora, por privacidade") para "fora para provedores externos; permitida no endpoint da própria pessoa". Só entra com a confirmação do dono (V15-16).

---

## 9. Plataformas, permissões e loja

| Recurso | Android | iOS | Permissão ou exigência |
|---|---|---|---|
| Geofence (CT1) | Até 100 áreas. Com o app encerrado, o evento **não reinicia** o app. Em segundo plano, o sistema processa em intervalos de minutos | Até 20 regiões. O sistema **reinicia** o app no evento | Localização em segundo plano ("sempre" no iOS). *Development build*. Declaração na Google Play |
| Wi-Fi (CT2) | A validar em CT0 | **Fora** | Provável localização e serviços ligados (validar) |
| Bateria (CT3) | Sim | Sim | Nenhuma |
| Link por QR ou NFC (CT4) | Sim | Sim | Nenhuma (o sistema abre o link) |
| Widgets (CP3) | Conforme doc do SDK 57 (validar em CT0) | Estável a partir do SDK 56 | *Development build* |
| IA local em rede (AI1) | HTTP exige *config plugin* | HTTP exige ajuste de segurança de transporte | Só quando a pessoa ativa |

O Claude Code **confere a documentação versionada do SDK em uso** (`AGENTS.md`) antes de cada item e **registra divergências** em `DECISIONS.md`.

---

## 10. Fora deste escopo

- **Controle do sistema Android** (SMS, ligações, Não Perturbe, brilho, notificações de outros apps): fora. Delegado a apps de automação via CT5.
- **Bluetooth como gatilho:** fora até o dono decidir (V15-20).
- **Vídeo ao vivo embutido, gravação e compartilhamento de câmera.**
- **Fechaduras, portões e alarmes** (V14 §8.5).
- **Banco de bulas, interação de medicamentos, dose, diagnóstico, dieta gerada por IA.**
- **Base nutricional externa** (licença e custo): só a tabela da pessoa.
- **Código de barras na despensa.** Pode reaproveitar a leitura de QR da nota fiscal do V9 numa versão futura.
- **OAuth e apps de terceiros multiusuário** na API.
- **Google Agenda de mão dupla:** V12 §1.
- **E-mail → tarefa:** adiado até haver provedor de entrada (CP2).
- **Fluxos, Processos, editor avançado:** V16.
- **Conector nativo do Home Assistant:** usa webhooks e a ponte do V14.

---

## 11. Ordem sugerida

Prioridade: **1** = alto valor e baixo risco, **2** = bom valor, **3** = depende de decisão ou de módulo.

| Id | Tarefa | Pri. | Depende de |
|---|---|---|---|
| CT0 | Spike de plataforma (§2) | 1 | V14 AU0 |
| CT4 | Gatilho por link (QR e NFC) | 1 | V14 AU9 |
| CT1 | Locais, geofence e lembrete por local | 1 | CT0, V14 AU6 |
| CT3 | Bateria e carregador | 2 | CT0, V14 AU6 |
| CT2 | Wi-Fi (Android) | 2 | CT0, V14 AU6 |
| CT5 | Guia de integração com apps de automação | 2 | CT4, V14 AU9 |
| IG1-A | Discord por webhook (modelos e receita) | 1 | V14 AU7, AU8 |
| CM1 | Câmeras como atalho | 2 | V14 SL5 |
| CS1 | Equipamentos e manutenção | 1 | — |
| CS2 | Rodízio de tarefas domésticas | 2 | V10 |
| CS3 | Garantias e documentos | 2 | CS1 |
| CS4 | Despensa e compras | 3 | V10 |
| CS5 | Energia | 3 | V14 SL2, V9 |
| SA0 | Fundação de privacidade da saúde | 2 | — |
| SA2 | Água | 2 | SA0 |
| SA1 | Sono | 2 | SA0 |
| SA3 | Medicamentos | 2 | SA0 |
| SA4 | Exames | 3 | SA0 |
| SA5 | Receita, compras e macros | 3 | SA0, V10 |
| ET1 | Repetição espaçada | 2 | V11 OB1 |
| ET2 | Estudo e jogo | 3 | ET1, V8, V13 ES7 |
| CP1 | Compartilhar → nova tarefa | 1 | — |
| CP3 | Widgets de tela inicial | 2 | CT0 |
| CP4 | Captura rápida do sistema | 3 | — |
| CP2 | E-mail → tarefa | 3 | provedor de entrada (adiado) |
| IG2 | API pública com tokens pessoais | 2 | V14 AU6 + decisão V15-14 |
| IG3 | Servidor MCP | 2 | IG2 |
| IG1-B | Bot de comandos do Discord | 3 | IG2 |
| CM2 | Foto instantânea | 3 | V14 SL0, SL3 |
| CM3 | Alerta de movimento | 3 | CM2 |
| AI1 | IA local opcional | 3 | decisão V15-16 |

**Conferir colisão dos prefixos** (`CT`, `CM`, `CS`, `SA`, `ET`, `CP`, `IG`, `AI`) contra `STATUS.md` e `PENDENTES.md` antes de começar e renomear aqui se necessário.

**Requisitos de teste (valem para todas as tarefas):**

- Ajuda em três idiomas, i18n (`parity.test.ts`), testes E2E, registro em `STATUS`, `PENDENTES`, `FEITOS` e `DECISIONS`, um commit por tarefa com o ID no fim, `lint` e `typecheck` antes de concluir, e pacotes só por `npx expo install` (regras do `CLAUDE.md` e do `AGENTS.md`).
- Tabela nova: RLS e pgTAP com **dono, estranho e leitor**, privilégio por coluna e publicação no sync quando for da pessoa.
- **Privacidade (obrigatório):** teste que prova que variáveis `saude.*`, `local.*`, `camera.*` e `dispositivo.*` **são recusadas** em webhook de saída, API e MCP sem liberação por campo, e que os dados de saúde **não aparecem** em exportação pública, Comunidade nem páginas publicadas.
- **Contexto:** lógica de histerese, debounce e evento atrasado em testes de unidade (módulo puro). Como geofence e Wi-Fi não rodam no CI, registrar um **roteiro de teste manual** em `docs/TESTES_MANUAIS_V15.md`, executado em aparelho real e anexado ao `STATUS`.
- **Estudo:** o estado do cartão derivado do log dá o mesmo resultado se as revisões chegarem fora de ordem ou de dois aparelhos (teste de propriedade).
- **API e MCP:** token revogado deixa de valer na hora, escopo `leitura` não escreve, limite de pedidos por token (429), e nenhuma tabela é exposta diretamente.
- **Desempenho (medir e registrar):** a tela "Hoje" dos widgets e a lista de cartões do dia respondem em até 300 ms com 100 mil cartões e 10 mil tarefas; consumo de bateria do CT0 dentro do orçamento acordado.

---

## 12. Decisões do dono

Todas com resposta **(padrão)** até o dono responder.

| # | Pergunta | Padrão |
|---|---|---|
| V15-1 | Contexto no iOS? | **Android primeiro.** No iOS só geofence e bateria; Wi-Fi fora |
| V15-2 | Quantos locais ativos? | **20**, igual nos dois sistemas |
| V15-3 | Localização em segundo plano | Pedida só ao criar o primeiro uso. Aceita atraso de minutos e perda de evento com o app encerrado, e a Ajuda explica |
| V15-4 | Dados de saúde, local, câmera e dispositivo em webhook, API e MCP | **Bloqueados**, liberação campo a campo pela pessoa |
| V15-5 | Câmeras | Só **atalho** (CM1) é firme. CM2 e CM3 dependem do SL0 |
| V15-6 | Vídeo ao vivo, gravação e compartilhar câmera | **Fora** |
| V15-7 | Nome do medicamento na notificação | **Oculto** por padrão |
| V15-8 | Macros | Só **tabela da própria pessoa** |
| V15-9 | Algoritmo de repetição espaçada | **SM-2 modificado**. FSRS depois |
| V15-10 | XP de estudo | **Por sessão**, com teto diário definido no servidor |
| V15-11 | E-mail → tarefa | **Adiado** até haver provedor de entrada |
| V15-12 | Widgets | Hoje, Nova tarefa e regras manuais. **Dispositivo sensível nunca** |
| V15-13 | Discord | Webhook de saída (V14) mais **bot opcional** de slash commands, respostas efêmeras e sem dado sensível. `/concluir` só se o dono pedir |
| V15-14 | API pública | **Sim**, com tokens pessoais e sem OAuth. **Contraria o V11 §9 (API aberta): precisa de confirmação** |
| V15-15 | MCP | Local (`stdio`), sem concluir nem apagar, sem dados sensíveis |
| V15-16 | IA local | **Sim**, opcional, **desligada** por padrão, no endpoint da própria pessoa, chamada feita pelo aparelho. **Muda o V12-8: precisa de confirmação** |
| V15-17 | Atalho de captura rápida do sistema | **Só se houver módulo do Expo** |
| V15-18 | Rodízio de tarefas | Contagem justa por semana, com opção de pular e trocar |
| V15-19 | Link por QR ou NFC | **Sempre confirmar** quando a regra tem dispositivo ou webhook |
| V15-20 | Bluetooth como gatilho | **Fora** |
| V15-21 | Prioridade geral | Ordem da coluna "Pri." do §11 |

---

## 13. Critérios de aceite por tarefa

**CT0** — O documento do §2 existe com as 6 respostas, medidas em aparelho real, e a decisão do dono para CT1–CT3 e CP3 consta em `DECISIONS.md`.

**CT1** — Criar um local, sair e voltar gera `local.saiu` e `local.entrou` em até **5 min** em condições normais. Entrar e sair do mesmo local em menos de 2 min gera um só evento. O lembrete por local dispara **offline**. O 21º local é recusado com mensagem clara. Negar a permissão de segundo plano desliga a função sem erro.

**CT2** — Conectar à rede "Casa" gera `wifi.conectou` com apelido "Casa", e o **nome real da rede não chega ao servidor** (teste de inspeção do payload). Queda menor que 30 s não gera evento.

**CT3** — `bateria.baixa` com limite 20% dispara **uma vez** ao cruzar e só de novo depois de voltar acima do limite.

**CT4** — Abrir `/r/<token>` com o app instalado abre a tela de confirmação e executa a regra. Token revogado falha na hora. Regra sem dispositivo ou webhook executa direto, se a pessoa assim configurou. Etiqueta NFC gravada com a URL funciona sem biblioteca NFC no app.

**CT5** — O artigo existe nos 3 idiomas com pelo menos 2 receitas testadas em apps reais, registradas em `docs/TESTES_MANUAIS_V15.md`.

**CM1** — Câmera cadastrada abre o app de origem. Não há vídeo, imagem ou segredo guardado no Questlist.

**CM2** — A imagem é mostrada e **não** é gravada (teste: nada no Storage nem no banco).

**CS1** — Plano "a cada 90 dias após concluir" cria a tarefa, e a próxima data muda ao concluir. Plano vinculado a um dispositivo aparece na tela do dispositivo.

**CS2** — Em um grupo de 3 pessoas, o responsável rotaciona na ordem. "Pular" avisa a próxima pessoa. A contagem de quem fez quanto fecha com o histórico.

**CS3** — Alerta de garantia a 30 e 7 dias. A garantia de um equipamento sem data de compra mostra "informe a data".

**CS4** — Quantidade abaixo do mínimo adiciona o item à lista de compras sem duplicar. Marcar comprado soma ao estoque.

**CS5** — Se o dispositivo não informa energia, a opção **não aparece**. Com energia, o custo estimado fecha com kWh × tarifa e vem rotulado "estimado".

**SA0** — Sem consentimento, nenhuma tabela de saúde aceita escrita. Amigo, time e leitor **não** veem nada. Exportar e excluir a conta incluem os dados. Os testes de privacidade do §11 passam.

**SA1–SA4** — Registro, edição e gráfico funcionam offline e sincronizam. O aviso "não é dispositivo médico" aparece. Nenhum campo recomenda dose, interpretação ou diagnóstico.

**SA3** — A notificação **não mostra o nome** do medicamento por padrão. "Tomei", "Pular" e "Adiar" gravam o histórico. Adiar respeita um limite de 3 adiamentos.

**SA5** — Duas receitas com "200 g" e "0,3 kg" do mesmo ingrediente viram "500 g" na lista. "1 colher" e "20 g" **não** são somados. Macros calculam com a tabela da pessoa. Sem tabela, mostram "informe a tabela".

**ET1** — Uma linha `pergunta ?:: resposta` vira um cartão e some quando a linha é apagada. Revisar em dois aparelhos fora de ordem dá o **mesmo** estado final. Os limites diários são respeitados.

**ET2** — Uma sessão concluída rende XP uma vez e respeita o teto diário. A automação do V14 **não** pode conceder isso (teste).

**CP1** — Compartilhar uma URL cria a tarefa na lista escolhida com o link no corpo. Imagem acima do limite é recusada com mensagem clara.

**CP3** — Widgets mostram o instantâneo mais recente e abrem o app no toque. Dispositivo sensível **não** pode ser colocado no widget.

**IG1** — Parte A: o modelo de nível envia mensagem a um canal de teste. Parte B: `/vincular` com código expirado falha. Resposta é efêmera. Nenhum dado sensível retorna. O bot não tem a permissão de ler mensagens.

**IG2** — Token `leitura` não grava (403). Token revogado falha em menos de 5 s. Passar de 60 pedidos por minuto retorna 429. O OpenAPI descreve todas as rotas.

**IG3** — Uma ferramenta de criar tarefa funciona a partir de um cliente MCP real. `concluir` e `apagar` **não existem** nas ferramentas. Os dados sensíveis não saem.

**AI1** — Com a função desligada, **nenhuma** chamada de rede é feita (teste). Ligada, só o endpoint configurado é chamado. O prompt aparece e é editável. Endpoint fora do ar mostra erro amigável.
