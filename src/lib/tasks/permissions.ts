export type Role = 'member' | 'admin' | 'owner' | string;

export function isPrivileged(role: Role): boolean {
  return role === 'admin' || role === 'owner';
}

export function canDeleteTask(role: Role, taskManagerId: number | null, currentUserId: number | null): boolean {
  if (isPrivileged(role)) return true;
  if (taskManagerId && currentUserId && taskManagerId === currentUserId) return true;
  return false;
}

export function canChangeState(role: Role, taskAssigneeId: number | null, currentUserId: number | null): boolean {
  if (isPrivileged(role)) return true;
  if (taskAssigneeId && currentUserId && taskAssigneeId === currentUserId) return true;
  return false;
}

export function canEditTask(isDeleted: boolean): boolean {
  return !isDeleted;
}

export function getEditBlockMessage(exists: boolean, isDeleted: boolean): string | null {
  if (!exists) return "Unable to edit: The selected task no longer exists in the system";
  if (isDeleted) return "This task has been deleted and cannot be modified";
  return null;
}
