import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { CATALOGO } from '@/lib/automation/registry';
import { lerBotao } from '@/lib/note-format';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

/** Dado sensível do V15 não entra em botão (o servidor recusa igual, V16 §1.7) */
const SENSIVEL = /\{\{\s*(saude|local|camera|dispositivo)\./i;

/**
 * Bloco ```questlist-button (ED4, D360): o JSON `{ rotulo, acao, confirmar? }` vira um botão que roda
 * a ação do V14 pelo servidor (com histórico nas automações). Webhook e dispositivo pedem
 * confirmação; JSON inválido aparece como o código que é, sem rodar.
 */
export function NoteButton({ source, noteId }: { source: string; noteId?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useIsOnline();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const botao = lerBotao(source);
  if (!botao || !noteId)
    return (
      <View className="rounded-lg border border-line bg-wash px-3 py-2">
        <Text className="font-mono text-sm text-ink-muted">{source}</Text>
      </View>
    );
  const sensivel = SENSIVEL.test(JSON.stringify(botao.acao));
  const externo = CATALOGO.passos[botao.acao.tipo]?.externo === true || botao.confirmar === true;
  const run = async (confirmado: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc('note_button_run', {
      p_note: noteId,
      p_rotulo: botao.rotulo,
      p_acao: botao.acao as never,
      p_confirmado: confirmado,
    });
    setBusy(false);
    toast({ message: error ? error.message : t('noteButton.done', { label: botao.rotulo }) });
  };
  return (
    <View className="flex-row items-center gap-2 py-1" testID="note-button">
      <Button
        variant="primary"
        label={botao.rotulo}
        loading={busy}
        disabled={!online || sensivel}
        onPress={() => (externo ? setAsking(true) : void run(false))}
      />
      {sensivel && <Text className="text-sm text-warn">{t('noteButton.sensitive')}</Text>}
      {!online && !sensivel && (
        <Text className="text-sm text-ink-muted">{t('noteButton.offline')}</Text>
      )}
      {asking && (
        <ConfirmDialog
          title={botao.rotulo}
          message={t('noteButton.confirm')}
          confirmLabel={t('noteButton.run')}
          onConfirm={() => {
            setAsking(false);
            void run(true);
          }}
          onClose={() => setAsking(false)}
        />
      )}
    </View>
  );
}
