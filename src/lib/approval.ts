import type { Preset } from './permissions';

// Aprovação (M7, D144): espelho de public.can_approve.

export type ApprovalTask = { approver_id: string | null; approver_role: string | null };

export const isApproval = (t: ApprovalTask) => !!t.approver_id || !!t.approver_role;

export function canApprove(
  t: ApprovalTask,
  userId: string | undefined,
  preset: Preset | undefined,
) {
  if (!isApproval(t)) return true;
  if (t.approver_id && t.approver_id === userId) return true;
  if (t.approver_role === 'owner') return preset === 'owner';
  if (t.approver_role === 'manager') return preset === 'owner' || preset === 'manager';
  return false;
}
