# Pendentes

O que falta de todos os escopos (`ESCOPO.md` a `ESCOPO_V8.md`), numa tabela só, para ler rápido. O detalhe fica em `docs/STATUS.md`, `docs/TAREFAS_V6.md` e nos escopos; o que já foi feito, em `docs/FEITOS.md`.

**Atualize no mesmo commit da tarefa** (como o `STATUS.md`): concluída sai daqui (e entra no `FEITOS.md` pelo `npm run feitos`); parcial muda a situação.

Atualizado em 19/10/2026 (produção v2026.10.18). ESCOPO_V8 (modo jogo) concluído em 19/10.

| Escopo | Id / seção | Tarefa | Situação | Depende de |
|---|---|---|---|---|
| **V1** | PUBLICACAO | Testar num Android de verdade (development build) e no iOS (TestFlight) | pendente | dono |
| V1 | PUBLICACAO | Receber push num aparelho de verdade | pendente | dono |
| V1 | PUBLICACAO | Contas das lojas e do EAS, nome e ícone, domínio | pendente | dono |
| **V2** | B3 | Aprovar os mockups (revisão nas capturas) | em andamento | dono |
| V2 | D10 | Aceite do offline com o celular em modo avião (op-sqlite nunca rodou num aparelho) | parcial | development build |
| **V3** | J6 | Aviso do timer com o celular bloqueado, num development build | parcial | development build |
| V3 | §6 itens B | Custos e orçamento (com racha de contas), lista de compras gerada, kits por domínio, revisão semanal, Eisenhower, reações, recompensas personalizadas, voz e Share Target, exportação CSV/Markdown/PDF e imprimir (o feed .ics saiu no C1) | backlog | decisão V3-6 |
| V3 | §6 itens C | Lembrete por local, captura por foto (OCR), dependências entre projetos, Gantt, notas colaborativas (CRDT), importar de Habitica/Todoist, webhooks e API | backlog | — |
| **V4** | T1 | Planos e assinaturas (modelo) | pendente | V4-5 |
| V4 | T2 | Provedor de pagamento | **bloqueado** | V4-6, contas do dono |
| **V5** | §1.2 | App para relógio Wear OS (companheiro do celular, em Kotlin) | pendente | estimar antes |
| V5 | §1.1 | Tela de bloqueio: botões com o app encerrado e atualizações ao vivo do Android 16 | depois | — |
| V5 | §2 | Usabilidade: medir toques e tempo, teste com 3 a 5 pessoas | parcial | dono |
| V5 | §4 | LGPD: termos de uso, registro do consentimento, contato do DPO, retenção, pedidos do titular, plano de incidente, terceiros, idade mínima | pendente | — |
| V5 | §5 | E-mails: provedor, SPF/DKIM/DMARC, SMTP; modelos em 3 idiomas; preferências e descadastro | **bloqueado** | provedor (dono) |
| V5 | §6 | Restauração de conta: exclusão com carência de 30 dias, troca de e-mail, lixeira para anotações e anexos | pendente | carência (dono), e-mail |
| V5 | §8 | Login com o Google (Supabase Auth, nativo no Android/iOS) — **não fazer agora** | pendente | projeto no Google Cloud (dono) |
| **V6** | AC2.1–2.2 | Criar exercício sem ruído (campos da página de treino) | pendente | AC1.5 |
| V6 | AC3.1–3.9 | Biblioteca de exercícios: montar a base, traduzir, busca e filtros, tabelas, RLS e sync, tela, `exercise_id`, `NOTICE.md` | pendente | AC3.3 roda na máquina do dono |
| V6 | AC4.1–4.6 | Registro por série: unidades, RIR/RPE, `workout_sets` + `log_set`, `SetRow`, Modo Treino, histórico | pendente | AC3.6 |
| V6 | AC5.1–5.4 | Recordes e 1RM (aviso, crítico no boss, gráfico, calculadora) | pendente | AC4 |
| V6 | AC6.1–6.3 | Progressão automática (linear, dupla, Greyskull, deload, "por quê") | pendente | AC4.3 |
| V6 | AC7.1–7.3 | Peso e medidas (dado sensível, consentimento) | pendente | — |
| V6 | AC8.1–8.5 | Estatísticas: mapa de calor, mapa muscular, volume | pendente | AC4.3 |
| V6 | AC9.1–9.5 | Anilhas, aquecimento, supersets, plano da semana e lembrete | pendente | AC4.5, AC1.6 |
| V6 | AC11 | Conquistas de academia e recorde crítico; prêmio (conquista e item) para os primeiros do desafio | pendente | AC5.3 |
| V6 | AC12.1–12.2 | Planos prontos e importadores (Strong, Hevy, FitNotes) | pendente | arquivos de exemplo do dono |
| V6 | AC13 | Painel do treinador (recordes, 1RM, estagnação) | pendente | AC5.2, AC6.3 |
| V6 | AC14 | Treinador por IA (avaliar custo e modelos) | pendente | LGPD (V5 §4) |
| **V7** | §1–4 | Integrações com apps de treino e saúde: Strava, Health Connect (Samsung Health, Google Fit, Garmin), Apple Saúde; atividade de fora conta como dia de treino | pendente | conta de desenvolvedor do Strava, development build (dono) |

## Decisões do dono em aberto

| # | Pergunta | Bloqueia |
|---|---|---|
| V2-4 | Tipografia e acento final | B3 |
| V3-6 | Quais itens B do V3 sobem de prioridade | V3 §6 |
| V4-5 | Planos: o que cada um libera, preços, founder | T1 |
| V4-6 | Provedor de pagamento e compras nas lojas | T2 |
| V5-3 | Provedor de e-mail e domínio de envio | V5 §5, §6 |
| V5-4 | Carência da exclusão de conta (proposta: 30 dias) | V5 §6 |
| V7-1 | Conta de desenvolvedor no Strava (nome do app, domínio de retorno do OAuth) | V7 §2 |
| V7-2 | Escrever no Health Connect/Strava por padrão ou só ler | V7 §2 |
| V7-3 | Quais atividades contam como treino (corrida, caminhada, bike, musculação, todas) | V7 §2 |
