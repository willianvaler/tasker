// Quando um lembrete toca (D206): a data e o horário da tarefa estão no fuso do perfil, sem
// deslocamento; aqui viram um instante (ms desde 1970), menos a antecedência. Espelho da conta do
// public.send_task_reminders (que usa `at time zone`).

/** Deslocamento do fuso (ms) num instante: quanto o relógio local está à frente do UTC. */
function offsetAt(epoch: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(epoch));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const local = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return local - epoch;
}

/** 'YYYY-MM-DD' + 'HH:MM[:SS]' no fuso → instante. */
export function zonedEpoch(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, h, min);
  // Duas passadas acertam a hora em que o fuso muda (horário de verão)
  let epoch = naive - offsetAt(naive, timeZone);
  epoch = naive - offsetAt(epoch, timeZone);
  return epoch;
}

/** Instante do lembrete (ou null sem horário ou sem lembrete). */
export function reminderAt(
  task: { due_date: string | null; due_time: string | null; remind_before: number | null },
  timeZone: string,
) {
  if (!task.due_date || !task.due_time || task.remind_before == null) return null;
  return zonedEpoch(task.due_date, task.due_time, timeZone) - task.remind_before * 60_000;
}
