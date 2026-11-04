// Captura por voz (PB7, V3 §6 B, D302): o reconhecedor devolve uma frase por pausa; cada frase vira
// uma linha do "Adicionar várias", e dentro dela "próximo item" / "next item" / "siguiente tarea" (e
// parecidos) também separam. Só expressões de duas palavras: "próxima" sozinha é a "próxima semana"
// da data, e "depois" é o "depois de amanhã". O resto da sintaxe rápida (amanhã, !!) fica com o
// parser de sempre.

const SEPARATORS: Record<'pt' | 'en' | 'es', string[]> = {
  pt: ['próximo item', 'próxima tarefa', 'nova tarefa', 'nova linha', 'ponto e vírgula'],
  en: ['next item', 'next task', 'new task', 'new line', 'semicolon'],
  es: ['siguiente tarea', 'siguiente cosa', 'nueva tarea', 'nueva línea', 'punto y coma'],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function separatorRe(lang: string) {
  const key = lang.startsWith('en') ? 'en' : lang.startsWith('es') ? 'es' : 'pt';
  // Mais longos primeiro; só a palavra inteira, sem acento obrigatório (o reconhecedor às vezes tira)
  const words = [...SEPARATORS[key]]
    .sort((a, b) => b.length - a.length)
    .map((w) =>
      escape(w).replace(/[óo]/g, '[óo]').replace(/[íi]/g, '[íi]').replace(/[ée]/g, '[ée]'),
    );
  return new RegExp(`(?:^|[\\s,.;]+)(?:${words.join('|')})(?=$|[\\s,.;]+)[\\s,.;]*`, 'giu');
}

/** Uma frase ditada → linhas (sem pontuação final, com a primeira letra maiúscula) */
export function spokenLines(transcript: string, lang: string): string[] {
  return transcript
    .replace(separatorRe(lang), '\n')
    .split(/\n|;/)
    .map((line) =>
      line
        .trim()
        .replace(/^[,.;:]+|[,.;:?]+$/g, '')
        .trim(),
    )
    .filter(Boolean)
    .map((line) => line.charAt(0).toLocaleUpperCase(lang) + line.slice(1));
}

/** Idioma da interface → idioma do reconhecedor */
export function speechLang(lang: string | undefined) {
  if (lang?.startsWith('en')) return 'en-US';
  if (lang?.startsWith('es')) return 'es-ES';
  return 'pt-BR';
}
