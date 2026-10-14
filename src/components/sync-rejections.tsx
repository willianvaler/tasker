import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { setOnRejected } from '@/lib/sync/connector';
import { useToast } from '@/providers/toast';

/** Avisa quando o servidor recusa uma mudança feita no aparelho (limite, permissão, regra). */
export function SyncRejections() {
  const { t } = useTranslation();
  const toast = useToast();
  useEffect(() => {
    setOnRejected((message) => toast({ message: t('sync.rejected', { message }) }));
    return () => setOnRejected(null);
  }, [t, toast]);
  return null;
}
