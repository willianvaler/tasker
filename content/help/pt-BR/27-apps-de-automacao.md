# Chamar o Questlist de apps de automação

Apps de automação do celular (Automate, MacroDroid, Tasker, Atalhos do iPhone, Rotinas da Samsung) fazem o que o Questlist não faz: ler SMS, ligar o Não Perturbe, mudar o brilho, reagir a notificações de outros apps. O Questlist não mexe no sistema do celular, mas esses apps podem **chamar** uma automação sua, de dois jeitos:

- **Endereço da chamada de fora** (webhook de entrada): o app manda um `POST` com dados (o título de uma tarefa, por exemplo) e a automação roda no servidor, sem abrir nada na tela. Precisa de um app com ação de **pedido HTTP**.
- **Link da automação** (`/r/…`, o mesmo do QR e do NFC): o app só **abre um endereço**. O navegador abre o Questlist, que roda a automação como você (pedindo **Executar** antes, se ela pede confirmação). Serve para qualquer app que saiba abrir um site.

Os dois estão em **Automações**, no **Quando** da automação: **Chamada de fora (webhook) → Gerar endereço**, ou **Só quando eu mandar → Gerar link**. Veja o artigo **Automações**.

## O que cada app consegue

| App | Pedido HTTP (chamada de fora) | Abrir o link |
|---|---|---|
| Automate (Android) | Sim, bloco **HTTP request** | Sim |
| MacroDroid (Android) | Sim, ação **HTTP Request** | Sim |
| Tasker (Android) | Sim, ação **HTTP Request** | Sim |
| Atalhos (iPhone) | Sim, ação **Obter Conteúdo do URL** | Sim |
| Rotinas da Samsung (Modos e Rotinas, antigo Bixby Routines) | Não tem | Depende da versão do One UI; se não houver, use um dos apps acima |

Os nomes dos menus mudam com a versão de cada app. Se não achar, procure por "HTTP" ou "URL" na lista de ações.

## Receita 1: criar uma tarefa por um pedido HTTP

1. No Questlist, crie uma automação com **Quando: Chamada de fora (webhook)** e **Então: Criar tarefa**. Escolha a lista e, no título, escreva `{{hook.titulo}}`. Salve e toque em **Gerar endereço**. Copie o endereço (ele aparece uma vez só).
2. No app de automação, crie uma ação de pedido HTTP:
   - **Método:** `POST`
   - **Endereço:** o que você copiou
   - **Tipo do conteúdo:** `application/json`
   - **Corpo:** `{"titulo": "Comprar pão"}`
3. Rode. A resposta é sempre `202`, sem corpo (mesmo com endereço errado: o Questlist não diz se ele vale). A tarefa aparece na lista escolhida; o histórico da automação mostra cada chamada.

Qualquer campo do corpo vira `{{hook.<nome>}}` na automação: `{"titulo": "...", "quando": "amanhã"}` dá `{{hook.titulo}}` e `{{hook.quando}}`. Também vale formulário (`application/x-www-form-urlencoded`, `titulo=Comprar pão`), que é o padrão de alguns apps. O corpo vai até 16 KB e no máximo 4 níveis.

**Ideia com o app:** no MacroDroid ou no Tasker, o gatilho "SMS recebido de tal número" e o corpo `{"titulo": "Ligar de volta para %SMSRF"}` (a variável de quem mandou, no Tasker). O app lê o SMS; o Questlist só recebe o título.

## Receita 2: rodar uma automação abrindo o link

1. Crie uma automação com **Quando: Só quando eu mandar** (por exemplo, "Cheguei em casa: abrir a lista Casa e começar o pomodoro") e toque em **Gerar link**. Copie o endereço `https://…/r/…`.
2. No app de automação, use a ação de **abrir site** (ou **abrir URL**, **Visualizar conteúdo**, **Abrir URLs** no Atalhos) com esse endereço, e o gatilho que quiser: conectar no Wi-Fi de casa, desligar o alarme, conectar no carro.
3. O Questlist abre no navegador e roda a automação. Se ela pede confirmação, toque em **Executar**. Desligue **Pedir confirmação ao abrir** para rodar direto (a automação que chama um webhook ou um dispositivo sempre pede).

O link só vale para a **sua** conta logada; no celular, ele abre no navegador (ainda não direto no app).

## Cuidados

- O endereço da chamada de fora e o link são como senhas. Ao compartilhar um fluxo do Automate, um perfil do Tasker ou um atalho, tire o endereço antes. Vazou? **Trocar endereço** ou **Trocar o link** invalida o antigo na hora.
- Há um limite de chamadas por minuto; acima dele, a resposta é `429`. Não use para algo que dispara a cada segundo.
- Para aceitar só chamadas suas, ligue **Exigir assinatura** na automação e mande o cabeçalho `X-Questlist-Signature` com o HMAC do corpo (veja **Automações**). A maioria desses apps não calcula HMAC sem um script; se o seu não calcular, deixe desligado e guarde bem o endereço.
- Dado de saúde, local, câmera e dispositivo não sai do Questlist por webhook sem você liberar campo a campo; receber dados por aqui não muda isso.
