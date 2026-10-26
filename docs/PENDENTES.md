# Pendentes

O que falta de todos os escopos (`ESCOPO.md` a `ESCOPO_V11.md`), numa tabela só, para ler rápido. O detalhe fica em `docs/STATUS.md`, `docs/TAREFAS_V6.md` e nos escopos; o que já foi feito, em `docs/FEITOS.md`.

**Atualize no mesmo commit da tarefa** (como o `STATUS.md`): concluída sai daqui (e entra no `FEITOS.md` pelo `npm run feitos`); parcial muda a situação.

Atualizado em 26/10/2026. Produção na v2026.10.24.2 (https://questlist.wavdev.org). Em 26/10: Treinar com… em qualquer treino (AC15A, D277) e painel do treinador no Alunos (AC13, D278). Em 24/10: correções CD27 a CD29 (fundo da Hoje atrás do painel, painel dos bosses, fundo do modo escuro à escolha), ESCOPO_V11 (Obsidian) escrito, planos prontos (AC12.1), copiar e mover exercícios (AC12.3) e fotos dos exercícios (AC3.10). Em 25/10: Dieta e Vida saudável no Bem-estar (BE2, BE3, D275). Da reforma de usabilidade (22/10, `docs/PROPOSTA_UX.md`) fica para depois o teste de árvore com 5 a 8 pessoas e a medição de toques antes e depois (§8).

## Para fazer depois (pedido do dono, 20/10, noite)

**Plano de fechamento do V6** (na ordem)

| Ordem | Id | O que | Tamanho |
|---|---|---|---|
| 7 | AC15B–C | Treino ↔ grupo nos dois sentidos e bloco Desafios estilo GymRats (decidido em 21/10, D252; **não começar sem o dono pedir**; o AC15A saiu em 26/10, D277) | médio + grande |

Fora do fechamento: AC7.4 (desligado por padrão, e o resto vai com o V7), AC12.2 (arquivos de exemplo do dono), AC14 (treinador por IA). O trabalho vai direto na `main` (alpha) e sobe para a produção pelo `npm run promover`.

## Todos os escopos

| Escopo | Id / seção | Tarefa | Situação | Depende de |
|---|---|---|---|---|
| **V1** | PUBLICACAO | Testar num Android de verdade (development build) e no iOS (TestFlight) | pendente | dono |
| V1 | PUBLICACAO | Receber push num aparelho de verdade | pendente | dono |
| V1 | PUBLICACAO | Contas das lojas e do EAS, nome e ícone, domínio | pendente | dono |
| **V2** | D10 | Aceite do offline com o celular em modo avião (op-sqlite nunca rodou num aparelho) | parcial | development build |
| **V3** | J6 | Aviso do timer com o celular bloqueado, num development build | parcial | development build |
| V3 | §6 itens B (resto) | Kits por domínio, voz e Share Target, exportação CSV/Markdown/PDF e imprimir | backlog | — |
| V3 | §6 itens C | Lembrete por local, dependências entre projetos, Gantt, notas colaborativas (CRDT), importar de Habitica/Todoist, webhooks e API | backlog | — |
| **V4** | T1 | Planos e assinaturas (modelo): tudo grátis por enquanto, pago no futuro com founder (V4-5) | depois | — |
| V4 | T2 | Pagamento: primeiro pelas lojas (Google Play e App Store); depois, uma plataforma aberta ou sem taxa para cartão e Pix, com assinatura anual | depois (V4-6 decidido 20/10) | contas das lojas (dono) |
| **Dono** | CD14 | Trocar o leitor da foto de uma lista (a nota já é lida pelo Tesseract, D254; lista escrita à mão o Tesseract não lê bem) | depois (pedido do dono, 20/10) | escolher o serviço |
| **V5** | §1.2 | App para relógio Wear OS (companheiro do celular, em Kotlin) | pendente | estimar antes |
| V5 | §1.1 | Tela de bloqueio: botões com o app encerrado e atualizações ao vivo do Android 16 | depois | — |
| V5 | §4 | LGPD: e-mail do encarregado na política e revisão do texto por advogado (o resto foi feito, D213) | pendente | provedor de e-mail (V5-3), dono |
| V5 | §5 | E-mails: provedor, SPF/DKIM/DMARC, SMTP; modelos em 3 idiomas; preferências e descadastro | em espera (V5-3: servidor próprio, Google ou outro, ainda sem decisão) | dono |
| V5 | §6 | Restauração de conta: exclusão com carência de 30 dias (V5-4), lixeira para anotações e anexos; troca de e-mail fica com o e-mail | pendente | e-mail só para a troca |
| V5 | §8 | Login com o Google (Supabase Auth, nativo no Android/iOS) — **não fazer agora** | pendente | projeto no Google Cloud (dono) |
| **V6** | AC7.4 | Pergunta do peso do corpo no início do treino: **desligada por padrão** (liga no Perfil); importar do Health Connect / Apple Saúde fica com o V7 | pendente | AC7.3, V7 |
| V6 | AC12.2 | Importadores Strong, Hevy e FitNotes | pendente | arquivos de exemplo do dono |
| V6 | AC15B | **Treino ↔ grupo nos dois sentidos**: continua criar o grupo e pôr treinos dentro; e, num treino da Academia, "Adicionar a um grupo" (um ou vários), com o treino seguindo da pessoa e cada um com o próprio diário (reaproveita a página enviada ao vivo, D133) (D252) | decidido, aguardando o dono | — |
| V6 | AC15C | **Bloco Desafios (estilo GymRats)** abaixo da Academia: o desafio é o próprio grupo (membros, mural, chat, prêmio); "+" cria, traz gente de grupos/times/amigos e gera código ou link que qualquer um usa para entrar direto (o criador remove gente e cancela ou troca o código); cada treino concluído no app (ou vindo de outro app, V7) é uma atividade; ranking configurável: dias ativos, número de atividades, minutos, pontos; os desafios atuais migram (D252). **Medir a complexidade de novo antes de começar** | decidido, aguardando o dono | — |
| V6 | AC15D | Atividades de apps de terceiros (Strava, Health Connect, Apple Saúde) entram como mais uma origem do AC15C | pendente | V7 |
| V6 | AC13.2 | Treinador define a regra de progressão e a carga inicial de cada aluno ("definido pelo treinador"; o painel saiu em 26/10, D278) | pendente | — |
| V6 | AC14 | Treinador por IA (avaliar custo e modelos) | pendente | LGPD (V5 §4) |
| **V7** | §1–4 | Integrações com apps de treino e saúde: Strava, Health Connect (Samsung Health, Google Fit, Garmin), Apple Saúde; atividade de fora (qualquer uma, só leitura) vira registro de treino (V7-1 a V7-3) | pendente | conta de desenvolvedor do Strava, development build (dono) |
| **V6** | TR5 | Memória e lentidão do APK: as imagens do jogo já têm miniatura (D229); falta medir num aparelho se ainda engasga (outro suspeito: cache do TanStack salvo inteiro e síncrono no SQLite) | parcial | aparelho do dono |
| **V9** | GA8 | Chave do Gemini no servidor (`supabase/functions/.env`) e teste com listas de verdade (a nota não precisa mais, D254) | pendente | chave do dono |
| V9 | GA9 | Editar célula a célula, ligar lançamento a tarefa, fila de fotos sem internet, apagar a foto quando a lixeira vence | backlog | — |
| **V11** | OB1–OB15 | Funções do Obsidian nas anotações e tarefas: links `[[...]]` e backlinks, propriedades e etiquetas, nota do dia, consultas e Bases, grafo, canvas, callouts e incorporar, versões, importar/exportar cofre, publicar (`ESCOPO_V11.md` §10) | pendente | V11-1 (por onde começar) |

## Decisões do dono em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| V5-3 | Provedor de e-mail e domínio de envio (em espera: servidor próprio, Google ou outro) | V5 §5 |
| V11-1 a V11-5 | Por onde começar o V11, propriedades × campos, compartilhar antes do CRDT, publicação aberta, versões no espaço (`ESCOPO_V11.md` §11) | V11 |

As outras foram respondidas em 19/10 (D220, tabela no `STATUS.md`) e em 20/10 (D247).
