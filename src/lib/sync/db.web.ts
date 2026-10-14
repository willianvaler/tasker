import { PowerSyncDatabase } from '@powersync/web';

import { AppSchema } from './schema';

// O Metro não empacota os workers do SDK: eles vão para public/@powersync (npm run sync:assets)
const WORKER = '/@powersync/worker.js';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'questlist.db', worker: WORKER },
  sync: { worker: WORKER },
});
