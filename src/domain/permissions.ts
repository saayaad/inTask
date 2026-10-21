import { AppAreaTab, Goal, isPersonalSpace, Membership, OrgRole, Task, User } from './types';

export type PermissionAction =
  | 'view_space'
  | 'manage_org'
  | 'invite_member'
  | 'remove_member'
  | 'manage_tags'
  | 'create_task'
  | 'view_task'
  | 'edit_task'
  | 'delete_task'
  | 'assign_others'
  | 'complete_direct'
  | 'submit_for_approval'
  | 'review_approval'
  | 'manage_goal'
  | 'view_goal';

export interface PermissionResource {
  spaceId?: string;
  orgId?: string;
  task?: Task;
  goal?: Goal;
}

export function getUserRoleInOrg(
  userId: string,
  spaceOrOrgId: string,
  memberships: Membership[]
): OrgRole | null {
  if (spaceOrOrgId === `personal:${userId}`) {
    return 'admin';
  }
  const found = memberships.find((m) => m.orgId === spaceOrOrgId && m.userId === userId);
  return found ? found.role : null;
}

export function canAccessSpace(
  userId: string,
  spaceId: string,
  memberships: Membership[]
): boolean {
  if (spaceId === `personal:${userId}`) {
    return true;
  }
  return getUserRoleInOrg(userId, spaceId, memberships) !== null;
}

export function canAccessTabInSpace(
  userId: string,
  spaceId: string,
  tab: AppAreaTab,
  memberships: Membership[]
): boolean {
  if (spaceId === 'all' || spaceId === `personal:${userId}`) return true;
  const found = memberships.find((m) => m.orgId === spaceId && m.userId === userId);
  if (!found) return false;
  if (found.role === 'admin') return true;
  if (!found.allowedTabs || found.allowedTabs.length === 0) return true;
  return found.allowedTabs.includes(tab);
}

/**
 * Business rule:
 * A task requires approval when:
 * 1) The assignee is a Member (not Admin) in that space
 * 2) It was assigned/created by another person (task.createdBy !== task.assigneeId)
 */
export function taskRequiresApproval(task: Task, memberships: Membership[]): boolean {
  if (!task.assigneeId) return false;
  if (task.spaceId === `personal:${task.assigneeId}`) return false;
  const assigneeRole = getUserRoleInOrg(task.assigneeId, task.spaceId, memberships);
  if (assigneeRole !== 'member') return false;
  return task.createdBy !== task.assigneeId;
}

/**
 * Single centralized permission guard `can(user, action, resource, memberships)`
 */
export function can(
  user: User | null | undefined,
  action: PermissionAction,
  resource: PermissionResource,
  memberships: Membership[]
): boolean {
  if (!user) return false;

  const spaceId =
    resource.spaceId ??
    resource.task?.spaceId ??
    resource.goal?.spaceId ??
    (resource.orgId ? resource.orgId : undefined);

  if (!spaceId) return false;

  // Owner of personal space has full Admin rights over their personal space
  if (isPersonalSpace(spaceId) && spaceId === `personal:${user.id}`) {
    if (action === 'submit_for_approval') {
      return false; // Owner completes directly and can approve/move anything
    }
    return true;
  }

  // Check role in space (works for both Organizations and shared Personal Spaces)
  const role = getUserRoleInOrg(user.id, spaceId, memberships);
  if (!role) return false;

  if (role === 'admin') {
    if (action === 'submit_for_approval') {
      return false; // Admins complete directly
    }
    return true;
  }

  // Role === 'member'
  switch (action) {
    case 'view_space':
    case 'view_task':
    case 'view_goal':
    case 'create_task':
      return true;

    case 'manage_org':
    case 'invite_member':
    case 'remove_member':
    case 'manage_tags':
    case 'assign_others':
    case 'review_approval':
    case 'manage_goal':
      return false;

    case 'edit_task':
    case 'delete_task': {
      const task = resource.task;
      if (!task) return false;
      return task.assigneeId === user.id || task.createdBy === user.id;
    }

    case 'submit_for_approval': {
      const task = resource.task;
      if (!task) return false;
      return task.assigneeId === user.id && taskRequiresApproval(task, memberships);
    }

    case 'complete_direct': {
      const task = resource.task;
      if (!task) return false;
      if (task.assigneeId !== user.id) return false;
      return !taskRequiresApproval(task, memberships);
    }

    default:
      return false;
  }
}