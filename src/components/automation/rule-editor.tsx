import { ArrowDown, ArrowUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, IconButton } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import {
  lerCondicoes,
  montarCondicoes,
  passoNovo,
  type CondicoesForm,
  type Definicao,
  type ItemCondicao,
} from '@/lib/automation/editor';
import {
  CATALOGO,
  gatilhosDoEscopo,
  passosDoEscopo,
  type Condicao,
  type Escopo,
  type LinhaSimulada,
  type Passo,
} from '@/lib/automation/registry';
import type { Run } from '@/lib/queries/automation-rules';

// Editor de automações em formulário (V14 §9, AU7, D341): Quando… (gatilho), Se… (condições),
// Então… (passos). Tudo com rótulo para leitor de tela e campos que o teclado alcança.

export type Opcao = { id: string; nome: string };
export type EditorCtx = {
  escopo: Escopo;
  listas: Opcao[];
  pessoas: Opcao[];
  regras: Opcao[];
};

const DIAS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const PRONTAS = CATALOGO.prontas;
const OPERADORES = CATALOGO.operadores;
/** Passos que ainda não rodam (o conector de dispositivos chega no SL3). */
const SEM_EXECUTOR = new Set(['comandar_dispositivo']);
const label = (id: string) => id.replace(/\./g, '_');

function Field({
  label: rotulo,
  value,
  onChange,
  placeholder,
  multiline,
  keyboard,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboard?: 'number-pad';
  hint?: string;
}) {
  return (
    <View className="gap-1">
      <Text className="text-xs text-ink-muted">{rotulo}</Text>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        accessibilityLabel={rotulo}
        autoCapitalize="none"
        multiline={multiline}
        keyboardType={keyboard}
        className={multiline ? 'min-h-24 py-2' : undefined}
      />
      {hint && <Text className="text-xs text-ink-muted">{hint}</Text>}
    </View>
  );
}

function Choice({
  title,
  options,
  value,
  onChange,
}: {
  title?: string;
  options: { id: string; label: string; disabled?: boolean }[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <View className="gap-1">
      {title && <Text className="text-xs text-ink-muted">{title}</Text>}
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" aria-label={title}>
        {options.map((o) => (
          <Chip
            key={o.id}
            role="radio"
            label={o.label}
            selected={value === o.id}
            disabled={o.disabled}
            onPress={() => onChange(o.id)}
          />
        ))}
      </View>
    </View>
  );
}

const num = (v: unknown, fallback = '') => (v === undefined || v === null ? fallback : String(v));
const lista = (v: unknown) => (Array.isArray(v) ? v.map(String).join(', ') : '');
const partes = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------------------------
// Quando
// ---------------------------------------------------------------------------------------------

export function TriggerFields({
  gatilho,
  onChange,
  ctx,
}: {
  gatilho: Definicao['gatilho'];
  onChange: (g: Definicao['gatilho']) => void;
  ctx: EditorCtx;
}) {
  const { t } = useTranslation();
  const set = (patch: Record<string, unknown>) => onChange({ ...gatilho, ...patch });
  const dias = Array.isArray(gatilho.dias) ? gatilho.dias.map(Number) : [];
  const deTarefa = gatilho.tipo.startsWith('tarefa.') || gatilho.tipo === 'lista.concluida';
  return (
    <View className="gap-3">
      <Choice
        title={t('auto.ed.trigger')}
        value={gatilho.tipo}
        onChange={(tipo) => onChange({ tipo })}
        options={gatilhosDoEscopo(ctx.escopo).map((g) => ({ id: g.id, label: g.label() }))}
      />
      {gatilho.tipo === 'horario' && (
        <>
          <Field
            label={t('auto.ed.time')}
            value={num(gatilho.hora)}
            onChange={(hora) => set({ hora })}
            placeholder="22:30"
          />
          <View className="gap-1">
            <Text className="text-xs text-ink-muted">{t('auto.ed.days')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {DIAS.map((d, i) => (
                <Chip
                  key={d}
                  role="checkbox"
                  label={t(`auto.ed.dayShort.${d}` as 'auto.ed.title')}
                  selected={dias.includes(i)}
                  onPress={() =>
                    set({
                      dias: dias.includes(i) ? dias.filter((x) => x !== i) : [...dias, i].sort(),
                    })
                  }
                />
              ))}
            </View>
            <Text className="text-xs text-ink-muted">{t('auto.ed.daysHint')}</Text>
          </View>
        </>
      )}
      {gatilho.tipo === 'intervalo' && (
        <Field
          label={t('auto.ed.hours')}
          value={num(gatilho.horas, '1')}
          onChange={(v) => set({ horas: Number(v) || 1 })}
          keyboard="number-pad"
        />
      )}
      {gatilho.tipo === 'tarefa.vencendo' && (
        <Field
          label={t('auto.ed.minutesBefore')}
          value={num(gatilho.minutos, '60')}
          onChange={(v) => set({ minutos: Number(v) || 60 })}
          keyboard="number-pad"
        />
      )}
      {deTarefa && ctx.escopo === 'projeto' && ctx.listas.length > 0 && (
        <Choice
          title={t('auto.ed.inList')}
          value={typeof gatilho.lista === 'string' ? gatilho.lista : ''}
          onChange={(id) => set({ lista: id || undefined })}
          options={[
            { id: '', label: t('auto.anyPage') },
            ...ctx.listas.map((l) => ({ id: l.id, label: l.nome })),
          ]}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Se
// ---------------------------------------------------------------------------------------------

type Comparacao = { campo: string; op: string; valor?: unknown };
const OP_KEY: Record<string, string> = {
  '=': 'eq',
  '≠': 'ne',
  '<': 'lt',
  '≤': 'le',
  '>': 'gt',
  '≥': 'ge',
};

function CompareFields({
  item,
  set,
}: {
  item: Comparacao;
  set: (patch: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Field
        label={t('auto.ed.field')}
        value={item.campo}
        onChange={(campo) => set({ campo })}
        placeholder="evento.titulo"
        hint={t('auto.ed.fieldHint')}
      />
      <Choice
        value={item.op}
        onChange={(op) => set({ op })}
        options={OPERADORES.map((o) => ({
          id: o,
          label: t(`auto.ed.op.${OP_KEY[o] ?? o}` as 'auto.ed.title'),
        }))}
      />
      {item.op !== 'vazio' && (
        <Field
          label={t('auto.ed.value')}
          value={num(item.valor)}
          onChange={(valor) => set({ valor })}
        />
      )}
    </>
  );
}

function ConditionItem({
  item,
  onChange,
  onRemove,
  ctx,
}: {
  item: ItemCondicao;
  onChange: (c: ItemCondicao) => void;
  onRemove?: () => void;
  ctx: EditorCtx;
}) {
  const { t } = useTranslation();
  const tipo = 'pronta' in item ? item.pronta : 'comparar';
  const novo = (id: string): ItemCondicao => {
    switch (id) {
      case 'comparar':
        return { campo: 'evento.titulo', op: 'contem', valor: '' };
      case 'janela_horario':
        return { pronta: id, de: '22:00', ate: '06:00' };
      case 'dias_semana':
        return { pronta: id, dias: [1, 2, 3, 4, 5] };
      case 'nivel_min':
        return { pronta: id, nivel: 5 };
      case 'etiqueta':
        return { pronta: id, etiqueta: '' };
      default:
        return { pronta: id, [id]: ctx.listas[0]?.id ?? '' };
    }
  };
  const set = (patch: Record<string, unknown>) => onChange({ ...item, ...patch } as ItemCondicao);
  const r = item as Record<string, unknown>;
  return (
    <View className="gap-2 border-l border-line pl-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Choice
            value={tipo}
            onChange={(id) => onChange({ ...novo(id), ...(item.nao ? { nao: true } : {}) })}
            options={[
              ...PRONTAS.filter((p) => ctx.escopo === 'projeto' || p !== 'projeto').map((p) => ({
                id: p,
                label: t(`auto.ed.ready.${p}` as 'auto.ed.title') as string,
              })),
              { id: 'comparar', label: t('auto.ed.compare') },
            ]}
          />
        </View>
        {onRemove && (
          <IconButton icon={X} label={t('auto.ed.removeCondition')} onPress={onRemove} />
        )}
      </View>
      {tipo === 'janela_horario' && (
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Field
              label={t('auto.ed.from')}
              value={num(r.de)}
              onChange={(de) => set({ de })}
              placeholder="22:00"
            />
          </View>
          <View className="flex-1">
            <Field
              label={t('auto.ed.until')}
              value={num(r.ate)}
              onChange={(ate) => set({ ate })}
              placeholder="06:00"
            />
          </View>
        </View>
      )}
      {tipo === 'dias_semana' && (
        <View className="flex-row flex-wrap gap-2">
          {DIAS.map((d, i) => {
            const dias = Array.isArray(r.dias) ? r.dias.map(Number) : [];
            return (
              <Chip
                key={d}
                role="checkbox"
                label={t(`auto.ed.dayShort.${d}` as 'auto.ed.title')}
                selected={dias.includes(i)}
                onPress={() =>
                  set({
                    dias: dias.includes(i) ? dias.filter((x) => x !== i) : [...dias, i].sort(),
                  })
                }
              />
            );
          })}
        </View>
      )}
      {(tipo === 'lista' || tipo === 'projeto') && (
        <Choice
          value={num(r[tipo])}
          onChange={(id) => set({ [tipo]: id })}
          options={ctx.listas.map((l) => ({ id: l.id, label: l.nome }))}
        />
      )}
      {tipo === 'etiqueta' && (
        <Field
          label={t('auto.ed.label')}
          value={num(r.etiqueta)}
          onChange={(etiqueta) => set({ etiqueta })}
          placeholder="casa"
        />
      )}
      {tipo === 'nivel_min' && (
        <Field
          label={t('auto.ed.level')}
          value={num(r.nivel)}
          onChange={(v) => set({ nivel: Number(v) || 1 })}
          keyboard="number-pad"
        />
      )}
      {tipo === 'comparar' && 'campo' in item && (
        <CompareFields item={item as Comparacao} set={set} />
      )}
      <ToggleRow
        title={t('auto.ed.not')}
        value={!!item.nao}
        onChange={(nao) => set({ nao: nao || undefined })}
      />
    </View>
  );
}

export function ConditionsFields({
  condicoes,
  onChange,
  ctx,
}: {
  condicoes: Condicao | null | undefined;
  onChange: (c: Condicao | null) => void;
  ctx: EditorCtx;
}) {
  const { t } = useTranslation();
  const form = lerCondicoes(condicoes);
  if (form === 'avancada') {
    return <Text className="text-sm text-ink-muted">{t('auto.ed.advancedConditions')}</Text>;
  }
  const update = (f: CondicoesForm) => onChange(montarCondicoes(f));
  return (
    <View className="gap-3">
      {form.itens.length > 1 && (
        <Choice
          title={t('auto.ed.combine')}
          value={form.modo}
          onChange={(modo) => update({ ...form, modo: modo as 'e' | 'ou' })}
          options={[
            { id: 'e', label: t('auto.ed.all') },
            { id: 'ou', label: t('auto.ed.any') },
          ]}
        />
      )}
      {form.itens.length === 0 && (
        <Text className="text-sm text-ink-muted">{t('auto.ed.noConditions')}</Text>
      )}
      {form.itens.map((item, i) => (
        <ConditionItem
          key={i}
          item={item}
          ctx={ctx}
          onChange={(c) => update({ ...form, itens: form.itens.map((x, j) => (j === i ? c : x)) })}
          onRemove={() => update({ ...form, itens: form.itens.filter((_, j) => j !== i) })}
        />
      ))}
      {form.itens.length < 10 && (
        <Button
          variant="ghost"
          className="self-start"
          label={t('auto.ed.addCondition')}
          onPress={() =>
            update({
              ...form,
              itens: [...form.itens, { pronta: 'dias_semana', dias: [1, 2, 3, 4, 5] }],
            })
          }
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Então
// ---------------------------------------------------------------------------------------------

/** Cabeçalho do webhook no formulário: nome, valor e se é segredo (o valor do segredo vai à parte). */
export type SegredoPendente = Record<string, string>;

function WebhookFields({
  passo,
  set,
  segredos,
  onSegredo,
}: {
  passo: Passo;
  set: (patch: Record<string, unknown>) => void;
  segredos: string[];
  onSegredo: (nome: string, valor: string) => void;
}) {
  const { t } = useTranslation();
  const cab = (passo.cabecalhos ?? {}) as Record<string, string | { segredo: string }>;
  const [corpo, setCorpo] = useState(() => JSON.stringify(passo.corpo ?? {}, null, 2));
  const [erroCorpo, setErroCorpo] = useState(false);
  const [novo, setNovo] = useState({ nome: '', valor: '', segredo: false });
  const slug = (nome: string) =>
    nome
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'segredo';
  return (
    <View className="gap-2">
      <Field
        label={t('auto.ed.url')}
        value={num(passo.url)}
        onChange={(url) => set({ url })}
        placeholder="https://"
        hint={t('auto.ed.urlHint')}
      />
      <Choice
        title={t('auto.ed.method')}
        value={String(passo.metodo ?? 'POST')}
        onChange={(metodo) => set({ metodo })}
        options={['POST', 'PUT', 'PATCH', 'GET', 'DELETE'].map((m) => ({ id: m, label: m }))}
      />
      <Text className="text-xs text-ink-muted">{t('auto.ed.headers')}</Text>
      {Object.entries(cab).map(([k, v]) => (
        <View key={k} className="flex-row items-center gap-2">
          <Text className="flex-1 font-mono text-xs text-ink">
            {k}:{' '}
            {typeof v === 'string'
              ? v
              : segredos.includes(v.segredo)
                ? t('auto.ed.secretSaved')
                : t('auto.ed.secretPending')}
          </Text>
          <IconButton
            icon={X}
            label={t('auto.ed.removeHeader', { name: k })}
            onPress={() =>
              set({ cabecalhos: Object.fromEntries(Object.entries(cab).filter(([x]) => x !== k)) })
            }
          />
        </View>
      ))}
      <View className="gap-2 rounded-lg bg-wash p-2">
        <Field
          label={t('auto.ed.headerName')}
          value={novo.nome}
          onChange={(nome) => setNovo({ ...novo, nome })}
          placeholder="Authorization"
        />
        <Field
          label={t('auto.ed.headerValue')}
          value={novo.valor}
          onChange={(valor) => setNovo({ ...novo, valor })}
        />
        <ToggleRow
          title={t('auto.ed.headerSecret')}
          hint={t('auto.ed.headerSecretHint')}
          value={novo.segredo}
          onChange={(segredo) => setNovo({ ...novo, segredo })}
        />
        <Button
          variant="ghost"
          className="self-start"
          label={t('auto.ed.addHeader')}
          disabled={!novo.nome.trim()}
          onPress={() => {
            const nome = novo.nome.trim();
            if (novo.segredo) {
              const s = slug(nome);
              onSegredo(s, novo.valor);
              set({ cabecalhos: { ...cab, [nome]: { segredo: s } } });
            } else set({ cabecalhos: { ...cab, [nome]: novo.valor } });
            setNovo({ nome: '', valor: '', segredo: false });
          }}
        />
      </View>
      <Field
        label={t('auto.ed.body')}
        value={corpo}
        multiline
        hint={erroCorpo ? t('auto.ed.bodyInvalid') : t('auto.ed.bodyHint')}
        onChange={(v) => {
          setCorpo(v);
          try {
            set({ corpo: v.trim() ? JSON.parse(v) : null });
            setErroCorpo(false);
          } catch {
            setErroCorpo(true);
          }
        }}
      />
      <ToggleRow
        title={t('auto.ed.sign')}
        hint={t('auto.ed.signHint')}
        value={passo.assinar === true}
        onChange={(assinar) => set({ assinar: assinar || undefined })}
      />
    </View>
  );
}

export function StepFields({
  passo,
  onChange,
  ctx,
  depth,
  segredos,
  onSegredo,
}: {
  passo: Passo;
  onChange: (p: Passo) => void;
  ctx: EditorCtx;
  depth: number;
  segredos: string[];
  onSegredo: (nome: string, valor: string) => void;
}) {
  const { t } = useTranslation();
  const set = (patch: Record<string, unknown>) => onChange({ ...passo, ...patch });
  const listas = [
    { id: '', label: t('auto.ed.eventList') },
    ...ctx.listas.map((l) => ({ id: l.id, label: l.nome })),
  ];
  switch (passo.tipo) {
    case 'notificar':
      return (
        <View className="gap-2">
          <Field
            label={t('auto.ed.notifyTitle')}
            value={num(passo.titulo)}
            onChange={(titulo) => set({ titulo })}
          />
          <Field
            label={t('auto.ed.notifyBody')}
            value={num(passo.corpo)}
            onChange={(corpo) => set({ corpo })}
            hint={t('auto.ed.textHint')}
          />
          <Choice
            title={t('auto.ed.channel')}
            value={String(passo.canal ?? 'ambos')}
            onChange={(canal) => set({ canal })}
            options={(['ambos', 'app', 'push'] as const).map((c) => ({
              id: c,
              label: t(`auto.ed.channel_${c}` as 'auto.ed.title'),
            }))}
          />
          {ctx.escopo === 'projeto' && (
            <>
              <Choice
                title={t('auto.ed.to')}
                value={String(passo.para ?? 'dona')}
                onChange={(para) => set({ para })}
                options={(['dona', 'responsaveis', 'pessoa'] as const).map((c) => ({
                  id: c,
                  label: t(`auto.ed.to_${c}` as 'auto.ed.title'),
                }))}
              />
              {passo.para === 'pessoa' && (
                <Choice
                  value={num(passo.pessoa)}
                  onChange={(pessoa) => set({ pessoa })}
                  options={ctx.pessoas.map((p) => ({ id: p.id, label: p.nome }))}
                />
              )}
            </>
          )}
        </View>
      );
    case 'criar_tarefa':
      return (
        <View className="gap-2">
          <Field
            label={t('auto.ed.taskTitle')}
            value={num(passo.titulo)}
            onChange={(titulo) => set({ titulo })}
            hint={t('auto.ed.textHint')}
          />
          <Choice
            title={t('auto.ed.whereList')}
            value={num(passo.lista)}
            onChange={(id) => set({ lista: id || undefined })}
            options={listas}
          />
          <Field
            label={t('auto.ed.due')}
            value={num(passo.vencimento)}
            onChange={(v) => set({ vencimento: v || undefined })}
            placeholder="+1"
            hint={t('auto.ed.dueHint')}
          />
          <Field
            label={t('auto.ed.labels')}
            value={lista(passo.etiquetas)}
            onChange={(v) => set({ etiquetas: partes(v) })}
            placeholder="casa, rua"
          />
          <ToggleRow
            title={t('auto.ed.noDuplicate')}
            value={passo.evitar_duplicar === true}
            onChange={(v) => set({ evitar_duplicar: v || undefined })}
          />
        </View>
      );
    case 'atualizar_tarefa':
      return (
        <View className="gap-2">
          <Text className="text-xs text-ink-muted">{t('auto.ed.updateHint')}</Text>
          <Field
            label={t('auto.ed.addLabels')}
            value={lista(passo.adicionar_etiquetas)}
            onChange={(v) => set({ adicionar_etiquetas: partes(v) })}
          />
          <Field
            label={t('auto.ed.removeLabels')}
            value={lista(passo.remover_etiquetas)}
            onChange={(v) => set({ remover_etiquetas: partes(v) })}
          />
          <Choice
            title={t('auto.ed.moveTo')}
            value={num(passo.mover_para)}
            onChange={(id) => set({ mover_para: id || undefined })}
            options={[
              { id: '', label: t('auto.ed.dontMove') },
              ...ctx.listas.map((l) => ({ id: l.id, label: l.nome })),
            ]}
          />
          <Field
            label={t('auto.ed.due')}
            value={num(passo.vencimento)}
            onChange={(v) => set({ vencimento: v || undefined })}
            placeholder="+1"
            hint={t('auto.ed.dueHint')}
          />
        </View>
      );
    case 'atribuir':
      return (
        <Choice
          title={t('auto.ed.person')}
          value={num(passo.pessoa)}
          onChange={(pessoa) => set({ pessoa })}
          options={ctx.pessoas.map((p) => ({ id: p.id, label: p.nome }))}
        />
      );
    case 'descanso':
      return (
        <Field
          label={t('auto.ed.seconds')}
          value={num(passo.segundos, '60')}
          onChange={(v) => set({ segundos: Number(v) || 60 })}
          keyboard="number-pad"
        />
      );
    case 'esperar':
      return (
        <Field
          label={t('auto.ed.waitMinutes')}
          value={num(passo.minutos, '10')}
          onChange={(v) => set({ minutos: Number(v) || 1 })}
          keyboard="number-pad"
          hint={t('auto.ed.waitHint')}
        />
      );
    case 'definir_variavel':
      return (
        <View className="gap-2">
          <Field
            label={t('auto.ed.varName')}
            value={num(passo.nome)}
            onChange={(nome) => set({ nome })}
            placeholder="peca"
          />
          <Field
            label={t('auto.ed.varValue')}
            value={num(passo.valor)}
            onChange={(valor) => set({ valor })}
            hint={t('auto.ed.textHint')}
          />
        </View>
      );
    case 'executar_regra':
      return ctx.regras.length ? (
        <Choice
          title={t('auto.ed.otherRule')}
          value={num(passo.regra)}
          onChange={(regra) => set({ regra })}
          options={ctx.regras.map((r) => ({ id: r.id, label: r.nome }))}
        />
      ) : (
        <Text className="text-sm text-ink-muted">{t('auto.ed.noOtherRules')}</Text>
      );
    case 'alternar_modo_jogo':
      return (
        <Choice
          title={t('auto.ed.gameMode')}
          value={num(passo.modo)}
          onChange={(modo) => set({ modo })}
          options={(['off', 'light', 'full'] as const).map((m) => ({
            id: m,
            label: t(`auto.ed.mode_${m}` as 'auto.ed.title'),
          }))}
        />
      );
    case 'enviar_webhook':
      return <WebhookFields passo={passo} set={set} segredos={segredos} onSegredo={onSegredo} />;
    case 'se': {
      const cond = (passo.condicao ?? { pronta: 'dias_semana', dias: [] }) as ItemCondicao;
      return (
        <View className="gap-2">
          {'pronta' in cond || 'campo' in cond ? (
            <ConditionItem
              item={cond}
              ctx={ctx}
              onChange={(c) => set({ condicao: c.nao ? { nao: { ...c, nao: undefined } } : c })}
            />
          ) : (
            <Text className="text-sm text-ink-muted">{t('auto.ed.advancedConditions')}</Text>
          )}
          <SectionLabel title={t('auto.ed.then')} />
          <StepsList
            passos={(passo.entao as Passo[]) ?? []}
            onChange={(entao) => set({ entao })}
            ctx={ctx}
            depth={depth + 1}
            segredos={segredos}
            onSegredo={onSegredo}
          />
          <SectionLabel title={t('auto.ed.else')} />
          <StepsList
            passos={(passo.senao as Passo[]) ?? []}
            onChange={(senao) => set({ senao })}
            ctx={ctx}
            depth={depth + 1}
            segredos={segredos}
            onSegredo={onSegredo}
          />
        </View>
      );
    }
    case 'parar':
      return <Text className="text-sm text-ink-muted">{t('auto.ed.stopHint')}</Text>;
    default:
      return <Text className="text-sm text-warn">{t('auto.ed.notAvailable')}</Text>;
  }
}

export function StepsList({
  passos,
  onChange,
  ctx,
  depth = 0,
  segredos,
  onSegredo,
}: {
  passos: Passo[];
  onChange: (p: Passo[]) => void;
  ctx: EditorCtx;
  depth?: number;
  segredos: string[];
  onSegredo: (nome: string, valor: string) => void;
}) {
  const { t } = useTranslation();
  const [tipo, setTipo] = useState('');
  const tipos = passosDoEscopo(ctx.escopo).filter(
    (p) => !SEM_EXECUTOR.has(p.id) && (depth < 2 || p.id !== 'se'),
  );
  const mover = (i: number, d: number) => {
    const out = [...passos];
    const [x] = out.splice(i, 1);
    out.splice(i + d, 0, x);
    onChange(out);
  };
  return (
    <View className="gap-3">
      {passos.map((p, i) => (
        <View
          key={i}
          className="gap-2 rounded-lg border border-line p-3"
          accessibilityLabel={t('auto.ed.stepN', { n: i + 1 })}
        >
          <View className="flex-row items-center gap-1">
            <Text className="flex-1 text-sm font-semibold text-ink">
              {i + 1}. {t(`auto.motor.passo.${label(p.tipo)}` as 'auto.ed.title')}
            </Text>
            {i > 0 && (
              <IconButton
                icon={ArrowUp}
                label={t('auto.ed.moveUp', { n: i + 1 })}
                onPress={() => mover(i, -1)}
              />
            )}
            {i < passos.length - 1 && (
              <IconButton
                icon={ArrowDown}
                label={t('auto.ed.moveDown', { n: i + 1 })}
                onPress={() => mover(i, 1)}
              />
            )}
            <IconButton
              icon={X}
              tone="danger"
              label={t('auto.ed.removeStep', { n: i + 1 })}
              onPress={() => onChange(passos.filter((_, j) => j !== i))}
            />
          </View>
          <StepFields
            passo={p}
            ctx={ctx}
            depth={depth}
            segredos={segredos}
            onSegredo={onSegredo}
            onChange={(np) => onChange(passos.map((x, j) => (j === i ? np : x)))}
          />
        </View>
      ))}
      {passos.length < 20 && (
        <View className="gap-2">
          <Choice
            title={t('auto.ed.addStep')}
            value={tipo}
            onChange={setTipo}
            options={tipos.map((p) => ({ id: p.id, label: p.label() }))}
          />
          <Button
            variant="ghost"
            className="self-start"
            label={t('auto.ed.add')}
            disabled={!tipo}
            onPress={() => {
              onChange([...passos, passoNovo(tipo)]);
              setTipo('');
            }}
          />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Testar e histórico
// ---------------------------------------------------------------------------------------------

const resumoEfeito = (e: Record<string, unknown> | undefined) =>
  e
    ? Object.entries(e)
        .filter(([k]) => k !== 'tipo')
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' · ')
    : '';

export function TestResult({
  linhas,
  fim,
}: {
  linhas: LinhaSimulada[];
  fim: 'ok' | 'falhou' | 'condicoes';
}) {
  const { t } = useTranslation();
  return (
    <View
      className="gap-2 rounded-lg bg-wash p-3"
      accessibilityLiveRegion="polite"
      aria-live="polite"
    >
      <Text className="text-sm font-semibold text-ink">
        {t(`auto.ed.testEnd_${fim}` as 'auto.ed.title')}
      </Text>
      {linhas.map((l, i) => (
        <View key={i} className="gap-1">
          <Text className="text-sm text-ink">
            {l.tipo === 'condicoes'
              ? t(l.ramo === 'sim' ? 'auto.ed.conditionsYes' : 'auto.ed.conditionsNo')
              : `${t(`auto.motor.passo.${label(l.tipo)}` as 'auto.ed.title')}${l.ramo ? ` → ${l.ramo === 'entao' ? t('auto.ed.then') : t('auto.ed.else')}` : ''}`}
          </Text>
          {!!l.efeito && (
            <Text className="font-mono text-xs text-ink-muted">{resumoEfeito(l.efeito)}</Text>
          )}
          {l.externo && <Text className="text-xs text-ink-muted">{t('auto.ed.wouldCall')}</Text>}
          {l.esperaria && (
            <Text className="text-xs text-ink-muted">
              {t('auto.ed.wouldWait', { at: new Date(l.esperaria).toLocaleString() })}
            </Text>
          )}
          {l.erro && <Text className="text-xs text-danger">{l.erro}</Text>}
          {l.avisos.map((a) => (
            <Text key={a} className="text-xs text-warn">
              {a}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function RunHistory({ runs }: { runs: Run[] }) {
  const { t } = useTranslation();
  const [aberta, setAberta] = useState<string | null>(null);
  if (runs.length === 0)
    return <Text className="text-sm text-ink-muted">{t('auto.ed.noRuns')}</Text>;
  return (
    <View className="gap-1">
      {runs.map((r) => {
        const steps = (Array.isArray(r.steps) ? r.steps : []) as {
          caminho?: string;
          tipo?: string;
          ok?: boolean;
          erro?: string;
        }[];
        const warnings = (Array.isArray(r.warnings) ? r.warnings : []) as string[];
        const open = aberta === r.id;
        return (
          <View key={r.id} className="border-b border-line py-1">
            <Button
              variant="ghost"
              className="self-stretch"
              aria-expanded={open}
              label={`${new Date(r.started_at).toLocaleString()} · ${t(`auto.ed.status.${r.status}` as 'auto.ed.title')}${r.error ? ` · ${r.error}` : ''}`}
              onPress={() => setAberta(open ? null : r.id)}
            />
            {open && (
              <View className="gap-1 pl-3">
                {steps.map((s, i) => (
                  <Text
                    key={i}
                    className={s.ok === false ? 'text-xs text-danger' : 'text-xs text-ink-muted'}
                  >
                    {s.tipo === 'condicoes'
                      ? t('auto.ed.conditions')
                      : t(`auto.motor.passo.${label(s.tipo ?? '')}` as 'auto.ed.title')}{' '}
                    · {s.ok === false ? s.erro : t('auto.ok')}
                  </Text>
                ))}
                {warnings.map((w, i) => (
                  <Text key={`w${i}`} className="text-xs text-warn">
                    {w}
                  </Text>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
