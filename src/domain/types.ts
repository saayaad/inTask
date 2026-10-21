export type ThemeMode = 'light' | 'dark' | 'system';
export type RolloverMode = 'ask' | 'auto';
export type OrgRole = 'admin' | 'member';
export type InviteStatus = 'pending' | 'accepted' | 'revoked';
export type TaskStatus = 'todo' | 'doing' | 'awaiting_approval' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export type RecurrenceType = null | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export type GoalPeriod = 'monthly' | 'quarterly' | 'yearly';
export type AppAreaTab = 'hoje' | 'inbox' | 'projetos' | 'organizacoes' | 'metas' | 'tags';

export interface UserPreferences {
  accentColor: string;
  themeMode: ThemeMode;
  rolloverMode: RolloverMode;
  rolloverHandledDate: string | null; // YYYY-MM-DD
  projectsViewMode?: 'week' | 'kanban';
  sidebarCollapsed?: boolean;
  personalSpaceName?: string;
  personalSpaceIcon?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string; // ISO
  preferences: UserPreferences;
}

export interface Organization {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  createdBy: string;
  createdAt: string;
}

export interface Membership {
  orgId: string; // "<orgId>" or "personal:<ownerUserId>"
  userId: string;
  role: OrgRole;
  allowedTabs?: AppAreaTab[];
  joinedAt: string;
}

export interface Invite {
  id: string;
  orgId: string; // Primary spaceId
  spaceIds?: string[]; // Multiple spaces the guest will get access to
  role?: OrgRole; // Role granted upon accepting
  allowedTabs?: AppAreaTab[]; // Allowed app areas/tabs
  code: string; // 8 unambiguous chars
  email?: string;
  status: InviteStatus;
  createdBy: string;
  createdAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
}

export interface Tag {
  id: string;
  spaceId: string; // "personal:<userId>" or "<orgId>"
  name: string;
  color: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface RecurrenceCompletion {
  date: string; // YYYY-MM-DD
  userId: string;
  completedAt?: string;
}

export interface TaskApproval {
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decision?: 'approved' | 'changes_requested';
  comment?: string;
}

export interface TaskHistoryItem {
  at: string;
  userId: string;
  event:
    | 'created'
    | 'status_changed'
    | 'rollover'
    | 'submitted_for_approval'
    | 'approved'
    | 'changes_requested'
    | 'reassigned'
    | 'rescheduled'
    | 'updated';
  details: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  spaceId: string; // "personal:<userId>" or "<orgId>"
  createdBy: string;
  assigneeId: string | null;
  tagIds: string[];
  dueDate: string | null; // "YYYY-MM-DD" or null
  originalDueDate: string | null; // "YYYY-MM-DD" or null
  notes: string;
  subtasks: Subtask[];
  recurrence: RecurrenceType;
  completions: RecurrenceCompletion[];
  goalId?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  approval?: TaskApproval | null;
  history: TaskHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  id: string;
  ownerId: string;
  text: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  spaceId: string; // "personal:<userId>" or "<orgId>"
  createdBy: string;
  period: GoalPeriod;
  deadline: string; // "YYYY-MM-DD"
  createdAt: string;
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  exportedByUserId: string;
  user: User;
  organizations: Organization[];
  memberships: Membership[];
  invites: Invite[];
  tags: Tag[];
  tasks: Task[];
  inboxItems: InboxItem[];
  goals: Goal[];
}

export function getPersonalSpaceId(userId: string): string {
  return `personal:${userId}`;
}

export function isPersonalSpace(spaceId: string): boolean {
  return spaceId.startsWith('personal:');
}