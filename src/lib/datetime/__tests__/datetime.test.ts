import { describe, it, expect } from 'vitest';
import { toLocalYMD, toLocalHHMM, isValidHHMM, combineLocalToUTCISO, formatDueLocal } from '../../datetime';

describe('datetime utils', () => {
  it('validates HH:MM format', () => {
    expect(isValidHHMM('00:00')).toBe(true);
    expect(isValidHHMM('23:59')).toBe(true);
    expect(isValidHHMM('24:00')).toBe(false);
    expect(isValidHHMM('12:60')).toBe(false);
    expect(isValidHHMM('9:30')).toBe(false);
  });

  it('combines local date/time to UTC ISO', () => {
    const ymd = '2023-01-31';
    const hhmm = '14:30';
    const iso = combineLocalToUTCISO(ymd, hhmm);
    const expected = new Date(`${ymd}T${hhmm}:00`).toISOString();
    expect(iso).toBe(expected);
  });

  it('formats due label consistently', () => {
    const iso = new Date('2023-01-15T14:30:00Z').toISOString();
    const label = formatDueLocal(iso);
    expect(label).toMatch(/Jan \d{1,2}, 2023 at \d{2}:\d{2}/);
  });

  it('extracts local YMD and HH:MM from ISO', () => {
    const iso = new Date('2023-02-28T00:05:00Z').toISOString();
    const ymd = toLocalYMD(iso);
    const hhmm = toLocalHHMM(iso);
    expect(ymd).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(hhmm).toMatch(/\d{2}:\d{2}/);
  });
});
