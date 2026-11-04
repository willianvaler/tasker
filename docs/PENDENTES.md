# Pendentes

O que falta de todos os escopos (`ESCOPO.md` a `ESCOPO_V11.md`), numa tabela só, para ler rápido. O detalhe fica em `docs/STATUS.md`, `docs/TAREFAS_V6.md` e nos escopos; o que já foi feito, em `docs/FEITOS.md`.

**Atualize no mesmo commit da tarefa** (como o `STATUS.md`): concluída sai daqui (e entra no `FEITOS.md` pelo `npm run feitos`); parcial muda a situação.

Atualizado em 04/11/2026. Em 04/11: importar do Habitica e do Todoist (PC1, D306); dependência entre projetos (PC2, D307); kits por assunto em Usar modelo (PB6, D301); falar a lista (PB7, D302); Compartilhar de outros apps (PB8, D303); exportar e imprimir a lista (PB9, D304); Web Clipper (OB15, D305), o último do V11; aviso do timer e treino com a tela desligada no Android Go (CD35, D299); compartilhar e publicar anotações (OB14, D300). Em 03/11: produção na v2026.11.03.4 (APK código 408); download do app do relógio em Configurações e divisor na barra lateral (CD34); edição das anotações do V11 (OB3, D288), propriedades e etiquetas (OB4, D289), nota do dia e modelos (OB5, D290), incorporar com prévia dos links (OB6, D291), consultas (OB7, D292), bases, grafo e canvas (OB8 a OB10, D293 a D295), histórico de versões (OB11, D296), favoritos, busca com operadores, tela dividida e anotação aleatória (OB12, D297) e o cofre do Obsidian (OB13, D298). Em 02/11: app para relógio Wear OS, companheiro do Modo Treino (X3, D287; falta conferir a ligação no relógio do dono, junto do teste em aparelho). Em 01/11: decisões do V11 respondidas (V11-1 a V11-5, D285) e links e backlinks do V11 (OB1, OB2, D286). Em 31/10: treino na tela de bloqueio com módulo nativo do Android (X2, D284). Em 28/10: produção na v2026.10.28 (https://questlist.wavdev.org; APK e AAB código 391), com as correções CD31 a CD33. Em 27/10: plano do aluno definido pelo treinador (AC13.2, D282). Em 26/10: Treinar com… em qualquer treino (AC15A, D277), painel do treinador no Alunos (AC13, D278), treino da Academia em grupos (AC15B, D279) e Desafios estilo GymRats (AC15C, D280). Em 24/10: correções CD27 a CD29 (fundo da Hoje atrás do painel, painel dos bosses, fundo do modo escuro à escolha), ESCOPO_V11 (Obsidian) escrito, planos prontos (AC12.1), copiar e mover exercícios (AC12.3) e fotos dos exercícios (AC3.10). Em 25/10: Dieta e Vida saudável no Bem-estar (BE2, BE3, D275). Da reforma de usabilidade (22/10, `docs/PROPOSTA_UX.md`) fica para depois o teste de árvore com 5 a 8 pessoas e a medição de toques antes e depois (§8).

## Para fazer depois (pedido do dono, 20/10, noite)

**Plano de fechamento do V6:** concluído em 26/10 (o último foi o AC15C).

Fora do fechamento: AC7.4 (desligado por padrão, e o resto vai com o V7), AC12.2 (arquivos de exemplo do dono), AC14 (treinador por IA). O trabalho vai direto na `main` (alpha) e sobe para a produção pelo `npm run promover`.

## Todos os escopos

| Escopo | Id / seção | Tarefa | Situação | Depende de |
|---|---|---|---|---|
| **V1** | PUBLICACAO | Testar num Android de verdade (development build) e no iOS (TestFlight) | pendente | dono |
| V1 | PUBLICACAO | Receber push num aparelho de verdade | pendente | dono |
| V1 | PUBLICACAO | Contas das lojas e do EAS, nome e ícone, domínio | pendente | dono |
| **V2** | D10 | Aceite do offline com o celular em modo avião (op-sqlite nunca rodou num aparelho) | parcial | development build |
| **V3** | J6 | Aviso do timer com o celular bloqueado: no Moto E14 (Android Go) o app congelava com a tela desligada; corrigido com alarme exato e wakelock no descanso (CD35, D299), falta conferir no aparelho com o APK novo | parcial | APK novo, aparelho do dono |
| V3 | §6 itens B | Feitos em 04/11 (PB6 a PB9, D301 a D304). Falta conferir no Android com o APK novo: falar a lista, o Compartilhar de outros apps e o PDF/imprimir; no iPhone, ficam para o build de iOS (o Compartilhar pede uma extensão à parte) | parcial | APK novo, aparelho do dono |
| V3 | §6 itens C | Lembrete por local, Gantt, notas colaborativas (CRDT), webhooks e API (feitos em 04/11: importar do Habitica e do Todoist, PC1; dependência entre projetos, PC2) | backlog | — |
| **V4** | T1 | Planos e assinaturas (modelo): tudo grátis por enquanto, pago no futuro com founder (V4-5) | depois | — |
| V4 | T2 | Pagamento: primeiro pelas lojas (Google Play e App Store); depois, uma plataforma aberta ou sem taxa para cartão e Pix, com assinatura anual | depois (V4-6 decidido 20/10) | contas das lojas (dono) |
| **Dono** | CD14 | Trocar o leitor da foto de uma lista (a nota já é lida pelo Tesseract, D254; lista escrita à mão o Tesseract não lê bem) | depois (pedido do dono, 20/10) | escolher o serviço |
| **V5** | §1.1 | Tela de bloqueio: conferir num celular com Android 16 QPR1 a atualização ao vivo (chip e cartão fixo, D284); iPhone com Live Activity (`expo-widgets`) | parcial | aparelho do dono, build de iOS |
| V5 | §4 | LGPD: e-mail do encarregado na política e revisão do texto por advogado (o resto foi feito, D213) | pendente | provedor de e-mail (V5-3), dono |
| V5 | §5 | E-mails: provedor, SPF/DKIM/DMARC, SMTP; modelos em 3 idiomas; preferências e descadastro | em espera (V5-3: servidor próprio, Google ou outro, ainda sem decisão) | dono |
| V5 | §6 | Restauração de conta: exclusão com carência de 30 dias (V5-4), lixeira para anotações e anexos; troca de e-mail fica com o e-mail | pendente | e-mail só para a troca |
| V5 | §8 | Login com o Google (Supabase Auth, nativo no Android/iOS) — **não fazer agora** | pendente | projeto no Google Cloud (dono) |
| **V6** | AC7.4 | Pergunta do peso do corpo no início do treino: **desligada por padrão** (liga no Perfil); importar do Health Connect / Apple Saúde fica com o V7 | pendente | AC7.3, V7 |
| V6 | AC12.2 | Importadores Strong, Hevy e FitNotes | pendente | arquivos de exemplo do dono |
| V6 | AC15D | Atividades de apps de terceiros (Strava, Health Connect, Apple Saúde) entram como mais uma origem do AC15C | pendente | V7 |
| V6 | AC14 | Treinador por IA (avaliar custo e modelos) | pendente | LGPD (V5 §4) |
| **V7** | §1–4 | Integrações com apps de treino e saúde: Strava, Health Connect (Samsung Health, Google Fit, Garmin), Apple Saúde; atividade de fora (qualquer uma, só leitura) vira registro de treino (V7-1 a V7-3) | pendente | conta de desenvolvedor do Strava, development build (dono) |
| **V6** | TR5 | Memória e lentidão do APK: as imagens do jogo já têm miniatura (D229); falta medir num aparelho se ainda engasga (outro suspeito: cache do TanStack salvo inteiro e síncrono no SQLite) | parcial | aparelho do dono |
| **V9** | GA8 | Chave do Gemini no servidor (`supabase/functions/.env`) e teste com listas de verdade (a nota não precisa mais, D254) | pendente | chave do dono |
| V9 | GA9 | Editar célula a célula, ligar lançamento a tarefa, fila de fotos sem internet, apagar a foto quando a lixeira vence | backlog | — |
| **V11** | OB15 | Publicar o Web Clipper nas lojas de extensões (Chrome Web Store, Firefox Add-ons); por enquanto, carregar o `.zip` à mão (D305) | pendente | contas do dono |

## Decisões do dono em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| V5-3 | Provedor de e-mail e domínio de envio (em espera: servidor próprio, Google ou outro) | V5 §5 |

As outras foram respondidas em 19/10 (D220, tabela no `STATUS.md`) em 20/10 (D247) e em 01/11 (V11-1 a V11-5, D285).
