export interface NotifyPayload {
  targetUserId: number;
  title: string;
  body: string;
  url: string;
}

export function prepareNotifyPayload(userId: number, comment: string): NotifyPayload {
  return {
    targetUserId: userId,
    title: 'Task returned for rework',
    body: comment.trim(),
    url: '/tasks'
  };
}
