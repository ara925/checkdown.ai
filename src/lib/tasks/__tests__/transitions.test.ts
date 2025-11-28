import { describe, it, expect } from 'vitest';
import { validateReassignComment, transitionPendingReviewToAssigned, isTerminal } from '../transitions';

describe('task transitions', () => {
  it('requires non-empty comment', () => {
    expect(validateReassignComment('')).toEqual({ valid: false, error: 'Comment is required' });
  });

  it('requires minimum length', () => {
    expect(validateReassignComment('a')).toEqual({ valid: false, error: 'Comment must be at least 3 characters' });
  });

  it('validates proper comment', () => {
    expect(validateReassignComment('Need more details')).toEqual({ valid: true });
  });

  it('transitions pending_review to assigned with reason', () => {
    const res = transitionPendingReviewToAssigned('pending_review', 'Add unit tests');
    expect(res).toEqual({ next: 'assigned', reason: 'Add unit tests' });
  });

  it('rejects invalid current state', () => {
    expect(() => transitionPendingReviewToAssigned('assigned' as any, 'x')).toThrow();
  });

  it('terminal states detected', () => {
    expect(isTerminal('approved')).toBe(true);
    expect(isTerminal('rejected')).toBe(true);
    expect(isTerminal('assigned')).toBe(false);
  });
});
