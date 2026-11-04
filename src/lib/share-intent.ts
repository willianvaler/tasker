import { router } from 'expo-router';
import { useEffect } from 'react';

import { ShareIntent, type SharedPayload } from '../../modules/share-intent';

// "Compartilhar" de outro app para o Questlist no Android (PB8, D303): o que chegou com o app
// fechado (lido quando a área logada monta) e o que chega com ele aberto abrem a tela /compartilhar.
// Na web instalada, o share_target do manifest abre a mesma tela direto.
export function useShareIntent() {
  useEffect(() => {
    if (!ShareIntent) return;
    const open = (shared: SharedPayload | null) => {
      if (!shared) return;
      router.push({
        pathname: '/compartilhar',
        params: { title: shared.title ?? '', text: shared.text ?? '' },
      });
    };
    open(ShareIntent.take());
    const subscription = ShareIntent.addListener('onShare', open);
    return () => subscription.remove();
  }, []);
}
