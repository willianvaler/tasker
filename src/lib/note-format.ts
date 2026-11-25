// Formato das anotações (ED1, ESCOPO_V16, docs/FORMATO_NOTAS.md, D345): o texto É o Markdown, e os
// blocos são só uma leitura dele, por posição. Assim nada se reescreve: remontar os blocos (com o
// que fica entre eles) dá exatamente o texto de entrada, para qualquer entrada (teste com fuzz).
// O ID de bloco (`^abc123` no fim do bloco, como no Obsidian) só entra quando alguém referencia o
// bloco (ED2). Funções puras, com testes.

export type TipoBloco =
  | 'propriedades'
  | 'titulo'
  | 'paragrafo'
  | 'lista'
  | 'citacao'
  | 'codigo'
  | 'formula'
  | 'tabela'
  | 'consulta'
  | 'botao'
  | 'regua';

export type Bloco = {
  tipo: TipoBloco;
  /** Posição no texto: [inicio, fim) */
  inicio: number;
  fim: number;
  /** `^id` do bloco, se tiver */
  id?: string;
  /** Linguagem da cerca de código (```ts, ```questlist, ```questlist-button) */
  linguagem?: string;
  /** Cerca ou fórmula que não fecha até o fim do texto (não ganha ID: ele cairia dentro) */
  aberto?: boolean;
};

/** `^id` no fim do bloco: letras, números e hífen, até 32 (o Obsidian aceita o mesmo). */
export const ID_BLOCO = /(?:^|[ \t])\^([A-Za-z0-9-]{1,32})[ \t]*$/;
/** O ID sozinho numa linha depois do bloco (o jeito do Obsidian para código, tabela e citação) */
const ID_SOZINHO = /^\^([A-Za-z0-9-]{1,32})[ \t]*$/;

const CERCA = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const LISTA = /^\s*(?:[-*+]|\d+[.)])\s/;
const REGUA = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;

type Linha = { texto: string; inicio: number; fim: number };

function linhas(md: string): Linha[] {
  const out: Linha[] = [];
  let i = 0;
  while (i <= md.length) {
    const nl = md.indexOf('\n', i);
    const fim = nl < 0 ? md.length : nl;
    out.push({ texto: md.slice(i, fim).replace(/\r$/, ''), inicio: i, fim });
    if (nl < 0) break;
    i = nl + 1;
  }
  return out;
}

const vazia = (l: Linha) => l.texto.trim() === '';

/** Os blocos do texto, em ordem. O que fica entre eles são só linhas vazias. */
export function blocos(md: string): Bloco[] {
  const ls = linhas(md);
  const out: Bloco[] = [];
  let i = 0;
  const fechar = (tipo: TipoBloco, de: number, ate: number, extra: Partial<Bloco> = {}) => {
    let fimLinha = ate;
    let id: string | undefined;
    // ID sozinho na linha seguinte (sem linha vazia no meio) pertence a este bloco
    const prox = ls[ate + 1];
    if (prox && ID_SOZINHO.test(prox.texto)) {
      id = ID_SOZINHO.exec(prox.texto)?.[1];
      fimLinha = ate + 1;
    } else if (tipo !== 'codigo' && tipo !== 'formula' && tipo !== 'botao' && tipo !== 'consulta') {
      id = ID_BLOCO.exec(ls[ate].texto)?.[1];
    }
    out.push({
      tipo,
      inicio: ls[de].inicio,
      fim: ls[fimLinha].fim,
      ...(id ? { id } : {}),
      ...extra,
    });
    i = fimLinha + 1;
  };
  while (i < ls.length) {
    const l = ls[i];
    if (vazia(l)) {
      i++;
      continue;
    }
    const t = l.texto;
    // Cabeçalho de dados no começo (o que a exportação grava; a anotação guarda em props)
    if (i === 0 && t.trim() === '---') {
      let j = i + 1;
      while (j < ls.length && ls[j].texto.trim() !== '---') j++;
      if (j < ls.length) {
        fechar('propriedades', i, j);
        continue;
      }
    }
    const cerca = CERCA.exec(t);
    if (cerca) {
      const marca = cerca[1];
      const lang = cerca[2] ?? '';
      let j = i + 1;
      while (
        j < ls.length &&
        !new RegExp(`^ {0,3}${marca[0]}{${marca.length},}\\s*$`).test(ls[j].texto)
      )
        j++;
      const ate = Math.min(j, ls.length - 1);
      const aberto = j >= ls.length;
      const tipo: TipoBloco =
        lang === 'questlist-button' ? 'botao' : lang === 'questlist' ? 'consulta' : 'codigo';
      fechar(tipo, i, ate, {
        ...(lang ? { linguagem: lang } : {}),
        ...(aberto ? { aberto: true } : {}),
      });
      continue;
    }
    if (t.trim().startsWith('$$')) {
      let j = i;
      if (!(t.trim().length > 2 && t.trim().endsWith('$$'))) {
        j = i + 1;
        while (j < ls.length && !ls[j].texto.trim().endsWith('$$')) j++;
      }
      fechar('formula', i, Math.min(j, ls.length - 1), j >= ls.length ? { aberto: true } : {});
      continue;
    }
    if (/^ {0,3}#{1,6}(\s|$)/.test(t)) {
      fechar('titulo', i, i);
      continue;
    }
    if (REGUA.test(t)) {
      fechar('regua', i, i);
      continue;
    }
    const enquanto = (teste: (x: Linha) => boolean) => {
      let j = i;
      while (j + 1 < ls.length && teste(ls[j + 1])) j++;
      return j;
    };
    if (/^ {0,3}>/.test(t)) {
      fechar(
        'citacao',
        i,
        enquanto((x) => /^ {0,3}>/.test(x.texto)),
      );
      continue;
    }
    if (/^ {0,3}\|/.test(t)) {
      fechar(
        'tabela',
        i,
        enquanto((x) => /^ {0,3}\|/.test(x.texto)),
      );
      continue;
    }
    if (LISTA.test(t)) {
      // Itens e as linhas recuadas que continuam o item
      fechar(
        'lista',
        i,
        enquanto((x) => !vazia(x) && (LISTA.test(x.texto) || /^\s+\S/.test(x.texto))),
      );
      continue;
    }
    fechar(
      'paragrafo',
      i,
      enquanto(
        (x) =>
          !vazia(x) &&
          !CERCA.test(x.texto) &&
          !/^ {0,3}(#{1,6}(\s|$)|>|\|)/.test(x.texto) &&
          !LISTA.test(x.texto),
      ),
    );
  }
  return out;
}

export const textoDoBloco = (md: string, b: Bloco) => md.slice(b.inicio, b.fim);

export function blocoPorId(md: string, id: string): Bloco | undefined {
  return blocos(md).find((b) => b.id === id);
}

/** ID novo de 6 letras e números (o formato curto do Obsidian). */
export function novoIdBloco(aleatorio: () => number = Math.random): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 6 }, () => abc[Math.floor(aleatorio() * abc.length)]).join('');
}

/**
 * O ID do bloco, criando quando ainda não tem (ED2: só o bloco referenciado ganha ID). Texto e
 * lista ganham ` ^id` no fim da última linha; código, fórmula, tabela e citação, uma linha
 * `^id` logo depois. Nada mais no texto muda.
 */
export function garantirIdBloco(
  md: string,
  indice: number,
  gerar: () => string = novoIdBloco,
): { md: string; id: string } | null {
  const lista = blocos(md);
  const b = lista[indice];
  if (!b || b.aberto) return null;
  if (b.id) return { md, id: b.id };
  const usados = new Set(lista.map((x) => x.id).filter(Boolean));
  let id = gerar();
  for (let k = 0; usados.has(id) && k < 20; k++) id = gerar();
  const separado = [
    'codigo',
    'formula',
    'tabela',
    'citacao',
    'botao',
    'consulta',
    'propriedades',
    'regua',
  ].includes(b.tipo);
  const fim = md[b.fim - 1] === '\r' ? b.fim - 1 : b.fim;
  const marca = separado ? `\n^${id}` : ` ^${id}`;
  return { md: md.slice(0, fim) + marca + md.slice(fim), id };
}

/** O texto do bloco sem o `^id` (para mostrar na transclusão, ED2). */
export function semIdBloco(texto: string): string {
  // Só o ID do fim: a última linha sozinha (`^id`) ou o ` ^id` no fim da última linha
  const ls = texto.split('\n');
  if (ls.length > 1 && ID_SOZINHO.test(ls[ls.length - 1].replace(/\r$/, ''))) {
    return ls.slice(0, -1).join('\n');
  }
  return texto.replace(/[ \t]\^[A-Za-z0-9-]{1,32}[ \t]*(\r?)$/, '$1');
}

/** O que a importação normaliza (e só ela: abrir e salvar não mexem no texto): fim de linha. */
export function normalizar(md: string): string {
  return md.replace(/\r\n?/g, '\n');
}

// ---------------------------------------------------------------------------------------------
// Bloco de botão (ED4): cerca ```questlist-button com JSON
// ---------------------------------------------------------------------------------------------

export type Botao = {
  rotulo: string;
  acao: Record<string, unknown> & { tipo: string };
  confirmar?: boolean;
};

/** Lê o JSON do botão; null se não for um botão válido (aí aparece como código, sem rodar). */
export function lerBotao(conteudo: string): Botao | null {
  try {
    const v = JSON.parse(conteudo) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const acao = o.acao as Record<string, unknown> | undefined;
    if (typeof o.rotulo !== 'string' || !o.rotulo.trim() || o.rotulo.length > 80) return null;
    if (!acao || typeof acao !== 'object' || typeof acao.tipo !== 'string') return null;
    return {
      rotulo: o.rotulo.trim(),
      acao: acao as Botao['acao'],
      ...(o.confirmar === true ? { confirmar: true } : {}),
    };
  } catch {
    return null;
  }
}

/** O conteúdo de dentro da cerca (sem a primeira e a última linha). */
export function conteudoDaCerca(texto: string): string {
  const ls = texto.split('\n');
  const fecha =
    ls.length > 1 && /^ {0,3}(`{3,}|~{3,})\s*$/.test(ls[ls.length - 1]) ? ls.length - 1 : ls.length;
  return ls.slice(1, fecha).join('\n');
}

// ---------------------------------------------------------------------------------------------
// Mesclar por bloco (ED6): a versão em conflito volta sem apagar nada da atual
// ---------------------------------------------------------------------------------------------

/**
 * Junta a versão atual com a que ficou em conflito, bloco a bloco: tudo da atual fica, e cada bloco
 * da outra que a atual não tem entra logo depois do bloco que vinha antes dele na outra (ou no
 * começo). Bloco igual (mesmo texto, sem contar espaço no fim) não se repete. Não é por caractere:
 * um parágrafo mudado nos dois lados fica duas vezes, um embaixo do outro, para a pessoa escolher.
 */
export function mesclarPorBloco(atual: string, outra: string): string {
  const chave = (t: string) =>
    t
      .replace(/\r/g, '')
      .replace(/[ \t]+$/gm, '')
      .trim();
  const a = blocos(atual).map((b) => textoDoBloco(atual, b));
  const o = blocos(outra).map((b) => textoDoBloco(outra, b));
  const out = [...a];
  const tem = new Set(a.map(chave));
  let ultimo = -1; // posição em `out` do último bloco da outra que já está no resultado
  for (const t of o) {
    const k = chave(t);
    const ja = out.findIndex((x, i) => i > ultimo && chave(x) === k);
    if (tem.has(k) && ja >= 0) {
      ultimo = ja;
      continue;
    }
    if (tem.has(k)) continue;
    out.splice(ultimo + 1, 0, t);
    tem.add(k);
    ultimo += 1;
  }
  return out.join('\n\n');
}
