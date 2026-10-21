# Pendentes

O que falta de todos os escopos (`ESCOPO.md` a `ESCOPO_V10.md`), numa tabela só, para ler rápido. O detalhe fica em `docs/STATUS.md`, `docs/TAREFAS_V6.md` e nos escopos; o que já foi feito, em `docs/FEITOS.md`.

**Atualize no mesmo commit da tarefa** (como o `STATUS.md`): concluída sai daqui (e entra no `FEITOS.md` pelo `npm run feitos`); parcial muda a situação.

Atualizado em 20/10/2026 (produção v2026.10.18). ESCOPO_V8 (modo jogo) concluído em 19/10; correções do Modo Treino (TR1–TR4) e ESCOPO_V9 (gastos e leitura de foto, GA1–GA7) em 19/10; itens B do V3 que subiram de prioridade (PB1 a PB5) em 20/10; ESCOPO_V10 (amigos, visibilidade, comunidade) em 20/10, falta o bloco Bem-estar.

## Para fazer depois (pedido do dono, 20/10, noite)

**Plano de fechamento do V6** (na ordem)

| Ordem | Id | O que | Tamanho |
|---|---|---|---|
| 2 | AC8.6 | Mapa muscular no resumo do fim e enquanto o treino é montado | pequeno |
| 3 | AC11 | Prêmio (conquista e item) para os primeiros do desafio | pequeno |
| 4 | AC12.1 + AC12.3 | Planos prontos e levar exercícios para outro treino | médio |
| 5 | AC3.10 | Fotos do free-exercise-db (cerca de 1.750, com miniatura, servidas por nós) | médio |
| 6 | AC13 | Painel do treinador (recordes, 1RM, estagnação) | médio |
| 7 | AC15 | Grupo de treino: proposta "Treinar com…" em qualquer treino, sem pasta de grupo à parte (confirmar com o dono antes) | depende da proposta |

Fora do fechamento: AC7.4 (desligado por padrão, e o resto vai com o V7), AC12.2 (arquivos de exemplo do dono), AC14 (treinador por IA). Depois do fechamento: levar a `dev` para a `main` (alpha) para o dono testar; a política nova pede o aceite de todos de novo.

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
| **Dono** | CD14 | Trocar o leitor de foto (OCR) das notas fiscais e listas | depois (pedido do dono, 20/10) | escolher o serviço |
| **V5** | §1.2 | App para relógio Wear OS (companheiro do celular, em Kotlin) | pendente | estimar antes |
| V5 | §1.1 | Tela de bloqueio: botões com o app encerrado e atualizações ao vivo do Android 16 | depois | — |
| V5 | §4 | LGPD: e-mail do encarregado na política e revisão do texto por advogado (o resto foi feito, D213) | pendente | provedor de e-mail (V5-3), dono |
| V5 | §5 | E-mails: provedor, SPF/DKIM/DMARC, SMTP; modelos em 3 idiomas; preferências e descadastro | em espera (V5-3: servidor próprio, Google ou outro, ainda sem decisão) | dono |
| V5 | §6 | Restauração de conta: exclusão com carência de 30 dias (V5-4), lixeira para anotações e anexos; troca de e-mail fica com o e-mail | pendente | e-mail só para a troca |
| V5 | §8 | Login com o Google (Supabase Auth, nativo no Android/iOS) — **não fazer agora** | pendente | projeto no Google Cloud (dono) |
| **V6** | AC3.10 | Fotos do free-exercise-db (Unlicense, 876 exercícios × 2 fotos, início e fim) na ficha, no painel e no Modo Treino, alternando as duas como animação; servidas por nós, com miniatura | pendente | — |
| V6 | AC7.4 | Pergunta do peso do corpo no início do treino: **desligada por padrão** (liga no Perfil); importar do Health Connect / Apple Saúde fica com o V7 | pendente | AC7.3, V7 |
| V6 | AC8.6 | Mapa muscular enquanto o treino é montado e no resumo do fim do treino | pendente | AC8.4 |
| V6 | AC11 | Conquistas de academia e recorde crítico; prêmio (conquista e item) para os primeiros do desafio | pendente | AC5.3 |
| V6 | AC12.1 | Planos prontos: iniciante corpo inteiro 3×, ABC, ABCD, superior/inferior 4×, push/pull/legs, 5×5 e Greyskull, em casa sem equipamento (exercícios ligados, dias, progressão) | pendente | — |
| V6 | AC12.3 | Levar exercícios para outra página de treino com facilidade (copiar ou mover um ou vários, arrastar entre treinos) | pendente | — |
| V6 | AC12.2 | Importadores Strong, Hevy e FitNotes | pendente | arquivos de exemplo do dono |
| V6 | AC15 | Rever o grupo de treino: hoje é uma pasta que tem treinos dentro, mas não dá para chamar gente a partir de um treino; achar um jeito único e simples (proposta antes de mudar) | pendente | proposta para o dono |
| V6 | AC13 | Painel do treinador (recordes, 1RM, estagnação) | pendente | AC5.2, AC6.3 |
| V6 | AC14 | Treinador por IA (avaliar custo e modelos) | pendente | LGPD (V5 §4) |
| **V7** | §1–4 | Integrações com apps de treino e saúde: Strava, Health Connect (Samsung Health, Google Fit, Garmin), Apple Saúde; atividade de fora (qualquer uma, só leitura) vira registro de treino (V7-1 a V7-3) | pendente | conta de desenvolvedor do Strava, development build (dono) |
| **V6** | TR5 | Memória e lentidão do APK: as imagens do jogo já têm miniatura (D229); falta medir num aparelho se ainda engasga (outro suspeito: cache do TanStack salvo inteiro e síncrono no SQLite) | parcial | aparelho do dono |
| **V9** | GA8 | Chave do Gemini no servidor (`supabase/functions/.env`) e teste com notas de verdade | pendente | chave do dono |
| V9 | GA9 | Editar célula a célula, ligar lançamento a tarefa, fila de fotos sem internet, apagar a foto quando a lixeira vence | backlog | — |
| **V10** | BE1–BE3 | Bloco **Bem-estar** (treino, dieta, vida saudável) | pendente | — (nome decidido em 20/10) |

## Decisões do dono em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| V5-3 | Provedor de e-mail e domínio de envio (em espera: servidor próprio, Google ou outro) | V5 §5 |
| AC15 | Como deve funcionar o grupo de treino | proposta |

As outras foram respondidas em 19/10 (D220, tabela no `STATUS.md`) e em 20/10 (D247).
