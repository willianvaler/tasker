// AC3.6 (D235): gera a migração que carrega (ou atualiza) o catálogo `exercises` a partir de
// data/exercicios/base.json + traducoes.json. Upsert: rodar de novo depois de mais traduções gera
// outra migração que só completa os nomes e as instruções.
//   node scripts/exercicios/gerar-migracao.mjs 20261169000001
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..', '..');
const stamp = process.argv[2];
if (!/^\d{14}$/.test(stamp ?? '')) throw new Error('Informe o carimbo da migração (14 dígitos)');
const base = JSON.parse(readFileSync(path.join(root, 'data/exercicios/base.json'), 'utf8'));
const tPath = path.join(root, 'data/exercicios/traducoes.json');
const tr = existsSync(tPath) ? JSON.parse(readFileSync(tPath, 'utf8')) : {};

const q = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (l) => `'{${(l ?? []).map((x) => `"${String(x).replace(/["\\]/g, '\\$&').replace(/'/g, "''")}"`).join(',')}}'`;
const json = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'::jsonb`;

const rows = base.map((e) => {
  const t = tr[e.id] ?? {};
  const instructions = {
    en: e.instructions.en.length ? e.instructions.en : (t.steps_en ?? []),
    es: e.instructions.es?.length ? e.instructions.es : (t.steps_es ?? []),
    pt: t.steps_pt ?? [],
  };
  return `(${[
    q(e.id), q(e.name.en), q(t.pt), q(t.es), q(e.body_part), q(e.target), arr(e.secondary),
    q(e.equipment), q(e.kind), q(e.level), q(e.mechanic), q(e.force), json(instructions),
  ].join(', ')})`;
});

const translated = base.filter((e) => tr[e.id]).length;
const sql = `-- GERADO por scripts/exercicios/gerar-migracao.mjs: não edite à mão.
-- Catálogo de exercícios (AC3.6, D235): ${base.length} exercícios, ${translated} com nome em pt/es.
insert into public.exercises (id, name_en, name_pt, name_es, body_part, target, secondary, equipment,
  kind, level, mechanic, force, instructions)
values
${rows.join(',\n')}
on conflict (id) do update set
  name_en = excluded.name_en,
  name_pt = coalesce(excluded.name_pt, public.exercises.name_pt),
  name_es = coalesce(excluded.name_es, public.exercises.name_es),
  body_part = excluded.body_part, target = excluded.target, secondary = excluded.secondary,
  equipment = excluded.equipment, kind = excluded.kind, level = excluded.level,
  mechanic = excluded.mechanic, force = excluded.force,
  instructions = case when jsonb_array_length(coalesce(excluded.instructions -> 'pt', '[]')) > 0
                      then excluded.instructions
                      else excluded.instructions || jsonb_build_object('pt', coalesce(public.exercises.instructions -> 'pt', '[]')) end,
  updated_at = now();
`;
const file = path.join(root, `supabase/migrations/${stamp}_exercicios_dados.sql`);
writeFileSync(file, sql);
console.log(`${path.relative(root, file)}: ${base.length} exercícios, ${translated} traduzidos`);
