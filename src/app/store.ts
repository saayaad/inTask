import { create } from 'zustand';
import { dataProvider } from '../data/firebaseAdapter';
import {
  BackupSummary,
  CreateGoalInput,
  CreateInviteOptions,
  CreateTaskInput,
  LoginInput,
  RegisterInput,
  UpdateGoalInput,
  UpdateTaskInput,
} from '../data/interfaces';
import {
  advanceSimulatedDay,
  getSimulatedOffsetDays,
  setSimulatedOffsetDays,
  todayStr,
} from '../domain/clock';
import { DEFAULT_ACCENT_COLOR } from '../domain/color';
import { getPendingRolloverTasks } from '../domain/rollover';
import {
  AppAreaTab,
  BackupPayload,
  Goal,
  InboxItem,
  Invite,
  Membership,
  Organization,
  OrgRole,
  Tag,
  Task,
  User,
  UserPreferences,
} from '../domain/types';
import { applyThemeToDom } from '../theme/ThemeProvider';

export interface ToastNotification {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'error';
  undoLabel?: string;
  onUndo?: () => Promise<void>;
}

interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  user: User | null;
  localAccounts: User[];
  tasks: Task[];
  inboxItems: InboxItem[];
  tags: Tag[];
  organizations: Organization[];
  memberships: Membership[];
  membersById: Record<string, User>;
  invites: Invite[];
  goals: Goal[];

  currentTodayStr: string;
  simulatedOffsetDays: number;
  storageWarning: string | null;

  // UI state
  selectedTodaySpace: string; // 'all' | 'personal:<id>' | '<orgId>'
  activeTaskId: string | null;
  isQuickAddOpen: boolean;
  quickAddDefaultSpace?: string;
  quickAddDefaultDate?: string | null;
  toast: ToastNotification | null;

  // Actions
  initialize: () => Promise<void>;
  refreshUserData: (targetUser?: User | null) => Promise<void>;
  checkDayRollover: () => Promise<void>;

  // Auth
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  logout: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserPreferences>) => Promise<void>;
  updateUserName: (name: string) => Promise<void>;

  // Tasks
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (taskId: string, updates: UpdateTaskInput) => Promise<Task>;
  toggleTaskCompletion: (taskId: string, dateStr?: string) => Promise<void>;
  submitForApproval: (taskId: string) => Promise<void>;
  reviewApproval: (
    taskId: string,
    decision: 'approved' | 'changes_requested',
    comment?: string
  ) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  rolloverTasks: (taskIds: string[], markHandled?: boolean) => Promise<void>;
  dismissRolloverForToday: () => Promise<void>;

  // Inbox
  addInboxItem: (text: string) => Promise<void>;
  deleteInboxItem: (itemId: string, withUndo?: boolean) => Promise<void>;
  triageInboxToTask: (itemId: string, taskInput: CreateTaskInput) => Promise<void>;

  // Tags
  createTag: (spaceId: string, name: string, color: string) => Promise<Tag>;
  updateTag: (tagId: string, name: string, color: string) => Promise<Tag>;
  deleteTag: (tagId: string) => Promise<void>;

  // Organizations, Spaces & Invites
  createOrganization: (name: string, icon?: string, color?: string) => Promise<Organization>;
  renameOrganization: (orgId: string, name: string) => Promise<void>;
  updateOrganization: (
    orgId: string,
    updates: { name?: string; icon?: string; color?: string }
  ) => Promise<void>;
  deleteOrganization: (orgId: string) => Promise<void>;
  createInvite: (
    orgId: string,
    emailOrOptions?: string | CreateInviteOptions
  ) => Promise<Invite>;
  revokeInvite: (inviteId: string) => Promise<void>;
  acceptInviteByCode: (code: string) => Promise<Organization>;
  updateMemberRole: (
    orgId: string,
    targetUserId: string,
    role: OrgRole,
    allowedTabs?: AppAreaTab[]
  ) => Promise<void>;
  removeMember: (orgId: string, targetUserId: string) => Promise<void>;
  leaveOrganization: (orgId: string) => Promise<void>;

  // Goals
  createGoal: (input: CreateGoalInput) => Promise<Goal>;
  updateGoal: (goalId: string, updates: UpdateGoalInput) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;

  // Backup & Simulation
  exportBackup: () => Promise<BackupPayload>;
  validateBackup: (rawJson: string) => Promise<{ payload: BackupPayload; summary: BackupSummary }>;
  importBackup: (payload: BackupPayload, mode: 'replace' | 'merge') => Promise<void>;
  seedSampleData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  simulateNextDay: () => Promise<void>;
  resetSimulatedClock: () => Promise<void>;

  // UI helpers
  setSelectedTodaySpace: (space: string) => void;
  openTaskDetail: (taskId: string | null) => void;
  openQuickAdd: (defaultSpace?: string, defaultDate?: string | null) => void;
  closeQuickAdd: () => void;
  showToast: (toast: Omit<ToastNotification, 'id'>) => void;
  dismissToast: () => void;
  dismissStorageWarning: () => void;
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export const useAppStore = create<AppState>((set, get) => ({
  isInitialized: false,
  isLoading: false,
  user: null,
  localAccounts: [],
  tasks: [],
  inboxItems: [],
  tags: [],
  organizations: [],
  memberships: [],
  membersById: {},
  invites: [],
  goals: [],

  currentTodayStr: todayStr(),
  simulatedOffsetDays: getSimulatedOffsetDays(),
  storageWarning: null,

  selectedTodaySpace: 'all',
  activeTaskId: null,
  isQuickAddOpen: false,
  quickAddDefaultSpace: undefined,
  quickAddDefaultDate: undefined,
  toast: null,

  initialize: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true });

    dataProvider.subscribeStorageWarnings((msg) => {
      set({ storageWarning: msg });
    });

    dataProvider.subscribeExternalChanges(() => {
      void get().refreshUserData();
    });

    try {
      const currentUser = await dataProvider.auth.getCurrentUser();
      await get().refreshUserData(currentUser);
      set({ isInitialized: true, isLoading: false });
      if (currentUser) {
        await get().checkDayRollover();
      }
    } catch {
      set({ isInitialized: true, isLoading: false });
    }
  },

  refreshUserData: async (explicitUser) => {
    const currentUser =
      explicitUser !== undefined ? explicitUser : await dataProvider.auth.getCurrentUser();
    const localAccounts = await dataProvider.auth.listLocalAccounts();
    const currentToday = todayStr();

    if (!currentUser) {
      set({
        user: null,
        localAccounts,
        tasks: [],
        inboxItems: [],
        tags: [],
        organizations: [],
        memberships: [],
        membersById: {},
        invites: [],
        goals: [],
        currentTodayStr: currentToday,
        simulatedOffsetDays: getSimulatedOffsetDays(),
      });
      return;
    }

    const [tasks, inboxItems, tags, orgData, goals] = await Promise.all([
      dataProvider.tasks.listAccessibleTasks(currentUser.id),
      dataProvider.inbox.listInboxItems(currentUser.id),
      dataProvider.tags.listAccessibleTags(currentUser.id),
      dataProvider.orgs.listUserOrganizations(currentUser.id),
      dataProvider.goals.listAccessibleGoals(currentUser.id),
    ]);

    set({
      user: currentUser,
      localAccounts,
      tasks,
      inboxItems,
      tags,
      organizations: orgData.organizations,
      memberships: orgData.memberships,
      membersById: orgData.membersById,
      invites: orgData.invites,
      goals,
      currentTodayStr: currentToday,
      simulatedOffsetDays: getSimulatedOffsetDays(),
    });
  },

  checkDayRollover: async () => {
    const currentToday = todayStr();
    if (get().currentTodayStr !== currentToday) {
      set({ currentTodayStr: currentToday });
    }
    const { user, tasks } = get();
    if (!user) return;

    const pending = getPendingRolloverTasks(tasks, user.id, currentToday);
    if (
      pending.length > 0 &&
      user.preferences.rolloverMode === 'auto' &&
      user.preferences.rolloverHandledDate !== currentToday
    ) {
      const snapshotBefore = pending.map((t) => ({
        ...t,
        history: [...t.history],
      }));
      const prevHandledDate = user.preferences.rolloverHandledDate;

      await dataProvider.tasks.rolloverTasksToToday(
        user.id,
        pending.map((t) => t.id),
        currentToday
      );
      const updatedUser = await dataProvider.auth.updateProfile(user.id, {
        preferences: { rolloverHandledDate: currentToday },
      });
      await get().refreshUserData(updatedUser);

      get().showToast({
        message: `${pending.length} ${
          pending.length === 1 ? 'tarefa pendente foi movida' : 'tarefas pendentes foram movidas'
        } automaticamente para Hoje.`,
        undoLabel: 'Desfazer',
        onUndo: async () => {
          await dataProvider.tasks.restoreTasksSnapshot(user.id, snapshotBefore);
          const revertedUser = await dataProvider.auth.updateProfile(user.id, {
            preferences: { rolloverHandledDate: prevHandledDate },
          });
          await get().refreshUserData(revertedUser);
        },
      });
    }
  },

  login: async (input) => {
    const loggedIn = await dataProvider.auth.login(input);
    await get().refreshUserData(loggedIn);
    await get().checkDayRollover();
  },

  register: async (input) => {
    const registered = await dataProvider.auth.register(input);
    await get().refreshUserData(registered);
  },

  switchAccount: async (userId) => {
    try {
      const switched = await dataProvider.auth.switchAccount(userId);
      set({ selectedTodaySpace: 'all', activeTaskId: null });
      await get().refreshUserData(switched);
      await get().checkDayRollover();
      get().showToast({
        message: `Alternado para a conta de ${switched.name}.`,
        type: 'info',
      });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Não foi possível alternar de conta.'),
        type: 'error',
      });
    }
  },

  logout: async () => {
    await dataProvider.auth.logout();
    set({ activeTaskId: null, selectedTodaySpace: 'all' });
    await get().refreshUserData(null);
  },

  updatePreferences: async (prefs) => {
    const { user } = get();
    if (!user) return;
    try {
      const updated = await dataProvider.auth.updateProfile(user.id, { preferences: prefs });
      set({ user: updated });
      if (prefs.rolloverMode === 'auto') {
        await get().checkDayRollover();
      }
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao salvar preferências.'),
        type: 'error',
      });
    }
  },

  updateUserName: async (name) => {
    const { user } = get();
    if (!user) return;
    try {
      const updated = await dataProvider.auth.updateProfile(user.id, { name });
      await get().refreshUserData(updated);
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao atualizar nome.'),
        type: 'error',
      });
    }
  },

  createTask: async (input) => {
    const { user } = get();
    if (!user) throw new Error('Faça login para criar tarefas.');
    try {
      const created = await dataProvider.tasks.createTask(user.id, input);
      await get().refreshUserData(user);
      return created;
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao criar tarefa.'),
        type: 'error',
      });
      throw err;
    }
  },

  updateTask: async (taskId, updates) => {
    const { user, tasks } = get();
    if (!user) throw new Error('Faça login para editar tarefas.');
    try {
      const before = tasks.find((t) => t.id === taskId);
      const updated = await dataProvider.tasks.updateTask(user.id, taskId, updates);
      await get().refreshUserData(user);

      if (
        before &&
        before.status !== 'awaiting_approval' &&
        updated.status === 'awaiting_approval'
      ) {
        get().showToast({
          message: 'Tarefa enviada para aprovação do administrador.',
          type: 'info',
        });
      }
      return updated;
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Não foi possível atualizar a tarefa.'),
        type: 'error',
      });
      throw err;
    }
  },

  toggleTaskCompletion: async (taskId, dateStr) => {
    const { user, tasks, currentTodayStr } = get();
    if (!user) return;
    const targetDate = dateStr || currentTodayStr;
    const snapshot = tasks.find((t) => t.id === taskId);
    if (!snapshot) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch {
      // Ignore
    }

    try {
      const updated = await dataProvider.tasks.toggleTaskCompletion(user.id, taskId, targetDate);
      await get().refreshUserData(user);

      if (
        !updated.recurrence &&
        (updated.status === 'done' || updated.status === 'awaiting_approval')
      ) {
        const msg =
          updated.status === 'awaiting_approval'
            ? 'Enviada para aprovação!'
            : 'Tarefa concluída!';
        get().showToast({
          message: msg,
          type: 'success',
          undoLabel: 'Desfazer',
          onUndo: async () => {
            await dataProvider.tasks.restoreTasksSnapshot(user.id, [snapshot]);
            await get().refreshUserData(user);
          },
        });
      }
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Sem permissão para alterar esta tarefa.'),
        type: 'error',
      });
    }
  },

  submitForApproval: async (taskId) => {
    const { user, tasks } = get();
    if (!user) return;
    try {
      const snapshot = tasks.find((t) => t.id === taskId);
      await dataProvider.tasks.submitForApproval(user.id, taskId);
      await get().refreshUserData(user);
      get().showToast({
        message: 'Tarefa enviada para aprovação do Admin.',
        type: 'info',
        undoLabel: snapshot ? 'Desfazer' : undefined,
        onUndo: snapshot
          ? async () => {
              await dataProvider.tasks.restoreTasksSnapshot(user.id, [snapshot]);
              await get().refreshUserData(user);
            }
          : undefined,
      });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Não foi possível enviar para aprovação.'),
        type: 'error',
      });
    }
  },

  reviewApproval: async (taskId, decision, comment) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.tasks.reviewApproval(user.id, taskId, decision, comment);
      await get().refreshUserData(user);
      get().showToast({
        message:
          decision === 'approved'
            ? 'Tarefa aprovada com sucesso! O progresso da meta foi atualizado.'
            : 'Ajustes solicitados enviados para o responsável.',
        type: 'success',
      });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao revisar aprovação.'),
        type: 'error',
      });
    }
  },

  deleteTask: async (taskId) => {
    const { user, activeTaskId } = get();
    if (!user) return;
    try {
      const deleted = await dataProvider.tasks.deleteTask(user.id, taskId);
      if (activeTaskId === taskId) {
        set({ activeTaskId: null });
      }
      await get().refreshUserData(user);
      get().showToast({
        message: `Tarefa "${deleted.title.slice(0, 32)}" excluída.`,
        undoLabel: 'Desfazer',
        onUndo: async () => {
          await dataProvider.tasks.restoreTasksSnapshot(user.id, [deleted]);
          await get().refreshUserData(user);
        },
      });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Sem permissão para excluir esta tarefa.'),
        type: 'error',
      });
    }
  },

  rolloverTasks: async (taskIds, markHandled = true) => {
    const { user, tasks, currentTodayStr } = get();
    if (!user || taskIds.length === 0) return;

    const idSet = new Set(taskIds);
    const snapshot = tasks
      .filter((t) => idSet.has(t.id))
      .map((t) => ({ ...t, history: [...t.history] }));
    const prevHandled = user.preferences.rolloverHandledDate;

    await dataProvider.tasks.rolloverTasksToToday(user.id, taskIds, currentTodayStr);
    let updatedUser = user;
    if (markHandled) {
      updatedUser = await dataProvider.auth.updateProfile(user.id, {
        preferences: { rolloverHandledDate: currentTodayStr },
      });
    }
    await get().refreshUserData(updatedUser);

    get().showToast({
      message: `${taskIds.length} ${
        taskIds.length === 1 ? 'tarefa movida para Hoje.' : 'tarefas movidas para Hoje.'
      }`,
      type: 'success',
      undoLabel: 'Desfazer',
      onUndo: async () => {
        await dataProvider.tasks.restoreTasksSnapshot(user.id, snapshot);
        const reverted = await dataProvider.auth.updateProfile(user.id, {
          preferences: { rolloverHandledDate: prevHandled },
        });
        await get().refreshUserData(reverted);
      },
    });
  },

  dismissRolloverForToday: async () => {
    const { user, currentTodayStr } = get();
    if (!user) return;
    const updatedUser = await dataProvider.auth.updateProfile(user.id, {
      preferences: { rolloverHandledDate: currentTodayStr },
    });
    set({ user: updatedUser });
  },

  addInboxItem: async (text) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.inbox.addInboxItem(user.id, text);
      await get().refreshUserData(user);
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao adicionar item na Inbox.'),
        type: 'error',
      });
    }
  },

  deleteInboxItem: async (itemId, withUndo = true) => {
    const { user } = get();
    if (!user) return;
    try {
      const removed = await dataProvider.inbox.deleteInboxItem(user.id, itemId);
      await get().refreshUserData(user);

      if (withUndo) {
        get().showToast({
          message: 'Item removido da Inbox.',
          undoLabel: 'Desfazer',
          onUndo: async () => {
            await dataProvider.inbox.restoreInboxItem(user.id, removed);
            await get().refreshUserData(user);
          },
        });
      }
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao remover item da Inbox.'),
        type: 'error',
      });
    }
  },

  triageInboxToTask: async (itemId, taskInput) => {
    const { user, inboxItems } = get();
    if (!user) return;
    const item = inboxItems.find((i) => i.id === itemId);
    if (!item) return;

    try {
      const createdTask = await dataProvider.tasks.createTask(user.id, {
        ...taskInput,
        title: item.text,
        createdAt: item.createdAt,
      });
      await dataProvider.inbox.deleteInboxItem(user.id, itemId);
      await get().refreshUserData(user);

      get().showToast({
        message: 'Item transformado em tarefa!',
        type: 'success',
        undoLabel: 'Desfazer',
        onUndo: async () => {
          await dataProvider.tasks.deleteTask(user.id, createdTask.id);
          await dataProvider.inbox.restoreInboxItem(user.id, item);
          await get().refreshUserData(user);
        },
      });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao transformar item em tarefa.'),
        type: 'error',
      });
    }
  },

  createTag: async (spaceId, name, color) => {
    const { user } = get();
    if (!user) throw new Error('Não autenticado.');
    try {
      const tag = await dataProvider.tags.createTag(user.id, spaceId, name, color);
      await get().refreshUserData(user);
      return tag;
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao criar tag.'),
        type: 'error',
      });
      throw err;
    }
  },

  updateTag: async (tagId, name, color) => {
    const { user } = get();
    if (!user) throw new Error('Não autenticado.');
    try {
      const tag = await dataProvider.tags.updateTag(user.id, tagId, name, color);
      await get().refreshUserData(user);
      return tag;
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao atualizar tag.'),
        type: 'error',
      });
      throw err;
    }
  },

  deleteTag: async (tagId) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.tags.deleteTag(user.id, tagId);
      await get().refreshUserData(user);
      get().showToast({ message: 'Tag excluída.', type: 'info' });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao excluir tag.'),
        type: 'error',
      });
    }
  },

  createOrganization: async (name, icon, color) => {
    const { user } = get();
    if (!user) throw new Error('Não autenticado.');
    try {
      const { organization } = await dataProvider.orgs.createOrganization(
        user.id,
        name,
        icon,
        color
      );
      await get().refreshUserData(user);
      get().showToast({
        message: `Espaço "${organization.name}" criado! Você é o Admin.`,
        type: 'success',
      });
      return organization;
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao criar espaço.'),
        type: 'error',
      });
      throw err;
    }
  },

  renameOrganization: async (orgId, name) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.orgs.renameOrganization(user.id, orgId, name);
      await get().refreshUserData(user);
      get().showToast({ message: 'Nome do espaço atualizado.', type: 'success' });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao renomear espaço.'),
        type: 'error',
      });
    }
  },

  updateOrganization: async (orgId, updates) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.orgs.updateOrganization(user.id, orgId, updates);
      await get().refreshUserData(user);
      get().showToast({ message: 'Espaço atualizado com sucesso!', type: 'success' });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao atualizar espaço.'),
        type: 'error',
      });
    }
  },

  deleteOrganization: async (orgId) => {
    const { user, selectedTodaySpace } = get();
    if (!user) return;
    try {
      await dataProvider.orgs.deleteOrganization(user.id, orgId);
      if (selectedTodaySpace === orgId) {
        set({ selectedTodaySpace: 'all' });
      }
      await get().refreshUserData(user);
      get().showToast({ message: 'Espaço excluído.', type: 'info' });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao excluir espaço.'),
        type: 'error',
      });
    }
  },

  createInvite: async (orgId, emailOrOptions) => {
    const { user } = get();
    if (!user) throw new Error('Não autenticado.');
    try {
      const invite = await dataProvider.orgs.createInvite(user.id, orgId, emailOrOptions);
      await get().refreshUserData(user);
      return invite;
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao criar convite.'),
        type: 'error',
      });
      throw err;
    }
  },

  revokeInvite: async (inviteId) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.orgs.revokeInvite(user.id, inviteId);
      await get().refreshUserData(user);
      get().showToast({ message: 'Código de convite revogado.', type: 'info' });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao revogar convite.'),
        type: 'error',
      });
    }
  },

  acceptInviteByCode: async (code) => {
    const { user } = get();
    if (!user) throw new Error('Faça login para aceitar o convite.');
    const { organization, membership } = await dataProvider.orgs.acceptInviteByCode(user.id, code);
    await get().refreshUserData(user);
    get().showToast({
      message: `Você entrou em "${organization.name}" como ${
        membership.role === 'admin' ? 'Admin' : 'Membro'
      }!`,
      type: 'success',
    });
    return organization;
  },

  updateMemberRole: async (orgId, targetUserId, role, allowedTabs) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.orgs.updateMemberRole(user.id, orgId, targetUserId, role, allowedTabs);
      await get().refreshUserData(user);
      get().showToast({
        message: 'Permissões e cargo atualizados!',
        type: 'success',
      });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao atualizar permissões do membro.'),
        type: 'error',
      });
    }
  },

  removeMember: async (orgId, targetUserId) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.orgs.removeMember(user.id, orgId, targetUserId);
      await get().refreshUserData(user);
      get().showToast({
        message: 'Membro removido. As tarefas abertas dele ficaram sem responsável.',
        type: 'info',
      });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao remover membro.'),
        type: 'error',
      });
    }
  },

  leaveOrganization: async (orgId) => {
    const { user, selectedTodaySpace } = get();
    if (!user) return;
    try {
      await dataProvider.orgs.leaveOrganization(user.id, orgId);
      if (selectedTodaySpace === orgId) {
        set({ selectedTodaySpace: 'all' });
      }
      await get().refreshUserData(user);
      get().showToast({ message: 'Você saiu do espaço.', type: 'info' });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Não foi possível sair do espaço.'),
        type: 'error',
      });
    }
  },

  createGoal: async (input) => {
    const { user } = get();
    if (!user) throw new Error('Não autenticado.');
    try {
      const goal = await dataProvider.goals.createGoal(user.id, input);
      await get().refreshUserData(user);
      get().showToast({ message: 'Meta criada com sucesso!', type: 'success' });
      return goal;
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao criar meta.'),
        type: 'error',
      });
      throw err;
    }
  },

  updateGoal: async (goalId, updates) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.goals.updateGoal(user.id, goalId, updates);
      await get().refreshUserData(user);
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao atualizar meta.'),
        type: 'error',
      });
    }
  },

  deleteGoal: async (goalId) => {
    const { user } = get();
    if (!user) return;
    try {
      await dataProvider.goals.deleteGoal(user.id, goalId);
      await get().refreshUserData(user);
      get().showToast({ message: 'Meta removida.', type: 'info' });
    } catch (err) {
      get().showToast({
        message: getErrorMessage(err, 'Erro ao remover meta.'),
        type: 'error',
      });
    }
  },

  exportBackup: async () => {
    const { user } = get();
    if (!user) throw new Error('Não autenticado.');
    return dataProvider.backup.exportUserBackup(user.id);
  },

  validateBackup: async (rawJson) => {
    return dataProvider.backup.validateBackupJson(rawJson);
  },

  importBackup: async (payload, mode) => {
    const { user } = get();
    if (!user) throw new Error('Não autenticado.');
    await dataProvider.backup.importUserBackup(user.id, payload, mode);
    await get().refreshUserData();
    get().showToast({
      message:
        mode === 'replace'
          ? 'Backup restaurado com sucesso (dados substituídos)!'
          : 'Backup importado e mesclado com sucesso!',
      type: 'success',
    });
  },

  seedSampleData: async () => {
    const { user } = get();
    const seededUser = await dataProvider.backup.seedSampleData(user?.id);
    await get().refreshUserData(seededUser);
    get().showToast({
      message: 'Dados de exemplo carregados!',
      type: 'success',
    });
  },

  clearAllData: async () => {
    await dataProvider.backup.clearAllData();
    setSimulatedOffsetDays(0);
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyThemeToDom(DEFAULT_ACCENT_COLOR, Boolean(prefersDark), false);
    set({
      user: null,
      localAccounts: [],
      tasks: [],
      inboxItems: [],
      tags: [],
      organizations: [],
      memberships: [],
      membersById: {},
      invites: [],
      goals: [],
      activeTaskId: null,
      selectedTodaySpace: 'all',
      currentTodayStr: todayStr(),
      simulatedOffsetDays: 0,
    });
  },

  simulateNextDay: async () => {
    advanceSimulatedDay(1);
    const nextToday = todayStr();
    set({
      currentTodayStr: nextToday,
      simulatedOffsetDays: getSimulatedOffsetDays(),
    });
    await get().checkDayRollover();
    const { user } = get();
    if (user?.preferences.rolloverMode !== 'auto') {
      get().showToast({
        message: `Relógio avançado para ${nextToday}. Confira a virada de dia em Hoje!`,
        type: 'info',
      });
    }
  },

  resetSimulatedClock: async () => {
    setSimulatedOffsetDays(0);
    const nextToday = todayStr();
    set({
      currentTodayStr: nextToday,
      simulatedOffsetDays: 0,
    });
    await get().refreshUserData();
    get().showToast({
      message: 'Relógio restaurado para a data real de hoje.',
      type: 'info',
    });
  },

  setSelectedTodaySpace: (space) => set({ selectedTodaySpace: space }),
  openTaskDetail: (taskId) => set({ activeTaskId: taskId }),
  openQuickAdd: (defaultSpace, defaultDate) =>
    set({
      isQuickAddOpen: true,
      quickAddDefaultSpace: defaultSpace,
      quickAddDefaultDate: defaultDate,
    }),
  closeQuickAdd: () =>
    set({
      isQuickAddOpen: false,
      quickAddDefaultSpace: undefined,
      quickAddDefaultDate: undefined,
    }),

  showToast: (toastInput) => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    const id = `toast_${Date.now()}`;
    set({ toast: { ...toastInput, id } });
    toastTimeout = setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, 6500);
  },

  dismissToast: () => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
    set({ toast: null });
  },

  dismissStorageWarning: () => set({ storageWarning: null }),
}));