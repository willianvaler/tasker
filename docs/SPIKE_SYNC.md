# Spike de sync (A7) — PowerSync × protocolo próprio

ESCOPO_V2 §2.2 pede avaliar primeiro uma engine pronta e só cair para protocolo próprio se nenhuma servir. Esta é a **parte 1 (pesquisa, 13/10/2026)**. A parte 2 é um protótipo descartável numa branch, feito depois que a direção for aprovada.

## Critérios (V2 §2.2)

Web + nativo no mesmo código (aqui: Expo, não Capacitor, D71) · permissões por time/projeto · custo e self-host · maturidade · não reescrever a autoridade do servidor (XP, bosses, convites).

## Candidatos

| | PowerSync | ElectricSQL | Zero (Rocicorp) | Protocolo próprio (V2 §2.4) |
|---|---|---|---|---|
| Expo / React Native | SDK oficial, inclusive react-native-web | Sem SDK móvel maduro | Foco em web | O que escrevermos |
| Banco local | SQLite (op-sqlite no nativo; OPFS/IndexedDB na web; sql.js no Expo Go) | PGlite (+3,7 MB) | Cache próprio | `expo-sqlite` + WASM/IndexedDB |
| Leitura | Postgres → réplica lógica → "Sync Streams" filtrados por usuário | "Shapes" | Consultas sincronizadas | `sync/pull` por cursor |
| Escrita offline | Fila local; **nós** enviamos cada operação ao backend (`uploadData`) | Por nossa conta | Fontes divergem | Outbox + `sync/push` |
| Self-host | Open Edition gratuita (source-available), em Docker | Sim | Sim | — |
| Nuvem | Free (2 GB/mês, 50 clientes simultâneos, pausa por inatividade); Pro a partir de US$ 49/mês | — | — | — |
| Maturidade | A mais citada como pronta para produção com Postgres e celular | Mudanças grandes entre versões | Nova | Nenhuma: tudo a construir e testar |

## Por que PowerSync encaixa aqui

1. **A autoridade do servidor continua igual.** A escrita sai da fila local e cada operação é enviada pelo nosso código (`uploadData`). Ela pode chamar as mesmas RPCs de hoje (`create_tasks_batch`, `complete_task`, `habit_tick`...). XP, dano, anti-farm, RLS e privilégio por coluna não mudam; o servidor recusa o que não pode, e a operação recusada é desfeita localmente (V2 §2.4.4).
2. **Leitura por permissão** com Sync Streams: cada usuário recebe só as pastas/projetos de que é membro (`folder_members`). Perder o acesso tira os dados do aparelho (V2 §2.4, revogação), sem código nosso.
3. **Um código para web e celular**, que é o caso do Expo.
4. **Custo:** nuvem grátis para desenvolver e testar; para publicar, Open Edition em Docker junto do Supabase (grátis, sem painel nem suporte) ou o plano Pro.

## O que muda no app (estimativa para a Fase D)

- Telas leem do SQLite local (consultas SQL com `watch`), no lugar das consultas do TanStack Query ao Supabase. Isso toca todos os arquivos de `src/lib/queries/`.
- A fila offline atual (D52) é substituída pela fila do PowerSync, que vale para todas as tabelas, e não só para tarefas.
- **Native:** `@op-engineering/op-sqlite` exige development build (o projeto já tem `expo-dev-client`); no Expo Go, adaptador sql.js mais lento.
- O banco ganha publicação de réplica lógica e o serviço PowerSync (container) no `db:start`.
- **Conflitos:** a fila manda operações na ordem; o banco aplica. O "última escrita vence por campo" sai naturalmente de mandar só os campos alterados (PATCH). Conclusão como evento já existe (`task_completions`).
- Colunas `deleted_at` / `version` / UUID v7 (D1 do cronograma) continuam necessárias para tombstones e lixeira.

Estimativa: com PowerSync, a Fase D cai de ~8 para ~6 dias. Com protocolo próprio, passa de 8 (outbox, pull paginado, cursor, revogação, idempotência e testes de convergência, tudo à mão).

## Riscos e o que o protótipo precisa provar

1. **Web via react-native-web:** os docs listam como suportado, mas há relato recente de projeto tratando como beta. O protótipo precisa rodar na web exportada (o E2E roda lá).
2. **op-sqlite no Expo SDK 57 / RN 0.86** (development build).
3. **Sync Streams com a regra de pasta raiz** (`folder_root`): a permissão precisa caber na linguagem de regras do PowerSync, que não executa funções do Postgres. Pode exigir desnormalizar a raiz (`root_folder_id`) nas tabelas.
4. **RPCs na fila:** operações que não são "linha de tabela" (concluir, habit_tick) precisam ir pela fila como chamadas de função. O PowerSync só enfileira escritas em tabelas locais; o caminho é uma tabela local de "comandos" que o `uploadData` traduz em RPC.

## Recomendação

**PowerSync**, desenvolvendo com o serviço Open Edition em container local (Podman), como o Supabase. A decisão sobre nuvem ou self-host na publicação fica para a D7 (decisão em aberto V2-5).

**Parte 2 (protótipo, ~1 dia, branch `spike/powersync`, não vai para a main):** subir o PowerSync local ligado ao Supabase local; sincronizar `folders`/`pages`/`tasks` com regra por membro; uma tela lendo do SQLite local na web e num development build; criar tarefa offline indo pela fila até a RPC; tirar um membro do projeto e ver os dados sumirem. O resultado (funcionou / não funcionou e por quê) entra aqui e na decisão do `DECISIONS.md`.

## Resultado do protótipo (14/10/2026, D0)

1. **Web:** funciona na web exportada, inclusive pelo túnel (`/powersync` repassado pelo `scripts/serve.mjs`). Precisou copiar os workers para `public/@powersync`.
2. **op-sqlite:** instalado (v18) e com tipos ok; não testado em aparelho.
3. **Pasta raiz:** coube nas regras sem desnormalizar, com duas consultas por tabela (raiz e subpastas).
4. **RPCs na fila:** o `uploadData` traduz a operação de tabela (`status` → `complete_task`) e há a tabela local `commands` para o resto.

Detalhes e escolhas na D82.

## Fontes

- [PowerSync — React Native & Expo SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo)
- [PowerSync — plataformas suportadas](https://docs.powersync.com/resources/supported-platforms)
- [PowerSync — preços e Open Edition](https://www.powersync.com/pricing)
- [Expo blog — What synced in-app SQLite brings to Expo apps](https://expo.dev/blog/what-synced-in-app-sqlite-brings-to-expo-apps)
- [Supabase — integração PowerSync](https://supabase.com/partners/integrations/powersync)
- [Relato de web em beta (hisaab #14)](https://github.com/khanate-dev/hisaab/issues/14)
- [Comparativo Electric × PowerSync × Zero (Kanopy Labs, 2026)](https://kanopylabs.com/blog/electric-sql-vs-powersync-vs-livestore-local-first)
