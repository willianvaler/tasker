// Texto para busca de exercícios (V6 §2): sem acento, minúsculas, pontuação vira espaço.

/** "Supino Reto (Barra)!" → "supino reto barra" */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Palavras da busca, sem as que não ajudam a achar ("de", "com", "the"...). */
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'na', 'no', 'em', 'e', 'a', 'o']);
const STOPWORDS_EN_ES = ['the', 'with', 'on', 'and', 'con', 'en', 'el', 'la', 'y'];
for (const word of STOPWORDS_EN_ES) STOPWORDS.add(word);

export function tokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t));
}
