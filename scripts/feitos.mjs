// Gera docs/FEITOS.md (tudo que já foi feito, numa tabela de leitura rápida) a partir do
// docs/STATUS.md. Rode depois de atualizar o STATUS: npm run feitos
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const status = readFileSync(path.join(root, 'docs/STATUS.md'), 'utf8');

// As fases do ESCOPO.md (v1) não estão no STATUS; o que veio depois do backlog dele, sim ("ESCOPO v1")
const V1 = [
  ['Fase 0', 'Base do app, login, pastas e páginas, RLS', 'D1 a D12'],
  ['Fase 1', 'Captura rápida, lote, datas, etiquetas', 'D13 a D23'],
  ['Fase 2', 'Ciclos, recorrência, duplicar e reiniciar página', 'D24 a D31'],
  ['Pastas', 'Barra lateral e telas de pasta', 'D32'],
  ['Fase 3', 'Gamificação: XP, nível, sequência, boss, conquistas', 'D33 a D39'],
  [
    'Fase 4',
    'Projetos: convites, responsáveis, comentários, atividade, notificações, modelos',
    'D40 a D48',
  ],
  ['Fase 5', 'Clã, bosses cooperativos, fila offline, privacidade', 'D49 a D53'],
  [
    'Fase 6',
    'Kanban, tema, onboarding, acessibilidade e desempenho, push, publicação',
    'D54 a D59',
  ],
  ['Fase 7', 'RPG leve, telas largas, Início e tela Hábitos', 'D60 a D70'],
];

const ESCOPOS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V8', 'V9'];

/** Escopo de uma seção do STATUS pelo título; null = não entra na tabela. */
function escopoDa(titulo) {
  const fase = /^Fase ([A-Z])\b/.exec(titulo)?.[1];
  if (fase && 'ABCDEF'.includes(fase)) return 'V2';
  if (fase && 'GHIJKLM'.includes(fase)) return 'V3';
  if (fase === 'U' || fase === 'W' || titulo.includes('ESCOPO_V5')) return 'V5';
  if (titulo.includes('ESCOPO_V4')) return 'V4';
  if (titulo.includes('ESCOPO_V6')) return 'V6';
  if (titulo.includes('ESCOPO_V8')) return 'V8';
  if (titulo.includes('ESCOPO_V9')) return 'V9';
  if (titulo.includes('ESCOPO v1')) return 'V1';
  return null;
}

/** Tarefa (primeira frase, sem as decisões entre parênteses) e decisões de uma linha [x]. */
function linhaDa(texto) {
  const decisoes = [...new Set([...texto.matchAll(/\bD(\d+)\b/g)].map((m) => `D${m[1]}`))];
  const limpo = texto.replace(/\s*\((?:D\d+(?:,\s*|\s+a\s+|\s+e\s+)?)+\)/g, '');
  const corte = limpo.indexOf('. ');
  let tarefa = (corte >= 0 ? limpo.slice(0, corte) : limpo).replace(/\.$/, '');
  if (corte >= 0 && /\b(Pendente|pendente:|[Ff]alta )/.test(limpo.slice(corte))) {
    tarefa += ' (parcial)';
  }
  return { tarefa: escapar(tarefa), decisoes: decisoes.join(', ') || '—' };
}

const escapar = (s) => s.replace(/\|/g, '\\|');

function linhasDoStatus() {
  const porEscopo = Object.fromEntries(ESCOPOS.map((e) => [e, []]));
  let escopo = null;
  for (const linha of status.split('\n')) {
    if (linha.startsWith('## ')) {
      const titulo = linha.slice(3);
      if (titulo.startsWith('Decisões em aberto')) break;
      escopo = escopoDa(titulo);
      continue;
    }
    const m = /^- \[x\] \*\*([^*]+)\*\* (.*)$/.exec(linha);
    if (m && escopo) porEscopo[escopo].push({ id: m[1], ...linhaDa(m[2]) });
  }
  porEscopo.V1 = [...V1.map(([id, tarefa, decisoes]) => ({ id, tarefa, decisoes })), ...porEscopo.V1];
  return porEscopo;
}

const porEscopo = linhasDoStatus();
const linhas = ESCOPOS.flatMap((e) =>
  porEscopo[e].map(
    (l, i) => `| ${i === 0 ? `**${e}**` : e} | ${l.id} | ${l.tarefa} | ${l.decisoes} |`,
  ),
);

writeFileSync(
  path.join(root, 'docs/FEITOS.md'),
  `# Feitos

O que já foi feito em todos os escopos, numa tabela só, para ler rápido. **Gerado por \`npm run feitos\`** a partir do \`docs/STATUS.md\`: não edite à mão, rode de novo depois de atualizar o STATUS. O que falta está em \`docs/PENDENTES.md\`; o detalhe, no STATUS e no \`DECISIONS.md\`.

| Escopo | Id | Tarefa | Decisões |
|---|---|---|---|
${linhas.join('\n')}
`,
);
console.log(`FEITOS.md: ${linhas.length} tarefas`);
