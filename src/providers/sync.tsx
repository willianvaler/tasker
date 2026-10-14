import { PowerSyncContext } from '@powersync/react';
import { useEffect, type ReactNode } from 'react';

import { connector, POWERSYNC_URL } from '@/lib/sync/connector';
import { db } from '@/lib/sync/db';
import { useSession } from '@/providers/session';

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session, isLoading } = useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (isLoading || !POWERSYNC_URL) return;
    // Saiu da conta: os dados de quem saiu não ficam no aparelho
    if (!userId) db.disconnectAndClear();
    else db.connect(connector);
  }, [isLoading, userId]);

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}
