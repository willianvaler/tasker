# Questlist — Escopo V7: integrações com apps de treino e saúde (instruções para o Claude Code)

Pedido do dono em 18/10/2026: o treino feito fora do Questlist (corrida no Strava, caminhada no relógio, treino registrado em outro app) deve contar aqui, e o que é feito aqui pode ir para lá. Vale junto do ESCOPO_V6 (academia); em conflito, este vence.

## 1. O que entra

| Integração | Plataforma | Como | Observações |
|---|---|---|---|
| **Strava** | todas (API web) | OAuth 2 + webhooks de atividade | Precisa de app registrado no Strava (conta do dono); limite de requisições por 15 min e por dia |
| **Health Connect** (Android: Samsung Health, Google Fit, Garmin e outros escrevem nele) | Android | biblioteca nativa (`react-native-health-connect` ou módulo Expo próprio), só com development build | Ler sessões de exercício, passos e peso; escrever o treino do Questlist |
| **Samsung Health** | Android | pelo Health Connect (o SDK próprio da Samsung exige parceria) | Sincroniza com o Health Connect desde 2023 |
| **Apple Saúde (HealthKit)** | iOS | HealthKit com permissão por tipo de dado | Fica para quando o app de iOS for publicado |
| **Garmin, Polar, Fitbit** | todas | pelo Health Connect/HealthKit no aparelho; API própria só se valer a pena | Avaliar depois |

## 2. Comportamento

- **Perfil → Integrações:** conectar e desconectar cada uma, ver a última sincronização e o que entrou.
- **Atividade de fora conta como dia de treino** (V6 §15.5 e AC10): uma sessão importada de 30 min ou mais conta no ranking do desafio, com a origem visível ("via Strava").
- **Do Questlist para fora (opcional, por integração):** o treino concluído no Modo Treino vai como sessão de exercício (tipo musculação, duração, volume) para o Health Connect/HealthKit e, se a pessoa quiser, como atividade no Strava.
- **Peso corporal** (V6 §6): ler do Health Connect/HealthKit em vez de digitar, com o consentimento do V6 §6.
- **Sem duplicar:** cada atividade importada guarda o id de origem; importar de novo atualiza em vez de criar outra. A mesma sessão vinda de duas fontes (relógio → Health Connect e → Strava) conta uma vez só (mesma janela de tempo e tipo).
- **Antitrapaça leve:** atividade importada vale para o ranking, mas não dá XP extra além do limite diário do jogo.

## 3. Privacidade (LGPD, V5 §4)

- Dados de saúde são sensíveis: consentimento explícito por integração e por tipo de dado, revogável; desconectar apaga os tokens e, se a pessoa pedir, o que foi importado.
- Tokens OAuth só no servidor (cifrados), nunca no aparelho nem no repositório.
- Exportar e excluir a conta incluem as atividades importadas.

## 4. Ordem sugerida

1. Modelo de dados: `external_activities` (origem, id de origem, início, duração, tipo, dados brutos mínimos) com RLS só do dono; contar no dia de treino do AC10.
2. Strava (web, sem build nativo): OAuth no servidor, webhook, importação.
3. Health Connect no Android (development build): ler sessões e peso; depois escrever.
4. HealthKit quando houver app de iOS.

## Decisões em aberto (do dono)

1. Conta de desenvolvedor no Strava (nome do app, domínio de retorno do OAuth).
2. Escrever no Health Connect/Strava por padrão ou só ler?
3. Quais tipos de atividade contam como treino (corrida, caminhada, bike, musculação, todas)?
