// O que chega pelo "Compartilhar" de outro app (PB8, D303): no Android, EXTRA_SUBJECT (título) e
// EXTRA_TEXT (texto, muitas vezes "título\nlink" ou só o link); na web instalada, title, text e url
// do share_target (o Chrome do Android põe o link no `text`). Aqui tudo vira título, linhas e link.

export type SharedInput = { title?: string | null; text?: string | null; url?: string | null };
export type SharedContent = {
  /** Título sugerido: o do outro app, ou a primeira linha */
  title: string;
  /** As linhas do texto, sem o título repetido nem o link */
  lines: string[];
  url: string | null;
};

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i;
// Pontuação que costuma colar no fim do link copiado de um texto
const TRAILING = /[).,;:!?\]}'"»]+$/;

export function sharedContent(input: SharedInput): SharedContent {
  const rawTitle = (input.title ?? '').trim();
  let text = (input.text ?? '').replace(/\r\n?/g, '\n').trim();
  let url = (input.url ?? '').trim() || null;
  if (!url) {
    const found = URL_RE.exec(text);
    if (found) url = found[0].replace(TRAILING, '');
  }
  if (url)
    text = text
      .split(url)
      .join('')
      // O que sobra em volta do link tirado: "()" vazio e espaço antes da pontuação
      .replace(/\(\s*\)|\[\s*\]/g, '')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
      .trim();
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    // "Título - Site" repetido no texto (o Chrome manda os dois)
    .filter((l) => l !== rawTitle);
  const title = (rawTitle || lines[0] || hostOf(url) || '').slice(0, 200);
  return { title, lines: rawTitle ? lines : lines.slice(1), url };
}

export function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Notas da tarefa criada a partir do compartilhado: o texto e, no fim, o link */
export function sharedNotes(content: SharedContent) {
  return [...content.lines, content.url].filter(Boolean).join('\n').slice(0, 10000);
}
