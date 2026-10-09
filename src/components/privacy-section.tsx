import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PromptDialog, useDialog } from '@/components/ui/dialog';
import { saveTextFile } from '@/lib/download';
import { tasksToCsv } from '@/lib/export';
import { clearPrefs } from '@/lib/prefs';
import { deleteMyAccount, exportMyData } from '@/lib/queries/clan';
import { supabase } from '@/lib/supabase';
import { useIsOnline } from '@/providers/online';
import { clearQueryCache } from '@/providers/query';
import { useToast } from '@/providers/toast';

/** Seus dados (ESCOPO 9): exportar (JSON completo ou CSV das tarefas) e excluir a conta. */
export function PrivacySection() {
  const online = useIsOnline();
  const toast = useToast();
  const [busy, setBusy] = useState<'json' | 'csv' | 'delete' | null>(null);
  const [confirm, setConfirm, close] = useDialog<true>();

  async function download(format: 'json' | 'csv') {
    setBusy(format);
    try {
      const data = await exportMyData();
      const date = new Date().toISOString().slice(0, 10);
      if (format === 'json')
        await saveTextFile(
          `questlist-${date}.json`,
          JSON.stringify(data, null, 2),
          'application/json',
        );
      else
        await saveTextFile(
          `questlist-tarefas-${date}.csv`,
          tasksToCsv((data.tasks as Parameters<typeof tasksToCsv>[0]) ?? []),
          'text/csv',
        );
    } catch (err) {
      toast({ message: `Não deu para exportar: ${(err as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    close();
    setBusy('delete');
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      clearQueryCache();
      clearPrefs();
    } catch (err) {
      toast({ message: `Não deu para excluir: ${(err as Error).message}` });
      setBusy(null);
    }
  }

  return (
    <View className="gap-2">
      <Text className="font-semibold text-foreground">Seus dados</Text>
      <Link href="/privacidade" className="text-sm text-primary">
        Política de privacidade
      </Link>
      <Text className="text-sm text-muted-foreground">
        Baixe tudo o que é seu: pastas, páginas, tarefas, histórico de XP, conquistas e comentários.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="outline"
          label="Exportar (JSON)"
          disabled={!online || !!busy}
          loading={busy === 'json'}
          onPress={() => download('json')}
        />
        <Button
          variant="outline"
          label="Tarefas em planilha (CSV)"
          disabled={!online || !!busy}
          loading={busy === 'csv'}
          onPress={() => download('csv')}
        />
      </View>
      <Button
        variant="ghost"
        className="self-start"
        label="Excluir minha conta"
        disabled={!online || !!busy}
        loading={busy === 'delete'}
        onPress={() => setConfirm(true)}
      />
      {confirm && (
        <PromptDialog
          title="Excluir a conta?"
          confirmLabel="Excluir para sempre"
          fields={[{ key: 'confirm', placeholder: 'Digite EXCLUIR para confirmar' }]}
          onClose={close}
          onConfirm={({ confirm: typed }) => {
            if (typed.toUpperCase() === 'EXCLUIR') remove();
            else toast({ message: 'Digite EXCLUIR para confirmar.' });
          }}
        />
      )}
      <Text className="text-xs text-muted-foreground">
        Excluir apaga suas pastas e seu histórico. Projetos com outras pessoas continuam com elas
        (passam para o membro mais antigo), e as tarefas atribuídas a você voltam a ser só o seu
        nome.
      </Text>
    </View>
  );
}
