// Revisão local do delegar.sh: manda regras + spec + diff + verificação ao revisor (llama-server)
// e grava o parecer. Sai com 0 se APROVADO, 1 se há problemas, 2 em erro.
//   node revisar.mjs <spec.md> <diff> <verificacao.log> <saida-dir>
// Em streaming: com raciocínio, a resposta leva dezenas de minutos e o fetch sem stream estoura o
// tempo de espera dos cabeçalhos.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [specFile, diffFile, verifyFile, out] = process.argv.slice(2);
const url = `http://127.0.0.1:${process.env.DELEGAR_REVISOR_PORT ?? 8091}/v1/chat/completions`;
const rules = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'revisor.md'), 'utf8');
const diff = readFileSync(diffFile, 'utf8');
if (!diff.trim()) {
  writeFileSync(join(out, 'revisao.md'), '1. O diff está vazio: nada da spec foi feito.\n');
  process.exit(1);
}
const prompt = [
  rules,
  '## Spec\n',
  readFileSync(specFile, 'utf8'),
  '\n## Resultado da verificação automática\n```',
  readFileSync(verifyFile, 'utf8').slice(-3000),
  '```\n## Diff\n```diff',
  diff,
  '```',
].join('\n');

const res = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'revisor',
    stream: true,
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  }),
});
if (!res.ok) {
  console.error(`revisor respondeu ${res.status}: ${await res.text()}`);
  process.exit(2);
}

let content = '';
let reasoning = '';
let buffer = '';
const decoder = new TextDecoder();
for await (const chunk of res.body) {
  buffer += decoder.decode(chunk, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta ?? {};
    content += delta.content ?? '';
    reasoning += delta.reasoning_content ?? '';
  }
}

content = content.trim();
writeFileSync(join(out, 'revisao.md'), content + '\n');
writeFileSync(join(out, 'raciocinio.md'), reasoning + '\n');
if (!content) {
  console.error('revisor não respondeu (sem conteúdo)');
  process.exit(2);
}
process.exit(/^\W*APROVADO\W*$/.test(content.split('\n')[0]) ? 0 : 1);
