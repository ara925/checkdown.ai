import { describe, it, expect } from 'vitest';
import { convert12To24, toLocal12, formatDueLocal12 } from '../../datetime';

describe('AM/PM conversions', () => {
  it('converts 12-hour to 24-hour correctly', () => {
    expect(convert12To24(12, '00', 'AM')).toBe('00:00');
    expect(convert12To24(12, '00', 'PM')).toBe('12:00');
    expect(convert12To24(1, '05', 'AM')).toBe('01:05');
    expect(convert12To24(11, '59', 'PM')).toBe('23:59');
  });

  it('extracts local 12-hour parts from ISO', () => {
    const iso = new Date('2023-07-10T22:30:00Z').toISOString();
    const { hour, minute, meridiem } = toLocal12(iso);
    expect(['AM','PM']).toContain(meridiem);
    expect(hour).toBeGreaterThanOrEqual(1);
    expect(hour).toBeLessThanOrEqual(12);
    expect(minute).toMatch(/^\d{2}$/);
  });

  it('formats due label with AM/PM', () => {
    const iso = new Date('2023-01-15T14:30:00Z').toISOString();
    const label = formatDueLocal12(iso);
    expect(label).toMatch(/at \d{1,2}:\d{2} (AM|PM)$/);
  });
});
