import { parseLinks } from './wikilinks';

// Anotação publicada (OB14, D300): a página pública só mostra o conjunto publicado. Antes de
// desenhar, os links para fora dele viram o texto escrito (sem link), os ![[...]] viram link comum
// (ou texto) e as consultas ```questlist viram código: incorporar e consultar leriam dados da conta
// de quem escreveu, que a página pública não tem.

const escape = (s: string) => s.replace(/([\\`*_~<>[\]])/g, '\\$1');

export function publicBody(body: string, inSet: (noteId: string) => boolean): string {
  let out = body.replace(/^(\s*)```questlist\b.*$/gm, '$1```');
  const links = parseLinks(out);
  for (let i = links.length - 1; i >= 0; i--) {
    const l = links[i];
    const raw = out.slice(l.start, l.end);
    const keep = l.kind === 'note' && !!l.id && inSet(l.id);
    const replacement = keep
      ? raw.replace(/^!/, '')
      : escape(l.alias ?? (l.anchor ? `${l.title} › ${l.anchor}` : l.title));
    out = out.slice(0, l.start) + replacement + out.slice(l.end);
  }
  return out;
}
