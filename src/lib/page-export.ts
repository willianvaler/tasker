import { wbsCodes } from './task-tree';

// Exportar uma lista (PB9, V3 §6 B, D304): CSV (planilha), Markdown (checklist que o "Adicionar
// várias" e o Obsidian entendem) e HTML para imprimir ou salvar em PDF. Funções puras: quem chama
// traduz os textos e salva o arquivo.

export type ExportTask = {
  id: string;
  parent_task_id: string | null;
  position: number;
  status: string;
  title: string;
  priority: number | null;
  due_date: string | null;
  due_time?: string | null;
  labels: string[] | null;
  notes: string | null;
};

export type ExportStrings = {
  code: string;
  task: string;
  done: string;
  due: string;
  priority: string;
  labels: string;
  notes: string;
  yes: string;
  /** "Exportada em 04/11/2026" (já formatado) */
  generated: string;
  /** "3 de 10 feitas" (já formatado) */
  progress: string;
  /** Data no formato da tela */
  date: (iso: string) => string;
};

export type ExportRow = { code: string; level: number; task: ExportTask };

/** Tarefas na ordem da árvore (mãe e logo as filhas), com o código "1.2" e o nível */
export function exportRows(tasks: readonly ExportTask[]): ExportRow[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return [...wbsCodes(tasks).entries()].flatMap(([id, code]) => {
    const task = byId.get(id);
    return task ? [{ code, level: code.split('.').length - 1, task }] : [];
  });
}

const done = (t: ExportTask) => t.status === 'done';
const bangs = (p: number | null) => '!'.repeat(Math.max(0, Math.min(3, p ?? 0)));

function cell(value: string) {
  return /[";\n\r,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV com ";" e BOM (o Excel em pt-BR abre com os acentos certos); data em ISO, para ordenar */
export function pageToCsv(tasks: readonly ExportTask[], s: ExportStrings) {
  const head = [s.code, s.task, s.done, s.due, s.priority, s.labels, s.notes];
  const lines = exportRows(tasks).map(({ code, task }) =>
    [
      code,
      task.title,
      done(task) ? s.yes : '',
      [task.due_date, task.due_time?.slice(0, 5)].filter(Boolean).join(' '),
      task.priority ? String(task.priority) : '',
      (task.labels ?? []).join(' '),
      task.notes ?? '',
    ]
      .map(cell)
      .join(';'),
  );
  return `﻿${[head.join(';'), ...lines].join('\r\n')}\r\n`;
}

/**
 * Markdown: o nome da lista como título e uma caixinha por tarefa, com recuo nas subtarefas.
 * Prioridade como "!!" e etiquetas como "#x" (a sintaxe rápida do app); vencimento no formato do
 * plugin Tasks do Obsidian ("📅 2026-11-05"); a descrição vai recuada embaixo, como citação.
 */
export function pageToMarkdown(name: string, tasks: readonly ExportTask[]) {
  const lines = [`# ${name}`, ''];
  for (const { level, task } of exportRows(tasks)) {
    const indent = '  '.repeat(level);
    const extra = [
      bangs(task.priority),
      ...(task.labels ?? []).map((l) => `#${l}`),
      task.due_date ? `📅 ${task.due_date}` : '',
    ].filter(Boolean);
    lines.push(`${indent}- [${done(task) ? 'x' : ' '}] ${[task.title, ...extra].join(' ')}`);
    for (const note of (task.notes ?? '').split('\n').filter((l) => l.trim()))
      lines.push(`${indent}  > ${note}`);
  }
  return `${lines.join('\n')}\n`;
}

const html = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Página para imprimir (ou salvar em PDF): caixinhas, recuo, data e descrição, em preto e branco */
export function pageToPrintHtml(name: string, tasks: readonly ExportTask[], s: ExportStrings) {
  const rows = exportRows(tasks)
    .map(({ level, task }) => {
      const meta = [
        task.due_date ? `${html(s.due)}: ${html(s.date(task.due_date))}` : '',
        task.priority ? bangs(task.priority) : '',
        ...(task.labels ?? []).map((l) => `#${html(l)}`),
      ].filter(Boolean);
      const notes = task.notes?.trim()
        ? `<div class="notes">${html(task.notes.trim()).replace(/\n/g, '<br>')}</div>`
        : '';
      return `<li class="${done(task) ? 'done' : ''}" style="margin-left:${level * 1.5}em"><span class="box">${done(task) ? '✓' : ''}</span><div><span class="title">${html(task.title)}</span>${meta.length ? ` <span class="meta">${meta.join(' · ')}</span>` : ''}${notes}</div></li>`;
    })
    .join('\n');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${html(name)}</title>
<style>
  body { font: 12pt/1.4 Georgia, 'Times New Roman', serif; color: #000; margin: 2cm; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  .sub { color: #444; font: 9pt sans-serif; margin-bottom: 14pt; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; gap: 8pt; padding: 4pt 0; border-bottom: 0.5pt solid #ccc; break-inside: avoid; }
  .box { flex: none; width: 11pt; height: 11pt; border: 1pt solid #000; font: 9pt/11pt sans-serif; text-align: center; margin-top: 2pt; }
  .done .title { text-decoration: line-through; color: #555; }
  .meta { color: #444; font: 9pt sans-serif; }
  .notes { color: #333; font-size: 10pt; margin-top: 2pt; }
  @page { margin: 1.5cm; }
  @media print { body { margin: 0; } }
</style></head>
<body><h1>${html(name)}</h1><div class="sub">${html(s.progress)} · ${html(s.generated)}</div>
<ul>
${rows}
</ul></body></html>`;
}

/** Nome de arquivo sem os caracteres que o Windows e o Android recusam */
export function exportFileName(name: string, ext: string) {
  const base =
    name
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'lista';
  return `${base}.${ext}`;
}
