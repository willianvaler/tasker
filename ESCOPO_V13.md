# Questlist — Escopo V13: estudar por dentro do app (instruções para o Claude Code)

Pedido do dono em 21/11/2026, depois de importar o projeto "Engenharia na prática" (CSV do Todoist) e organizar o material de estudo numa pasta do Obsidian:

> "estava usando o obsidian local e ele é muito bom pra estudos [...] abrindo o obsidian, ele me permite visualizar os arquivos .md perfeitamente, da pra fazer isso no questlist? a gente já tem a visualização de grafos, mas sempre que clico em qualquer coisa, ele edita a tarefa/anotação, precisaríamos ter uma forma de poder visualizar sem abrir a edição sempre, adicionar um modo edição ou botão editar, mas quando clicar, abrir a descrição da tarefa (quando houver) [...] de eu poder [ter os] meus planos de estudos dentro do questlist, jogar os pdfs, html ou .md lá e poder visualizar eles como se fossem um projeto de verdade e estudar por dentro do app"
>
> "sim, pode ser, pensamos parecido" (sobre escrever este escopo antes de começar)

O caso real que guia o escopo é a pasta `~/projects/engenharia/` do dono: o CSV do plano (15 listas, 197 tarefas, miniaturas M01 a M21 e desafios P00 a P30, com sessões como subtarefas) e a pasta `material/` com 34 itens (44 MB), cujos nomes seguem `NN - <código> - <fonte> - <título>`:

- **28 `.md`** baixados de OpenStax, Wikipedia, TeachEngineering etc. (licenças abertas, com a fonte no topo), com **imagens locais** (`![...](img/87055e99c8.jpg)`, 156 imagens, 19 MB) e **fórmulas em LaTeX** em 9 deles (`$$\tau = rF\sin\theta$$`, `$r$`).
- **3 PDFs** (1,7 a 3,2 MB).
- **1 HTML interativo** (simulador PhET "Balançando", 3,1 MB, com JavaScript).
- **1 livro em HTML** numa pasta (Vitrúvio, `index.html` + 123 arquivos, 14 MB).

Em conflito com escopos anteriores, este vence. Decisões tomadas sem o dono ficam marcadas com **(padrão)** e voltam na tabela do §12. **Ainda não começar:** o dono vai ler e ajustar.

## 0. O que o Questlist já tem

| Para estudar | No Questlist hoje |
|---|---|
| Ler Markdown | Anotações com o Markdown do Obsidian (OB3, D288: títulos, listas, tabelas, callouts, destaques, rodapés, `[[links]]`, incorporar) |
| Ler sem editar | **A anotação já abre em leitura** quando tem texto, com o botão Editar (D288). **A tarefa não:** tocar abre o painel, que é edição; o grafo, os links `[[t:...]]` e as Bases levam ao painel |
| Importar do Obsidian | Cofre `.zip` → anotações, com propriedades e links (OB13, D298). **Imagens, PDFs e `.canvas` ficam de fora** (as anotações não têm anexos, D291) |
| Fórmulas | Não tem. `$$...$$` aparece como texto |
| PDF e HTML | Anexo na **tarefa** (N1 a N4, D150 a D153: até 10 MB por arquivo, 1 GB por conta), que **abre fora do app** (baixa ou vai para o navegador); imagem tem visualizador próprio |
| Grafo | Anotações e o que elas citam (OB9, D294); tocar abre a anotação ou o painel da tarefa |
| Plano de estudos | O projeto importado: listas, tarefas, sessões e descrições com os links das fontes |
| Tempo de estudo | Pomodoro e cronômetro na tarefa (K, D129 a D132) |

O que falta, em resumo: **abrir para ler** (sobretudo a tarefa), **ver o material dentro do app** (Markdown com imagens e fórmulas, PDF, HTML), **o material morar no projeto e estar ligado às tarefas** e **uma tela de estudo** que junte ler, marcar a sessão e contar o tempo.

## 1. Abrir para ler, editar só quando pedir

- **Ficha de leitura da tarefa:** tocar numa tarefa (fora da linha da lista, ver abaixo) abre a **ficha**: título, estado, data, etiquetas, a **descrição renderizada** (o mesmo Markdown da anotação, com os links clicáveis), os anexos, as subtarefas com a caixinha (marcar continua valendo) e quem cita. Botão **Editar** abre o painel de hoje; `E` faz o mesmo no teclado.
- **Onde a ficha vale (padrão):** no **grafo**, nos links `[[t:...]]`, no "Citado em", nas Bases (cartão), no Calendário, na busca e nas tarefas de um **projeto de estudo** (§5). Na **linha da lista** comum o toque continua abrindo o painel (é onde se edita no dia a dia), e a seta da linha ganha a opção "Ler". Preferência em Configurações para quem quiser a ficha em todo lugar.
- **Anotação:** já abre em leitura quando tem texto; o título deixa de ser editável no modo leitura (hoje é um campo, e um toque nele já edita). Anotação vazia continua abrindo na edição (não há o que ler).
- **Sem conexão:** a ficha lê do aparelho, como o painel (D86).

## 2. Markdown de estudo: fórmulas e imagens

- **Fórmulas LaTeX** na leitura de anotação e da descrição da tarefa: `$...$` na linha e `$$...$$` em bloco, como no Obsidian. Biblioteca: **KaTeX** (MIT; renderiza no app, sem servidor). Na web, direto; no celular, o caminho mais simples que funcione offline (KaTeX numa WebView pequena por fórmula, ou converter para SVG) **a decidir no ES2** depois de testar no aparelho. Fórmula com erro aparece como o texto original, em monoespaçado.
- **Imagens nas anotações:** as anotações ganham **arquivos próprios** (o que o D291 deixou de fora): `![](img/x.jpg)` aponta para um arquivo guardado no Storage com a anotação, no bucket privado de sempre, com a mesma permissão da anotação (a dona, o projeto, o compartilhamento do OB14). Na escrita, colar ou arrastar uma imagem guarda e insere o link. Mesmas reduções da imagem da tarefa (D151: lado maior 2048 px, WebP) e mesmo limite por conta (D153).
- **Importar o cofre com as imagens:** o OB13 passa a trazer as imagens citadas pelos `.md` (as outras continuam fora), resolvendo o caminho relativo (`img/x.jpg`, `../img/x.jpg`, `![[x.jpg]]` do Obsidian). **Exportar** devolve as imagens no `.zip`, nas mesmas pastas.

## 3. Material do projeto: PDF e HTML dentro do app

- **Material** é uma seção nova do projeto (e de pasta): a lista dos arquivos de estudo, na ordem do nome (`01 - ...`, `02 - ...`), com o tipo e o tamanho. Entra por **Adicionar material** (arquivos, várias de uma vez) ou pela importação (§6). Os `.md` viram anotações do projeto (com as imagens, §2); PDF, HTML e o livro em HTML viram **arquivos do projeto** (tabela nova, `project_files`, no Storage privado, permissão do projeto: quem vê o projeto lê, quem tem `page.manage` acrescenta e tira).
- **Leitor de PDF** dentro do app: na web, o leitor do próprio navegador num quadro da tela (rápido, com busca e zoom); no celular, o **pdf.js** numa WebView (funciona offline com o arquivo no aparelho). Lembra a página onde parou (por pessoa, §5).
- **HTML e livro em HTML:** abrem num quadro **isolado** (ver segurança abaixo), com o livro inteiro (o `index.html` e os arquivos ao lado) guardado como um pacote (`.zip` no Storage, aberto no aparelho e servido ao quadro). O simulador PhET roda (precisa de JavaScript).
- **Segurança do HTML (obrigatório):** HTML enviado pela pessoa **nunca** roda na origem do app (`questlist.wavdev.org`): leria a sessão e os dados. Ele abre num `iframe` com `sandbox="allow-scripts"` **sem** `allow-same-origin`, servido de um endereço separado (subdomínio próprio, ex.: `arquivos.wavdev.org`, ou `blob:`/`srcdoc` com origem nula) e com CSP que proíbe chamar a API do app; sem acesso a cookies, armazenamento nem ao Supabase. No celular, WebView com JavaScript isolado e sem ponte para o app. PDF também abre isolado.
- **Limites (padrão):** 10 MB por arquivo como hoje (os PDFs do dono têm até 3,2 MB), 50 MB por pacote de livro em HTML (o Vitrúvio tem 14 MB) e o mesmo 1 GB por conta, somando tudo (anexos, imagens das anotações, material). O Perfil mostra o uso separado.
- **Offline (padrão):** as anotações já vão para o aparelho (sync); PDF e HTML baixam ao abrir e ficam no aparelho até faltar espaço; **Baixar o material para ler sem internet** no projeto guarda tudo de uma vez (com o tamanho antes).
- **Direitos autorais:** o material é privado do projeto; não entra em publicar (OB14) nem em compartilhar como modelo ou na Comunidade. A fonte que o `.md` traz no topo continua lá.

## 4. Ligar o material às tarefas

- **Pelo código (padrão):** o nome do arquivo `NN - M01 - ...` liga o material à tarefa cujo título começa com o código (`M01 · Alavanca...`) no mesmo projeto. O código é a primeira palavra do título antes de ` · ` ou ` - ` (letras e números, ex.: `M01`, `P04`, `CD40`). Sem tarefa com o código, o material fica só na seção Material. Na Fase 0, o código `Fase 0` liga à lista.
- **À mão:** na ficha e no painel da tarefa, **Material** mostra o que está ligado e **Ligar material** escolhe da lista do projeto; nas anotações, `[[...]]` continua valendo (e liga também).
- A **ficha da tarefa** (§1) mostra o material ligado em ordem, com um toque para abrir no leitor; a sessão (subtarefa) herda o material da mãe.
- O **grafo** mostra o material como pontos ligados às tarefas.

## 5. Estudar: o projeto de estudo e a tela de leitura

- **Projeto de estudo (padrão):** um interruptor no projeto ("É um plano de estudos"); ligado, as tarefas abrem a ficha (§1), aparece a seção Material e a visão geral mostra **o que estudar agora** (a próxima sessão aberta, na ordem das listas, com o material dela).
- **Tela de leitura** (para anotação, PDF e HTML): tela cheia, com o título, **anterior / próximo** na ordem do material da tarefa (ou do projeto), **onde parei** (posição da rolagem ou página, por pessoa, no aparelho e no servidor), modo noturno do tema e tamanho do texto.
- **Junto da sessão:** na tela de leitura, a sessão da vez aparece embaixo com **Começar foco** (o pomodoro de sempre, contando o tempo na sessão, D129) e **Concluir sessão** (o `complete_task` de sempre, com XP). O progresso do projeto segue o das tarefas.
- **Destaques e anotações na margem** (como no Obsidian com plugins): **fora deste escopo** (ver §10); o dono anota numa anotação ligada.

## 6. Importar o plano de estudos inteiro

- **Um `.zip` com o CSV e a pasta do material** (como a pasta do dono): o importador do Todoist (D306) cria o projeto, já como **projeto de estudo** (§5), e o material entra junto (§3), ligado pelos códigos (§4). A tela de antes mostra quantas tarefas, quantos materiais, quantos ficaram sem tarefa e o tamanho total, como o importar de hoje.
- **Projeto já importado:** **Adicionar material** aceita a pasta (ou o `.zip` dela) e liga pelos códigos às tarefas que já existem. É o caminho do "Engenharia na prática" (o projeto já existe).
- Sem novo formato próprio: o CSV continua o do Todoist; um importador de JSON do próprio app fica no backlog (o "CSV genérico" do D306).

## 7. Grafo e links

- Tocar num ponto do grafo abre a **leitura** (anotação em leitura, ficha da tarefa, leitor do material); segurar (ou clique direito) abre o menu com **Editar**.
- Material aparece no grafo (§4); o "Citado em" da anotação e da ficha mostra as tarefas e materiais ligados.

## 8. Privacidade e política

- Nada vai para terceiros: o material fica no Storage do servidor, como os anexos. Não entra na IA (D219 lê só foto, por pedido).
- **Dado novo:** o que a pessoa envia como material e a posição de leitura. Atualizar a política (D213) com "material de estudo e onde você parou", **sem** mudar a retenção (o material some com o projeto e com a conta; a lixeira vale como para o resto).
- **Exportar meus dados** leva o material (os arquivos em `.zip`) e as posições de leitura.

## 9. Sem conexão

- Ficha da tarefa e anotações: offline, como hoje.
- PDF e HTML: offline depois de abertos uma vez ou de **Baixar o material** (§3). Enviar material novo pede conexão.
- Concluir a sessão e o foco: offline, pela fila de sempre (D86).

## 10. Fora deste escopo

- **Destaques e anotações na margem** do PDF e do Markdown: pesado (posição estável no texto, sync, conflito). Avaliar depois de usar o leitor.
- **Repetição espaçada / flashcards** (Anki): seria outro escopo; os hábitos e repetições do app não são o mesmo modelo.
- **EPUB, vídeo e áudio:** fora por agora (o material do dono não tem); vídeo do YouTube continua como link.
- **Editar o PDF ou o HTML** no app: só leitura.
- **IA para resumir ou perguntar ao material:** mesma razão do V12-8 (privacidade).
- **Obsidian ao vivo** (abrir o cofre do computador sem importar): o app não lê pastas do computador; o caminho é importar e exportar (OB13).

## 11. Ordem sugerida

| Id | Tarefa | Depende de |
|---|---|---|
| ES1 | Ficha de leitura da tarefa (descrição renderizada, Editar, `E`); grafo, `[[t:]]`, Citado em, Bases, Calendário e busca abrem a ficha; título da anotação não editável em leitura | — |
| ES2 | Fórmulas LaTeX (KaTeX) na leitura da anotação e da descrição, web e celular | — |
| ES3 | Imagens nas anotações (Storage, colar/arrastar, permissão da anotação) e o cofre do Obsidian importando e exportando as imagens | — |
| ES4 | Material do projeto (`project_files`, seção Material, Adicionar material), leitor de PDF na web e no celular, limites e uso no Perfil; política | ES3 |
| ES5 | HTML e livro em HTML isolados (origem separada, sandbox, CSP), pacote `.zip`; WebView isolada no celular | ES4 |
| ES6 | Ligar material às tarefas (código e à mão), material na ficha e no grafo | ES1, ES4 |
| ES7 | Projeto de estudo (interruptor, "o que estudar agora") e tela de leitura (anterior/próximo, onde parei, foco e concluir a sessão), baixar para ler offline | ES6 |
| ES8 | Importar o plano inteiro (`.zip` com CSV + material) e Adicionar material com a pasta num projeto que já existe | ES6 |

O **ES1** é pequeno e muda o dia a dia: pode sair antes do resto. O **ES5** é o mais delicado (segurança) e pede o subdomínio do §3 na Cloudflare.

Cada tarefa: Ajuda nos 3 idiomas, i18n, E2E e o registro de sempre (STATUS, PENDENTES, FEITOS, DECISIONS). Tabela nova: RLS e pgTAP (dono acessa, estranho não vê, leitor não grava), privilégio por coluna, publicação do sync quando for o caso. Arquivo enviado pela pessoa: nunca roda na origem do app.

## 12. Decisões do dono

| # | Pergunta | Padrão |
|---|---|---|
| V13-1 | Onde o toque abre a **ficha de leitura** em vez do painel? | No grafo, links, Citado em, Bases, Calendário, busca e nas tarefas de projeto de estudo; na **linha da lista** continua o painel (com "Ler" na seta). Preferência para ficha em todo lugar |
| V13-2 | "Projeto de estudo" é um interruptor no projeto ou um tipo novo de projeto? | **Interruptor** no projeto (dá para ligar no "Engenharia na prática" que já existe) |
| V13-3 | Ligar o material à tarefa pelo **código** no nome do arquivo (`M01`) automaticamente? | **Sim**, e também à mão |
| V13-4 | Limite por arquivo do material: manter 10 MB ou subir (livros em PDF costumam passar)? | **10 MB por arquivo**, 50 MB por pacote de livro em HTML, 1 GB por conta |
| V13-5 | HTML isolado num **subdomínio próprio** (ex.: `arquivos.wavdev.org`, precisa de registro na Cloudflare) ou só `srcdoc`/`blob:` com origem nula (sem subdomínio, mas o livro de várias páginas fica mais difícil)? | **Subdomínio próprio** |
| V13-6 | Material disponível **sem internet** por projeto (baixar tudo de uma vez)? | **Sim**, com o tamanho antes |
| V13-7 | Por onde começar: ES1 (ficha de leitura) sozinho primeiro, ou ES1 a ES4 de uma vez? | **ES1 primeiro**, depois ES2 a ES4 |
| V13-8 | Destaques e anotações na margem ficam mesmo de fora agora? | **Fora** (§10) |
