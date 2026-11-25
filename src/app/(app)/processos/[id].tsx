import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EditorProcesso } from '@/components/processo/editor';
import { Screen, ScreenScroll } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { validar, type Grafo, type Variavel } from '@/lib/processo';
import {
  useDefinition,
  useDefinitions,
  useInstances,
  useProcessMutations,
  type Definicao,
} from '@/lib/queries/processos';
import { pageLabel, useTree } from '@/lib/queries/tree';
import { useToast } from '@/providers/toast';

// Uma definição de processo (PR5): o editor, publicar (só sem erro), iniciar e as instâncias dela.

export default function ProcessoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useDefinition(id);
  if (!q.data?.definicao) {
    return (
      <Screen>
        <ScreenScroll contentContainerClassName="gap-6 pb-clear">
          <ScreenHeader title={q.isLoading ? '…' : '—'} back />
        </ScreenScroll>
      </Screen>
    );
  }
  return <Editor key={q.data.definicao.id} def={q.data.definicao} versoes={q.data.versoes ?? []} />;
}

const variaveisTexto = (v: Variavel[] | undefined) =>
  (v ?? []).map((x) => `${x.nome}:${x.tipo}`).join(', ');
const lerVariaveis = (s: string): Variavel[] =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [nome, tipo] = x.split(':').map((y) => y.trim());
      return {
        nome,
        tipo: (['texto', 'numero', 'booleano', 'data', 'lista', 'objeto'].includes(tipo)
          ? tipo
          : 'texto') as Variavel['tipo'],
      };
    });

function Editor({
  def,
  versoes,
}: {
  def: Definicao;
  versoes: { id: string; number: number; published_at: string; signature: unknown }[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const m = useProcessMutations();
  const tree = useTree();
  const todas = useDefinitions();
  const inst = useInstances(def.id);
  const [nome, setNome] = useState(def.name);
  const [grafo, setGrafo] = useState<Grafo>(def.draft as unknown as Grafo);
  const [vars, setVars] = useState(variaveisTexto((def.draft as unknown as Grafo).variaveis));
  const [entradas, setEntradas] = useState(
    variaveisTexto((def.draft as unknown as Grafo).assinatura?.entradas),
  );
  const [saidas, setSaidas] = useState(
    variaveisTexto((def.draft as unknown as Grafo).assinatura?.saidas),
  );
  const [apagar, setApagar] = useState(false);
  const onError = (e: Error) => toast({ message: e.message });
  const completo: Grafo = {
    ...grafo,
    variaveis: lerVariaveis(vars),
    ...(def.is_function
      ? { assinatura: { entradas: lerVariaveis(entradas), saidas: lerVariaveis(saidas) } }
      : {}),
  };
  const erros = validar(completo);
  const salvar = () =>
    m.save.mutateAsync({ id: def.id, name: nome.trim() || def.name, draft: completo });
  const listas = (tree.data?.pages ?? []).map((p) => ({ id: p.id, nome: pageLabel(p) }));
  const funcoes = (todas.data ?? [])
    .filter((d) => d.is_function && d.id !== def.id)
    .map((d) => ({ id: d.id, nome: d.name }));
  // Função: quem a usa (para avisar ao mudar a assinatura, FN)
  const usam = (todas.data ?? []).filter(
    (d) => JSON.stringify(d.draft).includes(def.id) && d.id !== def.id,
  );
  const assinaturaAntiga = JSON.stringify(versoes[0]?.signature ?? null);
  const mudouAssinatura =
    def.is_function &&
    versoes.length > 0 &&
    assinaturaAntiga !== JSON.stringify(completo.assinatura ?? null);
  return (
    <Screen>
      <ScreenScroll contentContainerClassName="gap-6 pb-clear">
        <ScreenHeader
          help="processos"
          title={def.name}
          eyebrow={def.is_function ? t('processos.functions') : t('processos.title')}
          back
        />
        <View className="gap-2">
          <Text className="text-xs text-ink-muted">{t('auto.ed.name')}</Text>
          <Input
            value={nome}
            onChangeText={setNome}
            maxLength={80}
            accessibilityLabel={t('auto.ed.name')}
          />
          <Text className="text-xs text-ink-muted">{t('processos.ed.variables')}</Text>
          <Input
            value={vars}
            onChangeText={setVars}
            accessibilityLabel={t('processos.ed.variables')}
            autoCapitalize="none"
            placeholder="cliente:texto, valor:numero"
          />
          {def.is_function && (
            <>
              <Text className="text-xs text-ink-muted">{t('processos.ed.fnInputs')}</Text>
              <Input
                value={entradas}
                onChangeText={setEntradas}
                accessibilityLabel={t('processos.ed.fnInputs')}
                autoCapitalize="none"
              />
              <Text className="text-xs text-ink-muted">{t('processos.ed.fnOutputs')}</Text>
              <Input
                value={saidas}
                onChangeText={setSaidas}
                accessibilityLabel={t('processos.ed.fnOutputs')}
                autoCapitalize="none"
              />
            </>
          )}
          <ToggleRow
            title={t('processos.ed.active')}
            value={def.active}
            onChange={(active) => m.save.mutate({ id: def.id, active }, { onError })}
          />
        </View>

        <EditorProcesso grafo={grafo} onMudar={setGrafo} listas={listas} funcoes={funcoes} />

        {mudouAssinatura && usam.length > 0 && (
          <View className="gap-1 rounded-lg border border-warn p-3">
            <Text className="text-sm text-ink">{t('processos.ed.signatureChanged')}</Text>
            {usam.map((d) => (
              <Text key={d.id} className="text-sm text-ink-muted">
                · {d.name}
              </Text>
            ))}
          </View>
        )}
        <View className="flex-row flex-wrap gap-2">
          <Button
            label={t('auto.ed.save')}
            loading={m.save.isPending}
            onPress={() =>
              void salvar()
                .then(() => toast({ message: t('auto.ed.saved') }))
                .catch(onError)
            }
          />
          <Button
            variant="ghost"
            label={t('processos.ed.publish', { n: (versoes[0]?.number ?? 0) + 1 })}
            disabled={erros.length > 0 || m.publish.isPending}
            onPress={() =>
              void salvar()
                .then(() => m.publish.mutateAsync(def.id))
                .then(() => toast({ message: t('processos.ed.published') }))
                .catch(onError)
            }
          />
          {!def.is_function && versoes.length > 0 && (
            <Button
              variant="ghost"
              label={t('processos.ed.start')}
              disabled={!def.active}
              onPress={() =>
                m.start.mutate(
                  { id: def.id },
                  {
                    onError,
                    onSuccess: (iid) =>
                      router.push({ pathname: '/processos/instancia/[id]', params: { id: iid } }),
                  },
                )
              }
            />
          )}
          <Button
            variant="ghost"
            destructive
            label={t('auto.ed.delete')}
            onPress={() => setApagar(true)}
          />
        </View>
        {erros.length > 0 && (
          <Text className="text-sm text-warn">{t('processos.ed.cantPublish')}</Text>
        )}
        <Text className="text-xs text-ink-muted">
          {versoes.length
            ? t('processos.ed.versions', {
                n: versoes[0].number,
                at: new Date(versoes[0].published_at).toLocaleString(),
              })
            : t('processos.ed.notPublished')}
        </Text>

        {(inst.data ?? []).length > 0 && (
          <View className="gap-1">
            <Text className="text-sm font-semibold text-ink">{t('processos.instances')}</Text>
            {(inst.data ?? []).map((i) => (
              <Button
                key={i.id}
                variant="ghost"
                className="self-start"
                label={`${t(`processos.status.${i.status}` as 'processos.badge')} · ${new Date(i.started_at).toLocaleString()}`}
                onPress={() =>
                  router.push({ pathname: '/processos/instancia/[id]', params: { id: i.id } })
                }
              />
            ))}
          </View>
        )}
      </ScreenScroll>
      {apagar && (
        <ConfirmDialog
          title={t('auto.ed.deleteTitle', { name: def.name })}
          message={t('processos.ed.deleteMessage')}
          confirmLabel={t('auto.ed.delete')}
          destructive
          onClose={() => setApagar(false)}
          onConfirm={() => m.remove.mutate(def.id, { onError, onSuccess: () => router.back() })}
        />
      )}
    </Screen>
  );
}
