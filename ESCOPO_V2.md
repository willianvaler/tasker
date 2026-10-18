# Tasker — Escopo V2 (instruções para o Claude Code)

Este documento **complementa** o `ESCOPO.md` original. Onde houver conflito, **este documento vence**.

Repositório: https://github.com/willianvaler/tasker

---

## 0. Antes de escrever qualquer código

1. **Audite o repositório atual.** Leia `package.json`, estrutura de pastas, schema do banco, rotas, componentes e testes. Gere um `docs/AUDITORIA.md` curto com: stack real, o que já existe do `ESCOPO.md`, o que está faltando, dívidas técnicas relevantes.
2. **Não assuma a stack.** Este documento sugere tecnologias, mas se o repositório já usa algo diferente, adapte e registre a decisão em `DECISIONS.md`. Só proponha trocar de tecnologia se houver motivo concreto (ex.: bloqueia o sync offline).
3. **Crie/atualize o `CLAUDE.md`** na raiz com convenções, comandos (dev, test, lint, build, migrate) e a regra: *"Sempre que concluir uma tarefa deste escopo, atualize `docs/STATUS.md` (feito / em andamento / pendente / decisões)."*
4. **Trabalhe por fases (seção 13)**, cada uma funcionando e testada antes da seguinte. Faça commits pequenos e descritivos (Conventional Commits).
5. Em dúvida de produto, escolha a opção **mais simples e rápida de usar** e registre em `DECISIONS.md`.

---

## 1. Princípios (não negociáveis)

- **Rapidez acima de tudo.** Criar tarefa/hábito/item continua sendo: digitar + Enter. Nada obrigatório além do título.
- **Complexidade escondida.** Configurações avançadas existem, mas só aparecem na **criação/edição avançada** (seção 7). O fluxo comum nunca é poluído por elas.
- **Teclado e toque são cidadãos de primeira classe.** Tudo importante tem atalho no desktop e gesto/alvo grande no celular.
- **Offline-first.** O app funciona sem internet e sincroniza depois (seção 2).
- **Servidor é a autoridade** para permissões, XP, bosses e convites. Cliente nunca decide isso sozinho.
- **Três idiomas desde o início:** pt-BR (padrão), inglês e espanhol (seção 11).
- **Não pode ter cara de "projeto gerado por IA"** (seção 12).

---

## 2. Estratégia de sincronização local ↔ servidor — ✅ done (PowerSync, D75 a D89)

### 2.1 Visão geral

Cada dispositivo tem um **banco local** que é a fonte de leitura da interface. A UI nunca espera a rede.

| Plataforma | Banco local | Observação |
|---|---|---|
| Navegador (desktop/mobile web) | **SQLite WASM (OPFS)** ou **IndexedDB (Dexie)** | Escolher um e abstrair atrás de uma interface `LocalStore` |
| Android / iOS | **SQLite nativo** | Empacotar a web app com **Capacitor** (reaproveita 100% da UI) |
| Servidor | **PostgreSQL** | Fonte da verdade, com RLS e/ou camada de autorização no servidor |

A UI conversa **somente** com o `LocalStore`. Uma camada de sync, separada, move dados entre `LocalStore` e servidor.

### 2.2 Decisão tecnológica (fazer um spike de 1 dia e registrar em DECISIONS.md)

Avaliar nesta ordem:

1. **Engine de sync pronta** (preferência, menos código para manter): **PowerSync** (Postgres ↔ SQLite, funciona com web e Capacitor) ou **ElectricSQL / Zero / RxDB**. Critérios: suporte a web + Capacitor, regras de permissão por time/projeto, custo e possibilidade de self-host, maturidade.
2. **Protocolo próprio** (fallback, descrito abaixo) se nenhuma engine atender bem as permissões por time ou o custo.

Seja qual for a escolha, o **modelo de dados e as regras abaixo valem igual**.

### 2.3 Regras de modelagem para sync (valem para TODAS as tabelas sincronizáveis)

- **IDs gerados no cliente** (UUID v7, ordenável por tempo). Nunca depender do servidor para criar um id.
- Toda linha tem: `id`, `created_at`, `updated_at`, `deleted_at` (**soft delete / tombstone**, nunca `DELETE` físico imediato), `version` (inteiro incrementado pelo servidor) e `updated_by`.
- **Ordenação manual** (drag & drop) via **fractional indexing** (chave de ordem em string, ex. lexorank), nunca `position` inteiro sequencial (evita reescrever a lista inteira e conflitos).
- **Relógio:** usar *Hybrid Logical Clock* (HLC) ou timestamp do servidor para resolver conflitos; nunca confiar só no relógio do dispositivo.
- O servidor mantém uma tabela/sequência global de mudanças (`change_seq` monotônico) para o cliente pedir "tudo depois do cursor X".

### 2.4 Protocolo próprio (se for o caminho escolhido)

**Escrita (push):**
1. Toda ação do usuário grava no `LocalStore` **e** em uma fila `outbox` (mutations): `{mutation_id (uuid), entity, entity_id, op: create|update|delete, patch (apenas campos alterados), client_hlc, created_at}`.
2. Um worker envia a outbox em lotes (`POST /sync/push`) quando há rede, em ordem. O servidor é **idempotente por `mutation_id`** (reenviar nunca duplica).
3. O servidor valida **permissão por mutation** (usuário ainda é membro? cargo permite essa ação?), aplica, e responde com o resultado de cada mutation: `applied | rejected(reason) | conflict(merged)`.
4. Mutations rejeitadas por permissão são **desfeitas localmente** e o usuário é avisado de forma discreta.

**Leitura (pull):**
1. `GET /sync/pull?cursor=<change_seq>` retorna as mudanças que o usuário **tem permissão de ver**, em páginas.
2. O cliente aplica no `LocalStore` e avança o cursor.
3. **Tempo real:** canal websocket/SSE só avisa "há mudanças" → o cliente dispara um pull. (Em Supabase, Realtime serve como esse aviso.)
4. Se o usuário perde acesso a um projeto, o servidor envia um evento de **revogação** e o cliente **apaga os dados locais daquele projeto**.

**Primeiro sync:** snapshot paginado por escopo (pastas/projetos que o usuário acessa), depois segue por cursor.

### 2.5 Resolução de conflitos

- **Campo a campo, "última escrita vence"** (por HLC) para campos simples: título, notas, prioridade, data, ícone, cor.
- **Conclusão de tarefa:** tratar como **evento** (`task_completions`), não como boolean sobrescrevível. Se dois usuários concluem a mesma tarefa, ambos os eventos existem e o estado final é "concluída"; XP/dano de boss são concedidos **uma única vez** pelo servidor.
- **Checklist/subtarefas e etiquetas:** tratar como conjuntos (adicionar/remover por id), não como lista inteira sobrescrita.
- **Edição simultânea de texto longo (notas):** LWW é aceitável na V2; se houver conflito, guardar a versão perdedora em `conflict_copies` e mostrar um aviso "ver versão anterior". (CRDT fica no backlog.)
- **Exclusão vs edição:** exclusão vence, mas o item fica recuperável na **lixeira por 30 dias**.

### 2.6 Gamificação e sync

- **XP, nível, streak, boss e conquistas são calculados somente no servidor.** Offline, a UI mostra um **valor otimista** (estimativa) marcado como pendente; ao sincronizar, o valor oficial substitui o otimista (sem animação confusa de "voltar atrás").
- Anti-farm e ledger de XP continuam como no `ESCOPO.md`, agora também protegendo contra reenvio duplicado (idempotência por `mutation_id`).

### 2.7 UX do sync

- Indicador discreto de estado: *sincronizado / sincronizando / offline / erro* (um ponto de cor + tooltip, não um banner).
- Tela "Estado da sincronização" em Configurações: mutations pendentes, última sincronização, botão "Forçar sincronização" e "Descartar mudanças locais".
- Nunca bloquear a UI esperando rede.

### 2.8 Testes obrigatórios de sync

- Dois clientes simulados editando o mesmo item offline e sincronizando em ordens diferentes → estado final **igual** nos dois.
- Reenvio da mesma mutation → sem duplicar.
- Criar → editar → excluir offline, depois sincronizar.
- Usuário removido do projeto com mutations pendentes → mutations rejeitadas, dados locais limpos.
- Perda de conexão no meio de um push.

---

## 3. Banco de dados do servidor — ✅ done

- **PostgreSQL** (gerenciado, com backups automáticos e point-in-time recovery). Se o projeto já usa Supabase, manter; senão, Postgres + camada de auth.
- Migrations versionadas, sempre reversíveis quando possível.
- **Índices** pensados para: pull por `change_seq`, tarefas por página, tarefas por responsável, membros por projeto.
- **RLS** (ou verificação equivalente em toda rota/função) em **todas** as tabelas. Teste automatizado que tenta acessar dados de outro time e **deve falhar**.
- Rotinas de **retenção**: lixeira 30 dias, limpeza de tombstones antigos só depois que todos os dispositivos conhecidos passaram do cursor correspondente (ou após janela longa, ex. 90 dias, forçando resync completo em dispositivos muito antigos).
- Backup e restauração documentados em `docs/OPERACOES.md`.

---

## 4. Times (grupos) e cargos — ✅ done (Fase E)

### 4.1 Conceito

- **Time** = conjunto de pessoas. Um usuário pode estar em vários times.
- Um **Projeto** (ou uma Pasta compartilhada) pertence a **um time** *ou* é pessoal.
- **Só membros do time/projeto podem ver e alterar** os itens. Quem não é membro não vê nem que existe.
- Convite por **link com validade/limite de usos** e por e-mail. Pedido de entrada precisa de aprovação opcional (configurável por quem tem permissão).

### 4.2 Dois níveis de cargo

1. **Cargo no time** (vale para o time todo): `Dono`, `Admin`, `Membro`, `Convidado`.
2. **Cargo no projeto/pasta** (pode sobrescrever o do time naquele projeto): `Gerente`, `Editor`, `Colaborador`, `Leitor`.

### 4.3 Matriz de permissões (padrão)

| Ação | Gerente | Editor | Colaborador | Leitor |
|---|:-:|:-:|:-:|:-:|
| Ver tudo do projeto | ✔ | ✔ | ✔ | ✔ |
| Comentar | ✔ | ✔ | ✔ | ✔ |
| Concluir tarefas atribuídas a si | ✔ | ✔ | ✔ | — |
| Concluir qualquer tarefa | ✔ | ✔ | — | — |
| Criar tarefas/páginas | ✔ | ✔ | ✔ (só nas listas permitidas) | — |
| Editar tarefas de outros | ✔ | ✔ | — | — |
| Excluir tarefas | ✔ | ✔ | só as que criou | — |
| Atribuir/delegar | ✔ | ✔ | — | — |
| Gerenciar páginas/estrutura | ✔ | ✔ | — | — |
| Convidar/remover membros, alterar cargos | ✔ | — | — | — |
| Excluir ou arquivar o projeto | só Dono do time | — | — | — |

- **Cargos personalizados:** na V2, permitir criar cargos custom a partir de um conjunto de **permissões atômicas** (`task.create`, `task.edit_any`, `task.delete_any`, `task.assign`, `page.manage`, `member.manage`, …). Os 4 cargos padrão são apenas presets dessas permissões. Implementar permissões como dados, **não** como `if (role === 'x')` espalhado pelo código.
- Toda checagem de permissão passa por **uma única função** (`can(user, action, resource)`) usada igualmente no servidor (autoridade) e no cliente (só para esconder/desabilitar botões).
- **Log de auditoria** por time: quem convidou, removeu, mudou cargo, excluiu.
- Regra de segurança: sempre existe pelo menos 1 Dono; não é possível remover o último.

---

## 5. Estrutura: Pastas, Projetos e Páginas — ✅ done (Fase C)

### 5.1 Modelo mental

Dois **agregadores** diferentes, com propósitos diferentes:

| | **Pasta** | **Projeto** |
|---|---|---|
| Para quê | Organizar coisas (pessoal ou compartilhada) | Alcançar um objetivo com outras pessoas |
| Contém | **Páginas** (lista, cards, hábitos, kanban) | **Listas** (agrupamentos de tarefas) + **Marcos** (datas-chave) |
| Pessoas | Opcional | Sim (time, cargos, delegação) |
| Extras | Ícone, cor, subpasta (1 nível) | Prazo, progresso %, atividade, boss cooperativo, templates |
| Exemplo | "Academia", "Casa" | "Churrasco", "Mudança", "Lançamento" |

> **Decisão de nomenclatura (em aberto):** para os itens dentro de um Projeto, o usuário ainda não definiu o nome. Proposta inicial: **"Listas"** dentro de Projetos e **"Páginas"** dentro de Pastas. **Implemente os rótulos via i18n** (chaves `project.item.singular/plural`) para que o nome possa ser trocado em um único lugar. Registrar em `DECISIONS.md` e perguntar ao usuário antes da Fase 5 se ele quer outro nome.

### 5.2 Modelo técnico (simples)

Evite duas hierarquias paralelas. Sugestão:

```
containers(id, kind: 'folder' | 'project', parent_id, team_id null, owner_id, name, icon, color, ...)
pages(id, container_id, kind: 'list'|'cards'|'habits'|'kanban', ...)   -- "Lista" no projeto é uma page
tasks(id, page_id, ...)
milestones(id, project_id, name, due_at, ...)    -- só projetos
```

### 5.3 Botão "Adicionar"

- Um botão único **"+ Novo"** (na sidebar e na barra de captura) que abre um menu enxuto:
  **Tarefa · Página · Pasta · Projeto · Hábito** (+ "Criação avançada…").
- Atalho: `Ctrl/Cmd + N` abre o menu; letras de atalho dentro do menu (`T`, `P`, `F`, `J`, `H`).
- O contexto define o padrão: dentro de uma Pasta, "Página" cria dentro dela; dentro de um Projeto, cria uma Lista.
- **Criar Pasta / Projeto / Página deve exigir só o nome** (ícone e cor com padrão automático). Todo o resto é editável depois.
- Mover itens entre pasta/projeto por drag & drop e por comando ("Mover para…").

---

## 6. Criação rápida (continua sendo a prioridade) — ✅ done

- Campo de captura sempre visível; Enter cria; foco permanece.
- Sintaxe rápida e criação em lote do `ESCOPO.md` seguem valendo, **agora com as mesmas regras de permissão** (o campo some/desabilita para Leitor).
- Lote em projeto: `@nome` resolve entre os membros do projeto (autocomplete ao digitar `@`).

---

## 7. Criação/edição avançada — ✅ done (C8)

- Botão **"Criação avançada"** (ícone de sliders) ao lado do campo rápido e no menu "+ Novo"; atalho `Ctrl/Cmd + Shift + N`. Na edição, o mesmo painel abre com `Ctrl/Cmd + E` ou pelo botão "Mais opções".
- Abre um **painel lateral** (desktop) ou **tela cheia deslizante** (celular). Nunca um modal que bloqueia tudo.
- Funciona para: **tarefa, hábito, página, pasta, projeto, marco**.
- Mostra **todas** as configurações possíveis, agrupadas em seções recolhíveis:
  - **Tarefa:** título, notas (markdown), status, prioridade, datas (início/vencimento/lembrete), recorrência completa, responsáveis, etiquetas, subtarefas, anexos de link, estimativa de tempo, peso no boss, página/lista de destino, visibilidade.
  - **Hábito:** frequência (dias/semana/mês), meta por período, horário, dificuldade (XP), streak/congelamento, cor/ícone.
  - **Página:** tipo, ciclo de reset, campos extras dos itens (séries/reps/carga), ordenação padrão, cor/ícone.
  - **Projeto/Pasta:** time, cargos, prazo, marcos, boss, template, arquivar.
- Salvar com `Ctrl/Cmd + Enter`; fechar com `Esc` (pedir confirmação só se houver alterações).
- Item criado no avançado continua editável no rápido (sem "modo separado" de dados).

---

## 8. Edição inline (edição rápida) — ✅ done (C5)

- Selecionar qualquer item (pasta, projeto, página, tarefa) e pressionar **`F2`** (ou duplo clique / toque longo no celular) habilita edição inline:
  - o nome vira um campo editável com o texto selecionado;
  - ao lado aparece o **seletor de ícone** (e cor) em um popover compacto;
  - `Enter` confirma, `Esc` cancela, `Tab` pula do nome para o ícone.
- Em tarefas, `F2` edita título; `Shift + F2` abre o painel de detalhes.
- Edição inline também para: prioridade (`1`–`3`), data (`D` abre seletor rápido com "hoje / amanhã / próxima semana / escolher"), responsável (`A`).
- Otimista + sincronizado: edição aparece imediatamente.

### 8.1 Ícones — ✅ done (C4)

- Biblioteca de ícones curada (**Phosphor** ou **Lucide**, escolher uma e manter consistência) com **busca por nome em pt/en/es** e categorias (casa, trabalho, saúde/academia, estudo, finanças, viagem, comida, pessoas, etc.).
- Aceitar também **emoji** como ícone.
- Ícones recentes e favoritos no topo do seletor.
- Pasta/Projeto/Página recebem ícone padrão automático por tipo, para nunca ficarem "sem cara".
- Armazenar o ícone como identificador estável (`ph:barbell`, `emoji:🔥`), nunca como SVG inline.

---

## 9. Atalhos de teclado — ✅ done (C6; faltam Shift+Z para refazer e remapear atalhos)

Implementar um **registro central de atalhos** (`shortcuts.ts`): cada atalho tem `id`, tecla(s), descrição (chave i18n), escopo (global / lista / editor) e condição de permissão. A página de ajuda e a paleta de comandos leem desse mesmo registro (nunca duplicar a lista à mão).

| Atalho | Ação |
|---|---|
| `Ctrl/Cmd + K` | Paleta de comandos (buscar, ir para, executar ação) |
| `Ctrl/Cmd + N` | Menu "Novo" |
| `Q` ou `N` (fora de campo) | Foco no campo de captura rápida |
| `Ctrl/Cmd + Shift + N` | Criação avançada |
| `F2` | Renomear / editar inline o item selecionado |
| `Enter` / `Esc` | Confirmar / cancelar |
| `Space` ou `X` | Marcar/desmarcar tarefa selecionada |
| `↑ ↓` / `J K` | Navegar entre itens |
| `→ ←` | Expandir / recolher pasta ou subtarefas |
| `Ctrl/Cmd + ↑ ↓` | Mover item na lista |
| `Delete` / `Backspace` | Excluir (com desfazer) |
| `Ctrl/Cmd + Z` / `Shift + Z` | Desfazer / refazer |
| `Ctrl/Cmd + D` | Duplicar |
| `Ctrl/Cmd + B` | Mostrar/ocultar sidebar |
| `G` depois `H / I / M` | Ir para Hoje / Caixa de entrada / Minhas tarefas |
| `1 2 3` | Prioridade da tarefa selecionada |
| `D` | Data rápida |
| `A` | Atribuir responsável |
| `/` | Buscar |
| `?` | Abrir atalhos (cola rápida) |

- Atalhos **não podem conflitar** com digitação: só valem quando o foco não está em um campo de texto (exceto os com `Ctrl/Cmd`).
- Em macOS exibir `⌘`, no resto `Ctrl`.
- Os atalhos respeitam permissões (não faz nada se o cargo não permite, e mostra aviso discreto).
- Opcional: permitir que o usuário **remapeie** atalhos em Configurações.

---

## 10. Página Wiki / Ajuda — ✅ done (F1, F2)

- Rota `/ajuda` (também acessível por `?` e pela paleta de comandos).
- **Texto simples, direto, sem jargão**, com frases curtas, exemplos reais e, quando útil, GIFs/imagens curtas.
- Conteúdo mínimo:
  1. **Começando em 1 minuto** (criar tarefa, criar várias de uma vez).
  2. **Pastas, Projetos e Páginas:** qual a diferença e quando usar cada um (com o exemplo "Academia" e "Churrasco").
  3. **Criar rápido vs. criar avançado.**
  4. **Edição rápida com F2** (renomear e trocar ícone).
  5. **Tabela completa de atalhos** (gerada do registro central, seção 9) com busca.
  6. **Trabalhando em time:** convidar, cargos e o que cada um pode fazer.
  7. **Funciona sem internet:** como o sync funciona e o que significam os indicadores.
  8. **Gamificação:** XP, streak e bosses em linguagem simples (e como desativar).
  9. **Perguntas frequentes.**
- Cada artigo vive em arquivo Markdown por idioma (`content/help/pt-BR/*.md`, `en/`, `es/`), facilitando edição futura.
- Ajuda contextual: botão "?" pequeno em telas-chave levando ao artigo certo.
- Pequeno **tour inicial opcional** (3 passos), que pode ser pulado e refeito pela Ajuda.

---

## 11. Internacionalização (pt-BR, en, es) — ✅ done (falta o texto das notificações push em en/es)

- Usar uma biblioteca madura de i18n compatível com a stack (ex.: `next-intl`/`react-i18next`), com **chaves semânticas** (`task.create.placeholder`), nunca texto fixo em componentes.
- Arquivos: `locales/pt-BR.json`, `locales/en.json`, `locales/es.json`. **Todos os três completos** ao fim da Fase 1 do V2, e todo texto novo nasce nos três.
- Detectar idioma do navegador/dispositivo; seletor em Configurações; preferência salva no perfil e sincronizada.
- Cobrir: interface, mensagens de erro, e-mails, notificações, templates de projeto (nomes e tarefas padrão), conquistas, bosses, **artigos da Ajuda** e o **parser de datas** (`amanhã` / `tomorrow` / `mañana`, `sexta` / `friday` / `viernes`, etc.).
- Plurais, formatação de data/hora/número via `Intl`; primeiro dia da semana conforme a região.
- Teste automatizado que falha se uma chave existir em um idioma e faltar em outro.
- Preparar para RTL e novos idiomas (sem texto concatenado manualmente).

---

## 12. Redesign visual — ✅ done (Fase B; a aprovação formal dos mockups ficou para as capturas)

### 12.1 Problema a resolver

O visual atual está com cara de "projeto feito por IA". Sinais típicos que **devem ser removidos**:

- gradientes roxo/azul/índigo e "brilhos" (glow);
- glassmorphism e blur em tudo;
- cards arredondados demais (`rounded-2xl`) com sombra suave em **tudo**, tudo flutuando;
- fonte Inter/system por padrão, com todos os títulos em negrito;
- ícones de IA/estrelinha (✨), emojis decorativos em títulos e botões;
- dashboards com cartões de estatística idênticos em grid;
- hero centralizado com título gigante e subtítulo cinza;
- paleta genérica "slate + indigo" do shadcn/Tailwind sem personalização;
- tudo com o mesmo espaçamento e a mesma hierarquia (sem ritmo).

### 12.2 Direção: "Caderno de bolso" — papel, tinta e um acento

Interface de ferramenta séria e calma, inspirada em papelaria/cadernos e em editores densos (linhas, não caixas). A gamificação aparece como **marcações discretas**, não como um jogo por cima.

**Princípios visuais**
- **Linhas em vez de cartões.** A lista de tarefas é uma lista com divisórias finas (hairlines), sem caixa por item. Cards só onde há função real (páginas de checklist grande, como treino).
- **Densidade confortável.** Mais informação por tela no desktop; alvos de 44 px no celular.
- **Um único acento** forte, usado com parcimônia (estado ativo, foco, progresso).
- **Tipografia com personalidade.** Contraste entre uma fonte de títulos com caráter e uma de texto limpa.
- **Cantos pouco arredondados** (4–6 px), sombras quase inexistentes (usar bordas), sem blur.
- **Movimento curto e útil** (100–180 ms), com um "carimbo/risco" satisfatório ao concluir.

**Tipografia (sugestão; evitar Inter/Roboto/Arial)**
- Títulos e nomes de pastas/projetos: **Fraunces** (serifada com personalidade) *ou* **Newsreader**.
- Texto da interface: **Instrument Sans** *ou* **Hanken Grotesk**.
- Números, atalhos, metadados: **JetBrains Mono** *ou* **IBM Plex Mono** (tamanho pequeno).
- Hospedar localmente (sem depender de CDN) e limitar a 2–3 pesos.

**Cores (tokens; ajustar após ver em tela)**

| Token | Claro | Escuro |
|---|---|---|
| `--bg` | `#F6F2EA` (papel) | `#1B1A17` (carvão quente) |
| `--surface` | `#FBF8F2` | `#23211D` |
| `--ink` (texto) | `#1F1D1A` | `#ECE6DA` |
| `--ink-muted` | `#6B655B` | `#9B9487` |
| `--line` (divisórias) | `#E2DBCD` | `#34312B` |
| `--accent` | `#D8452B` (vermelhão/tinta de carimbo) | `#F0644A` |
| `--accent-soft` | `#F6D9D2` | `#3A2420` |
| `--ok` | `#3F7D4E` | `#6DB27D` |
| `--warn` | `#C58A12` | `#E0A93A` |

- Fundo **nunca** branco puro nem preto puro; escuro **não** é azul-marinho.
- Cada Pasta/Projeto pode ter uma **cor de marcador** de uma paleta curada de ~10 tons (terrosos/pigmento), usada em uma barrinha lateral e no ícone, não em fundos grandes.

**Elementos de assinatura (para ter identidade própria)**
- **Concluir tarefa = risco de caneta** animado sobre o texto + checkbox que vira "carimbo" (um X ou check traçado à mão, em SVG), em vez de um check genérico.
- **Progresso** como régua/linha fina (tipo marcação de caderno), não barras gordas e arredondadas.
- **Boss:** faixa estreita no topo da tela "Hoje" com nome, uma linha de HP e valor em mono (`HP 640/900`). Arte do boss em **ilustração simples de traço único** (estilo carimbo/xilogravura), um estilo só para todos os bosses. Sem pixel art, sem fantasia genérica.
- **XP/nível:** número pequeno em mono no cabeçalho + fio de progresso de 2 px; nada de medalhões.
- **Estados vazios** com uma ilustração de traço simples e um texto com humor leve (traduzido nos 3 idiomas), nunca "No data".
- **Textura sutil** opcional de papel (ruído muito leve, desligável) apenas no fundo.

### 12.3 Layout

**Desktop (≥1024 px) — 3 áreas**
1. **Sidebar (240–280 px, recolhível):** busca/paleta no topo, atalhos fixos (Hoje, Caixa de entrada, Minhas tarefas), depois **Pastas** e **Projetos** como duas seções separadas e recolhíveis, cada item com ícone + barrinha de cor. Botão **"+ Novo"** fixo embaixo. Estado de sync (ponto) e avatar no rodapé.
2. **Área principal (coluna central, largura de leitura ~720–840 px):** cabeçalho simples (ícone + nome editável por `F2` + ações), campo de captura **fixo no topo da lista**, lista de tarefas em linhas.
3. **Painel de detalhes (direita, abre sob demanda):** edição avançada da tarefa/página; fecha com `Esc`.

**Mobile (<768 px)**
- **Barra inferior** com 4 destinos: Hoje · Caixa · Pastas/Projetos · Eu. No centro, botão **"+"** grande que abre o menu "Novo".
- Campo de captura **fixo acima do teclado/rodapé** na página.
- Painel de detalhes vira **folha deslizante de baixo para cima** (bottom sheet).
- Gestos: deslizar para a direita = concluir, para a esquerda = mais opções (adiar, excluir). Sempre com "Desfazer".
- Páginas tipo **cards**: cartões grandes (altura ≥ 72 px), toque no cartão inteiro marca, barra de progresso no topo.

**Telas-chave a redesenhar (nesta ordem)**
1. **Hoje** (lista do dia + hábitos + faixa do boss)
2. **Página em lista** e **Página em cards** (treino)
3. **Sidebar / navegação** e menu **"+ Novo"**
4. **Painel de criação/edição avançada**
5. **Projeto** (visão geral: progresso, marcos, membros, atividade, boss)
6. **Time e cargos** (gerenciamento de membros)
7. **Ajuda/Wiki** (leitura confortável, tabela de atalhos)
8. **Configurações** (idioma, tema, sync, gamificação, atalhos)

### 12.4 Processo para o Claude Code

1. Criar `docs/DESIGN.md` com os tokens acima (cores, tipografia, espaçamentos de escala 4 px, raios, bordas, durações de animação) e **implementá-los como variáveis CSS/tema do Tailwind** em um único lugar. Nenhum hex solto em componentes.
2. Criar uma página interna `/design` (apenas em desenvolvimento) mostrando: paleta, tipografia, botões, campos, linha de tarefa, card de checklist, faixa do boss, seletor de ícones, estados vazios, claro e escuro. Servirá de referência visual.
3. Refazer os componentes-base primeiro (botão, campo, linha de tarefa, checkbox "carimbo", item de sidebar, painel), depois as telas.
4. **Não reutilizar** o visual atual como ponto de partida; trate como substituição completa da camada visual, preservando a lógica.
5. Acessibilidade: contraste AA em ambos os temas, foco visível (anel com `--accent`), `prefers-reduced-motion` respeitado (desliga animação de risco/carimbo), navegação 100% por teclado.
6. Tirar capturas (Playwright) de cada tela-chave em claro/escuro, desktop/mobile, e salvar em `docs/screenshots/` para revisão do usuário.
7. Checklist anti "cara de IA" antes de fechar cada tela: sem gradiente decorativo, sem glow, sem blur, sem emoji decorativo, no máximo 1 cor de acento por tela, sem sombra "flutuante" em todos os cartões, hierarquia clara por tamanho/peso/posição (não por caixas).

---

## 13. Plano de entrega por fases (V2)

**Fase A — Auditoria e fundação** — ✅ done
- Auditoria do repo, `CLAUDE.md`, `DECISIONS.md`, `docs/STATUS.md`.
- Spike de sync (seção 2.2) e decisão registrada.
- Infra de i18n com os 3 idiomas e teste de chaves.
- Registro central de atalhos e função única `can()`.

**Fase B — Redesign** — ✅ done
- Tokens, página `/design`, componentes-base, telas-chave (seção 12). Capturas em `docs/screenshots/`.
- *Aceite:* o usuário aprova visualmente Hoje, Página (lista e cards) e Sidebar antes de seguir.

**Fase C — Estrutura e velocidade** — ✅ done
- Modelo `containers` (Pasta/Projeto), menu "+ Novo", mover itens.
- Edição inline (`F2`), seletor de ícones, atalhos da seção 9, paleta de comandos.
- Criação avançada (seção 7).
- *Aceite:* criar pasta + página + 10 tarefas em lote, renomear com `F2` e trocar ícone **sem usar o mouse**.

**Fase D — Offline-first e sync** — ✅ done (com Expo + PowerSync no lugar do Capacitor; falta repetir o aceite com o celular em modo avião)
- `LocalStore`, outbox, pull por cursor, tempo real como aviso, tombstones, lixeira.
- Capacitor (Android/iOS) com SQLite nativo.
- Testes de sync da seção 2.8.
- *Aceite:* editar no celular em modo avião e no navegador ao mesmo tempo, reconectar e os dois chegarem ao mesmo estado.

**Fase E — Times, cargos e projetos** — ✅ done
- Times, convites, cargos padrão e personalizados, matriz de permissões, auditoria.
- Projetos com marcos, atribuição, "Minhas tarefas", templates.
- Teste de isolamento entre times (deve falhar ao acessar dados alheios).
- *Aceite:* o cenário "Churrasco" completo (criar projeto, convidar 2 pessoas com cargos diferentes, delegar, cada um vê só o que pode).

**Fase F — Ajuda, polimento e idiomas** — ✅ done
- Página Wiki/Ajuda nos 3 idiomas, tour opcional, ajuda contextual.
- Revisão de acessibilidade, performance e traduções.
- Gamificação adaptada ao novo visual (faixa do boss, XP discreto), respeitando o sync server-authoritative.

---

## 14. Definição de pronto (cada fase)

- Funcionalidade demonstrável em desktop (1280 px) e celular (390 px), claro e escuro.
- Testes unitários + E2E dos fluxos críticos; testes de permissão e de sync quando aplicável.
- Nenhum texto fixo fora do i18n; os 3 idiomas completos.
- Toda ação nova com atalho (quando faz sentido) registrado no registro central e listado na Ajuda.
- `docs/STATUS.md`, `DECISIONS.md` e, se mudou algo visual, `docs/DESIGN.md` atualizados.
- Lint, tipos e build passando no CI.

---

## 15. Decisões em aberto (perguntar ao usuário quando chegar a hora)

1. **Nome dos itens dentro de Projeto** (proposta: "Listas"). Decidir antes da Fase E.
2. Engine de sync pronta (PowerSync etc.) ou protocolo próprio — depende do resultado do spike e do custo aceitável.
3. Cargos personalizados já na V2 ou só os 4 padrão por enquanto.
4. Tipografia e acento final (ver na página `/design` e ajustar).
5. Hospedagem do servidor e do banco (custo, região, backup).
