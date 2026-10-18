---
name: delegar
description: Delega tarefas de código bem delimitadas aos modelos locais (escritor Qwen3.6-35B-A3B + revisor Qwen3.8-27B) para economizar tokens; o Claude só escreve a spec e confere o patch aprovado. Use em funções puras e seus testes, componentes pequenos, i18n nos três idiomas, scripts e refatorações de 1 a 3 arquivos. Não use em banco, RLS, RPCs, sync, permissões ou segurança.
---

# Delegar aos modelos locais

O objetivo é gastar poucos tokens do Claude sem baixar a qualidade. Tempo não importa: o ciclo
roda na máquina do usuário (de 30 min a algumas horas por tarefa) enquanto a sessão segue.

O ciclo de `scripts/delegar/delegar.sh`, numa worktree isolada (a árvore de trabalho não é tocada):
1. **Escritor** (aider + `llama-escritor`, Qwen3.6-35B-A3B com raciocínio) faz a tarefa, com a
   verificação (`verificar.sh`: prettier, `tsc` do projeto, eslint, jest e paridade do i18n) no laço.
2. **Revisor** (`llama-revisor`, Qwen3.8-27B denso com raciocínio, regras em
   `scripts/delegar/revisor.md`) confere a spec item a item e a semântica. Pega o que os testes
   não pegam: lógica invertida, caso de teste errado, área de toque, ordem de imports.
3. Com problemas, volta ao escritor com a lista; até 3 rodadas. Só sai APROVADO se a verificação
   passou e o revisor aprovou.

## Quando delegar

- Sim: funções puras e testes em `src/lib/`; componentes pequenos e chaves de i18n; scripts;
  refatorações mecânicas; até 3 arquivos para editar, cada um de tamanho razoável (o contexto do
  escritor é de ~28 mil tokens; os locales inteiros não cabem, por isso o `i18n: sim`).
- Não: migrações, RLS, RPCs, espelhos banco↔app, sync (`isLocal`/`runCommand`), permissões,
  segurança, decisões de arquitetura, tarefas que exigem explorar o repositório.

## A tarefa

Um arquivo `.delegar/fila/<nome-curto>.md` (o `.delegar/` está no `.gitignore`):

```
---
edit: src/lib/x.ts src/lib/__tests__/x.test.ts
read: src/lib/y.ts src/lib/__tests__/referencia.test.ts
jest: src/lib/__tests__/x.test.ts
i18n: sim
---
O que fazer, em itens numerados, e o que não mudar.
```

- `edit`: arquivos que o escritor cria ou muda. `read`: referências de estilo e as dependências
  que ele precisa ver. `jest`: testes a rodar. `i18n: sim` quando há texto novo.
- A spec é curta: o que fazer, critérios concretos, o que não mudar. Com `i18n: sim`, diga as
  chaves e os textos em pt-BR (o escritor traduz en/es e grava em `i18n-fragmento.json`).
- O revisor já conhece as regras gerais do projeto; ponha na spec só as que são específicas da
  tarefa. Nada de colar o CLAUDE.md.

## Rodar

```bash
scripts/delegar/delegar.sh --fila            # todas da fila, uma por vez
scripts/delegar/delegar.sh .delegar/fila/x.md  # uma só
```

Rode em segundo plano (`run_in_background`) e siga com outra coisa; várias tarefas podem ir para a
fila de uma vez. Para o usuário rodar sem o Claude: `scripts/delegar/delegar.sh --fila`.

## Conferir e aplicar (o que custa tokens: seja breve)

1. Leia só `.delegar/<nome>/resumo.md` (status, rodadas, arquivos, parecer) e o
   `.delegar/<nome>/resultado.patch`. Não abra as rodadas nem releia os arquivos inteiros, a não
   ser que algo no patch pareça errado.
2. APROVADO: confira o patch contra a spec. `scripts/delegar/aplicar.sh <nome>` (fusão de três
   vias e, com i18n, o `i18n-fragmento.json` mesclado nos locales do momento; o patch não leva os
   locales). Rode `npm run lint && npm run typecheck && npm test` e faça um commit
   por tarefa no padrão do CLAUDE.md, com o rodapé `Delegado: .delegar/<nome>/` antes do
   Co-Authored-By.
3. REPROVADO: leia os problemas no resumo. Se a spec estava ambígua, corrija-a e ponha de volta na
   fila; se o problema é pequeno, aplique o patch e corrija você mesmo; se não, faça a tarefa direto.
4. ERRO: ambiente (serviço não subiu, revisor sem resposta). Veja `systemctl --user status
   llama-escritor llama-revisor`.

## Ambiente

- llama.cpp (Vulkan) em `~/.local/opt/llama.cpp/`, modelos em `~/.local/share/models/`.
- Serviços de usuário `llama-escritor` (porta 8090, `-ncmoe 26`, ~20 tokens/s) e `llama-revisor`
  (porta 8091, `-ngl 32`, ~1,7 token/s): um derruba o outro (`Conflicts=`), porque os dois não
  cabem juntos na RAM. O script desliga os dois no fim.
- Enquanto roda, a GPU e ~12 GB de RAM ficam ocupados; o Ollama não deve ter modelo carregado.
