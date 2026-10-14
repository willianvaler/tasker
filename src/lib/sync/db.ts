import { PowerSyncDatabase } from '@powersync/react-native';

import { AppSchema } from './schema';

// op-sqlite: precisa de development build (não roda no Expo Go)
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'questlist.db' },
});
