import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text } from 'react-native';

import { PageDialog } from '@/components/page-dialog';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { PageView } from '@/components/tasks/page-view';
import { ActionMenu, PromptDialog, useDialog } from '@/components/ui/dialog';
import { setLastPageId } from '@/lib/prefs';
import { pageLabel, useTree, useTreeMutations } from '@/lib/queries/tree';
import { useIsOnline } from '@/providers/online';
import { useToast } from '@/providers/toast';

type DialogState = 'menu' | 'settings' | 'duplicate';

export default function PageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tree = useTree();
  const m = useTreeMutations();
  const online = useIsOnline();
  const toast = useToast();
  const [dialog, setDialog, closeDialog] = useDialog<DialogState>();
  const page = tree.data?.pages.find((p) => p.id === id);

  // A captura rápida global usa a última página aberta como destino padrão
  useEffect(() => {
    if (page) setLastPageId(page.id);
  }, [page]);

  if (tree.data && !page) {
    return (
      <Screen>
        <ScreenHeader title="Página" back />
        <Text className="mt-6 text-muted-foreground">Essa página não existe mais.</Text>
      </Screen>
    );
  }

  const onError = (err: Error) => toast({ message: `Não deu certo: ${err.message}` });

  return (
    <Screen>
      <ScreenHeader
        title={page ? pageLabel(page) : ''}
        back
        right={
          page && online ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Opções da página"
              className="h-11 w-11 items-center justify-center rounded-full active:bg-muted"
              onPress={() => setDialog('menu')}
            >
              <Text className="text-xl text-muted-foreground">⋯</Text>
            </Pressable>
          ) : null
        }
      />
      <PageView page={page} />

      {page && dialog === 'menu' && (
        <ActionMenu
          title={pageLabel(page)}
          onClose={closeDialog}
          actions={[
            { label: '⚙️ Configurar página', onPress: () => setDialog('settings') },
            { label: '📑 Duplicar página', onPress: () => setDialog('duplicate') },
          ]}
        />
      )}
      {page && dialog === 'settings' && (
        <PageDialog
          title="Configurar página"
          initial={page}
          onClose={closeDialog}
          onConfirm={(settings) => {
            m.updatePage.mutate({ id: page.id, ...settings }, { onError });
            closeDialog();
          }}
        />
      )}
      {page && dialog === 'duplicate' && (
        <PromptDialog
          title="Duplicar página"
          confirmLabel="Duplicar"
          fields={[{ key: 'name', placeholder: 'Nome da cópia', initial: nextName(page.name) }]}
          onClose={closeDialog}
          onConfirm={({ name }) => {
            closeDialog();
            m.duplicatePage.mutate(
              { id: page.id, name },
              {
                onError,
                onSuccess: (newId) => {
                  toast({ message: `Página "${name}" criada` });
                  if (newId) router.replace({ pathname: '/page/[id]', params: { id: newId } });
                },
              },
            );
          }}
        />
      )}
    </Screen>
  );
}

/** "Treino A" → "Treino B"; o resto ganha " (cópia)". */
function nextName(name: string) {
  const letter = /^(.*\s)([A-Y])$/.exec(name);
  if (letter) return letter[1] + String.fromCharCode(letter[2].charCodeAt(0) + 1);
  return `${name} (cópia)`;
}
