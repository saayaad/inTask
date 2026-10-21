import {
  AppAreaTab,
  BackupPayload,
  Goal,
  GoalPeriod,
  InboxItem,
  Invite,
  Membership,
  Organization,
  OrgRole,
  Priority,
  RecurrenceType,
  Subtask,
  Tag,
  Task,
  TaskStatus,
  User,
  UserPreferences,
} from '../domain/types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateTaskInput {
  title: string;
  spaceId: string;
  priority?: Priority;
  dueDate?: string | null;
  assigneeId?: string | null;
  tagIds?: string[];
  notes?: string;
  subtasks?: Subtask[];
  recurrence?: RecurrenceType;
  goalId?: string | null;
  createdAt?: string;
}

export interface UpdateTaskInput {
  title?: string;
  status?: TaskStatus;
  priority?: Priority;
  spaceId?: string;
  assigneeId?: string | null;
  tagIds?: string[];
  dueDate?: string | null;
  originalDueDate?: string | null;
  notes?: string;
  subtasks?: Subtask[];
  recurrence?: RecurrenceType;
  goalId?: string | null;
}

export interface CreateGoalInput {
  title: string;
  spaceId: string;
  period: GoalPeriod;
  deadline: string;
}

export interface UpdateGoalInput {
  title?: string;
  period?: GoalPeriod;
  deadline?: string;
}

export interface CreateInviteOptions {
  email?: string;
  spaceIds?: string[];
  role?: OrgRole;
  allowedTabs?: AppAreaTab[];
}

export interface AuthService {
  getCurrentUser(): Promise<User | null>;
  listLocalAccounts(): Promise<User[]>;
  register(input: RegisterInput): Promise<User>;
  login(input: LoginInput): Promise<User>;
  switchAccount(userId: string): Promise<User>;
  logout(): Promise<void>;
  updateProfile(userId: string, updates: { name?: string; preferences?: Partial<UserPreferences> }): Promise<User>;
}

export interface TaskRepository {
  listAccessibleTasks(userId: string): Promise<Task[]>;
  createTask(actorId: string, input: CreateTaskInput): Promise<Task>;
  updateTask(actorId: string, taskId: string, updates: UpdateTaskInput): Promise<Task>;
  toggleTaskCompletion(actorId: string, taskId: string, targetDateStr: string): Promise<Task>;
  submitForApproval(actorId: string, taskId: string): Promise<Task>;
  reviewApproval(
    actorId: string,
    taskId: string,
    decision: 'approved' | 'changes_requested',
    comment?: string
  ): Promise<Task>;
  rolloverTasksToToday(actorId: string, taskIds: string[], todayStr: string): Promise<Task[]>;
  restoreTasksSnapshot(actorId: string, previousTasks: Task[]): Promise<void>;
  deleteTask(actorId: string, taskId: string): Promise<Task>;
}

export interface InboxRepository {
  listInboxItems(ownerId: string): Promise<InboxItem[]>;
  addInboxItem(ownerId: string, text: string): Promise<InboxItem>;
  deleteInboxItem(ownerId: string, itemId: string): Promise<InboxItem>;
  restoreInboxItem(ownerId: string, item: InboxItem): Promise<InboxItem>;
}

export interface TagRepository {
  listAccessibleTags(userId: string): Promise<Tag[]>;
  createTag(actorId: string, spaceId: string, name: string, color: string): Promise<Tag>;
  updateTag(actorId: string, tagId: string, name: string, color: string): Promise<Tag>;
  deleteTag(actorId: string, tagId: string): Promise<void>;
}

export interface OrgRepository {
  listUserOrganizations(userId: string): Promise<{
    organizations: Organization[];
    memberships: Membership[];
    membersById: Record<string, User>;
    invites: Invite[];
  }>;
  createOrganization(
    actorId: string,
    name: string,
    icon?: string,
    color?: string
  ): Promise<{ organization: Organization; membership: Membership }>;
  renameOrganization(actorId: string, orgId: string, name: string): Promise<Organization>;
  updateOrganization(
    actorId: string,
    orgId: string,
    updates: { name?: string; icon?: string; color?: string }
  ): Promise<Organization>;
  deleteOrganization(actorId: string, orgId: string): Promise<void>;
  createInvite(
    actorId: string,
    orgId: string,
    emailOrOptions?: string | CreateInviteOptions
  ): Promise<Invite>;
  revokeInvite(actorId: string, inviteId: string): Promise<Invite>;
  getInviteByCode(code: string): Promise<{ invite: Invite; organization: Organization } | null>;
  acceptInviteByCode(actorId: string, code: string): Promise<{ organization: Organization; membership: Membership }>;
  updateMemberRole(
    actorId: string,
    orgId: string,
    targetUserId: string,
    role: OrgRole,
    allowedTabs?: AppAreaTab[]
  ): Promise<Membership>;
  removeMember(actorId: string, orgId: string, targetUserId: string): Promise<void>;
  leaveOrganization(actorId: string, orgId: string): Promise<void>;
}

export interface GoalRepository {
  listAccessibleGoals(userId: string): Promise<Goal[]>;
  createGoal(actorId: string, input: CreateGoalInput): Promise<Goal>;
  updateGoal(actorId: string, goalId: string, updates: UpdateGoalInput): Promise<Goal>;
  deleteGoal(actorId: string, goalId: string): Promise<void>;
}

export interface BackupSummary {
  schemaVersion: number;
  exportedAt: string;
  userName: string;
  organizationsCount: number;
  tasksCount: number;
  inboxCount: number;
  goalsCount: number;
  tagsCount: number;
}

export interface BackupService {
  exportUserBackup(userId: string): Promise<BackupPayload>;
  validateBackupJson(rawJson: string): Promise<{ payload: BackupPayload; summary: BackupSummary }>;
  importUserBackup(userId: string, payload: BackupPayload, mode: 'replace' | 'merge'): Promise<void>;
  seedSampleData(userId?: string): Promise<User>;
  clearAllData(): Promise<void>;
}

export interface DataProvider {
  readonly mode: 'local' | 'firebase';
  auth: AuthService;
  tasks: TaskRepository;
  inbox: InboxRepository;
  tags: TagRepository;
  orgs: OrgRepository;
  goals: GoalRepository;
  backup: BackupService;
  subscribeExternalChanges(callback: () => void): () => void;
  subscribeStorageWarnings(callback: (message: string) => void): () => void;
}