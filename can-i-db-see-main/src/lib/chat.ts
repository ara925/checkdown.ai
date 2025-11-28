export function canEditMessage(createdAt: string, nowMs: number, windowSeconds: number) {
  const created = new Date(createdAt).getTime();
  return nowMs - created <= windowSeconds * 1000;
}

export function decrementUnread(current: number, viewedCount: number) {
  const n = current - viewedCount;
  return n < 0 ? 0 : n;
}

export function formatEditCountdown(createdAt: string, nowMs: number, windowSeconds: number) {
  const created = new Date(createdAt).getTime();
  const remaining = Math.floor((windowSeconds * 1000 - (nowMs - created)) / 1000);
  return remaining > 0 ? remaining : 0;
}
