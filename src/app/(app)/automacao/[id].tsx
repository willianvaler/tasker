import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  ConditionsFields,
  RunHistory,
  StepsList,
  TestResult,
  TriggerFields,
  type EditorCtx,
} from '@/components/automation/rule-editor';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import {
  conferirRascunho,
  definicaoVazia,
  eventoExemplo,
  MODELOS,
  type Definicao,
} from '@/lib/automation/editor';
import { registroBase, simulate, type Escopo, type LinhaSimulada } from '@/lib/automation/registry';
import { actorCan } from '@/lib/permissions';
import {
  useHook,
  useRule,
  useRuleMutations,
  useRules,
  useRuns,
  useSecretNames,
  type Rule,
} from '@/lib/queries/automation-rules';
import { useNotes } from '@/lib/queries/notes';
import { useDefinitions } from '@/lib/queries/processos';
import { useProfile, useTimeZone, useToday } from '@/lib/queries/profile';
import { useFolderActor, useMembers, webUrl } from '@/lib/queries/projects';
import { findFolder, pageLabel, useTree } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

// Editor de uma automação (V14 §9, AU7, D341): /automacao/<id>, ou /automacao/nova com
// ?modelo=<id> (um dos modelos), ?escopo=projeto&pasta=<id> (do projeto).

export default function AutomationEditorScreen() {
  const { id, modelo, escopo, pasta } = useLocalSearchParams<{
    id: string;
    modelo?: string;
    escopo?: string;
    pasta?: string;
  }>();
  const nova = id === 'nova';
  const rule = useRule(nova ? undefined : id);
  if (!nova && !rule.data) {
    return (
      <Screen>
        <ScreenScroll contentContainerClassName="gap-6 pb-clear">
          <ScreenHeader title={rule.isLoading ? '…' : '—'} back />
        </ScreenScroll>
      </Screen>
    );
  }
  return (
    <Editor
      key={rule.data?.id ?? 'nova'}
      rule={rule.data ?? null}
      modelo={modelo}
      escopo={(rule.data?.scope ?? (escopo === 'projeto' ? 'projeto' : 'pessoal')) as Escopo}
      folderId={rule.data?.folder_id ?? pasta}
    />
  );
}

function Editor({
  rule,
  modelo,
  escopo,
  folderId,
}: {
  rule: Rule | null;
  modelo?: string;
  escopo: Escopo;
  folderId?: string | null;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const tree = useTree();
  const profile = useProfile();
  const tz = useTimeZone();
  const today = useToday();
  const m = useRuleMutations();
  const onError = (err: Error) => toast({ message: err.message });

  const inicial = () => {
    if (rule) return { name: rule.name, definition: rule.definition as unknown as Definicao };
    const md = MODELOS.find((x) => x.id === modelo && !x.precisa);
    if (md) return md.montar({ inbox: tree.data?.inbox?.id });
    return { name: '', definition: definicaoVazia(escopo) };
  };
  const [{ name, definition: def }, setDraft] = useState(inicial);
  const setDef = (d: Definicao) => setDraft((x) => ({ ...x, definition: d }));
  const [pendentes, setPendentes] = useState<Record<string, string>>({});
  const [teste, setTeste] = useState<{
    linhas: LinhaSimulada[];
    fim: 'ok' | 'falhou' | 'condicoes';
  } | null>(null);
  const [mostrar, setMostrar] = useState<{ titulo: string; valor: string } | null>(null);
  const [apagar, setApagar] = useState(false);

  // Quem pode editar: a dona da regra pessoal; na de projeto, quem mexe nas automações
  const actor = useFolderActor(folderId ?? undefined);
  const podeEditar = online && (escopo === 'pessoal' || actorCan(actor, 'automation.manage'));

  const place = folderId ? findFolder(tree.data, folderId) : undefined;
  const folder = place?.folder;
  const folderIds = folder
    ? [folder.id, ...('children' in folder ? folder.children : []).map((c: { id: string }) => c.id)]
    : null;
  const pages = (tree.data?.pages ?? []).filter((p) =>
    folderIds ? folderIds.includes(p.folder_id) : true,
  );
  const members = useMembers(
    escopo === 'projeto' && folder?.is_shared ? (folderId ?? undefined) : undefined,
  );
  const outras = useRules(escopo === 'projeto' ? (folderId ?? undefined) : undefined);
  const processos = useDefinitions();
  const modelosNota = useNotes({ templates: 'only' });
  const ctx: EditorCtx = {
    escopo,
    listas: pages.map((p) => ({ id: p.id, nome: pageLabel(p) })),
    pessoas: (members.data ?? []).map((x) => ({ id: x.userId, nome: x.displayName })),
    regras: (outras.data ?? [])
      .filter((r) => r.id !== rule?.id)
      .map((r) => ({ id: r.id, nome: r.name })),
    processos: (processos.data ?? [])
      .filter((d) => !d.is_function)
      .map((d) => ({ id: d.id, nome: d.name })),
    modelosNota: (modelosNota.data ?? []).map((n) => ({ id: n.id, nome: n.title || '—' })),
  };

  const runs = useRuns(rule?.id);
  const temWebhook = JSON.stringify(def.passos).includes('"enviar_webhook"');
  const segredos = useSecretNames(rule?.id, escopo === 'pessoal' && temWebhook);
  const hook = useHook(rule?.id, def.gatilho.tipo === 'webhook');

  async function salvar() {
    const erro = conferirRascunho(name, def);
    if (erro) return toast({ message: erro });
    try {
      const salvo = await m.save.mutateAsync({
        id: rule?.id,
        scope: escopo,
        folderId: folderId ?? undefined,
        name: name.trim(),
        definition: def,
      });
      for (const [nome, valor] of Object.entries(pendentes)) {
        await m.secretSet.mutateAsync({ id: salvo, name: nome, value: valor });
      }
      setPendentes({});
      toast({ message: t('auto.ed.saved') });
      if (!rule) router.replace({ pathname: '/automacao/[id]', params: { id: salvo } });
    } catch (e) {
      onError(e as Error);
    }
  }

  function testar() {
    const agora = new Date().toISOString();
    const lista = ctx.listas[0];
    const p = profile.data;
    setTeste(
      simulate(
        def,
        {
          estado: {
            evento: eventoExemplo(def.gatilho.tipo, {
              hoje: today,
              agora,
              nivel: p?.level ?? 1,
              lista: lista && { id: lista.id, nome: lista.nome },
            }),
            var: {},
          },
          escopo,
          regra: { id: rule?.id ?? 'nova', nome: name },
          agora,
          fuso: tz,
          idioma: p?.locale ?? 'pt-BR',
          usuario: {
            nome: p?.display_name ?? '',
            nivel: p?.level ?? 1,
            sequencia: p?.streak ?? 0,
            xp: p?.xp ?? 0,
            atrasadas: 0,
          },
        },
        registroBase(),
      ),
    );
  }

  const limites = def.limites ?? {};
  return (
    <Screen size="narrow">
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          help="automacoes"
          title={rule ? rule.name : t('auto.new')}
          eyebrow={escopo === 'projeto' ? folder?.name : t('auto.ed.title')}
          back
        />
        {!podeEditar && (
          <Text className="text-sm text-warn">
            {online ? t('auto.ed.readOnly') : t('auto.ed.offline')}
          </Text>
        )}
        {rule?.disabled_reason === 'falhas' && (
          <Text className="text-sm text-warn">{t('auto.ed.disabledFailuresLong')}</Text>
        )}

        <View className="gap-1">
          <Text className="text-xs text-ink-muted">{t('auto.ed.name')}</Text>
          <Input
            value={name}
            onChangeText={(v) => setDraft((x) => ({ ...x, name: v }))}
            maxLength={80}
            accessibilityLabel={t('auto.ed.name')}
            placeholder={t('auto.ed.namePlaceholder')}
          />
        </View>

        <View className="gap-3">
          <SectionLabel title={t('auto.ed.when')} />
          <TriggerFields
            gatilho={def.gatilho}
            ctx={ctx}
            onChange={(gatilho) => setDef({ ...def, gatilho })}
          />
          {def.gatilho.tipo === 'webhook' && escopo === 'pessoal' && (
            <View className="gap-2">
              {!rule ? (
                <Text className="text-sm text-ink-muted">{t('auto.ed.hookSaveFirst')}</Text>
              ) : (
                <>
                  <Text className="text-sm text-ink-muted">
                    {hook.data
                      ? t('auto.ed.hookExists', {
                          at: new Date(hook.data.created_at).toLocaleString(),
                        })
                      : t('auto.ed.hookNone')}
                  </Text>
                  <Button
                    variant="ghost"
                    className="self-start"
                    label={hook.data ? t('auto.ed.hookRotate') : t('auto.ed.hookCreate')}
                    disabled={!podeEditar}
                    onPress={() =>
                      m.hookCreate.mutate(rule.id, {
                        onError,
                        onSuccess: (token) =>
                          setMostrar({
                            titulo: t('auto.ed.hookUrl'),
                            valor: webUrl(`/hooks/${token}`),
                          }),
                      })
                    }
                  />
                  {hook.data && (
                    <ToggleRow
                      title={t('auto.ed.hookSignature')}
                      hint={t('auto.ed.hookSignatureHint')}
                      value={hook.data.require_signature}
                      disabled={!podeEditar}
                      onChange={(require) =>
                        m.hookSignature.mutate({ id: rule.id, require }, { onError })
                      }
                    />
                  )}
                </>
              )}
            </View>
          )}
        </View>

        <View className="gap-3">
          <SectionLabel title={t('auto.ed.if')} />
          <ConditionsFields
            condicoes={def.condicoes}
            ctx={ctx}
            onChange={(condicoes) => setDef({ ...def, condicoes })}
          />
        </View>

        <View className="gap-3">
          <SectionLabel title={t('auto.ed.thenSteps')} />
          <StepsList
            passos={def.passos}
            ctx={ctx}
            segredos={segredos.data ?? []}
            onSegredo={(nome, valor) => setPendentes((p) => ({ ...p, [nome]: valor }))}
            onChange={(passos) => setDef({ ...def, passos })}
          />
          {temWebhook && escopo === 'pessoal' && rule && (
            <Button
              variant="ghost"
              className="self-start"
              label={
                (segredos.data ?? []).includes('_assinatura')
                  ? t('auto.ed.signingRotate')
                  : t('auto.ed.signingCreate')
              }
              disabled={!podeEditar}
              onPress={() =>
                m.signingSecret.mutate(rule.id, {
                  onError,
                  onSuccess: (valor) => setMostrar({ titulo: t('auto.ed.signingSecret'), valor }),
                })
              }
            />
          )}
        </View>

        {mostrar && (
          <View
            className="gap-1 rounded-lg bg-accent-soft p-3"
            accessibilityLiveRegion="polite"
            aria-live="polite"
          >
            <Text className="text-sm font-semibold text-ink">{mostrar.titulo}</Text>
            <Text selectable className="font-mono text-xs text-ink">
              {mostrar.valor}
            </Text>
            <Text className="text-xs text-ink-muted">{t('auto.ed.shownOnce')}</Text>
          </View>
        )}

        <View className="gap-3">
          <SectionLabel title={t('auto.ed.limits')} />
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Text className="text-xs text-ink-muted">{t('auto.ed.cooldown')}</Text>
              <Input
                value={limites.cooldown_min ? String(limites.cooldown_min) : ''}
                onChangeText={(v) =>
                  setDef({ ...def, limites: { ...limites, cooldown_min: Number(v) || 0 } })
                }
                keyboardType="number-pad"
                placeholder="0"
                accessibilityLabel={t('auto.ed.cooldown')}
              />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-xs text-ink-muted">{t('auto.ed.maxDelay')}</Text>
              <Input
                value={limites.atraso_max_min ? String(limites.atraso_max_min) : ''}
                onChangeText={(v) =>
                  setDef({ ...def, limites: { ...limites, atraso_max_min: Number(v) || 15 } })
                }
                keyboardType="number-pad"
                placeholder="15"
                accessibilityLabel={t('auto.ed.maxDelay')}
              />
            </View>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Button
            label={t('auto.ed.save')}
            disabled={!podeEditar || m.save.isPending}
            loading={m.save.isPending}
            onPress={salvar}
          />
          <Button variant="ghost" label={t('auto.ed.test')} onPress={testar} />
          {rule && (
            <Button
              variant="ghost"
              label={t('auto.ed.runNow')}
              disabled={!podeEditar || !rule.enabled}
              onPress={() =>
                m.runNow.mutate(rule.id, {
                  onError,
                  onSuccess: () => toast({ message: t('auto.ed.runQueued') }),
                })
              }
            />
          )}
          {rule && (
            <Button
              variant="ghost"
              destructive
              label={t('auto.ed.delete')}
              disabled={!podeEditar}
              onPress={() => setApagar(true)}
            />
          )}
        </View>
        {rule && (
          <ToggleRow
            title={t('auto.ed.enabled')}
            value={rule.enabled}
            disabled={!podeEditar}
            onChange={(enabled) => m.toggle.mutate({ id: rule.id, enabled }, { onError })}
          />
        )}

        {teste && <TestResult linhas={teste.linhas} fim={teste.fim} />}

        {rule && (
          <View className="gap-2">
            <SectionLabel title={t('auto.ed.history')} />
            <Button
              variant="ghost"
              className="self-start"
              label={t('auto.ed.refresh')}
              onPress={() => void runs.refetch()}
            />
            <RunHistory runs={runs.data ?? []} />
          </View>
        )}
      </ScreenScroll>
      {apagar && rule && (
        <ConfirmDialog
          title={t('auto.ed.deleteTitle', { name: rule.name })}
          message={t('auto.ed.deleteMessage')}
          confirmLabel={t('auto.ed.delete')}
          destructive
          onClose={() => setApagar(false)}
          onConfirm={() =>
            m.remove.mutate(rule.id, {
              onError,
              onSuccess: () => {
                setApagar(false);
                router.back();
              },
            })
          }
        />
      )}
    </Screen>
  );
}
