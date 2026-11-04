import type { NoteProps } from './note-props';

// Web Clipper (OB15, ESCOPO_V11, D305): a extensão do navegador abre /clip#<dados> com a página em
// Markdown, e o "Compartilhar" do celular (PB8) manda título, texto e link. Os dois viram uma
// anotação com a origem nas propriedades, como o Web Clipper do Obsidian (source, author, created).

export type Clip = {
  title: string;
  url: string | null;
  markdown: string;
  author?: string | null;
  description?: string | null;
  /** Data de publicação (AAAA-MM-DD), quando a página diz */
  published?: string | null;
  /** Só o trecho selecionado, não a página inteira */
  selection?: boolean;
};

const MAX_BODY = 19000;
const DATE = /^\d{4}-\d{2}-\d{2}/;

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) || null : null;

function httpUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    const url = new URL(v);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Dados do endereço (base64url de um JSON em UTF-8) → recorte conferido, ou null */
export function decodeClip(fragment: string): Clip | null {
  try {
    const b64 = fragment.replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!b64 || b64.length > 400_000) return null;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') return null;
    const url = httpUrl(raw.url);
    const markdown = typeof raw.markdown === 'string' ? raw.markdown.slice(0, MAX_BODY) : '';
    const title = str(raw.title, 200) ?? (url ? new URL(url).host : null);
    if (!title && !markdown.trim()) return null;
    const published = str(raw.published, 40);
    return {
      title: title ?? '',
      url,
      markdown,
      author: str(raw.author, 120),
      description: str(raw.description, 300),
      published: published && DATE.test(published) ? published.slice(0, 10) : null,
      selection: raw.selection === true,
    };
  } catch {
    return null;
  }
}

/** O contrário (a extensão faz o mesmo; aqui serve aos testes) */
export function encodeClip(clip: Partial<Clip>) {
  const bytes = new TextEncoder().encode(JSON.stringify(clip));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Recorte → anotação: o título, o texto (sem o link quando ele já está nas propriedades) e as
 * propriedades `source`, `author`, `published`, `created` e a etiqueta de recortes (`tag`, no idioma
 * da tela)
 */
export function clipNote(
  clip: Clip,
  { today, tag }: { today: string; tag: string },
): { title: string; body: string; props: NoteProps } {
  const props: NoteProps = {};
  if (clip.url) props.source = clip.url;
  if (clip.author) props.author = clip.author;
  if (clip.published) props.published = clip.published;
  props.created = today;
  if (clip.description) props.description = clip.description;
  props.tags = [tag];
  const body = clip.markdown.trim() || (clip.url ? `<${clip.url}>` : '');
  return { title: clip.title.slice(0, 200), body: body.slice(0, MAX_BODY), props };
}
