import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Input } from '@/components/ui/input';
import { SectionLabel } from '@/components/ui/section-label';
import { Text } from '@/components/ui/text';
import { ToggleRow } from '@/components/ui/toggle-row';
import { useProcessTaskActions } from '@/lib/queries/processos';
import { useToast } from '@/providers/toast';

// Tarefa de um processo (PR6, D353): responder o formulário e escolher, delegar, devolver ao grupo
// e ir para a instância. A resposta é validada no servidor (process_complete_task).

export type CampoForm = {
  nome: string;
  rotulo?: string;
  tipo?: 'texto' | 'numero' | 'data' | 'selecao' | 'caixa';
  obrigatorio?: boolean;
  opcoes?: string[];
};
export type MetaProcesso = {
  instancia: string;
  no: string;
  nome?: string;
  escolhas?: string[];
  formulario?: CampoForm[];
};

export function ProcessTaskPanel({
  taskId,
  processo,
  done,
}: {
  taskId: string;
  processo: MetaProcesso;
  done: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const m = useProcessTaskActions();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const campos = processo.formulario ?? [];
  const escolhas = processo.escolhas ?? [];
  const pede = campos.length > 0 || escolhas.length > 0;
  const onError = (e: Error) => toast({ message: e.message });
  const responder = (escolha?: string) =>
    m.complete.mutate(
      { task: taskId, escolha, formulario: form },
      { onError, onSuccess: () => toast({ message: t('processos.answered') }) },
    );
  return (
    <View
      className="gap-2 rounded-lg border border-line p-3"
      accessibilityLabel={t('processos.taskOf', { name: processo.nome ?? '' })}
    >
      <SectionLabel title={t('processos.taskOf', { name: processo.nome ?? '' })} />
      {!done && pede && (
        <View className="gap-2">
          {campos.map((c) => {
            const rotulo = `${c.rotulo ?? c.nome}${c.obrigatorio ? ' *' : ''}`;
            const v = form[c.nome];
            if (c.tipo === 'caixa')
              return (
                <ToggleRow
                  key={c.nome}
                  title={rotulo}
                  value={v === true}
                  onChange={(x) => setForm({ ...form, [c.nome]: x })}
                />
              );
            if (c.tipo === 'selecao')
              return (
                <View key={c.nome} className="gap-1">
                  <Text className="text-xs text-ink-muted">{rotulo}</Text>
                  <View
                    className="flex-row flex-wrap gap-2"
                    accessibilityRole="radiogroup"
                    aria-label={rotulo}
                  >
                    {(c.opcoes ?? []).map((o) => (
                      <Chip
                        key={o}
                        role="radio"
                        label={o}
                        selected={v === o}
                        onPress={() => setForm({ ...form, [c.nome]: o })}
                      />
                    ))}
                  </View>
                </View>
              );
            return (
              <View key={c.nome} className="gap-1">
                <Text className="text-xs text-ink-muted">{rotulo}</Text>
                <Input
                  value={v === undefined || v === null ? '' : String(v)}
                  accessibilityLabel={rotulo}
                  keyboardType={c.tipo === 'numero' ? 'numeric' : undefined}
                  placeholder={c.tipo === 'data' ? '2026-12-01' : undefined}
                  onChangeText={(x) =>
                    setForm({
                      ...form,
                      [c.nome]: c.tipo === 'numero' ? (x === '' ? null : Number(x)) : x,
                    })
                  }
                />
              </View>
            );
          })}
          <View className="flex-row flex-wrap gap-2">
            {escolhas.length > 0 ? (
              escolhas.map((e) => (
                <Button
                  key={e}
                  label={e}
                  disabled={m.complete.isPending}
                  onPress={() => responder(e)}
                />
              ))
            ) : (
              <Button
                label={t('processos.answerDone')}
                disabled={m.complete.isPending}
                onPress={() => responder()}
              />
            )}
          </View>
        </View>
      )}
      <View className="flex-row flex-wrap gap-2">
        {!done && (
          <Button
            variant="ghost"
            label={t('processos.returnToGroup')}
            onPress={() => m.giveBack.mutate(taskId, { onError })}
          />
        )}
        <Button
          variant="ghost"
          label={t('processos.openInstance')}
          onPress={() =>
            router.push({
              pathname: '/processos/instancia/[id]',
              params: { id: processo.instancia },
            })
          }
        />
      </View>
    </View>
  );
}
