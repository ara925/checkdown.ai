export function toLocalYMD(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toLocalHHMM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function isValidHHMM(s: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function combineLocalToUTCISO(ymd: string, hhmm: string): string {
  const d = new Date(`${ymd}T${hhmm}:00`);
  return d.toISOString();
}

export function formatDueLocal(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
  ];
  const label = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return label;
}

export function toLocal12(iso: string): { hour: number; minute: string; meridiem: 'AM' | 'PM' } {
  const d = new Date(iso);
  const h = d.getHours();
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  const minute = String(d.getMinutes()).padStart(2, '0');
  return { hour, minute, meridiem };
}

export function convert12To24(hour12: number, minute: string, meridiem: 'AM' | 'PM'): string {
  let h = hour12 % 12;
  if (meridiem === 'PM') h += 12;
  const hh = String(h).padStart(2, '0');
  const mm = String(Number(minute)).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatDueLocal12(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'
  ];
  const h24 = d.getHours();
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${h12}:${mm} ${meridiem}`;
}
