// Automações (M6, D143): o que cada ação precisa e a regra pronta para gravar. Puro.

export const TRIGGERS = [
  'task_done',
  'task_ready',
  'task_assigned',
  'page_done',
  'task_overdue',
] as const;
export const ACTIONS = [
  'create_task',
  'assign',
  'notify',
  'add_label',
  'move',
  'rest_timer',
] as const;
export type AutomationTrigger = (typeof TRIGGERS)[number];
export type AutomationAction = (typeof ACTIONS)[number];

export type RuleDraft = {
  trigger: AutomationTrigger;
  pageId: string | null;
  action: AutomationAction;
  title?: string;
  targetPageId?: string | null;
  userId?: string | null;
  to?: 'creator' | 'assignees';
  message?: string;
  label?: string;
  seconds?: number;
};

/** Os parâmetros que o servidor espera, ou null se falta algo. */
export function ruleParams(d: RuleDraft): Record<string, unknown> | null {
  switch (d.action) {
    case 'create_task':
      return d.title?.trim()
        ? { title: d.title.trim(), ...(d.targetPageId ? { page_id: d.targetPageId } : {}) }
        : null;
    case 'assign':
      return d.userId ? { user_id: d.userId } : null;
    case 'notify':
      return { to: d.to ?? 'creator', ...(d.message?.trim() ? { message: d.message.trim() } : {}) };
    case 'add_label': {
      const label = (d.label ?? '').trim().replace(/^#/, '').toLowerCase();
      return label ? { label } : null;
    }
    case 'move':
      return d.targetPageId ? { page_id: d.targetPageId } : null;
    case 'rest_timer':
      return d.seconds && d.seconds >= 5 && d.seconds <= 3600 ? { seconds: d.seconds } : null;
  }
}
