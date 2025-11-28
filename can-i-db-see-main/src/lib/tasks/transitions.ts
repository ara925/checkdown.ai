export type TaskState = 'unassigned' | 'assigned' | 'pending_review' | 'approved' | 'rejected';

export function validateReassignComment(comment: string): { valid: boolean; error?: string } {
  const trimmed = (comment ?? '').trim();
  if (trimmed.length === 0) return { valid: false, error: 'Comment is required' };
  if (trimmed.length < 3) return { valid: false, error: 'Comment must be at least 3 characters' };
  return { valid: true };
}

export function transitionPendingReviewToAssigned(current: TaskState, comment: string): { next: TaskState; reason: string } {
  if (current !== 'pending_review') throw new Error('Invalid current state');
  const val = validateReassignComment(comment);
  if (!val.valid) throw new Error(val.error);
  return { next: 'assigned', reason: comment.trim() };
}

export function isTerminal(state: TaskState): boolean {
  return state === 'approved' || state === 'rejected';
}
