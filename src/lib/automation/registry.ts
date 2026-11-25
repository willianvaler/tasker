// Registro de tipos das automações (ESCOPO_V14 §6.3, AU2, D334). O motor é o mesmo do servidor
// (supabase/functions/_shared/automation-engine.ts, que a Edge Function `automation-run` usa); aqui
// ganham os rótulos nos três idiomas, para o editor (AU7). O catálogo é espelho do
// automation_catalog() do banco, que valida as regras (o teste compara os dois).
import { tr } from '@/lib/i18n-ref';

import {
  CATALOGO,
  createRegistry,
  PASSOS_BASE,
  type Escopo,
  type TipoPasso,
} from '../../../supabase/functions/_shared/automation-engine';

export {
  advance,
  avaliar,
  expandir,
  resolver,
  CATALOGO,
  compile,
  createRegistry,
  executeRun,
  PASSOS_BASE,
  registroBase,
  simulate,
  LIMITE_EXECUCAO_MS,
  vencimentoDe,
} from '../../../supabase/functions/_shared/automation-engine';
export type {
  Commit,
  CommitFn,
  Condicao,
  ExternoFn,
  LinhaSimulada,
  ResultadoExterno,
  Contexto,
  Efeito,
  Escopo,
  Estado,
  Execucao,
  Passo,
  Resultado,
  TipoPasso,
} from '../../../supabase/functions/_shared/automation-engine';

/** Chave do i18n: o id com ponto (`tarefa.criada`) vira `tarefa_criada`. */
const key = (id: string) => id.replace(/\./g, '_');

export type TipoGatilhoInfo = { id: string; escopos: Escopo[]; label: () => string };
export type TipoPassoInfo = {
  id: string;
  escopos: Escopo[];
  externo: boolean;
  label: () => string;
};

export const GATILHOS: TipoGatilhoInfo[] = Object.entries(CATALOGO.gatilhos).map(([id, meta]) => ({
  id,
  escopos: meta.escopos,
  label: () => tr(`auto.motor.gatilho.${key(id)}`),
}));

export const PASSOS: TipoPassoInfo[] = Object.entries(CATALOGO.passos).map(([id, meta]) => ({
  id,
  escopos: meta.escopos,
  externo: meta.externo ?? false,
  label: () => tr(`auto.motor.passo.${key(id)}`),
}));

/** Gatilhos e passos que valem para o escopo (o editor só mostra estes). */
export const gatilhosDoEscopo = (escopo: Escopo) =>
  GATILHOS.filter((g) => g.escopos.includes(escopo));
export const passosDoEscopo = (escopo: Escopo) => PASSOS.filter((p) => p.escopos.includes(escopo));

/** Registro com os passos que o executor já sabe rodar, mais os que forem passados. */
export const registroCom = (extra: TipoPasso[] = []) => createRegistry([...PASSOS_BASE, ...extra]);
