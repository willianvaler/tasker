// Armazenamento da sessão no nativo: localStorage em cima do SQLite (recomendação do guia do Expo para Supabase).
// Só cache: a fonte de verdade é o Postgres.
import 'expo-sqlite/localStorage/install';

export const authStorage = globalThis.localStorage;
/** Mesmo armazenamento, usado também para o cache offline e preferências de UI. */
export const localStore = globalThis.localStorage;
