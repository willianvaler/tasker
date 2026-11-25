// Modelos de processo internos (PR8, ESCOPO_V16, D356): dados versionados no repositório, que a
// pessoa copia e adapta. Cada um tem teste de ponta a ponta do início ao fim.
import { tr } from '@/lib/i18n-ref';

import type { Grafo } from '../../../supabase/functions/_shared/processo';

export type ModeloProcesso = {
  id: string;
  titulo: () => string;
  descricao: () => string;
  grafo: () => Grafo;
};

export const MODELOS_PROCESSO: ModeloProcesso[] = [
  {
    id: 'revisao',
    titulo: () => tr('processos.modelo.revisao'),
    descricao: () => tr('processos.modelo.revisaoHint'),
    grafo: () => ({
      v: 1,
      variaveis: [
        { nome: 'resumo', tipo: 'texto' },
        { nome: 'decisao', tipo: 'texto' },
      ],
      nos: [
        {
          id: 'inicio',
          tipo: 'inicio',
          nome: tr('processos.modelo.sexta'),
          gatilho: { tipo: 'horario', hora: '17:00', dias: [5] },
          x: 0,
          y: 80,
        },
        {
          id: 'revisar',
          tipo: 'humana',
          nome: tr('processos.modelo.revisar'),
          titulo: tr('processos.modelo.revisarTitulo'),
          formulario: [
            {
              nome: 'resumo',
              rotulo: tr('processos.modelo.resumo'),
              tipo: 'texto',
              obrigatorio: true,
            },
          ],
          escolhas: [tr('processos.modelo.feita'), tr('processos.modelo.adiar')],
          saidas: { decisao: '{retorno.escolha}' },
          x: 220,
          y: 80,
        },
        { id: 'decide', tipo: 'xor', nome: tr('processos.modelo.feitaOuAdiada'), x: 440, y: 80 },
        {
          id: 'anotar',
          tipo: 'servico',
          nome: tr('processos.modelo.anotar'),
          acao: {
            tipo: 'notificar',
            titulo: tr('processos.modelo.revisaoFeita'),
            corpo: '{{var.resumo|corta:200}}',
            canal: 'app',
          },
          x: 660,
          y: 0,
        },
        {
          id: 'adiada',
          tipo: 'temporizador',
          nome: tr('processos.modelo.amanha'),
          duracao: 'P1D',
          x: 660,
          y: 160,
        },
        { id: 'fim', tipo: 'fim', x: 880, y: 80 },
      ],
      arestas: [
        { id: 'a1', de: 'inicio', para: 'revisar' },
        { id: 'a2', de: 'revisar', para: 'decide' },
        {
          id: 'a3',
          de: 'decide',
          para: 'anotar',
          condicao: `{var.decisao} = "${tr('processos.modelo.feita')}"`,
        },
        { id: 'a4', de: 'decide', para: 'adiada', padrao: true },
        { id: 'a5', de: 'anotar', para: 'fim' },
        { id: 'a6', de: 'adiada', para: 'revisar' },
      ],
    }),
  },
  {
    id: 'aprovacao',
    titulo: () => tr('processos.modelo.aprovacao'),
    descricao: () => tr('processos.modelo.aprovacaoHint'),
    grafo: () => ({
      v: 1,
      variaveis: [{ nome: 'pedido', tipo: 'texto' }],
      nos: [
        { id: 'inicio', tipo: 'inicio', x: 0, y: 80 },
        {
          id: 'aprovar',
          tipo: 'humana',
          nome: tr('processos.modelo.aprovar'),
          titulo: tr('processos.modelo.aprovarTitulo'),
          escolhas: [tr('processos.modelo.sim'), tr('processos.modelo.nao')],
          prazo: 'PT48H',
          lembrete_h: 24,
          escalar: { tipo: 'caminho' },
          x: 220,
          y: 80,
        },
        {
          id: 'ok',
          tipo: 'servico',
          nome: tr('processos.modelo.aprovado'),
          acao: { tipo: 'notificar', corpo: tr('processos.modelo.aprovadoMsg'), canal: 'ambos' },
          x: 460,
          y: 0,
        },
        {
          id: 'nao',
          tipo: 'servico',
          nome: tr('processos.modelo.rejeitado'),
          acao: { tipo: 'notificar', corpo: tr('processos.modelo.rejeitadoMsg'), canal: 'ambos' },
          x: 460,
          y: 100,
        },
        {
          id: 'tarde',
          tipo: 'servico',
          nome: tr('processos.modelo.expirou'),
          acao: { tipo: 'notificar', corpo: tr('processos.modelo.expirouMsg'), canal: 'ambos' },
          x: 460,
          y: 200,
        },
        { id: 'fim', tipo: 'fim', x: 700, y: 100 },
      ],
      arestas: [
        { id: 'a1', de: 'inicio', para: 'aprovar' },
        { id: 'a2', de: 'aprovar', para: 'ok', escolha: tr('processos.modelo.sim') },
        { id: 'a3', de: 'aprovar', para: 'nao', escolha: tr('processos.modelo.nao') },
        { id: 'a4', de: 'aprovar', para: 'tarde', prazo: true },
        { id: 'a5', de: 'ok', para: 'fim' },
        { id: 'a6', de: 'nao', para: 'fim' },
        { id: 'a7', de: 'tarde', para: 'fim' },
      ],
    }),
  },
  {
    id: 'integracao',
    titulo: () => tr('processos.modelo.integracao'),
    descricao: () => tr('processos.modelo.integracaoHint'),
    grafo: () => ({
      v: 1,
      variaveis: [{ nome: 'pessoa', tipo: 'texto' }],
      nos: [
        { id: 'inicio', tipo: 'inicio', x: 0, y: 120 },
        { id: 'divide', tipo: 'and', nome: tr('processos.modelo.aoMesmoTempo'), x: 200, y: 120 },
        {
          id: 'acessos',
          tipo: 'humana',
          nome: tr('processos.modelo.acessos'),
          titulo: tr('processos.modelo.acessosTitulo'),
          x: 400,
          y: 0,
        },
        {
          id: 'boas',
          tipo: 'humana',
          nome: tr('processos.modelo.boasVindas'),
          titulo: tr('processos.modelo.boasVindasTitulo'),
          x: 400,
          y: 120,
        },
        {
          id: 'apresentar',
          tipo: 'humana',
          nome: tr('processos.modelo.apresentacao'),
          titulo: tr('processos.modelo.apresentacaoTitulo'),
          x: 400,
          y: 240,
        },
        { id: 'junta', tipo: 'and', nome: tr('processos.modelo.tudoPronto'), x: 620, y: 120 },
        {
          id: 'avisa',
          tipo: 'servico',
          nome: tr('processos.modelo.avisar'),
          acao: {
            tipo: 'notificar',
            corpo: tr('processos.modelo.integracaoPronta'),
            canal: 'ambos',
          },
          x: 820,
          y: 120,
        },
        { id: 'fim', tipo: 'fim', x: 1020, y: 120 },
      ],
      arestas: [
        { id: 'a1', de: 'inicio', para: 'divide' },
        { id: 'a2', de: 'divide', para: 'acessos' },
        { id: 'a3', de: 'divide', para: 'boas' },
        { id: 'a4', de: 'divide', para: 'apresentar' },
        { id: 'a5', de: 'acessos', para: 'junta' },
        { id: 'a6', de: 'boas', para: 'junta' },
        { id: 'a7', de: 'apresentar', para: 'junta' },
        { id: 'a8', de: 'junta', para: 'avisa' },
        { id: 'a9', de: 'avisa', para: 'fim' },
      ],
    }),
  },
  {
    id: 'estudo',
    titulo: () => tr('processos.modelo.estudo'),
    descricao: () => tr('processos.modelo.estudoHint'),
    grafo: () => ({
      v: 1,
      nos: [
        {
          id: 'inicio',
          tipo: 'inicio',
          nome: tr('processos.modelo.estudando'),
          gatilho: { tipo: 'pagina.propriedade_mudou', propriedade: 'status', valor: 'Estudando' },
          x: 0,
          y: 80,
        },
        {
          id: 'r1',
          tipo: 'servico',
          nome: tr('processos.modelo.revisao1'),
          acao: {
            tipo: 'criar_tarefa',
            titulo: `${tr('processos.modelo.revisar')}: {{evento.titulo}}`,
            vencimento: '+1',
          },
          x: 220,
          y: 80,
        },
        {
          id: 'r3',
          tipo: 'servico',
          nome: tr('processos.modelo.revisao3'),
          acao: {
            tipo: 'criar_tarefa',
            titulo: `${tr('processos.modelo.revisar')}: {{evento.titulo}}`,
            vencimento: '+3',
          },
          x: 440,
          y: 80,
        },
        {
          id: 'r7',
          tipo: 'servico',
          nome: tr('processos.modelo.revisao7'),
          acao: {
            tipo: 'criar_tarefa',
            titulo: `${tr('processos.modelo.revisar')}: {{evento.titulo}}`,
            vencimento: '+7',
          },
          x: 660,
          y: 80,
        },
        {
          id: 'concluido',
          tipo: 'mensagem',
          nome: tr('processos.modelo.ateConcluido'),
          chave: '"concluido:" + {inicio.pagina}',
          timeout: 'P30D',
          x: 880,
          y: 80,
        },
        { id: 'fim', tipo: 'fim', x: 1100, y: 80 },
      ],
      arestas: [
        { id: 'a1', de: 'inicio', para: 'r1' },
        { id: 'a2', de: 'r1', para: 'r3' },
        { id: 'a3', de: 'r3', para: 'r7' },
        { id: 'a4', de: 'r7', para: 'concluido' },
        { id: 'a5', de: 'concluido', para: 'fim' },
        { id: 'a6', de: 'concluido', para: 'fim', prazo: true },
      ],
    }),
  },
];
