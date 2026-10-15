# Questlist — Escopo V5 (instruções para o Claude Code)

Este documento **complementa** `ESCOPO.md`, `ESCOPO_V2.md`, `ESCOPO_V3.md` e `ESCOPO_V4.md`. Onde houver conflito, **o mais recente vence** (V5 > V4 > V3 > V2 > V1). O que ainda falta do V4 (fases P a T: conquistas, inventário, renascer, página de entrada, planos) continua valendo e vem antes, salvo pedido do dono.

Antes de começar: releia `CLAUDE.md`, `DECISIONS.md` e `docs/STATUS.md`. Ao concluir cada item, atualize `docs/STATUS.md`; decisões novas vão em `DECISIONS.md`. Texto novo nasce nos 3 idiomas; um commit por tarefa.

Origem: anotações do dono em 15/10/2026, depois de usar o app num treino na academia ("uma coisa que nos incomodou foi ter que destravar o celular pra dar sequência no treino").

---

## 1. Treino sem destravar o celular

### 1.1 Tela de bloqueio (Android 14 para cima)

- Durante o Modo Treino e o descanso, uma **notificação contínua** na tela de bloqueio mostra o exercício, a série ("Supino · série 2 de 4") e o tempo de descanso correndo, com **ações** que funcionam sem destravar: **Feita**, **Pular descanso**, **+30 s**.
- Requisito: **Android 14 (API 34) para cima**. Em versões mais novas, usar os recursos de atualização ao vivo do sistema quando existirem (Android 16: "Live Updates"/notificações de progresso), com a notificação comum como reserva.
- Técnica (a confirmar na doc da versão do Expo instalada): notificação com categoria e ações (`expo-notifications`), visibilidade pública na tela de bloqueio, e a ação executando sem abrir o app (tarefa em segundo plano ou serviço em primeiro plano do tipo adequado; o Android 14 exige declarar o tipo do serviço). A ação grava como as outras (`log_rep`, `update_timer`), também sem internet (fila do aparelho).
- iPhone: Live Activities ficam para quando houver build de iOS (precisa da conta do dono).
- Critério de aceite: com o celular bloqueado no bolso, terminar uma série e começar o descanso só pela notificação, e o app mostrar o mesmo estado ao destravar.

### 1.2 App para relógio (Wear OS)

- Um app para **relógio Wear OS** que segue o treino do celular: exercício e série atuais, **Feita** grande, contagem do descanso com vibração no fim, pular e +30 s.
- Primeira versão como **companheiro** do celular (Data Layer API); depois, se valer a pena, independente (fala direto com o servidor).
- Exige código nativo (Kotlin + Compose for Wear OS) fora do React Native: módulo/projeto à parte no repositório, com o próprio processo de build. Estimar antes de começar.
- Apple Watch fica para depois do iOS.

## 2. Usabilidade

- Relato: "a usabilidade em alguns momentos parece um pouco debilitada". Exemplos já corrigidos na Fase W: painel espremido, botão do Modo Treino escondido, clicar fora não fechava, nome sumindo na busca de Relacionar.
- Fazer uma **revisão de usabilidade** de verdade: percorrer as tarefas principais no celular e no computador (capturar, organizar o dia, treinar, projeto em time, hábitos) contra heurísticas (visibilidade do estado, controle e saída, consistência, prevenção de erro, reconhecimento em vez de memória), anotar cada atrito com captura e prioridade, e corrigir em lotes pequenos.
- Medir: tempo e número de toques das tarefas principais antes e depois.
- Testar com 3 a 5 pessoas usando o app de verdade (o dono e quem treina com ele), observando sem ajudar.

## 3. Segurança: HTTPS e certificados

- **Avaliação (15/10/2026):** o endereço público passa pela Cloudflare (túnel `cloudflared`), com certificado Let's Encrypt renovado sozinho (válido até jan/2027), TLS 1.3, HTTP/2 e HTTP/3; TLS 1.1 é recusado. Do túnel até o servidor, o tráfego vai cifrado pelo próprio túnel.
- **Problemas achados:** `http://` respondia sem mandar para `https://`; faltavam HSTS e cabeçalhos de segurança. Corrigidos no servidor do app (W9). No painel da Cloudflare, o dono deve ligar também "Always Use HTTPS" e "TLS mínimo 1.2".
- **A fazer:** política de conteúdo (CSP) para a web (o Expo usa estilos embutidos: começar em modo só relatório); revisar CORS do `/supabase`; quando sair desta máquina para produção, Supabase e PowerSync em servidores com TLS próprio, segredos fora do código e backups cifrados.

## 4. LGPD

- **Já existe:** política de privacidade pública, exportar os dados (JSON/CSV) e excluir a conta.
- **Falta:** termos de uso; registro do consentimento (versão aceita e data) no cadastro; contato do encarregado de dados (DPO) na política; política de retenção explicada (lixeira 30 dias, backups, registros); atender pedidos do titular (acesso, correção, portabilidade, eliminação) com prazo; plano para incidente (avisar a ANPD e os titulares); revisar o que vai para terceiros (Cloudflare, provedor de e-mail, lojas) e transferência internacional; idade mínima.
- E-mails de marketing ou resumo só com opção de desligar (ver item 5).

## 5. E-mails

- Hoje o servidor não manda e-mail de verdade: o Supabase local entrega no Mailpit, só nesta máquina. "Esqueci minha senha" (W1) já está pronto e passa a funcionar assim que houver envio.
- **Configurar o envio:** provedor de e-mail transacional (ex.: Resend, Brevo, Amazon SES; decisão e conta do dono), domínio próprio com SPF, DKIM e DMARC, e o SMTP no Supabase (`auth.email.smtp`).
- **E-mails do app:** recuperar a senha, confirmar o e-mail no cadastro, convite de projeto/time/clã por e-mail, aviso de tarefa atribuída e menção (para quem não usa o app no celular) e um resumo diário ou semanal opcional. Modelos nos três idiomas.
- Preferências por tipo no Perfil e link de descadastro em todo e-mail que não seja de segurança (LGPD).

## 6. Restauração de conta

- Hoje "excluir a conta" apaga tudo na hora. Proposta: **exclusão com carência de 30 dias**: a conta fica desativada (ninguém vê, não entra em projetos), um e-mail avisa e entrar de novo no período **restaura** tudo; passado o prazo, apaga de vez.
- Recuperar o acesso: senha (W1, pronto), trocar o e-mail da conta com confirmação nos dois endereços, e um caminho de suporte para quem perdeu o e-mail.
- Restaurar dados apagados sem querer: a lixeira (30 dias) já cobre pastas, páginas e tarefas; estender para anotações e anexos e explicar na Ajuda.

---

## Decisões em aberto (do dono)

1. Ordem: V5 antes ou depois do resto do V4 (conquistas, inventário, renascer, página de entrada, planos)?
2. Relógio: vale começar o Wear OS agora ou primeiro a tela de bloqueio (que resolve a maior parte do incômodo)?
3. Provedor de e-mail e domínio de envio.
4. Carência da exclusão de conta (proposta: 30 dias).
