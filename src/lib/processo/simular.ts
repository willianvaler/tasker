// Simulação de um processo (PR5, D354): roda o diagrama no aparelho, passo a passo, sem efeito
// nenhum. Tarefa de serviço vira "simulada" (mostra a ação que faria, com o texto expandido);
// tarefa humana responde com a escolha e o formulário de teste; esperas passam direto (ou pelo
// prazo, se pedido); subprocesso devolve saídas vazias. Nada sai daqui: não há banco nem rede.
import { expandir, registroBase } from '@/lib/automation/registry';

import { exprApi } from './index';
import {
  aposEspera,
  avancar,
  saidasDoNo,
  type Grafo,
  type Proximo,
} from '../../../supabase/functions/_shared/processo';

export type PassoSimulado = {
  no: string;
  tipo: string;
  nome?: string;
  acao?: Record<string, unknown>;
  espera?: string;
  erro?: string;
  vars: Record<string, unknown>;
};

export type OpcoesSimulacao = {
  vars?: Record<string, unknown>;
  inicio?: Record<string, unknown>;
  /** Escolha da tarefa humana (por nó; senão, a primeira) */
  escolhas?: Record<string, string>;
  /** Formulário de teste por nó */
  formularios?: Record<string, Record<string, unknown>>;
  /** Esperas que vencem o prazo (por nó) */
  prazos?: string[];
  agora?: string;
};

export function simularProcesso(
  g: Grafo,
  o: OpcoesSimulacao = {},
): { passos: PassoSimulado[]; fim: 'concluida' | 'falhou' | 'limite'; erro?: string } {
  const agora = o.agora ?? new Date().toISOString();
  const hoje = agora.slice(0, 10);
  let vars: Record<string, unknown> = { ...(o.vars ?? {}) };
  const inicio = o.inicio ?? {};
  const passos: PassoSimulado[] = [];
  const reg = registroBase();
  const inicioNo = g.nos.find((n) => n.tipo === 'inicio');
  if (!inicioNo) return { passos, fim: 'falhou', erro: 'sem_inicio' };
  let fila: (Proximo & { retorno?: Record<string, unknown> })[] = [{ no: inicioNo.id, escopo: {} }];
  const naJuncao = new Map<string, number>();
  for (let k = 0; k < 500 && fila.length; k++) {
    const atual = fila.shift() as Proximo & { retorno?: Record<string, unknown> };
    const no = g.nos.find((n) => n.id === atual.no);
    const ctx = { vars, inicio, hoje, agora, ...(atual.retorno ? { retorno: atual.retorno } : {}) };
    if (atual.retorno) {
      vars = { ...vars, ...saidasDoNo(g, atual.no, ctx, exprApi) };
      fila.push(
        ...aposEspera(g, atual.no, atual.escopo ?? {}, {
          escolha: atual.retorno.escolha as string | undefined,
          prazo: atual.retorno.prazo === true,
        }),
      );
      continue;
    }
    const d = avancar(g, atual.no, atual.escopo ?? {}, ctx, exprApi);
    const base = { no: atual.no, tipo: no?.tipo ?? '?', nome: no?.nome };
    if (d.tipo === 'falha') {
      passos.push({ ...base, erro: d.erro, vars });
      return { passos, fim: 'falhou', erro: d.erro };
    }
    if (d.tipo === 'fim') {
      passos.push({ ...base, vars, ...(d.erro ? { erro: d.erro } : {}) });
      if (d.erro) return { passos, fim: 'falhou', erro: d.erro };
      continue;
    }
    if (d.tipo === 'juntar') {
      const n = (naJuncao.get(d.no) ?? 0) + 1;
      naJuncao.set(d.no, n);
      if (n >= d.esperados) {
        naJuncao.delete(d.no);
        passos.push({ ...base, vars });
        fila.push(...d.seguir);
      }
      continue;
    }
    if (d.tipo === 'esperar') {
      const espera = d.espera;
      const prazo = (o.prazos ?? []).includes(atual.no);
      let retorno: Record<string, unknown> = prazo ? { prazo: true } : {};
      if (espera.tipo === 'humana' && !prazo) {
        const escolhas = (espera.escolhas as string[]) ?? [];
        retorno = {
          escolha: o.escolhas?.[atual.no] ?? escolhas[0],
          formulario: o.formularios?.[atual.no] ?? {},
        };
      }
      if (espera.tipo === 'subprocesso' || espera.tipo === 'multi')
        retorno = { saidas: espera.tipo === 'multi' ? [] : {} };
      const estado = { evento: { ...inicio }, var: vars };
      const titulo =
        espera.tipo === 'humana'
          ? expandir(
              String(espera.titulo ?? ''),
              { estado, escopo: 'pessoal', regra: { id: 's', nome: 's' }, agora },
              [],
            )
          : undefined;
      passos.push({ ...base, espera: titulo ?? String(espera.tipo), vars });
      fila.push({ no: atual.no, escopo: atual.escopo, retorno });
      continue;
    }
    // seguir
    vars = { ...vars, ...(d.vars ?? {}) };
    let acao: Record<string, unknown> | undefined;
    if (d.efeito) {
      const passo = reg.get(d.efeito.tipo);
      const r = passo?.execute(
        {
          estado: { evento: { ...inicio }, var: vars },
          escopo: 'pessoal',
          regra: { id: 's', nome: 's' },
          agora,
        },
        d.efeito,
      );
      if (!passo || r?.erro) {
        passos.push({ ...base, erro: r?.erro ?? `Ação ${d.efeito.tipo}`, vars });
        return { passos, fim: 'falhou', erro: r?.erro };
      }
      // Simulada: mostra o que faria (webhook inclusive), sem fazer
      acao = r?.efeito ?? d.efeito;
    }
    passos.push({ ...base, vars, ...(acao ? { acao } : {}) });
    fila.push(...d.proximos);
  }
  return fila.length ? { passos, fim: 'limite' } : { passos, fim: 'concluida' };
}
