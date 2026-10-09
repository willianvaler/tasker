// Exportação dos dados (ESCOPO 9): JSON completo e CSV das tarefas (abre no Excel/Planilhas).

type ExportTask = {
  title?: string;
  folder?: string;
  page?: string;
  status?: string;
  priority?: number;
  due_date?: string | null;
  labels?: string[];
  notes?: string | null;
  created_at?: string;
  completed_at?: string | null;
};

const COLUMNS: [keyof ExportTask, string][] = [
  ['title', 'Tarefa'],
  ['folder', 'Pasta'],
  ['page', 'Página'],
  ['status', 'Status'],
  ['priority', 'Prioridade'],
  ['due_date', 'Vencimento'],
  ['labels', 'Etiquetas'],
  ['notes', 'Notas'],
  ['created_at', 'Criada em'],
  ['completed_at', 'Concluída em'],
];

function cell(value: unknown) {
  const text = Array.isArray(value) ? value.join(' ') : value == null ? '' : String(value);
  // Aspas em tudo que tem separador, aspas ou quebra de linha (RFC 4180)
  return /[";\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV com ";" (padrão do Excel em pt-BR) e BOM, para os acentos abrirem certo. */
export function tasksToCsv(tasks: ExportTask[]) {
  const lines = [
    COLUMNS.map(([, label]) => label).join(';'),
    ...tasks.map((t) => COLUMNS.map(([key]) => cell(t[key])).join(';')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
