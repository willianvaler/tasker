# Plano de resposta a incidentes (LGPD)

V5 §4, D213. Incidente é qualquer acesso, perda, vazamento ou alteração de dados pessoais que não
deveria ter acontecido: banco exposto, chave ou token vazado, servidor invadido, backup perdido ou
copiado por quem não devia, bug que mostrou dados de uma pessoa para outra.

A política de privacidade promete avisar as pessoas afetadas e a ANPD **em até 3 dias úteis**
quando houver risco ou dano relevante (LGPD art. 48; Resolução CD/ANPD nº 15/2024).

## 1. Conter (na hora)

- Tire do ar o que está vazando: `systemctl --user stop tasker-tunnel` (o app sai da internet; o
  banco continua no servidor).
- Troque o que pode ter vazado: segredos do Supabase (`docs/OPERACOES.md`, "Segredos próprios"),
  token do túnel da Cloudflare, senha do servidor, chaves SSH.
- Sessões: se um token de login pode ter vazado, a troca da chave de assinatura derruba todas.

## 2. Entender (no mesmo dia)

- O que aconteceu, quando começou, quando foi contido.
- Quais dados (tabelas, campos) e de quantas pessoas. Use os logs: `journalctl --user -u
  tasker-web` (acessos recusados, CSP), logs do Supabase (`npx supabase logs` ou
  `docker logs supabase_auth_task_tracking`).
- Guarde as evidências (logs, prints) numa pasta fora do servidor.

## 3. Avisar (até 3 dias úteis)

- **ANPD:** formulário de comunicação de incidente em gov.br/anpd. Informar: descrição, dados e
  pessoas afetadas, riscos, medidas tomadas e o contato do encarregado.
- **Pessoas afetadas:** aviso no app (notificação in-app para cada conta afetada) e por e-mail
  quando houver provedor (V5 §5). Linguagem simples: o que aconteceu, quais dados, o que fazer
  (ex.: trocar a senha), como falar com o encarregado.

## 4. Registrar

Mesmo incidente sem risco relevante fica registrado (LGPD art. 48 e a Resolução 15/2024 pedem o
registro por 5 anos): data, descrição, dados, pessoas, decisão de avisar ou não e por quê, medidas.
Guarde em `docs/incidentes/AAAA-MM-DD.md` (fora do repositório público, se tiver dado pessoal).

## 5. Corrigir e revisar

Corrija a causa, teste, e escreva a decisão no `DECISIONS.md` se mudou alguma regra.

## Pedidos do titular

Os pedidos feitos no app (Perfil → Privacidade → Pedido sobre meus dados) ficam em
`public.data_requests`, com prazo de 15 dias (`due_at`). Ver os abertos e responder:

```sql
select r.id, p.display_name, r.kind, r.message, r.created_at, r.due_at
from public.data_requests r join public.profiles p on p.id = r.user_id
where r.status = 'open' order by r.due_at;

update public.data_requests
set status = 'answered', answer = 'Corrigido. ...', answered_at = now()
where id = '<id>';
```

A resposta aparece para a pessoa no Perfil.
