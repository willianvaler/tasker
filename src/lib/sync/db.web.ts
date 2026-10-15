import { LogLevels, PowerSyncDatabase } from '@powersync/web';

import { AppSchema } from './schema';

// O Metro não empacota os workers do SDK: eles vão para public/@powersync (npm run sync:assets)
const WORKER = '/@powersync/worker.js';

// O worker compartilhado entre abas tem um registro próprio no console (e o repete em todas as
// abas). Toda aba que fecha ou recarrega gera ali "Aborting open connection because associated
// tab closed", "error closing database connection" e, se era a última aba, "Sync error: Could not
// open DB connection since no client is connected": é o caminho normal do SDK (ele reconecta
// sozinho quando a aba volta), não falha. Na versão publicada o registro do worker fica mudo; o
// estado real da sincronização (com o erro, se houver) está no ponto da barra lateral e em /sync.
// Em desenvolvimento, avisos e erros continuam aparecendo. O `broadcastLogs` fica no padrão:
// desligado, o SDK escreve a cada conexão que "os registros só aparecem no worker".
const WORKER_LOG_LEVEL = __DEV__ ? LogLevels.warn : LogLevels.error + 10;

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'questlist.db', worker: WORKER },
  sync: { worker: WORKER, logLevel: WORKER_LOG_LEVEL },
});
