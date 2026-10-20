// AC3.2 (D235): nomes em pt-BR e es e instruções REESCRITAS em pt-BR (não traduzidas ao pé da
// letra, V6 §14.1) pelo modelo local (llama-escritor, API compatível com OpenAI). Para os que vêm
// só da free-exercise-db (sem instruções), o modelo escreve passos curtos nos três idiomas.
// Retomável: grava data/exercicios/traducoes.json a cada lote e pula o que já foi feito.
//   systemctl --user start llama-escritor
//   node scripts/exercicios/traduzir.mjs [--limite N] [--lote 6]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', '..');
const basePath = path.join(root, 'data/exercicios/base.json');
const outPath = path.join(root, 'data/exercicios/traducoes.json');
const url = process.env.TRADUZIR_URL ?? 'http://127.0.0.1:8090/v1/chat/completions';
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const limit = arg('limite', Infinity);
const batchSize = arg('lote', 6);

const base = JSON.parse(readFileSync(basePath, 'utf8'));
const done = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {};
const todo = base.filter((e) => !done[e.id]).slice(0, limit);
console.log(`faltam ${base.length - Object.keys(done).length}; nesta rodada ${todo.length}`);

const SYSTEM = `Você é tradutor técnico de musculação para um app brasileiro. Para cada exercício recebido:
- "pt": nome em português do Brasil como se fala na academia (ex.: "Barbell bench press" → "Supino reto com barra"; "Lat pulldown" → "Puxada frontal"; "Squat" → "Agachamento"). Curto, sem traduzir marcas.
- "es": nome em espanhol neutro, como se fala no gimnasio.
- "steps_pt": os passos REESCRITOS com suas palavras em português do Brasil, frases curtas no imperativo (tu/você: "Deite", "Segure"), 3 a 6 passos. Não copie a estrutura do original frase por frase; diga o mesmo com outras palavras.
- Se o exercício vier sem passos ("steps_en" vazio), escreva também "steps_en" e "steps_es" (3 a 5 passos), só o que é seguro e certo sobre o movimento.
Responda SÓ com JSON: {"items":[{"id":"...","pt":"...","es":"...","steps_pt":["..."],"steps_en":["..."],"steps_es":["..."]}]} (steps_en e steps_es só quando pedidos).`;

async function translate(batch) {
  const input = batch.map((e) => ({
    id: e.id,
    name: e.name.en,
    equipment: e.equipment,
    target: e.target,
    steps_en: e.instructions.en,
  }));
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'escritor',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: JSON.stringify({ items: input }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`modelo: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const text = data.choices[0].message.content;
  const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  return parsed.items ?? [];
}

const ok = (s) => typeof s === 'string' && s.trim().length > 1;
const okSteps = (l) => Array.isArray(l) && l.length > 0 && l.every(ok);

for (let i = 0; i < todo.length; i += batchSize) {
  const batch = todo.slice(i, i + batchSize);
  const t0 = Date.now();
  let items = [];
  try {
    items = await translate(batch);
  } catch (err) {
    console.error(`lote ${i}: ${err.message}`);
    continue;
  }
  for (const it of items) {
    const e = batch.find((b) => b.id === it.id);
    if (!e || !ok(it.pt) || !ok(it.es) || !okSteps(it.steps_pt)) continue;
    const needsEn = e.instructions.en.length === 0;
    if (needsEn && (!okSteps(it.steps_en) || !okSteps(it.steps_es))) continue;
    done[e.id] = {
      pt: it.pt.trim(),
      es: it.es.trim(),
      steps_pt: it.steps_pt.map((s) => s.trim()),
      ...(needsEn
        ? { steps_en: it.steps_en.map((s) => s.trim()), steps_es: it.steps_es.map((s) => s.trim()), generated: true }
        : {}),
    };
  }
  writeFileSync(outPath, JSON.stringify(done, null, 1) + '\n');
  console.log(`${Object.keys(done).length}/${base.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
