import { describe, it, expect } from 'vitest';
import { prepareNotifyPayload } from '../notifications';

describe('notifications payload', () => {
  it('builds payload for returned task', () => {
    const p = prepareNotifyPayload(42, 'Please address missing validation');
    expect(p.targetUserId).toBe(42);
    expect(p.title).toBe('Task returned for rework');
    expect(p.body).toBe('Please address missing validation');
    expect(p.url).toBe('/tasks');
  });
});
