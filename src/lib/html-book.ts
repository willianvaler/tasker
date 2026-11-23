// HTML de estudo → anotações (ES5, ESCOPO_V13 §3, D326). O texto passa pelo conversor do Web
// Clipper (`htmlToMarkdown`, D305) e sai como arquivos `.md` de um cofre (o importador do OB13 liga
// os [[links]] pelo título e traz as imagens, ES3). Página longa (o livro inteiro num index.html)
// vira um sumário e uma anotação por parte, cortada nos títulos; o livro de várias páginas (pasta
// com index.html) troca os links entre páginas por [[links]]. O que é quase só script (simulador)
// não tem texto para converter: fica como arquivo, aberto isolado.

import { htmlToMarkdown } from './html-markdown';
import { tr } from './i18n-ref';
import { htmlTitle, parseHtml } from './html-parse';
import type { VaultFile } from './vault';

/** Endereço de mentira que o conversor usa como base (ele só mantém http): trocado depois */
const BASE = 'https://material.invalid/b/';
/** Tamanho de cada parte (a anotação guarda até 20 mil caracteres) */
export const PART_MAX = 18000;
/** Menos texto que isso, com script, é página interativa */
const INTERACTIVE_TEXT = 300;

export const isHtmlFile = (name: string) => /\.html?$/i.test(name);
const baseName = (path: string) => path.split('/').pop() ?? path;
const dirName = (path: string) => path.split('/').slice(0, -1).join('/');
const stripHtml = (name: string) => name.replace(/\.html?$/i, '');

/** Título que serve de nome de arquivo e de alvo de [[link]] */
export function safeTitle(text: string) {
  return text
    .replace(/[[\]|#^\\/:*?"<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

/** Só script, quase sem texto: o simulador do PhET, por exemplo */
export function isInteractive(html: string, markdown: string) {
  const text = markdown.replace(/!\[[^\]]*\]\([^)]*\)|[#>*_`|~=\-\s]/g, '');
  return /<script\b/i.test(html) && text.length < INTERACTIVE_TEXT;
}

/**
 * Corta o Markdown em partes de até `max`, de preferência antes de um título (#, ##, ###), depois
 * entre parágrafos e, no último caso, no meio
 */
export function splitMarkdown(markdown: string, max = PART_MAX): string[] {
  const sections = markdown.split(/\n(?=#{1,3} )/);
  const parts: string[] = [];
  let current = '';
  const push = (piece: string) => {
    if (current && current.length + piece.length + 1 > max) {
      parts.push(current.trim());
      current = '';
    }
    current = current ? `${current}\n${piece}` : piece;
  };
  for (const section of sections) {
    if (section.length <= max) {
      push(section);
      continue;
    }
    for (const para of section.split(/\n\n/)) {
      if (para.length <= max) push(`${para}\n`);
      else for (let i = 0; i < para.length; i += max) push(para.slice(i, i + max));
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** O primeiro título da parte, para o nome dela */
function firstHeading(part: string) {
  const lines = part.split('\n').filter((l) => /^#{1,3} /.test(l));
  // "CHAPTER I" seguido do assunto ("THE EDUCATION OF THE ARCHITECT"): junta os dois
  const [a, b] = lines.map((l) => l.replace(/^#+ /, '').trim());
  if (a && b && a.length < 20 && lines[0].startsWith('## ') && lines[1]?.startsWith('### '))
    return `${a} ${b}`;
  return a ?? '';
}

export type HtmlPage = { path: string; html: string };
export type HtmlGroup = {
  /** Nome do material (o da pasta do livro, ou o do arquivo) */
  name: string;
  dir: string;
  pages: HtmlPage[];
  /** Pasta com index.html (o nome é o da pasta) */
  book: boolean;
};

/**
 * Junta os HTML: a pasta com index.html é um livro (um material só); os outros, um material cada
 */
export function groupHtml(pages: readonly HtmlPage[]): HtmlGroup[] {
  const byDir = new Map<string, HtmlPage[]>();
  for (const p of pages) byDir.set(dirName(p.path), [...(byDir.get(dirName(p.path)) ?? []), p]);
  const groups: HtmlGroup[] = [];
  for (const [dir, list] of byDir) {
    const index = list.find((p) => /^index\.html?$/i.test(baseName(p.path)));
    if (index && dir) {
      // O índice primeiro: ele é o sumário (e o nome do livro é o da pasta)
      groups.push({
        name: baseName(dir),
        dir,
        pages: [index, ...list.filter((p) => p !== index)],
        book: true,
      });
    } else
      for (const p of list)
        groups.push({ name: stripHtml(baseName(p.path)), dir, pages: [p], book: false });
  }
  return groups;
}

export type HtmlConversion = {
  /** Os .md (no mesmo lugar do HTML, para as imagens relativas resolverem) */
  files: VaultFile[];
  /** Título da anotação que é o material (o sumário do livro ou a própria página) */
  mainTitle: string | null;
  /** HTML sem texto (simulador): fica como arquivo */
  interactive: boolean;
};

/** Um material em HTML → as anotações dele (ou "interativo") */
export function convertHtmlGroup(group: HtmlGroup): HtmlConversion {
  const name = safeTitle(group.name) || 'HTML';
  const prefix = group.dir ? `${group.dir}/` : '';
  const pages = group.pages.map((p, i) => {
    const file = baseName(p.path);
    const markdown = htmlToMarkdown(parseHtml(p.html), BASE + encodeURI(file), Infinity);
    const own = safeTitle(htmlTitle(p.html)) || stripHtml(file);
    return { file, html: p.html, markdown, title: i === 0 ? name : safeTitle(`${name} · ${own}`) };
  });
  if (pages.length === 1 && isInteractive(pages[0].html, pages[0].markdown))
    return { files: [], mainTitle: null, interactive: true };

  const titleOf = new Map(pages.map((p) => [p.file.toLowerCase(), p.title]));
  const relink = (markdown: string) =>
    markdown
      // Imagem: o caminho relativo à página (o importador acha pelo caminho ou pelo nome)
      .replace(/!\[([^\]]*)\]\(https:\/\/material\.invalid\/b\/([^)\s]+)\)/g, (_, alt, path) => {
        const clean = safeDecode(path.split('#')[0].split('?')[0]);
        return `![${alt}](<${clean}>)`;
      })
      // Link para outra página do livro: [[link]]; para a mesma página ou para fora: só o texto
      .replace(/\[([^\]]*)\]\(https:\/\/material\.invalid\/([^)\s]*)\)/g, (_, text, path) => {
        const target = safeDecode(path.replace(/^b\//, '').split('#')[0]).toLowerCase();
        const title = path.startsWith('b/') ? titleOf.get(target) : undefined;
        return title ? `[[${title}|${String(text).replace(/\|/g, ' ')}]]` : text;
      });

  const files: VaultFile[] = [];
  for (const page of pages) files.push(...splitLongNote(page.title, relink(page.markdown), prefix));
  return { files, mainTitle: name, interactive: false };
}

/**
 * Texto maior que uma anotação: um sumário (com o título e o cabeçalho de propriedades, se houver) e
 * uma anotação por parte, cortada nos títulos, com anterior · sumário · próxima. O que cabe vai inteiro
 */
export function splitLongNote(title: string, markdown: string, prefix = ''): VaultFile[] {
  if (markdown.length <= PART_MAX) return [{ path: `${prefix}${title}.md`, text: markdown }];
  // O frontmatter (propriedades) fica no sumário
  const front = /^---\n[\s\S]*?\n---\n/.exec(markdown)?.[0] ?? '';
  const parts = splitMarkdown(markdown.slice(front.length));
  const width = String(parts.length).length;
  const titles = parts.map((part, i) => {
    const n = String(i + 1).padStart(Math.max(2, width), '0');
    return safeTitle(`${shortName(title)} · ${n} ${firstHeading(part)}`.slice(0, 160));
  });
  const files = parts.map((part, i) => {
    const nav = [
      i > 0 ? `← [[${titles[i - 1]}|${tr('materials.prev')}]]` : null,
      `[[${title}|${tr('materials.contents')}]]`,
      i < parts.length - 1 ? `[[${titles[i + 1]}|${tr('materials.next')}]] →` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return { path: `${prefix}${titles[i]}.md`, text: `${part}\n\n---\n\n${nav}` };
  });
  files.push({
    path: `${prefix}${title}.md`,
    text: `${front}${titles.map((t) => `- [[${t}]]`).join('\n')}`,
  });
  return files;
}

/** O nome sem o parêntese do fim ("Livro (abrir index.html)" → "Livro"), para o título das partes */
export function shortName(title: string) {
  return title.replace(/\s*\([^)]*\)\s*$/, '').trim() || title;
}

function safeDecode(text: string) {
  try {
    return decodeURI(text);
  } catch {
    return text;
  }
}
