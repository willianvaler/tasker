#!/usr/bin/env bash
# Delega tarefas ao modelo local numa worktree isolada: o escritor (aider + llama-escritor) faz,
# a verificação (verificar.sh) confere e o revisor (llama-revisor, com raciocínio) revisa; volta
# ao escritor com os problemas até aprovar ou acabar as rodadas. A árvore de trabalho não é tocada.
#
#   scripts/delegar/delegar.sh .delegar/fila/nome.md   # uma tarefa
#   scripts/delegar/delegar.sh --fila                  # todas da fila, uma por vez
#
# A tarefa é um .md com cabeçalho e a spec embaixo:
#   ---
#   edit: src/lib/x.ts src/lib/__tests__/x.test.ts
#   read: src/lib/y.ts
#   jest: src/lib/__tests__/x.test.ts
#   i18n: sim
#   ---
#   (spec)
# Com `i18n: sim`, o escritor põe as chaves novas em i18n-fragmento.json ({"pt-BR", "en", "es"}) e o
# mesclar-i18n.mjs aplica nos locales (inteiros, não cabem no contexto do modelo).
#
# Resultado em .delegar/<nome>/: resumo.md, resultado.patch, a tarefa e uma pasta por rodada
# (aider.log, verificacao.log, diff.patch, revisao.md, raciocinio.md).
# Sai com 0 se tudo aprovado, 1 se alguma tarefa não passou, 2 em erro de uso ou de ambiente.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
base=$repo/.delegar
rounds=${DELEGAR_RODADAS:-3}
writer=${DELEGAR_ESCRITOR:-llama-escritor}
writer_port=${DELEGAR_ESCRITOR_PORT:-8090}
reviewer=${DELEGAR_REVISOR:-llama-revisor}
reviewer_port=${DELEGAR_REVISOR_PORT:-8091}

command -v aider >/dev/null || { echo "aider não instalado (uv tool install --python 3.12 aider-chat)" >&2; exit 2; }

# Sobe um dos modelos (o Conflicts= do systemd derruba o outro: os dois não cabem juntos).
serve() {
  systemctl --user start "$1" || return 1
  for _ in $(seq 120); do curl -sf "http://127.0.0.1:$2/health" >/dev/null && return 0; sleep 2; done
  echo "$1 não respondeu na porta $2" >&2
  return 1
}

# Valor de uma chave do cabeçalho da tarefa.
header() { awk -v k="$2" 'NR==1 && $0!="---" {exit} NR>1 && $0=="---" {exit} NR>1 { i=index($0,":"); if (substr($0,1,i-1)==k) { print substr($0,i+1) } }' "$1" | xargs; }
# A spec: tudo depois do cabeçalho.
body() { awk 'NR==1 && $0!="---" {p=1} p {print} NR>1 && $0=="---" && !p {p=1}' "$1"; }

run_task() {
  local task name out wt branch start status=REPROVADO round
  task=$(realpath "$1")
  name=$(basename "$task" .md)
  out=$base/$name
  [ -e "$out" ] && out=$out-$(date +%H%M%S)
  mkdir -p "$out"
  cp "$task" "$out/tarefa.md"
  body "$task" >"$out/spec.md"
  start=$(date +%s)

  read -ra edit <<<"$(header "$task" edit)"
  read -ra rd <<<"$(header "$task" read)"
  read -ra jest <<<"$(header "$task" jest)"
  local i18n
  i18n=$(header "$task" i18n)
  [ ${#edit[@]} -gt 0 ] || { echo "$name: cabeçalho sem 'edit:'" | tee "$out/resumo.md" >&2; return 2; }

  wt=$(mktemp -d "${TMPDIR:-/tmp}/delegar-wt.XXXXXX")
  branch=delegar/$(basename "$wt")
  current_wt=$wt
  git -C "$repo" worktree add -q -b "$branch" "$wt" HEAD || return 2
  ln -s "$repo/node_modules" "$wt/node_modules"

  local files=() verify=("$here/verificar.sh") code=() f j
  for f in "${edit[@]}"; do files+=(--file "$f"); case $f in *.ts | *.tsx | *.js | *.mjs) code+=("$f") ;; esac; done
  for f in "${rd[@]}"; do files+=(--read "$f"); done
  for j in "${jest[@]}"; do verify+=(--jest "$j"); done
  [ "$i18n" = sim ] && { files+=(--file i18n-fragmento.json); verify+=(--i18n i18n-fragmento.json); }
  verify+=("${code[@]}")

  for round in $(seq "$rounds"); do
    local dir=$out/rodada-$round
    mkdir -p "$dir"
    cp "$out/spec.md" "$dir/mensagem.md"
    if [ "$round" -gt 1 ]; then
      local prev=$out/rodada-$((round - 1))
      if [ -s "$prev/revisao.md" ]; then
        printf '\n\n## Correções pedidas pela revisão (faça todas)\n\n' >>"$dir/mensagem.md"
        cat "$prev/revisao.md" >>"$dir/mensagem.md"
      else
        printf '\n\n## A verificação falhou; corrija\n\n```\n%s\n```\n' "$(tail -60 "$prev/verificacao.log")" >>"$dir/mensagem.md"
      fi
    fi

    serve "$writer" "$writer_port" || { status=ERRO; break; }
    (cd "$wt" && OPENAI_API_BASE=http://127.0.0.1:$writer_port/v1 OPENAI_API_KEY=local aider \
      --model openai/escritor \
      --model-settings-file "$here/aider.model.settings.yml" \
      --model-metadata-file "$here/aider.model.metadata.json" \
      --map-tokens 1024 --no-show-model-warnings --no-check-update --no-show-release-notes \
      --no-analytics --no-gitignore --yes-always --no-pretty --no-stream \
      --no-auto-commits --no-dirty-commits --aiderignore "$here/aiderignore" \
      --timeout 7200 \
      --chat-history-file "$dir/chat.md" --input-history-file /dev/null \
      "${files[@]}" \
      --test-cmd "$(printf '%q ' "${verify[@]}")" --auto-test \
      --message-file "$dir/mensagem.md" >"$dir/aider.log" 2>&1)
    if grep -qE 'BadRequestError|exceeds the available context|APIConnectionError' "$dir/aider.log"; then
      echo "o escritor não respondeu (veja aider.log)" >"$dir/erro.txt"
      status=ERRO
      break
    fi

    # A verificação final da rodada, fora do aider, é a que vale.
    local green=0
    (cd "$wt" && "${verify[@]}") >"$dir/verificacao.log" 2>&1 && green=1
    # Dois diffs: o resultado leva os locales já mesclados; o revisor vê o fragmento, que é o que
    # o escritor escreveu (os locales inteiros não interessam e confundem a revisão).
    # O filtro vai no diff, não no add: o fragmento já fica no índice desde a rodada anterior.
    (cd "$wt" && git add -A -- . ':!node_modules' ':!.aider*') || { status=ERRO; break; }
    (cd "$wt" && git diff --cached -U8 -- . ':!i18n-fragmento.json') >"$dir/diff.patch"
    (cd "$wt" && git diff --cached -U8 -- . ':!src/i18n/locales') >"$dir/diff-revisao.patch"
    if [ "$round" -gt 1 ] && cmp -s "$dir/diff.patch" "$out/rodada-$((round - 1))/diff.patch"; then
      echo "o escritor não mudou nada nesta rodada" >"$dir/erro.txt"
      cp "$out/rodada-$((round - 1))/revisao.md" "$dir/revisao.md" 2>/dev/null
      break
    fi
    [ $green = 1 ] || continue

    serve "$reviewer" "$reviewer_port" || { status=ERRO; break; }
    DELEGAR_REVISOR_PORT=$reviewer_port node "$here/revisar.mjs" "$out/spec.md" "$dir/diff-revisao.patch" "$dir/verificacao.log" "$dir"
    case $? in
      0) status=APROVADO; break ;;
      2) status=ERRO; break ;;
    esac
  done

  # Com i18n, o resultado leva o fragmento à parte, não o diff dos locales: o fim desses JSONs
  # muda a todo commit e o patch deixaria de aplicar. O aplicar.sh mescla o fragmento.
  if [ "$i18n" = sim ]; then
    (cd "$wt" && git diff --cached -U8 -- . ':!i18n-fragmento.json' ':!src/i18n/locales') >"$out/resultado.patch"
    cp "$wt/i18n-fragmento.json" "$out/" 2>/dev/null
  else
    cp "$out/rodada-$round/diff.patch" "$out/resultado.patch" 2>/dev/null
  fi
  cleanup_wt

  local last=$out/rodada-$round
  {
    echo "# $name: $status"
    echo
    echo "- rodadas: $round de $rounds · tempo: $((($(date +%s) - start) / 60)) min"
    echo "- base: $(git -C "$repo" rev-parse --short HEAD) · aplicar: \`scripts/delegar/aplicar.sh ${out##*/}\`"
    echo
    echo '```'
    git -C "$repo" apply --stat "$out/resultado.patch" 2>/dev/null
    [ -f "$out/i18n-fragmento.json" ] && echo " + i18n-fragmento.json (chaves novas nos três idiomas)"
    echo '```'
    [ -s "$last/erro.txt" ] && { echo; echo "**Parou:** $(cat "$last/erro.txt")"; }
    if [ $status = APROVADO ]; then
      echo; echo "## Parecer do revisor"; echo; cat "$last/revisao.md"
    elif [ -s "$last/revisao.md" ]; then
      echo; echo "## Problemas que ficaram"; echo; cat "$last/revisao.md"
    else
      echo; echo "## Verificação falhou"; echo; echo '```'; tail -30 "$last/verificacao.log"; echo '```'
    fi
  } >"$out/resumo.md"
  cat "$out/resumo.md"
  [ $status = APROVADO ]
}

# Interrompido no meio também limpa: worktree, branch e os modelos (liberam a VRAM).
current_wt=
cleanup_wt() {
  [ -n "$current_wt" ] || return 0
  git -C "$repo" worktree remove --force "$current_wt" 2>/dev/null
  git -C "$repo" branch -D "delegar/$(basename "$current_wt")" >/dev/null 2>&1
  current_wt=
}
trap 'cleanup_wt; systemctl --user stop "$writer" "$reviewer" 2>/dev/null' EXIT
trap 'exit 130' INT TERM
mkdir -p "$base/fila"

if [ "${1:-}" = --fila ]; then
  shopt -s nullglob
  tasks=("$base"/fila/*.md)
  [ ${#tasks[@]} -gt 0 ] || { echo "fila vazia ($base/fila)"; exit 0; }
  failed=0
  for t in "${tasks[@]}"; do
    run_task "$t" || failed=1
    rm -f "$t"
  done
  exit $failed
fi

[ -f "${1:-}" ] || { echo "uso: delegar.sh <tarefa.md> | --fila" >&2; exit 2; }
run_task "$1"
