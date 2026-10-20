# Pendentes

O que falta de todos os escopos (`ESCOPO.md` a `ESCOPO_V10.md`), numa tabela só, para ler rápido. O detalhe fica em `docs/STATUS.md`, `docs/TAREFAS_V6.md` e nos escopos; o que já foi feito, em `docs/FEITOS.md`.

**Atualize no mesmo commit da tarefa** (como o `STATUS.md`): concluída sai daqui (e entra no `FEITOS.md` pelo `npm run feitos`); parcial muda a situação.

Atualizado em 20/10/2026 (produção v2026.10.18). ESCOPO_V8 (modo jogo) concluído em 19/10; correções do Modo Treino (TR1–TR4) e ESCOPO_V9 (gastos e leitura de foto, GA1–GA7) em 19/10; itens B do V3 que subiram de prioridade (PB1 a PB5) em 20/10; ESCOPO_V10 (amigos, visibilidade, comunidade) em 20/10, falta o bloco Bem-estar.

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
| V4 | T2 | Provedor de pagamento | depois (V4-6) | contas do dono |
| **V5** | §1.2 | App para relógio Wear OS (companheiro do celular, em Kotlin) | pendente | estimar antes |
| V5 | §1.1 | Tela de bloqueio: botões com o app encerrado e atualizações ao vivo do Android 16 | depois | — |
| V5 | §4 | LGPD: e-mail do encarregado na política e revisão do texto por advogado (o resto foi feito, D213) | pendente | provedor de e-mail (V5-3), dono |
| V5 | §5 | E-mails: provedor, SPF/DKIM/DMARC, SMTP; modelos em 3 idiomas; preferências e descadastro | inativo (V5-3) | dono reativar |
| V5 | §6 | Restauração de conta: exclusão com carência de 30 dias (V5-4), lixeira para anotações e anexos; troca de e-mail fica com o e-mail | pendente | e-mail só para a troca |
| V5 | §8 | Login com o Google (Supabase Auth, nativo no Android/iOS) — **não fazer agora** | pendente | projeto no Google Cloud (dono) |
| **V6** | AC4.1–4.6 | Registro por série: unidades, RIR/RPE, `workout_sets` + `log_set`, `SetRow`, Modo Treino, histórico | pendente | AC3.6 |
| V6 | AC5.1–5.4 | Recordes e 1RM (aviso, crítico no boss, gráfico, calculadora) | pendente | AC4 |
| V6 | AC6.1–6.3 | Progressão automática (linear, dupla, Greyskull, deload, "por quê") | pendente | AC4.3 |
| V6 | AC7.1–7.3 | Peso e medidas (dado sensível, consentimento) | pendente | — |
| V6 | AC8.1–8.5 | Estatísticas: mapa de calor, mapa muscular, volume | pendente | AC4.3 |
| V6 | AC9.1–9.5 | Anilhas, aquecimento, supersets, plano da semana e lembrete | pendente | AC4.5, AC1.6 |
| V6 | AC11 | Conquistas de academia e recorde crítico; prêmio (conquista e item) para os primeiros do desafio | pendente | AC5.3 |
| V6 | AC12.1–12.2 | Planos prontos e importadores (Strong, Hevy, FitNotes) | pendente | arquivos de exemplo do dono |
| V6 | AC13 | Painel do treinador (recordes, 1RM, estagnação) | pendente | AC5.2, AC6.3 |
| V6 | AC14 | Treinador por IA (avaliar custo e modelos) | pendente | LGPD (V5 §4) |
| **V7** | §1–4 | Integrações com apps de treino e saúde: Strava, Health Connect (Samsung Health, Google Fit, Garmin), Apple Saúde; atividade de fora (qualquer uma, só leitura) vira registro de treino (V7-1 a V7-3) | pendente | conta de desenvolvedor do Strava, development build (dono) |
| **V6** | TR5 | Memória e lentidão do APK: as imagens do jogo já têm miniatura (D229); falta medir num aparelho se ainda engasga (outro suspeito: cache do TanStack salvo inteiro e síncrono no SQLite) | parcial | aparelho do dono |
| **V9** | GA8 | Chave do Gemini no servidor (`supabase/functions/.env`) e teste com notas de verdade | pendente | chave do dono |
| V9 | GA9 | Editar célula a célula, ligar lançamento a tarefa, fila de fotos sem internet, apagar a foto quando a lixeira vence | backlog | — |
| **V10** | BE1–BE3 | Bloco Bem-estar (treino, dieta, vida saudável) | pendente | nome do bloco (V10-1) |

## Decisões do dono em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| V4-6 | Provedor de pagamento e compras nas lojas (decidir depois) | T2 |
| V5-3 | Provedor de e-mail e domínio de envio (inativo por enquanto) | V5 §5 |
| V10-1 | Nome do bloco de treino, dieta e vida saudável (padrão: Bem-estar) | BE1 |
| V10-2 a V10-5 | Amigo direto no grupo, tarefa pública fora do login, visibilidade em projeto, moderação (`ESCOPO_V10.md` §7) | seguem o padrão até a resposta |

As outras foram respondidas em 19/10 (D220, tabela no `STATUS.md`).
