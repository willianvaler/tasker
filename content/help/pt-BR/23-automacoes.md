# Automações

Uma **automação** é uma regra "quando… se… então…": **quando** algo acontece (o gatilho), **se** as condições baterem, **então** o app faz os passos, sozinho, no servidor. As suas ficam em **Configurações → Automações**; as de um projeto, no menu do projeto (**Automações**), para quem pode mexer nelas.

## Quando: o gatilho

- **Tarefas:** criada, concluída, ficou pronta (o que ela esperava foi feito), atribuída a você, atrasou, ou vai vencer em alguns minutos. **Lista inteira concluída.**
- **Jogo e projeto:** subiu de nível, boss derrotado, marco atingido.
- **Relógio:** num horário (com os dias da semana) ou a cada N horas, sempre no seu fuso.
- **Chamada de fora (webhook):** um endereço só desta automação; o que chegar nele vira `hook.*`.
- **Só quando eu mandar:** roda pelo botão **Executar agora**.

Importar do Habitica ou do Todoist e usar um modelo não disparam automação nenhuma.

## Se: as condições

Opcional. Junte com **E** (todas), **OU** (alguma) e **NÃO**, até 3 níveis e 10 comparações. Há as prontas — **janela de horário** (das 22:00 às 06:00 atravessa a meia-noite), **dias da semana**, **projeto**, **lista**, **etiqueta** e **nível mínimo** — e a comparação de um valor (`evento.titulo` contém "boleto", `evento.prioridade` ≥ 2). Se as condições não baterem, a execução aparece no histórico como "condições: não".

## Então: os passos

Até 20 passos: **avisar** (no app, no celular ou nos dois), **criar tarefa** (vencimento como data ou `+2` dias), **mudar a tarefa** (etiquetas, lista e vencimento), **atribuir** (no projeto), **começar descanso**, **esperar** (de 1 minuto a 7 dias), **guardar um valor**, **se… senão**, **rodar outra automação**, **chamar um endereço (webhook)**, **trocar o modo jogo** e **parar**. Automação nunca conclui, reabre nem apaga tarefa.

Nos textos, `{{evento.titulo}}` é trocado pelo valor. Filtros: `|corta:40`, `|data`, `|hora` e `|padrao:"sem nome"`. Também valem `{{usuario.nome}}`, `{{usuario.nivel}}`, `{{agora|hora}}` e `{{var.nome}}` (um valor guardado antes). Variável que não existe vira texto vazio e deixa um aviso no histórico. Os nomes em inglês e espanhol também funcionam (`{{event.title|cut:40}}`).

A automação age **como quem a criou**: só faz o que essa pessoa pode. Se ela sair do projeto, a ação falha e fica no histórico.

## Testar, executar e o histórico

**Testar** mostra o que cada passo faria, com um exemplo do gatilho, sem fazer nada de verdade (nem avisar, nem criar, nem chamar endereço). **Executar agora** roda de verdade. O **histórico** mostra as últimas 50 execuções, passo a passo, com o erro quando houver.

## Limites

Cada automação roda até **60 vezes por hora**, e as suas somadas, **600**; avisos, até **10 por hora** por automação. Passando disso, a execução fica como **limitada** (não é erro). Uma automação que falha **10 vezes seguidas** é desligada, com um aviso para você; ligue de novo depois de corrigir. Um disparo que atrasar mais de 15 minutos (servidor fora do ar) não roda e fica como **perdido**. **Pausar todas** para tudo na hora, inclusive o que estava esperando.

## Chamar um endereço (webhook de saída)

Serve para o Discord (o webhook do canal), o Home Assistant exposto na internet, o IFTTT e qualquer serviço com endereço **https://**. O corpo é um JSON, e os textos dentro dele aceitam `{{ }}`. Senhas e tokens de cabeçalho (`Authorization`) ficam guardados à parte, cifrados, e não voltam para a tela. Endereços da sua rede de casa e do próprio servidor são bloqueados.

Com **Assinar**, cada chamada leva `X-Questlist-Signature: t=<segundos>,v1=<assinatura>`, um HMAC-SHA256 do texto `t` + `.` + corpo, com o segredo de assinatura (mostrado uma vez, ao gerar). Para conferir no seu servidor (Node):

```js
const crypto = require('crypto');
function confere(cabecalho, corpo, segredo) {
  const { t, v1 } = Object.fromEntries(cabecalho.split(',').map((p) => p.split('=')));
  const esperado = crypto.createHmac('sha256', segredo).update(`${t}.${corpo}`).digest('hex');
  const recente = Math.abs(Date.now() / 1000 - Number(t)) < 300;
  return recente && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(esperado));
}
```

Cada chamada leva também `X-Questlist-Idempotency`: se chegar duas vezes com o mesmo valor, é a mesma chamada.

### Receita: avisar um canal do Discord

1. No Discord, abra as **Configurações do canal → Integrações → Webhooks → Novo webhook**, dê um nome e toque em **Copiar URL do webhook**.
2. No Questlist, em **Configurações → Automações**, escolha o modelo **Contar no Discord quando subir de nível** ou **Contar no Discord quando vencer um boss**.
3. Em **Então**, cole o endereço copiado no lugar de `https://discord.com/api/webhooks/` e ajuste o texto do `content` (ele aceita `{{evento.nivel}}` e `{{evento.boss_nome}}`).
4. **Testar** mostra o que seria enviado sem enviar nada; **Salvar** liga a automação.

O Discord mostra a mensagem com o nome do webhook. O endereço do webhook é como uma senha: quem tiver o endereço posta no canal. Se ele vazar, apague o webhook no Discord e crie outro. Nenhum dado sensível (saúde, local, câmera, dispositivo) entra na mensagem.

## Receber uma chamada (webhook de entrada)

Numa automação com o gatilho **Chamada de fora**, **Gerar endereço** mostra o endereço **uma vez** (guarde). Mande um `POST` com JSON ou formulário, até 16 KB; a resposta é sempre `202`, sem corpo. **Trocar endereço** invalida o antigo na hora. Há um limite de chamadas por minuto; acima dele, a resposta é `429`.

## Link por QR e NFC

Uma automação pessoal com o gatilho **manual** pode ganhar um link: em **Quando**, toque em **Gerar link**. O endereço e o QR aparecem uma vez só; use **Imprimir o QR** para colar na porta, na mesa ou no carro. Para NFC, grave o mesmo endereço numa etiqueta com qualquer app gravador: ao encostar o celular, o sistema abre o link, sem nada a instalar no Questlist.

Ao abrir o link, o Questlist pede para entrar (se precisar) e executa a automação como você. Só a sua conta usa o link: para outra pessoa, ele aparece como inválido. Por padrão a tela pede **Executar** antes; desligue **Pedir confirmação ao abrir** para rodar direto. Automação que chama um webhook ou um dispositivo **sempre** pede confirmação. **Trocar o link** ou **Revogar** faz o QR e as etiquetas antigas pararem na hora. No Android, o link abre no navegador, onde o Questlist já está com você logado.

## Anotações

Criada, propriedade mudou, etiqueta adicionada e botão apertado são gatilhos; acrescentar texto, definir propriedade, pôr etiqueta, criar de um modelo e **iniciar um processo** são ações. Nenhuma ação apaga texto.
