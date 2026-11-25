import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';

import { StepFields } from '@/components/automation/rule-editor';
import { Diagrama } from '@/components/processo/diagram';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { passoNovo } from '@/lib/automation/editor';
import type { Passo } from '@/lib/automation/registry';
import {
  ACOES_DE_SERVICO,
  textoDoErro,
  TIPOS_NO,
  validar,
  type Aresta,
  type Grafo,
  type No,
  type TipoNo,
} from '@/lib/processo';
import { disporGrafo } from '@/lib/processo/layout';
import { simularProcesso, type PassoSimulado } from '@/lib/processo/simular';

// Editor de processo (PR5, D354): diagrama na web (React Flow) com paleta, ligar por teclado,
// propriedades do nó e da ligação, desfazer e refazer, duplicar, disposição automática, validação
// em tempo real e simulação sem efeito. No celular, o diagrama abre só para leitura (V16-12).

export type Opcao = { id: string; nome: string };
type Sel = { tipo: 'no' | 'aresta'; id: string } | null;

const id = (p: string) => `${p}${Math.random().toString(36).slice(2, 7)}`;

function Campo({
  rotulo,
  valor,
  onMudar,
  dica,
  multilinha,
}: {
  rotulo: string;
  valor: string;
  onMudar: (v: string) => void;
  dica?: string;
  multilinha?: boolean;
}) {
  return (
    <View className="gap-1">
      <Text className="text-xs text-ink-muted">{rotulo}</Text>
      <Input
        value={valor}
        onChangeText={onMudar}
        accessibilityLabel={rotulo}
        autoCapitalize="none"
        multiline={multilinha}
        className={multilinha ? 'min-h-20 py-2' : undefined}
      />
      {dica && <Text className="text-xs text-ink-muted">{dica}</Text>}
    </View>
  );
}

function Escolha({
  rotulo,
  opcoes,
  valor,
  onMudar,
}: {
  rotulo: string;
  opcoes: { id: string; label: string }[];
  valor?: string;
  onMudar: (v: string) => void;
}) {
  return (
    <View className="gap-1">
      <Text className="text-xs text-ink-muted">{rotulo}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" aria-label={rotulo}>
        {opcoes.map((o) => (
          <Chip
            key={o.id}
            role="radio"
            label={o.label}
            selected={valor === o.id}
            onPress={() => onMudar(o.id)}
          />
        ))}
      </View>
    </View>
  );
}

const GATILHOS_PAGINA = [
  'pagina.criada',
  'pagina.propriedade_mudou',
  'pagina.tag_adicionada',
  'pagina.marcada_como',
] as const;

/** O início pode esperar um evento de anotação (PR7, D357); sem ele, começa à mão ou por automação. */
function GatilhoInicio({ no, set }: { no: No; set: (p: Record<string, unknown>) => void }) {
  const { t } = useTranslation();
  const g = (no.gatilho ?? {}) as Record<string, string | undefined>;
  const mudar = (patch: Record<string, string | undefined>) => {
    const novo = { ...g, ...patch };
    set({ gatilho: novo.tipo ? novo : undefined });
  };
  return (
    <View className="gap-2">
      <Escolha
        rotulo={t('processos.ed.trigger')}
        valor={g.tipo ?? 'manual'}
        onMudar={(tipo) => set({ gatilho: tipo === 'manual' ? undefined : { tipo } })}
        opcoes={[
          { id: 'manual', label: t('processos.ed.trigger_manual') },
          ...GATILHOS_PAGINA.map((id) => ({
            id,
            label: t(`auto.motor.gatilho.${id.replace('.', '_')}` as 'auto.motor.gatilho.manual'),
          })),
        ]}
      />
      {g.tipo === 'pagina.propriedade_mudou' && (
        <>
          <Campo
            rotulo={t('auto.ed.property')}
            valor={g.propriedade ?? ''}
            onMudar={(propriedade) => mudar({ propriedade: propriedade || undefined })}
            dica={t('processos.ed.storedOnly')}
          />
          <Campo
            rotulo={t('auto.ed.varValue')}
            valor={g.valor ?? ''}
            onMudar={(valor) => mudar({ valor: valor || undefined })}
            dica={t('processos.ed.anyValue')}
          />
        </>
      )}
      {g.tipo === 'pagina.tag_adicionada' && (
        <Campo
          rotulo={t('auto.ed.tag')}
          valor={g.tag ?? ''}
          onMudar={(tag) => mudar({ tag: tag || undefined })}
          dica={t('processos.ed.anyValue')}
        />
      )}
      {g.tipo === 'pagina.marcada_como' && (
        <Campo
          rotulo={t('processos.ed.mark')}
          valor={g.marca ?? ''}
          onMudar={(marca) => mudar({ marca: marca || undefined })}
          dica={t('processos.ed.markHint')}
        />
      )}
    </View>
  );
}

/** Texto JSON editável: grava só quando o JSON é válido. */
function CampoJson({
  rotulo,
  valor,
  onMudar,
  dica,
}: {
  rotulo: string;
  valor: unknown;
  onMudar: (v: unknown) => void;
  dica?: string;
}) {
  const { t } = useTranslation();
  const [texto, setTexto] = useState(() => JSON.stringify(valor ?? {}, null, 1));
  const [ruim, setRuim] = useState(false);
  return (
    <Campo
      rotulo={rotulo}
      valor={texto}
      multilinha
      dica={ruim ? t('auto.ed.bodyInvalid') : dica}
      onMudar={(v) => {
        setTexto(v);
        try {
          onMudar(v.trim() ? JSON.parse(v) : {});
          setRuim(false);
        } catch {
          setRuim(true);
        }
      }}
    />
  );
}

function PropriedadesNo({
  no,
  grafo,
  onNo,
  listas,
  funcoes,
}: {
  no: No;
  grafo: Grafo;
  onNo: (n: No) => void;
  listas: Opcao[];
  funcoes: Opcao[];
}) {
  const { t } = useTranslation();
  const set = (patch: Record<string, unknown>) => onNo({ ...no, ...patch });
  const s = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  const listaOp = listas.map((l) => ({ id: l.id, label: l.nome }));
  return (
    <View className="gap-3">
      <Campo
        rotulo={t('processos.ed.nodeName')}
        valor={s(no.nome)}
        onMudar={(nome) => set({ nome })}
      />
      {no.tipo === 'servico' && (
        <>
          <Escolha
            rotulo={t('processos.ed.action')}
            valor={(no.acao as { tipo?: string } | undefined)?.tipo}
            opcoes={ACOES_DE_SERVICO.map((a) => ({
              id: a,
              label: t(`auto.motor.passo.${a}` as 'processos.badge'),
            }))}
            onMudar={(tipo) => set({ acao: passoNovo(tipo) })}
          />
          {!!(no.acao as Passo | undefined)?.tipo && (
            <StepFields
              passo={no.acao as Passo}
              onChange={(acao) => set({ acao })}
              ctx={{ escopo: 'pessoal', listas, pessoas: [], regras: [] }}
              depth={2}
              segredos={[]}
              onSegredo={() => undefined}
            />
          )}
          <CampoJson
            rotulo={t('processos.ed.inputs')}
            valor={no.entradas ?? {}}
            onMudar={(entradas) => set({ entradas })}
            dica={t('processos.ed.inputsHint')}
          />
          <Escolha
            rotulo={t('processos.ed.onFailure')}
            valor={s(no.falha ?? 'falhar')}
            opcoes={(['falhar', 'tentar', 'erro'] as const).map((f) => ({
              id: f,
              label: t(`processos.ed.fail_${f}` as 'processos.badge'),
            }))}
            onMudar={(falha) => set({ falha })}
          />
        </>
      )}
      {no.tipo === 'humana' && (
        <>
          <Campo
            rotulo={t('processos.ed.taskTitle')}
            valor={s(no.titulo)}
            onMudar={(titulo) => set({ titulo })}
            dica={t('auto.ed.textHint')}
          />
          <Campo
            rotulo={t('processos.ed.taskDescription')}
            valor={s(no.descricao)}
            onMudar={(descricao) => set({ descricao })}
          />
          <Escolha
            rotulo={t('processos.ed.assignee')}
            valor={(no.responsavel as { tipo?: string } | undefined)?.tipo ?? 'dona'}
            opcoes={(['dona', 'pessoa', 'grupo', 'expressao'] as const).map((r) => ({
              id: r,
              label: t(`processos.ed.assignee_${r}` as 'processos.badge'),
            }))}
            onMudar={(tipo) => set({ responsavel: { tipo, valor: '' } })}
          />
          {['pessoa', 'expressao'].includes(
            (no.responsavel as { tipo?: string } | undefined)?.tipo ?? '',
          ) && (
            <Campo
              rotulo={t('processos.ed.assigneeValue')}
              valor={s((no.responsavel as { valor?: unknown }).valor)}
              onMudar={(valor) => set({ responsavel: { ...(no.responsavel as object), valor } })}
            />
          )}
          {listaOp.length > 0 && (
            <Escolha
              rotulo={t('processos.ed.taskList')}
              valor={s(no.lista)}
              opcoes={listaOp}
              onMudar={(lista) => set({ lista })}
            />
          )}
          <Campo
            rotulo={t('processos.ed.deadline')}
            valor={s(no.prazo)}
            onMudar={(prazo) => set({ prazo: prazo || undefined })}
            dica={t('processos.ed.durationHint')}
          />
          <Campo
            rotulo={t('processos.ed.reminder')}
            valor={s(no.lembrete_h)}
            onMudar={(v) => set({ lembrete_h: Number(v) || undefined })}
          />
          <Escolha
            rotulo={t('processos.ed.escalate')}
            valor={(no.escalar as { tipo?: string } | undefined)?.tipo ?? 'caminho'}
            opcoes={(['caminho', 'reatribuir', 'notificar'] as const).map((e) => ({
              id: e,
              label: t(`processos.ed.escalate_${e}` as 'processos.badge'),
            }))}
            onMudar={(tipo) => set({ escalar: { ...(no.escalar as object), tipo } })}
          />
          <Campo
            rotulo={t('processos.ed.choices')}
            valor={Array.isArray(no.escolhas) ? (no.escolhas as string[]).join(', ') : ''}
            onMudar={(v) =>
              set({
                escolhas: v
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
            dica={t('processos.ed.choicesHint')}
          />
          <CampoJson
            rotulo={t('processos.ed.form')}
            valor={no.formulario ?? []}
            onMudar={(formulario) => set({ formulario })}
            dica={t('processos.ed.formHint')}
          />
          <ToggleRow
            title={t('processos.ed.xp')}
            hint={t('processos.ed.xpHint')}
            value={no.xp === true}
            onChange={(xp) => set({ xp: xp || undefined })}
          />
        </>
      )}
      {no.tipo === 'temporizador' && (
        <>
          <Campo
            rotulo={t('processos.ed.duration')}
            valor={s(no.duracao)}
            onMudar={(duracao) => set({ duracao: duracao || undefined })}
            dica={t('processos.ed.durationHint')}
          />
          <Campo
            rotulo={t('processos.ed.until')}
            valor={s(no.ate)}
            onMudar={(ate) => set({ ate: ate || undefined })}
            dica={t('processos.ed.untilHint')}
          />
        </>
      )}
      {no.tipo === 'mensagem' && (
        <>
          <Campo
            rotulo={t('processos.ed.key')}
            valor={s(no.chave)}
            onMudar={(chave) => set({ chave })}
            dica={t('processos.ed.keyHint')}
          />
          <Campo
            rotulo={t('processos.ed.timeout')}
            valor={s(no.timeout)}
            onMudar={(timeout) => set({ timeout: timeout || undefined })}
            dica={t('processos.ed.durationHint')}
          />
        </>
      )}
      {(no.tipo === 'subprocesso' || no.tipo === 'multi') && (
        <>
          {funcoes.length ? (
            <Escolha
              rotulo={t('processos.ed.function')}
              valor={s(no.funcao)}
              opcoes={funcoes.map((f) => ({ id: f.id, label: f.nome }))}
              onMudar={(funcao) => set({ funcao })}
            />
          ) : (
            <Text className="text-sm text-ink-muted">{t('processos.ed.noFunctions')}</Text>
          )}
          <CampoJson
            rotulo={t('processos.ed.inputs')}
            valor={no.entradas ?? {}}
            onMudar={(entradas) => set({ entradas })}
            dica={t('processos.ed.inputsHint')}
          />
          <CampoJson
            rotulo={t('processos.ed.outputs')}
            valor={no.saidas ?? {}}
            onMudar={(saidas) => set({ saidas })}
            dica={t('processos.ed.outputsHint')}
          />
          {no.tipo === 'multi' && (
            <>
              <Campo
                rotulo={t('processos.ed.list')}
                valor={s(no.lista)}
                onMudar={(lista) => set({ lista })}
                dica={t('processos.ed.listHint')}
              />
              <Campo
                rotulo={t('processos.ed.max')}
                valor={s(no.max ?? 100)}
                onMudar={(v) => set({ max: Number(v) || 1 })}
              />
              <ToggleRow
                title={t('processos.ed.sequential')}
                value={no.sequencial === true}
                onChange={(sequencial) => set({ sequencial: sequencial || undefined })}
              />
            </>
          )}
        </>
      )}
      {no.tipo === 'laco' && (
        <>
          <Campo
            rotulo={t('processos.ed.loopUntil')}
            valor={s(no.condicao)}
            onMudar={(condicao) => set({ condicao })}
            dica={t('processos.ed.exprHint')}
          />
          <Campo
            rotulo={t('processos.ed.max')}
            valor={s(no.max ?? 3)}
            onMudar={(v) => set({ max: Number(v) || 1 })}
          />
        </>
      )}
      {no.tipo === 'inicio' && <GatilhoInicio no={no} set={set} />}
      {no.tipo === 'fim' && (
        <ToggleRow
          title={t('processos.ed.endError')}
          value={no.erro === true}
          onChange={(erro) => set({ erro: erro || undefined })}
        />
      )}
      {no.tipo === 'humana' && (
        <CampoJson
          rotulo={t('processos.ed.outputs')}
          valor={no.saidas ?? {}}
          onMudar={(saidas) => set({ saidas })}
          dica={t('processos.ed.outputsHint')}
        />
      )}
      {grafo && null}
    </View>
  );
}

function PropriedadesAresta({
  a,
  de,
  onAresta,
}: {
  a: Aresta;
  de?: No;
  onAresta: (a: Aresta) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Partial<Aresta>) => onAresta({ ...a, ...patch });
  return (
    <View className="gap-3">
      {de?.tipo === 'xor' && (
        <>
          <ToggleRow
            title={t('processos.aresta.padrao')}
            value={a.padrao === true}
            onChange={(padrao) =>
              set({ padrao: padrao || undefined, condicao: padrao ? undefined : a.condicao })
            }
          />
          {!a.padrao && (
            <Campo
              rotulo={t('processos.ed.condition')}
              valor={a.condicao ?? ''}
              onMudar={(condicao) => set({ condicao })}
              dica={t('processos.ed.exprHint')}
            />
          )}
        </>
      )}
      {de?.tipo === 'servico' && (
        <ToggleRow
          title={t('processos.aresta.erro')}
          value={a.erro === true}
          onChange={(erro) => set({ erro: erro || undefined })}
        />
      )}
      {de?.tipo === 'humana' && (
        <>
          <Campo
            rotulo={t('processos.ed.choice')}
            valor={a.escolha ?? ''}
            onMudar={(escolha) => set({ escolha: escolha || undefined })}
          />
          <ToggleRow
            title={t('processos.aresta.prazo')}
            value={a.prazo === true}
            onChange={(prazo) => set({ prazo: prazo || undefined })}
          />
        </>
      )}
      {de?.tipo === 'mensagem' && (
        <ToggleRow
          title={t('processos.aresta.prazo')}
          value={a.prazo === true}
          onChange={(prazo) => set({ prazo: prazo || undefined })}
        />
      )}
      {de?.tipo === 'laco' && (
        <Escolha
          rotulo={t('processos.ed.loopPath')}
          valor={a.laco}
          opcoes={(['repetir', 'sair'] as const).map((l) => ({
            id: l,
            label: t(`processos.aresta.${l}` as 'processos.badge'),
          }))}
          onMudar={(laco) => set({ laco: laco as 'repetir' | 'sair' })}
        />
      )}
    </View>
  );
}

export function EditorProcesso({
  grafo,
  onMudar,
  listas,
  funcoes,
}: {
  grafo: Grafo;
  onMudar: (g: Grafo) => void;
  listas: Opcao[];
  funcoes: Opcao[];
}) {
  const { t } = useTranslation();
  const editavel = Platform.OS === 'web';
  const [sel, setSel] = useState<Sel>(null);
  const [historico, setHistorico] = useState<{ passado: Grafo[]; futuro: Grafo[] }>({
    passado: [],
    futuro: [],
  });
  const [ligar, setLigar] = useState<{ de?: string; para?: string }>({});
  const [simulacao, setSimulacao] = useState<{
    passos: PassoSimulado[];
    fim: string;
    erro?: string;
  } | null>(null);
  const [varsTeste, setVarsTeste] = useState<unknown>({});
  const mudar = (g: Grafo) => {
    setHistorico((h) => ({ passado: [...h.passado.slice(-49), grafo], futuro: [] }));
    onMudar(g);
  };
  const desfazer = () => {
    const ant = historico.passado.at(-1);
    if (!ant) return;
    setHistorico((h) => ({ passado: h.passado.slice(0, -1), futuro: [grafo, ...h.futuro] }));
    onMudar(ant);
  };
  const refazer = () => {
    const prox = historico.futuro[0];
    if (!prox) return;
    setHistorico((h) => ({ passado: [...h.passado, grafo], futuro: h.futuro.slice(1) }));
    onMudar(prox);
  };
  const erros = validar(grafo);
  const nomes = new Map(
    grafo.nos.map((n) => [n.id, n.nome || t(`processos.no.${n.tipo}` as 'processos.badge')]),
  );
  const comErro = new Set(erros.map((e) => e.no).filter((x): x is string => !!x));
  const no = sel?.tipo === 'no' ? grafo.nos.find((n) => n.id === sel.id) : undefined;
  const aresta = sel?.tipo === 'aresta' ? grafo.arestas.find((a) => a.id === sel.id) : undefined;
  const adicionar = (tipo: TipoNo) => {
    const novo: No = {
      id: id(tipo.slice(0, 2)),
      tipo,
      nome: '',
      x: 40 + (grafo.nos.length % 5) * 200,
      y: 40 + Math.floor(grafo.nos.length / 5) * 90,
    };
    if (tipo === 'servico') novo.acao = passoNovo('notificar');
    if (tipo === 'humana') novo.titulo = t('processos.ed.newTask');
    if (tipo === 'temporizador') novo.duracao = 'PT1H';
    if (tipo === 'laco') novo.max = 3;
    mudar({ ...grafo, nos: [...grafo.nos, novo] });
    setSel({ tipo: 'no', id: novo.id });
  };
  const nosOp = grafo.nos.map((n) => ({ id: n.id, label: nomes.get(n.id) ?? n.id }));
  return (
    <View className="gap-4">
      <Diagrama
        grafo={grafo}
        editavel={editavel}
        comErro={comErro}
        selecionado={sel}
        onSelecionar={setSel}
        onMudar={mudar}
      />
      {!editavel && (
        <Text className="text-sm text-ink-muted">{t('processos.ed.readOnlyMobile')}</Text>
      )}
      {editavel && (
        <>
          <View className="gap-2">
            <SectionLabel title={t('processos.ed.palette')} />
            <View className="flex-row flex-wrap gap-2">
              {TIPOS_NO.map((tipo) => (
                <Button
                  key={tipo}
                  variant="ghost"
                  label={t('processos.ed.add', {
                    tipo: t(`processos.no.${tipo}` as 'processos.badge'),
                  })}
                  onPress={() => adicionar(tipo)}
                />
              ))}
            </View>
            <View className="flex-row flex-wrap gap-2">
              <Button
                variant="ghost"
                label={t('processos.ed.undo')}
                disabled={!historico.passado.length}
                onPress={desfazer}
              />
              <Button
                variant="ghost"
                label={t('processos.ed.redo')}
                disabled={!historico.futuro.length}
                onPress={refazer}
              />
              <Button
                variant="ghost"
                label={t('processos.ed.autoLayout')}
                onPress={() => mudar(disporGrafo(grafo))}
              />
            </View>
            {grafo.nos.length > 100 && (
              <Text className="text-sm text-warn">{t('processos.ed.manyNodes')}</Text>
            )}
          </View>
          {/* Ligar por teclado (e leitor de tela): de, para e ligar */}
          <View className="gap-2">
            <SectionLabel title={t('processos.ed.connect')} />
            <Escolha
              rotulo={t('processos.ed.from')}
              opcoes={nosOp}
              valor={ligar.de}
              onMudar={(de) => setLigar({ ...ligar, de })}
            />
            <Escolha
              rotulo={t('processos.ed.to')}
              opcoes={nosOp}
              valor={ligar.para}
              onMudar={(para) => setLigar({ ...ligar, para })}
            />
            <Button
              className="self-start"
              label={t('processos.ed.connectNow')}
              disabled={!ligar.de || !ligar.para}
              onPress={() => {
                mudar({
                  ...grafo,
                  arestas: [
                    ...grafo.arestas,
                    { id: id('a'), de: ligar.de as string, para: ligar.para as string },
                  ],
                });
                setLigar({});
              }}
            />
          </View>
        </>
      )}
      {(no || aresta) && (
        <View className="gap-3 rounded-lg border border-line p-3">
          <SectionLabel
            title={
              no ? t(`processos.no.${no.tipo}` as 'processos.badge') : t('processos.ed.connection')
            }
          />
          {no && (
            <PropriedadesNo
              no={no}
              grafo={grafo}
              listas={listas}
              funcoes={funcoes}
              onNo={(n) => mudar({ ...grafo, nos: grafo.nos.map((x) => (x.id === n.id ? n : x)) })}
            />
          )}
          {aresta && (
            <PropriedadesAresta
              a={aresta}
              de={grafo.nos.find((n) => n.id === aresta.de)}
              onAresta={(a) =>
                mudar({ ...grafo, arestas: grafo.arestas.map((x) => (x.id === a.id ? a : x)) })
              }
            />
          )}
          {editavel && (
            <View className="flex-row flex-wrap gap-2">
              {no && no.tipo !== 'inicio' && (
                <Button
                  variant="ghost"
                  label={t('processos.ed.duplicate')}
                  onPress={() => {
                    const copia = {
                      ...no,
                      id: id(no.tipo.slice(0, 2)),
                      x: (no.x ?? 0) + 30,
                      y: (no.y ?? 0) + 30,
                    };
                    mudar({ ...grafo, nos: [...grafo.nos, copia] });
                    setSel({ tipo: 'no', id: copia.id });
                  }}
                />
              )}
              <Button
                variant="ghost"
                destructive
                label={t('processos.ed.remove')}
                onPress={() => {
                  if (no)
                    mudar({
                      ...grafo,
                      nos: grafo.nos.filter((x) => x.id !== no.id),
                      arestas: grafo.arestas.filter((a) => a.de !== no.id && a.para !== no.id),
                    });
                  if (aresta)
                    mudar({ ...grafo, arestas: grafo.arestas.filter((x) => x.id !== aresta.id) });
                  setSel(null);
                }}
              />
            </View>
          )}
        </View>
      )}
      <View className="gap-1" aria-live="polite">
        <SectionLabel
          title={
            erros.length
              ? t('processos.ed.errors', { count: erros.length })
              : t('processos.ed.valid')
          }
        />
        {erros.map((e, i) => (
          <Button
            key={i}
            variant="ghost"
            className="self-start"
            label={textoDoErro(e, nomes)}
            onPress={() => e.no && setSel({ tipo: 'no', id: e.no })}
          />
        ))}
      </View>
      <View className="gap-2">
        <SectionLabel title={t('processos.ed.simulate')} />
        <CampoJson rotulo={t('processos.ed.testVars')} valor={varsTeste} onMudar={setVarsTeste} />
        <Button
          variant="ghost"
          className="self-start"
          label={t('processos.ed.runSimulation')}
          onPress={() =>
            setSimulacao(
              simularProcesso(grafo, { vars: (varsTeste ?? {}) as Record<string, unknown> }),
            )
          }
        />
        {simulacao && (
          <View className="gap-1 rounded-lg bg-wash p-3" aria-live="polite">
            <Text className="text-sm font-semibold text-ink">
              {t(`processos.ed.simEnd_${simulacao.fim}` as 'processos.badge')}
            </Text>
            {simulacao.passos.map((p, i) => (
              <View key={i} className="gap-1">
                <Text className="text-sm text-ink">
                  {i + 1}. {nomes.get(p.no) ?? p.no}
                  {p.espera ? ` · ${t('processos.ed.simWait', { espera: p.espera })}` : ''}
                  {p.acao ? ` · ${t('processos.ed.simAction', { acao: String(p.acao.tipo) })}` : ''}
                </Text>
                {p.erro && <Text className="text-xs text-danger">{p.erro}</Text>}
                <Text className="font-mono text-xs text-ink-muted">{JSON.stringify(p.vars)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
