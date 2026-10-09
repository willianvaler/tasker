# Publicação

Passo a passo para colocar o Questlist no ar: Supabase na nuvem, web, Android e iOS. O código já está pronto para isso (Fase 6); o que falta são contas, chaves e escolhas que só o dono do projeto pode fazer. Elas estão marcadas com **[você]**.

## 0. Antes de tudo

- **[você] Nome e ícone finais** (pergunta 6 do ESCOPO). Hoje o ícone e a splash são os do template do Expo (`assets/images`). Troque antes da primeira publicação.
- **[você] Identificador do app**: está `com.willianvaler.questlist` em `app.json` (`ios.bundleIdentifier` e `android.package`). Depois do primeiro envio às lojas **não muda mais**; troque agora se quiser outro.
- **[você] Contas**: Google Play Console (US$ 25, uma vez) e Apple Developer (US$ 99 por ano). Conta gratuita no [expo.dev](https://expo.dev) para o EAS.

## 1. Supabase na nuvem

1. Crie o projeto em [supabase.com](https://supabase.com) (região São Paulo, `sa-east-1`).
2. Ligue o CLI ao projeto e aplique as migrações:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push
   ```
3. **Auth** (painel → Authentication):
   - Site URL: o endereço da web (passo 2). Redirect URLs: o mesmo e `questlist://`.
   - Ligue a confirmação de e-mail e configure um SMTP próprio (o do Supabase tem limite baixo).
   - Login com Google (ESCOPO, Fase 0) ainda não foi implementado.
4. **pg_cron**: as migrações já agendam `refresh_cycles` (15 min) e a fuga dos bosses (de hora em hora). Confira em Database → Cron.
5. **Push** (D58):
   ```bash
   npx supabase functions deploy push
   npx supabase secrets set PUSH_WEBHOOK_SECRET=<um segredo forte>
   ```
   E no SQL Editor:
   ```sql
   insert into public.app_config values
     ('push_url', 'https://<ref-do-projeto>.supabase.co/functions/v1/push'),
     ('push_secret', '<o mesmo segredo>');
   ```

## 2. Web

1. `.env` de produção com a URL e a chave **publishable** do projeto na nuvem (nunca a secret):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   EXPO_PUBLIC_WEB_URL=https://<seu-domínio>
   ```
2. `npm run export:web` gera a pasta `dist/`.
3. Hospede como SPA: qualquer caminho (`/inbox`, `/invite/...`, `/privacidade`) devolve o `index.html` (D23).
   - EAS Hosting: `npx eas-cli@latest deploy` (já entende SPA).
   - Vercel/Netlify: regra de rewrite de `/*` para `/index.html`.
4. A política de privacidade fica em `https://<seu-domínio>/privacidade`. Use esse endereço nas lojas.

## 3. Android e iOS (EAS)

1. `npx eas-cli@latest login` e `npx eas-cli@latest init`. O `init` grava o `projectId` em `app.json` (`extra.eas.projectId`), que o push precisa.
2. Variáveis de ambiente dos builds (as mesmas do passo 2.1): `npx eas-cli@latest env:create` para cada uma, no ambiente `production` (e `preview`, se quiser).
3. Builds (perfis em `eas.json`):
   - `development`: app de desenvolvimento, com o `expo-dev-client`. É o que permite testar **push** (o Expo Go não recebe push no Android) e ver o app com o Supabase local.
     ```bash
     npx eas-cli@latest build --profile development --platform android
     ```
   - `preview`: APK para instalar direto no Android e testar com outras pessoas.
   - `production`: o que vai para as lojas (`autoIncrement` cuida do número da versão).
4. Envio:
   ```bash
   npx eas-cli@latest build --profile production --platform all
   npx eas-cli@latest submit --profile production --platform android   # trilha "internal" primeiro
   npx eas-cli@latest submit --profile production --platform ios       # vai para o TestFlight
   ```
5. Atualizações só de JavaScript, sem passar pela loja: `npx eas-cli@latest update --channel production`.

## 4. Links de convite abrindo o app (universal links / app links)

Hoje o link de convite é sempre da web (`https://<domínio>/invite/<token>`), que funciona sem o app. Para ele abrir o app instalado:

- iOS: `ios.associatedDomains: ["applinks:<domínio>"]` em `app.json` e o arquivo `/.well-known/apple-app-site-association` no site.
- Android: `android.intentFilters` com `autoVerify` para o domínio e o `/.well-known/assetlinks.json` com a impressão digital do certificado (o EAS mostra: `npx eas-cli@latest credentials`).
- Depende do domínio definitivo **[você]**.

## 5. Ficha nas lojas

**Nome**: Questlist (provisório).

**Descrição curta** (80 caracteres): Tarefas, projetos com a galera e um boss semanal para derrotar.

**Descrição longa**:

> Anote tarefas em 2 segundos: digite e aperte Enter. "Comprar pão amanhã !!" já vira tarefa com data e prioridade. Cole uma lista inteira e ela vira várias tarefas de uma vez.
>
> Organize em pastas e páginas do seu jeito: listas, cards grandes para marcar o treino na academia, hábitos com sequência e calendário, ou um quadro kanban.
>
> Faça junto: compartilhe um projeto por link (o churrasco, a viagem, a mudança), atribua tarefas com @nome mesmo antes da pessoa entrar e veja o progresso de todo mundo em tempo real.
>
> Ganhe XP fazendo: suba de nível, mantenha a sequência e enfrente o boss da semana, sozinho, com o clã ou com o projeto. Sem punição: tarefa esquecida não tira nada. Não curte? Desligue a gamificação.
>
> Funciona sem internet para criar e marcar tarefas. Seus dados são seus: exporte ou exclua quando quiser.

**Categoria**: Produtividade. **Classificação**: livre. **Anúncios**: não.

**Segurança dos dados (Google Play) / Privacidade (App Store)**:

| Dado                                       | Coletado                | Compartilhado                                      | Para quê             |
| ------------------------------------------ | ----------------------- | -------------------------------------------------- | -------------------- |
| Nome e e-mail                              | Sim                     | Não (só membros dos seus projetos/clã veem o nome) | Conta                |
| Conteúdo do usuário (tarefas, comentários) | Sim                     | Não                                                | Funcionamento do app |
| Identificador do aparelho (token de push)  | Sim, se ligar os avisos | Não (vai para o serviço de push da Expo)           | Notificações         |
| Localização, contatos, fotos               | Não                     |                                                    |                      |

Criptografia em trânsito: sim (HTTPS). Exclusão de conta: sim, no app (Perfil → Excluir minha conta). Rastreamento entre apps: não.

## 6. Checklist da Definição de pronto (ESCOPO 13)

- [x] Web testada em 390 px e 1280 px (Playwright, perfis celular e desktop)
- [x] Bundle Android compila (`npx expo export --platform android`)
- [ ] **[você]** Testado num Android de verdade (development build) e no iOS (TestFlight)
- [ ] **[você]** Push recebido num aparelho de verdade
