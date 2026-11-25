// Casos de paridade das expressões (FN0, ESCOPO_V16 §11, D344): 500 expressões e variáveis geradas
// com semente fixa. O Jest calcula no Node e a Edge Function `expr-paridade` no Deno; os resultados
// precisam ser idênticos. Sem imports (roda no Node e no Deno); quem calcula é `avaliarExpr`.

function semente(n: number) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const VARS = {
  var: { n: 7, m: -2.5, z: 0, s: 'Ação Rápida', t: 'acao rapida', d: '2026-12-01', e: '2026-11-20', b: true, l: [3, 1, 'x', 2], vazio: '', nada: null },
  inicio: { titulo: 'Revisão da semana', prioridade: 2, etiquetas: ['casa', 'Estudo'] },
  pagina: { prop: { status: 'Estudando', nota: 9 } },
};
export const QUANDO = { today: '2026-11-25', now: '2026-11-25T12:34:56.000Z' };

const CAMPOS = ['var.n', 'var.m', 'var.z', 'var.s', 'var.t', 'var.d', 'var.e', 'var.b', 'var.l', 'var.vazio', 'var.nada', 'inicio.titulo', 'inicio.prioridade', 'inicio.etiquetas', 'pagina.prop.status', 'pagina.prop.nota', 'var.naoexiste'];
const TEXTOS = ['"ação"', '"x"', '""', '"Revisão"', '"2026-12-24"', '"10"'];
const FUNCOES: [string, number][] = [
  ['se', 3], ['dias_ate', 1], ['hoje', 0], ['agora', 0], ['arredondar', 2], ['min', 2], ['max', 3], ['abs', 1],
  ['e', 2], ['ou', 2], ['nao', 1], ['vazio', 1], ['tamanho', 1], ['contem', 2], ['if', 3], ['length', 1], ['contiene', 2], ['round', 1],
];
const OPS = ['+', '-', '*', '/', '=', '!=', '<', '>', '<=', '>='];

export function gerarCasos(n = 500, seed = 16): string[] {
  const r = semente(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const expr = (prof: number): string => {
    const k = r();
    if (prof >= 3 || k < 0.3) {
      const a = r();
      if (a < 0.35) return `{${pick(CAMPOS)}}`;
      if (a < 0.6) return String(Math.floor(r() * 20) - (r() < 0.2 ? 5 : 0));
      if (a < 0.7) return (r() * 10).toFixed(2);
      return pick(TEXTOS);
    }
    if (k < 0.6) return `${expr(prof + 1)} ${pick(OPS)} ${expr(prof + 1)}`;
    if (k < 0.68) return `(${expr(prof + 1)})`;
    if (k < 0.72) return `-${expr(prof + 1)}`;
    const [f, aridade] = pick(FUNCOES);
    return `${f}(${Array.from({ length: aridade }, () => expr(prof + 1)).join(', ')})`;
  };
  const out = Array.from({ length: n }, () => expr(0));
  // Alguns casos de erro de propósito
  out.push('se(1, 2)', '1 +', '"aberto', 'desconhecida(1)', '{}', '');
  return out;
}

