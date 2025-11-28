import { describe, it, expect } from 'vitest';
import { TaskPayloadSchema } from '../persistence';

describe('Task payload validation', () => {
  it('rejects empty title', () => {
    const res = TaskPayloadSchema.safeParse({
      title: '',
      state: 'assigned',
      deadline_at: null,
      assignee_id: null,
      manager_id: null,
      review_comment: null,
    });
    expect(res.success).toBe(false);
  });

  it('accepts non-empty title', () => {
    const res = TaskPayloadSchema.safeParse({
      title: 'Update docs',
      state: 'assigned',
      deadline_at: null,
      assignee_id: null,
      manager_id: null,
      review_comment: null,
    });
    expect(res.success).toBe(true);
  });
});
