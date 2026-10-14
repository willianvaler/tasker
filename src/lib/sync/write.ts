import { uuidv7 } from '@/lib/uuid';

import { db } from './db';

// Escritas no banco local que precisam de RPC no servidor: a linha muda na hora no aparelho e o
// comando vai na mesma transação para a fila (com id próprio, que é a chave do run_once)
export function setTaskDone(taskId: string, done: boolean) {
  return db.writeTransaction(async (tx) => {
    await tx.execute('update tasks set status = ?, completed_at = ? where id = ?', [
      done ? 'done' : 'todo',
      done ? new Date().toISOString() : null,
      taskId,
    ]);
    await tx.execute('insert into commands (id, name, args) values (?, ?, ?)', [
      uuidv7(),
      done ? 'complete_task' : 'uncomplete_task',
      JSON.stringify({ p_task_id: taskId }),
    ]);
  });
}
