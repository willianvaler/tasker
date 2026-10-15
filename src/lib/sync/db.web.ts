import { PowerSyncDatabase } from '@powersync/web';

import { AppSchema } from './schema';

// O Metro não empacota os workers do SDK: eles vão para public/@powersync (npm run sync:assets)
const WORKER = '/@powersync/worker.js';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'questlist.db', worker: WORKER },
  sync: { worker: WORKER },
  // O worker compartilhado entre abas registra no console de toda aba cada aba que fecha ou
  // recarrega ("Aborting open connection because associated tab closed"...): ruído, não erro. O
  // estado real da sincronização está no ponto da barra lateral e em /sync.
  broadcastLogs: false,
});
