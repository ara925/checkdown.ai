import { describe, it, expect } from 'vitest';
import { canDeleteTask, canChangeState, isPrivileged, canEditTask, getEditBlockMessage } from '../permissions';

describe('task permissions', () => {
  it('admins are privileged', () => {
    expect(isPrivileged('admin')).toBe(true);
  });

  it('owners are privileged', () => {
    expect(isPrivileged('owner')).toBe(true);
  });

  it('members are not privileged', () => {
    expect(isPrivileged('member')).toBe(false);
  });

  it('privileged can delete any task', () => {
    expect(canDeleteTask('admin', 100, 200)).toBe(true);
    expect(canDeleteTask('owner', null, 200)).toBe(true);
  });

  it('creator can delete their own task', () => {
    expect(canDeleteTask('member', 100, 100)).toBe(true);
  });

  it('non-creator cannot delete others tasks', () => {
    expect(canDeleteTask('member', 100, 200)).toBe(false);
  });

  it('privileged can change state of any task', () => {
    expect(canChangeState('admin', null, 200)).toBe(true);
    expect(canChangeState('owner', 101, 200)).toBe(true);
  });

  it('assignee can change their task state', () => {
    expect(canChangeState('member', 100, 100)).toBe(true);
  });

  it('non-assignee cannot change others task state', () => {
    expect(canChangeState('member', 100, 200)).toBe(false);
  });

  it('cannot edit when task is deleted', () => {
    expect(canEditTask(true)).toBe(false);
    expect(canEditTask(false)).toBe(true);
  });

  it('edit block message returns correct scenarios', () => {
    expect(getEditBlockMessage(false, false)).toBe("Unable to edit: The selected task no longer exists in the system");
    expect(getEditBlockMessage(true, true)).toBe("This task has been deleted and cannot be modified");
    expect(getEditBlockMessage(true, false)).toBeNull();
  });
});
