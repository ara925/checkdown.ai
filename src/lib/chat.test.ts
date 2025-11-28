import { describe, it, expect } from 'vitest';
import { canEditMessage, decrementUnread, formatEditCountdown } from './chat';

describe('canEditMessage', () => {
  it('allows edit within window', () => {
    const now = Date.now();
    const created = new Date(now - 60_000).toISOString();
    expect(canEditMessage(created, now, 120)).toBe(true);
  });
  it('disallows edit after window', () => {
    const now = Date.now();
    const created = new Date(now - 180_000).toISOString();
    expect(canEditMessage(created, now, 120)).toBe(false);
  });
});

describe('decrementUnread', () => {
  it('never goes below zero', () => {
    expect(decrementUnread(2, 5)).toBe(0);
  });
  it('subtracts viewed count', () => {
    expect(decrementUnread(6, 3)).toBe(3);
  });
});

describe('formatEditCountdown', () => {
  it('returns remaining seconds', () => {
    const now = Date.now();
    const created = new Date(now - 30_000).toISOString();
    expect(formatEditCountdown(created, now, 120)).toBeGreaterThan(80);
  });
  it('returns 0 when expired', () => {
    const now = Date.now();
    const created = new Date(now - 200_000).toISOString();
    expect(formatEditCountdown(created, now, 120)).toBe(0);
  });
});
