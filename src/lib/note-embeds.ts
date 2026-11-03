// Incorporar com ![[...]] (OB6, ESCOPO_V11 §7, D291): a linha que é só um ![[...]] vira um bloco
// dentro da anotação (outra anotação ou um trecho dela, uma lista com as caixinhas de verdade, uma
// tarefa ou uma imagem dos anexos). Funções puras, com testes.

import { parseLinks, headingKey, type WikiLink } from '@/lib/wikilinks';

/** Marca que fica no lugar do ![[...]] até a hora de desenhar (não é Markdown que se escreva) */
const MARK = '%%questlist-embed:';
const QUERY_MARK = '%%questlist-query:';
const MARK_LINE = /^%%questlist-(embed|query):(\d+)%%$/;
/** A cerca de código da consulta (OB7): ```questlist (também ```query e ```consulta) */
const QUERY_FENCE = /^\s*```\s*(questlist|query|consulta)\s*$/i;

/** Arquivo de imagem pelo nome (o ![[foto.png]] do Obsidian) */
export const IMAGE_FILE = /\.(png|jpe?g|gif|webp|avif|heic|bmp|svg)$/i;

/** Quantos níveis de anotação dentro de anotação (evita voltas: A incorpora B que incorpora A) */
export const MAX_EMBED_DEPTH = 2;

/**
 * Troca as linhas que são só um ![[...]] (fora das cercas de código) por uma marca numerada e
 * devolve os links na ordem. O resto do texto passa como está.
 */
export function extractEmbeds(text: string): {
  text: string;
  embeds: WikiLink[];
  queries: string[];
} {
  const embeds: WikiLink[] = [];
  const queries: string[] = [];
  if (!text.includes('![[') && !text.includes('```')) return { text, embeds, queries };
  let fence = false;
  // A consulta aberta: as linhas dela até fechar a cerca
  let query: string[] | null = null;
  const lines = text.split('\n').flatMap((line): string[] => {
    if (query) {
      if (/^\s*```\s*$/.test(line)) {
        queries.push(query.join('\n').trim());
        query = null;
        return [`${QUERY_MARK}${queries.length - 1}%%`];
      }
      query.push(line);
      return [];
    }
    if (!fence && QUERY_FENCE.test(line)) {
      query = [];
      return [];
    }
    if (/^\s*```/.test(line)) {
      fence = !fence;
      return [line];
    }
    if (fence || !line.trimStart().startsWith('![[')) return [line];
    const trimmed = line.trim();
    const links = parseLinks(trimmed);
    if (links.length !== 1 || !links[0].embed || links[0].start !== 0) return [line];
    if (links[0].end !== trimmed.length) return [line];
    embeds.push(links[0]);
    return [`${MARK}${embeds.length - 1}%%`];
  });
  // Cerca da consulta sem fechar: vale até o fim (como o Markdown faz com o código)
  const open = query as string[] | null;
  if (open) {
    queries.push(open.join('\n').trim());
    lines.push(`${QUERY_MARK}${queries.length - 1}%%`);
  }
  return { text: lines.join('\n'), embeds, queries };
}

export type EmbedPart =
  | { kind: 'markdown'; text: string }
  | { kind: 'embed'; index: number }
  | { kind: 'query'; index: number };

/** Separa um trecho de Markdown nas marcas do `extractEmbeds` */
export function splitEmbedMarks(text: string): EmbedPart[] {
  if (!text.includes('%%questlist-')) return [{ kind: 'markdown', text }];
  const out: EmbedPart[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.join('\n').trim()) out.push({ kind: 'markdown', text: buffer.join('\n') });
    buffer = [];
  };
  for (const line of text.split('\n')) {
    const m = MARK_LINE.exec(line.trim());
    if (!m) {
      buffer.push(line);
      continue;
    }
    flush();
    out.push({ kind: m[1] === 'query' ? 'query' : 'embed', index: Number(m[2]) });
  }
  flush();
  return out;
}

/** O que o ![[...]] incorpora */
export function embedTarget(
  link: WikiLink,
):
  | { kind: 'note' | 'task' | 'page' | 'folder'; id: string }
  | { kind: 'image'; name: string }
  | { kind: 'missing' } {
  if (link.kind && link.id) return { kind: link.kind, id: link.id };
  if (IMAGE_FILE.test(link.title)) return { kind: 'image', name: link.title };
  return { kind: 'missing' };
}

/**
 * O trecho de uma anotação embaixo do título `anchor` ([[Anotação#Seção]]): do título até o
 * próximo de nível igual ou maior. Sem achar, a anotação inteira.
 */
export function noteSection(body: string, anchor: string | null): string {
  if (!anchor) return body;
  const key = headingKey(anchor);
  const lines = body.split('\n');
  let fence = false;
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const m = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[i]);
    if (!m) continue;
    if (start < 0) {
      if (headingKey(m[2]) === key) {
        start = i;
        level = m[1].length;
      }
    } else if (m[1].length <= level) return lines.slice(start, i).join('\n').trimEnd();
  }
  return start < 0 ? body : lines.slice(start).join('\n').trimEnd();
}

/** As primeiras linhas, sem marcação pesada, para a prévia ao passar o mouse */
export function previewLines(body: string, max = 6): string {
  const out: string[] = [];
  let fence = false;
  for (const line of body.split('\n')) {
    if (/^\s*```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence || !line.trim()) continue;
    out.push(line.trim());
    if (out.length >= max) break;
  }
  return out.join('\n');
}
