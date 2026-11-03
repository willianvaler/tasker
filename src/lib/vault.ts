// Importar e exportar um cofre do Obsidian (OB13, ESCOPO_V11 §8, D298): pasta de `.md` com
// frontmatter YAML e [[links]] pelo título. Importar: cada `.md` vira uma anotação, o frontmatter
// vira propriedades (tags e aliases inclusive) e os links são resolvidos pelo título (do cofre e das
// anotações que já existem), ganhando o id (OB1). Exportar: o inverso, um `.md` por anotação, com
// os links de volta para [[Nome do arquivo]]. O .zip fica para quem chama (fflate). Funções puras.

import { cleanPropName, type NoteProps, type PropValue } from './note-props';
import { fold } from './query/parse';
import { cleanLinkTitle, linkMarkup, parseLinks, type LinkKind } from './wikilinks';

export const NOTE_BODY_MAX = 20000;
export const NOTE_TITLE_MAX = 200;
/** Teto das propriedades no banco (8 KB, D289) */
const PROPS_MAX = 8000;
/** Notas por importação (o resto fica de fora, com aviso) */
export const IMPORT_MAX = 2000;

// ---------- frontmatter ----------

const FRONT = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function scalar(raw: string): PropValue {
  const v = raw.trim();
  if (v === '' || v === '~' || v === 'null') return null;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 16) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"') && v.length >= 2) || (v.startsWith("'") && v.endsWith("'") && v.length >= 2)) {
    const inner = v.slice(1, -1);
    if (v.startsWith('"')) {
      try {
        return JSON.parse(v) as string;
      } catch {
        return inner;
      }
    }
    return inner.replace(/''/g, "'");
  }
  return v;
}

const asText = (value: PropValue) => (value === null ? '' : String(value));

function inlineList(raw: string): string[] {
  const inner = raw.trim().slice(1, -1);
  if (!inner.trim()) return [];
  return inner
    .split(',')
    .map((part) => asText(scalar(part)))
    .filter(Boolean);
}

/** O frontmatter YAML (o pedaço que o Obsidian usa: valor, lista e texto em bloco) e o resto */
export function parseFrontmatter(text: string): { props: NoteProps; body: string } {
  const m = FRONT.exec(text.replace(/^﻿/, ''));
  if (!m) return { props: {}, body: text.replace(/^﻿/, '') };
  const props: NoteProps = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = /^([^\s#:][^:]*):(?:\s(.*)|)$/.exec(line);
    if (!kv) continue;
    const name = cleanPropName(kv[1]);
    const rest = (kv[2] ?? '').trim();
    // Filhos indentados (lista "- x" ou texto em bloco "|"/">")
    const children: string[] = [];
    while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || /^-\s/.test(lines[i + 1]))) {
      children.push(lines[++i]);
    }
    if (!name) continue;
    let value: PropValue;
    if (rest.startsWith('[') && rest.endsWith(']')) value = inlineList(rest);
    else if (/^[|>][+-]?$/.test(rest))
      value = children.map((c) => c.trim()).join(rest.startsWith('|') ? '\n' : ' ');
    else if (!rest && children.length && children.every((c) => /^\s*-\s?/.test(c)))
      value = children.map((c) => asText(scalar(c.replace(/^\s*-\s?/, '')))).filter(Boolean);
    else if (!rest && children.length)
      // Mapa aninhado: guarda como texto, para não perder
      value = children.map((c) => c.trim()).join('; ');
    else value = scalar(rest);
    props[name] = value;
  }
  return { props, body: text.slice(m[0].length + (text.startsWith('﻿') ? 1 : 0)) };
}

const NEEDS_QUOTES = /^[\s\-?:,[\]{}#&*!|>'"%@`]|[:#]\s|\s$|^(true|false|null|~|-?\d+(\.\d+)?)$/i;
const yamlString = (s: string) => (s === '' || NEEDS_QUOTES.test(s) || s.includes('\n') ? JSON.stringify(s) : s);

/** As propriedades como frontmatter YAML (vazio sem propriedades) */
export function toFrontmatter(props: NoteProps | null | undefined): string {
  const entries = Object.entries(props ?? {});
  if (!entries.length) return '';
  const lines = ['---'];
  for (const [name, value] of entries) {
    const key = /^[\p{L}\p{N}_ -]+$/u.test(name) ? name : JSON.stringify(name);
    if (Array.isArray(value)) {
      lines.push(value.length ? `${key}:` : `${key}: []`);
      for (const item of value) lines.push(`  - ${yamlString(String(item))}`);
    } else if (value === null) lines.push(`${key}:`);
    else if (typeof value === 'boolean' || typeof value === 'number') lines.push(`${key}: ${value}`);
    else lines.push(`${key}: ${yamlString(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

/** Propriedades que cabem no banco: as grandes demais saem (as primeiras ficam) */
function fitProps(props: NoteProps): { props: NoteProps; dropped: number } {
  const out: NoteProps = {};
  let dropped = 0;
  for (const [k, v] of Object.entries(props)) {
    const next = { ...out, [k]: v };
    if (JSON.stringify(next).length > PROPS_MAX) dropped++;
    else out[k] = v;
  }
  return { props: out, dropped };
}

// ---------- nomes de arquivo ----------

/** Nome de arquivo do título (sem os caracteres que o Obsidian e os sistemas recusam) */
export function safeFileName(title: string, fallback: string) {
  const base = title
    .replace(/[\\/:*?"<>|#^[\]\n\r\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 120)
    .trim();
  return base || fallback;
}

const baseName = (path: string) => (path.split('/').pop() ?? path).replace(/\.md$/i, '');

/** O caminho dentro do .zip, sem a pasta de fora que o zip de uma pasta costuma ter */
function skippable(path: string) {
  const parts = path.split('/');
  return (
    parts.some((p) => p.startsWith('.') || p === '__MACOSX') ||
    path.endsWith('/') ||
    !/\.md$/i.test(path)
  );
}

// ---------- importar ----------

export type VaultFile = { path: string; text: string };
export type ImportedNote = { id: string; title: string; body: string; props: NoteProps };
export type ImportResult = {
  notes: ImportedNote[];
  /** Arquivos que não são anotação (imagens, PDFs, .canvas) */
  skippedFiles: number;
  /** Anotações cortadas no limite de 20 mil caracteres */
  truncated: number;
  /** Além do teto de anotações por importação */
  overLimit: number;
  /** Links que ficaram para o que não existe (viram link apagado, como no Obsidian) */
  unresolved: number;
  /** Propriedades grandes demais, deixadas de fora */
  droppedProps: number;
};

export function importVault(
  files: readonly VaultFile[],
  opts: {
    newId: () => string;
    /** Anotações que já existem na conta: link para elas também resolve */
    existing?: readonly { id: string; title: string }[];
  },
): ImportResult {
  const md = files.filter((f) => !skippable(f.path));
  const skippedFiles = files.filter((f) => !f.path.endsWith('/')).length - md.length;
  const taken = md.slice(0, IMPORT_MAX);
  // Título → id (o primeiro com o nome vence, como o Obsidian quando há dois iguais)
  const byTitle = new Map<string, string>();
  const byPath = new Map<string, string>();
  const parsed = taken.map((f) => {
    const id = opts.newId();
    const title = baseName(f.path).slice(0, NOTE_TITLE_MAX).trim() || 'Sem título';
    const key = fold(title);
    if (!byTitle.has(key)) byTitle.set(key, id);
    byPath.set(fold(f.path.replace(/\.md$/i, '')), id);
    return { id, title, ...parseFrontmatter(f.text) };
  });
  // As do cofre primeiro; as que já existem na conta completam
  for (const n of opts.existing ?? []) {
    const key = fold(n.title.trim());
    if (key && !byTitle.has(key)) byTitle.set(key, n.id);
  }
  const titles = new Map(parsed.map((n) => [n.id, n.title]));
  for (const n of opts.existing ?? []) if (!titles.has(n.id)) titles.set(n.id, n.title);

  const resolve = (target: string): string | undefined => {
    const t = fold(target.replace(/\.md$/i, '').trim());
    if (byPath.has(t)) return byPath.get(t);
    // Caminho no link ([[Pasta/Nota]]): vale o fim, se não achou o caminho inteiro
    for (const [path, id] of byPath) if (path.endsWith(`/${t}`)) return id;
    return byTitle.get(t) ?? byTitle.get(fold(baseName(target)));
  };

  let truncated = 0;
  let unresolved = 0;
  let droppedProps = 0;
  const notes = parsed.map((n) => {
    let body = n.body;
    const links = parseLinks(body);
    // De trás para a frente: as posições de antes continuam valendo
    for (const link of [...links].reverse()) {
      if (link.kind) continue;
      const id = resolve(link.title);
      if (!id) {
        if (!/\.[a-z0-9]{2,5}$/i.test(link.title)) unresolved++;
        continue;
      }
      const markup = linkMarkup(titles.get(id) ?? link.title, 'note', id, link.anchor);
      body = body.slice(0, link.start) + (link.embed ? '!' : '') + markup + body.slice(link.end);
    }
    if (body.length > NOTE_BODY_MAX) {
      body = body.slice(0, NOTE_BODY_MAX);
      truncated++;
    }
    const fit = fitProps(n.props);
    droppedProps += fit.dropped;
    return { id: n.id, title: n.title, body, props: fit.props };
  });
  return {
    notes,
    skippedFiles,
    truncated,
    overLimit: md.length - taken.length,
    unresolved,
    droppedProps,
  };
}

// ---------- exportar ----------

export type ExportNote = {
  id: string;
  title: string;
  body: string;
  props: NoteProps;
  /** Pastas onde a anotação mora (raiz primeiro); vazio: no alto do cofre */
  dir: readonly string[];
};

/**
 * Um `.md` por anotação. Link para anotação exportada vira [[Nome do arquivo]] (com #seção e o
 * apelido quando o texto do link é outro); para tarefa, lista, pasta ou o que não foi exportado,
 * fica o nome (o Obsidian não tem onde apontar)
 */
export function exportVault(
  notes: readonly ExportNote[],
  opts: { untitled: string; resolve?: (kind: LinkKind, id: string) => string | null | undefined },
): VaultFile[] {
  const used = new Set<string>();
  const fileOf = new Map<string, { path: string; base: string }>();
  for (const n of notes) {
    const dir = n.dir.map((d) => safeFileName(d, '_')).join('/');
    const base0 = safeFileName(n.title, opts.untitled);
    let base = base0;
    // Nome repetido na mesma pasta: "Nome (2)"
    for (let i = 2; used.has(fold(`${dir}/${base}`)); i++) base = `${base0} (${i})`;
    used.add(fold(`${dir}/${base}`));
    fileOf.set(n.id, { path: `${dir ? `${dir}/` : ''}${base}.md`, base });
  }
  return notes.map((n) => {
    let body = n.body;
    for (const link of [...parseLinks(body)].reverse()) {
      if (!link.kind || !link.id) continue;
      const target = link.kind === 'note' ? fileOf.get(link.id) : undefined;
      let out: string;
      if (target) {
        const anchor = link.anchor ? `#${cleanLinkTitle(link.anchor)}` : '';
        const shown = cleanLinkTitle(link.title);
        out = `${link.embed ? '!' : ''}[[${target.base}${anchor}${shown !== target.base && !link.embed ? `|${shown}` : ''}]]`;
      } else {
        out = opts.resolve?.(link.kind, link.id) ?? link.title;
      }
      body = body.slice(0, link.start) + out + body.slice(link.end);
    }
    return { path: fileOf.get(n.id)!.path, text: toFrontmatter(n.props) + body };
  });
}
