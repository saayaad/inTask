import { addDaysToStr, now, todayStr } from '../domain/clock';
import { DEFAULT_ACCENT_COLOR } from '../domain/color';
import { can, canAccessSpace, taskRequiresApproval } from '../domain/permissions';
import { toggleRecurringCompletion } from '../domain/recurrence';
import { rolloverTaskToToday } from '../domain/rollover';
import { sanitizeText } from '../domain/sanitize';
import {
  AppAreaTab,
  BackupPayload,
  getPersonalSpaceId,
  Goal,
  InboxItem,
  Invite,
  isPersonalSpace,
  Membership,
  Organization,
  OrgRole,
  Tag,
  Task,
  User,
  UserPreferences,
} from '../domain/types';
import {
  generateId,
  generateInviteCode,
  generateSaltHex,
  hashPasswordWithSalt,
  verifyPassword,
} from './crypto';
import {
  AuthService,
  BackupService,
  BackupSummary,
  CreateGoalInput,
  CreateInviteOptions,
  CreateTaskInput,
  DataProvider,
  GoalRepository,
  InboxRepository,
  LoginInput,
  OrgRepository,
  RegisterInput,
  TagRepository,
  TaskRepository,
  UpdateGoalInput,
  UpdateTaskInput,
} from './interfaces';
import { CURRENT_SCHEMA_VERSION, StorageEngine } from './storageEngine';

export class LocalStorageAdapter implements DataProvider {
  public readonly mode = 'local' as const;
  private engine: StorageEngine;

  public auth: AuthService;
  public tasks: TaskRepository;
  public inbox: InboxRepository;
  public tags: TagRepository;
  public orgs: OrgRepository;
  public goals: GoalRepository;
  // Expande a tipagem localmente para suportar a nova função
  public backup: BackupService & { clearSampleData: () => Promise<void> };

  constructor(engine = new StorageEngine()) {
    this.engine = engine;
    this.auth = this.createAuthService();
    this.tasks = this.createTaskRepository();
    this.inbox = this.createInboxRepository();
    this.tags = this.createTagRepository();
    this.orgs = this.createOrgRepository();
    this.goals = this.createGoalRepository();
    this.backup = this.createBackupService();
  }

  public subscribeExternalChanges(callback: () => void): () => void {
    return this.engine.onExternalChange(callback);
  }

  public subscribeStorageWarnings(callback: (message: string) => void): () => void {
    return this.engine.onWarning(callback);
  }

  private getActor(userId: string): User {
    const db = this.engine.readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('Sessão inválida. Faça login novamente.');
    }
    return user;
  }

  private ensureDefaultPersonalTags(userId: string): void {
    const db = this.engine.readDb();
    const personalSpace = getPersonalSpaceId(userId);
    const existing = db.tags.filter((t) => t.spaceId === personalSpace);
    if (existing.length === 0) {
      db.tags.push(
        {
          id: generateId('tag'),
          spaceId: personalSpace,
          name: 'Pessoal',
          color: '#1c3cee',
        },
        {
          id: generateId('tag'),
          spaceId: personalSpace,
          name: 'Financeiro',
          color: '#059669',
        }
      );
      this.engine.writeDb(db);
    }
  }

  private createAuthService(): AuthService {
    return {
      getCurrentUser: async (): Promise<User | null> => {
        const sessionId = this.engine.getSessionUserId();
        if (!sessionId) return null;
        const db = this.engine.readDb();
        return db.users.find((u) => u.id === sessionId) ?? null;
      },

      listLocalAccounts: async (): Promise<User[]> => {
        const db = this.engine.readDb();
        return [...db.users];
      },

      register: async (input: RegisterInput): Promise<User> => {
        const cleanName = sanitizeText(input.name.trim(), 80);
        const cleanEmail = input.email.trim().toLowerCase();
        if (cleanName.length < 2) {
          throw new Error('Informe seu nome (mínimo de 2 caracteres).');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          throw new Error('Informe um endereço de e-mail válido.');
        }
        if (!input.password || input.password.length < 8) {
          throw new Error('A senha deve ter no mínimo 8 caracteres.');
        }

        const db = this.engine.readDb();
        if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
          throw new Error('Já existe uma conta cadastrada com este e-mail.');
        }

        const userId = generateId('usr');
        const salt = generateSaltHex();
        const passwordHash = await hashPasswordWithSalt(input.password, salt);

        const newUser: User = {
          id: userId,
          name: cleanName,
          email: cleanEmail,
          createdAt: now().toISOString(),
          preferences: {
            accentColor: DEFAULT_ACCENT_COLOR,
            themeMode: 'system',
            rolloverMode: 'ask',
            rolloverHandledDate: null,
            projectsViewMode: 'week',
            sidebarCollapsed: false,
            personalSpaceName: 'Pessoal',
            personalSpaceIcon: '👤',
          },
        };

        db.users.push(newUser);
        db.credentials.push({
          userId,
          passwordSalt: salt,
          passwordHash,
        });

        this.engine.writeDb(db, true);
        this.ensureDefaultPersonalTags(userId);
        this.engine.setSessionUserId(userId);
        return newUser;
      },

      login: async (input: LoginInput): Promise<User> => {
        const cleanEmail = input.email.trim().toLowerCase();
        const db = this.engine.readDb();
        const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
        if (!user) {
          throw new Error('E-mail ou senha incorretos.');
        }

        const cred = db.credentials.find((c) => c.userId === user.id);
        if (!cred) {
          throw new Error('Credenciais não encontradas para esta conta.');
        }

        const valid = await verifyPassword(input.password, cred.passwordSalt, cred.passwordHash);
        if (!valid) {
          throw new Error('E-mail ou senha incorretos.');
        }

        this.ensureDefaultPersonalTags(user.id);
        this.engine.setSessionUserId(user.id);
        return user;
      },

      switchAccount: async (userId: string): Promise<User> => {
        const db = this.engine.readDb();
        const user = db.users.find((u) => u.id === userId);
        if (!user) {
          throw new Error('Conta local não encontrada.');
        }
        this.ensureDefaultPersonalTags(user.id);
        this.engine.setSessionUserId(user.id);
        return user;
      },

      logout: async (): Promise<void> => {
        this.engine.setSessionUserId(null);
      },

      updateProfile: async (
        userId: string,
        updates: { name?: string; preferences?: Partial<UserPreferences> }
      ): Promise<User> => {
        const db = this.engine.readDb();
        const idx = db.users.findIndex((u) => u.id === userId);
        if (idx === -1) {
          throw new Error('Usuário não encontrado.');
        }
        const current = db.users[idx];
        const updated: User = {
          ...current,
          name: updates.name !== undefined ? sanitizeText(updates.name.trim(), 80) : current.name,
          preferences: {
            ...current.preferences,
            ...(updates.preferences ?? {}),
          },
        };
        db.users[idx] = updated;
        this.engine.writeDb(db);
        return updated;
      },
    };
  }

  private createTaskRepository(): TaskRepository {
    return {
      listAccessibleTasks: async (userId: string): Promise<Task[]> => {
        const db = this.engine.readDb();
        return db.tasks.filter((task) => canAccessSpace(userId, task.spaceId, db.memberships));
      },

      createTask: async (actorId: string, input: CreateTaskInput): Promise<Task> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        if (!can(actor, 'create_task', { spaceId: input.spaceId }, db.memberships)) {
          throw new Error('Sem permissão para criar tarefa neste espaço.');
        }

        let assigneeId = input.assigneeId !== undefined ? input.assigneeId : actorId;
        if (assigneeId && assigneeId !== actorId) {
          if (!can(actor, 'assign_others', { spaceId: input.spaceId }, db.memberships)) {
            throw new Error('Apenas administradores podem atribuir tarefas a outras pessoas.');
          }
        }

        const nowIso = now().toISOString();
        const dueDate = input.dueDate ?? null;

        const newTask: Task = {
          id: generateId('tsk'),
          title: sanitizeText(input.title.trim(), 240) || 'Nova tarefa',
          status: 'todo',
          priority: input.priority ?? 'medium',
          spaceId: input.spaceId,
          createdBy: actorId,
          assigneeId,
          tagIds: input.tagIds ?? [],
          dueDate,
          originalDueDate: dueDate,
          notes: sanitizeText(input.notes ?? '', 4000),
          subtasks: input.subtasks ?? [],
          recurrence: input.recurrence ?? null,
          completions: [],
          goalId: input.recurrence ? null : input.goalId ?? null,
          completedAt: null,
          completedBy: null,
          approval: null,
          history: [
            {
              at: input.createdAt ?? nowIso,
              userId: actorId,
              event: 'created',
              details: 'Tarefa criada',
            },
          ],
          createdAt: input.createdAt ?? nowIso,
          updatedAt: nowIso,
        };

        db.tasks.unshift(newTask);
        this.engine.writeDb(db);
        return newTask;
      },

      updateTask: async (actorId: string, taskId: string, updates: UpdateTaskInput): Promise<Task> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.tasks.findIndex((t) => t.id === taskId);
        if (idx === -1) throw new Error('Tarefa não encontrada.');

        const current = db.tasks[idx];
        if (!can(actor, 'edit_task', { task: current }, db.memberships)) {
          throw new Error('Você não tem permissão para editar esta tarefa.');
        }

        const nowIso = now().toISOString();
        const nextHistory = [...current.history];

        let nextSpaceId = updates.spaceId !== undefined ? updates.spaceId : current.spaceId;
        let nextAssigneeId =
          updates.assigneeId !== undefined ? updates.assigneeId : current.assigneeId;
        let nextTagIds = updates.tagIds !== undefined ? updates.tagIds : current.tagIds;
        let nextGoalId = updates.goalId !== undefined ? updates.goalId : current.goalId;

        if (nextSpaceId !== current.spaceId) {
          if (!can(actor, 'create_task', { spaceId: nextSpaceId }, db.memberships)) {
            throw new Error('Sem permissão para mover tarefa para este espaço.');
          }
          const validTagIdsInSpace = new Set(
            db.tags.filter((t) => t.spaceId === nextSpaceId).map((t) => t.id)
          );
          nextTagIds = nextTagIds.filter((id) => validTagIdsInSpace.has(id));

          if (nextGoalId) {
            const goal = db.goals.find((g) => g.id === nextGoalId);
            if (!goal || goal.spaceId !== nextSpaceId) {
              nextGoalId = null;
            }
          }
        }

        if (
          nextAssigneeId &&
          nextAssigneeId !== current.assigneeId &&
          nextAssigneeId !== actorId
        ) {
          if (!can(actor, 'assign_others', { spaceId: nextSpaceId }, db.memberships)) {
            throw new Error('Apenas o Admin pode atribuir tarefas para outros membros.');
          }
          nextHistory.push({
            at: nowIso,
            userId: actorId,
            event: 'reassigned',
            details: 'Responsável atualizado',
          });
        }

        const nextRecurrence =
          updates.recurrence !== undefined ? updates.recurrence : current.recurrence;
        if (nextRecurrence) {
          nextGoalId = null;
        }

        let nextStatus = updates.status !== undefined ? updates.status : current.status;
        let nextCompletedAt = current.completedAt;
        let nextCompletedBy = current.completedBy;
        let nextApproval = current.approval;

        if (updates.status !== undefined && updates.status !== current.status) {
          const candidateTask: Task = {
            ...current,
            spaceId: nextSpaceId,
            assigneeId: nextAssigneeId,
          };
          const needsApproval = taskRequiresApproval(candidateTask, db.memberships);
          const canReview = can(actor, 'review_approval', { task: candidateTask }, db.memberships);

          if (updates.status === 'done' && needsApproval && !canReview) {
            nextStatus = 'awaiting_approval';
            nextApproval = {
              submittedAt: nowIso,
            };
            nextHistory.push({
              at: nowIso,
              userId: actorId,
              event: 'submitted_for_approval',
              details: 'Enviada para aprovação do administrador',
            });
          } else if (
            current.status === 'awaiting_approval' &&
            (updates.status === 'done' || updates.status === 'doing') &&
            !canReview
          ) {
            throw new Error('Apenas o Admin pode aprovar ou devolver tarefas em aprovação.');
          } else if (updates.status === 'done') {
            nextCompletedAt = nowIso;
            nextCompletedBy = actorId;
            if (current.status === 'awaiting_approval') {
              nextApproval = {
                ...(current.approval ?? { submittedAt: nowIso }),
                reviewedBy: actorId,
                reviewedAt: nowIso,
                decision: 'approved',
              };
              nextHistory.push({
                at: nowIso,
                userId: actorId,
                event: 'approved',
                details: 'Tarefa aprovada e concluída',
              });
            } else {
              nextHistory.push({
                at: nowIso,
                userId: actorId,
                event: 'status_changed',
                details: 'Tarefa concluída',
              });
            }
          } else if (updates.status === 'todo' || updates.status === 'doing') {
            nextCompletedAt = null;
            nextCompletedBy = null;
            nextHistory.push({
              at: nowIso,
              userId: actorId,
              event: 'status_changed',
              details: `Status alterado para ${updates.status === 'doing' ? 'Em Andamento' : 'A Fazer'}`,
            });
          }
        }

        let nextDueDate = updates.dueDate !== undefined ? updates.dueDate : current.dueDate;
        let nextOriginalDueDate =
          updates.originalDueDate !== undefined ? updates.originalDueDate : current.originalDueDate;

        if (updates.dueDate !== undefined && updates.dueDate !== current.dueDate) {
          if (!nextOriginalDueDate && updates.dueDate) {
            nextOriginalDueDate = updates.dueDate;
          }
          nextHistory.push({
            at: nowIso,
            userId: actorId,
            event: 'rescheduled',
            details: `Data alterada para ${updates.dueDate ?? 'Sem data'}`,
          });
        }

        const updated: Task = {
          ...current,
          title:
            updates.title !== undefined
              ? sanitizeText(updates.title.trim(), 240) || current.title
              : current.title,
          status: nextStatus,
          priority: updates.priority !== undefined ? updates.priority : current.priority,
          spaceId: nextSpaceId,
          assigneeId: nextAssigneeId,
          tagIds: nextTagIds,
          dueDate: nextDueDate,
          originalDueDate: nextOriginalDueDate,
          notes:
            updates.notes !== undefined ? sanitizeText(updates.notes, 4000) : current.notes,
          subtasks: updates.subtasks !== undefined ? updates.subtasks : current.subtasks,
          recurrence: nextRecurrence,
          goalId: nextGoalId,
          completedAt: nextCompletedAt,
          completedBy: nextCompletedBy,
          approval: nextApproval,
          history: nextHistory,
          updatedAt: nowIso,
        };

        db.tasks[idx] = updated;
        this.engine.writeDb(db);
        return updated;
      },

      toggleTaskCompletion: async (
        actorId: string,
        taskId: string,
        targetDateStr: string
      ): Promise<Task> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.tasks.findIndex((t) => t.id === taskId);
        if (idx === -1) throw new Error('Tarefa não encontrada.');

        const current = db.tasks[idx];
        if (!can(actor, 'edit_task', { task: current }, db.memberships)) {
          throw new Error('Sem permissão para alterar esta tarefa.');
        }

        const nowIso = now().toISOString();

        if (current.recurrence) {
          const toggled = toggleRecurringCompletion(current, targetDateStr, actorId, nowIso);
          db.tasks[idx] = toggled;
          this.engine.writeDb(db);
          return toggled;
        }

        const needsApproval = taskRequiresApproval(current, db.memberships);

        if (current.status === 'done' || current.status === 'awaiting_approval') {
          const reopened: Task = {
            ...current,
            status: 'todo',
            completedAt: null,
            completedBy: null,
            updatedAt: nowIso,
            history: [
              ...current.history,
              {
                at: nowIso,
                userId: actorId,
                event: 'status_changed',
                details: 'Tarefa reaberta para A Fazer',
              },
            ],
          };
          db.tasks[idx] = reopened;
          this.engine.writeDb(db);
          return reopened;
        }

        if (needsApproval && !can(actor, 'review_approval', { task: current }, db.memberships)) {
          const submitted: Task = {
            ...current,
            status: 'awaiting_approval',
            approval: {
              submittedAt: nowIso,
            },
            updatedAt: nowIso,
            history: [
              ...current.history,
              {
                at: nowIso,
                userId: actorId,
                event: 'submitted_for_approval',
                details: 'Enviada para aprovação do administrador',
              },
            ],
          };
          db.tasks[idx] = submitted;
          this.engine.writeDb(db);
          return submitted;
        }

        const completed: Task = {
          ...current,
          status: 'done',
          completedAt: nowIso,
          completedBy: actorId,
          updatedAt: nowIso,
          history: [
            ...current.history,
            {
              at: nowIso,
              userId: actorId,
              event: 'status_changed',
              details: 'Tarefa concluída',
            },
          ],
        };
        db.tasks[idx] = completed;
        this.engine.writeDb(db);
        return completed;
      },

      submitForApproval: async (actorId: string, taskId: string): Promise<Task> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.tasks.findIndex((t) => t.id === taskId);
        if (idx === -1) throw new Error('Tarefa não encontrada.');
        const current = db.tasks[idx];

        if (!can(actor, 'submit_for_approval', { task: current }, db.memberships)) {
          throw new Error('Esta tarefa não exige ou não permite envio para aprovação.');
        }

        const nowIso = now().toISOString();
        const updated: Task = {
          ...current,
          status: 'awaiting_approval',
          approval: {
            submittedAt: nowIso,
          },
          updatedAt: nowIso,
          history: [
            ...current.history,
            {
              at: nowIso,
              userId: actorId,
              event: 'submitted_for_approval',
              details: 'Enviada para aprovação',
            },
          ],
        };

        db.tasks[idx] = updated;
        this.engine.writeDb(db);
        return updated;
      },

      reviewApproval: async (
        actorId: string,
        taskId: string,
        decision: 'approved' | 'changes_requested',
        comment?: string
      ): Promise<Task> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.tasks.findIndex((t) => t.id === taskId);
        if (idx === -1) throw new Error('Tarefa não encontrada.');
        const current = db.tasks[idx];

        if (!can(actor, 'review_approval', { task: current }, db.memberships)) {
          throw new Error('Apenas o Admin pode revisar aprovações.');
        }

        if (decision === 'changes_requested' && (!comment || !comment.trim())) {
          throw new Error('Informe um comentário explicando os ajustes solicitados.');
        }

        const nowIso = now().toISOString();
        const currentToday = todayStr();

        if (decision === 'approved') {
          const approved: Task = {
            ...current,
            status: 'done',
            completedAt: nowIso,
            completedBy: current.assigneeId ?? actorId,
            approval: {
              submittedAt: current.approval?.submittedAt ?? nowIso,
              reviewedBy: actorId,
              reviewedAt: nowIso,
              decision: 'approved',
              comment: comment ? sanitizeText(comment.trim(), 500) : undefined,
            },
            updatedAt: nowIso,
            history: [
              ...current.history,
              {
                at: nowIso,
                userId: actorId,
                event: 'approved',
                details: 'Aprovada pelo Admin',
              },
            ],
          };
          db.tasks[idx] = approved;
          this.engine.writeDb(db);
          return approved;
        } else {
          const cleanComment = sanitizeText(comment!.trim(), 500);
          const returned: Task = {
            ...current,
            status: 'doing',
            dueDate: currentToday,
            originalDueDate: current.originalDueDate || current.dueDate || currentToday,
            completedAt: null,
            completedBy: null,
            approval: {
              submittedAt: current.approval?.submittedAt ?? nowIso,
              reviewedBy: actorId,
              reviewedAt: nowIso,
              decision: 'changes_requested',
              comment: cleanComment,
            },
            updatedAt: nowIso,
            history: [
              ...current.history,
              {
                at: nowIso,
                userId: actorId,
                event: 'changes_requested',
                details: `Ajustes solicitados: ${cleanComment}`,
              },
            ],
          };
          db.tasks[idx] = returned;
          this.engine.writeDb(db);
          return returned;
        }
      },

      rolloverTasksToToday: async (
        actorId: string,
        taskIds: string[],
        currentTodayStr: string
      ): Promise<Task[]> => {
        const db = this.engine.readDb();
        const nowIso = now().toISOString();
        const idSet = new Set(taskIds);
        const updatedList: Task[] = [];

        db.tasks = db.tasks.map((task) => {
          if (!idSet.has(task.id)) return task;
          const rolled = rolloverTaskToToday(task, currentTodayStr, actorId, nowIso);
          updatedList.push(rolled);
          return rolled;
        });

        this.engine.writeDb(db);
        return updatedList;
      },

      restoreTasksSnapshot: async (_actorId: string, previousTasks: Task[]): Promise<void> => {
        const db = this.engine.readDb();
        const mapById = new Map(previousTasks.map((t) => [t.id, t]));
        const existingIds = new Set(db.tasks.map((t) => t.id));
        db.tasks = db.tasks.map((t) => mapById.get(t.id) ?? t);
        for (const prev of previousTasks) {
          if (!existingIds.has(prev.id)) {
            db.tasks.unshift(prev);
          }
        }
        this.engine.writeDb(db);
      },

      deleteTask: async (actorId: string, taskId: string): Promise<Task> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.tasks.findIndex((t) => t.id === taskId);
        if (idx === -1) throw new Error('Tarefa não encontrada.');
        const target = db.tasks[idx];
        if (!can(actor, 'delete_task', { task: target }, db.memberships)) {
          throw new Error('Sem permissão para excluir esta tarefa.');
        }
        db.tasks.splice(idx, 1);
        this.engine.writeDb(db);
        return target;
      },
    };
  }

  private createInboxRepository(): InboxRepository {
    return {
      listInboxItems: async (ownerId: string): Promise<InboxItem[]> => {
        const db = this.engine.readDb();
        return db.inboxItems.filter((item) => item.ownerId === ownerId);
      },

      addInboxItem: async (ownerId: string, text: string): Promise<InboxItem> => {
        const clean = sanitizeText(text.trim(), 500);
        if (!clean) throw new Error('Digite um texto para capturar na Inbox.');
        const db = this.engine.readDb();
        const item: InboxItem = {
          id: generateId('inb'),
          ownerId,
          text: clean,
          createdAt: now().toISOString(),
        };
        db.inboxItems.unshift(item);
        this.engine.writeDb(db);
        return item;
      },

      deleteInboxItem: async (ownerId: string, itemId: string): Promise<InboxItem> => {
        const db = this.engine.readDb();
        const idx = db.inboxItems.findIndex((i) => i.id === itemId && i.ownerId === ownerId);
        if (idx === -1) throw new Error('Item da Inbox não encontrado.');
        const [removed] = db.inboxItems.splice(idx, 1);
        this.engine.writeDb(db);
        return removed;
      },

      restoreInboxItem: async (ownerId: string, item: InboxItem): Promise<InboxItem> => {
        const db = this.engine.readDb();
        if (item.ownerId !== ownerId) throw new Error('Permissão negada.');
        if (!db.inboxItems.some((i) => i.id === item.id)) {
          db.inboxItems.unshift(item);
          this.engine.writeDb(db);
        }
        return item;
      },
    };
  }

  private createTagRepository(): TagRepository {
    return {
      listAccessibleTags: async (userId: string): Promise<Tag[]> => {
        this.ensureDefaultPersonalTags(userId);
        const db = this.engine.readDb();
        return db.tags.filter((tag) => canAccessSpace(userId, tag.spaceId, db.memberships));
      },

      createTag: async (
        actorId: string,
        spaceId: string,
        name: string,
        color: string
      ): Promise<Tag> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        if (!can(actor, 'manage_tags', { spaceId }, db.memberships)) {
          throw new Error('Sem permissão para criar tags neste espaço.');
        }
        const cleanName = sanitizeText(name.trim(), 40);
        if (!cleanName) throw new Error('Informe um nome para a tag.');

        const tag: Tag = {
          id: generateId('tag'),
          spaceId,
          name: cleanName,
          color: color || '#1c3cee',
        };
        db.tags.push(tag);
        this.engine.writeDb(db);
        return tag;
      },

      updateTag: async (
        actorId: string,
        tagId: string,
        name: string,
        color: string
      ): Promise<Tag> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.tags.findIndex((t) => t.id === tagId);
        if (idx === -1) throw new Error('Tag não encontrada.');
        const current = db.tags[idx];

        if (!can(actor, 'manage_tags', { spaceId: current.spaceId }, db.memberships)) {
          throw new Error('Sem permissão para editar esta tag.');
        }

        const updated: Tag = {
          ...current,
          name: sanitizeText(name.trim(), 40) || current.name,
          color: color || current.color,
        };
        db.tags[idx] = updated;
        this.engine.writeDb(db);
        return updated;
      },

      deleteTag: async (actorId: string, tagId: string): Promise<void> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.tags.findIndex((t) => t.id === tagId);
        if (idx === -1) return;
        const current = db.tags[idx];

        if (!can(actor, 'manage_tags', { spaceId: current.spaceId }, db.memberships)) {
          throw new Error('Sem permissão para excluir esta tag.');
        }

        db.tags.splice(idx, 1);
        db.tasks = db.tasks.map((task) =>
          task.tagIds.includes(tagId)
            ? { ...task, tagIds: task.tagIds.filter((id) => id !== tagId) }
            : task
        );
        this.engine.writeDb(db);
      },
    };
  }

  private createOrgRepository(): OrgRepository {
    return {
      listUserOrganizations: async (userId: string) => {
        const db = this.engine.readDb();
        const myPersonalSpaceId = getPersonalSpaceId(userId);
        const mySpaceIds = new Set(
          db.memberships.filter((m) => m.userId === userId).map((m) => m.orgId)
        );
        mySpaceIds.add(myPersonalSpaceId);

        const organizations = db.organizations.filter((o) => mySpaceIds.has(o.id));
        const memberships = db.memberships.filter((m) => mySpaceIds.has(m.orgId));

        const membersById: Record<string, User> = {};
        for (const u of db.users) {
          membersById[u.id] = u;
        }

        const invites = db.invites.filter(
          (i) =>
            mySpaceIds.has(i.orgId) ||
            i.createdBy === userId ||
            (i.spaceIds && i.spaceIds.some((sid) => mySpaceIds.has(sid)))
        );
        return { organizations, memberships, membersById, invites };
      },

      createOrganization: async (
        actorId: string,
        name: string,
        icon = '🏢',
        color = '#1c3cee'
      ) => {
        const cleanName = sanitizeText(name.trim(), 80);
        if (!cleanName) throw new Error('Informe o nome do espaço ou organização.');
        const db = this.engine.readDb();
        const nowIso = now().toISOString();

        const organization: Organization = {
          id: generateId('org'),
          name: cleanName,
          icon: icon || '🏢',
          color: color || '#1c3cee',
          createdBy: actorId,
          createdAt: nowIso,
        };

        const membership: Membership = {
          orgId: organization.id,
          userId: actorId,
          role: 'admin',
          joinedAt: nowIso,
        };

        db.organizations.push(organization);
        db.memberships.push(membership);
        db.tags.push({
          id: generateId('tag'),
          spaceId: organization.id,
          name: 'Geral',
          color: color || '#1c3cee',
        });

        this.engine.writeDb(db);
        return { organization, membership };
      },

      renameOrganization: async (actorId: string, orgId: string, name: string) => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        if (!can(actor, 'manage_org', { orgId }, db.memberships)) {
          throw new Error('Apenas o Admin pode renomear este espaço.');
        }
        const idx = db.organizations.findIndex((o) => o.id === orgId);
        if (idx === -1) throw new Error('Espaço não encontrado.');
        const cleanName = sanitizeText(name.trim(), 80);
        if (!cleanName) throw new Error('Nome inválido.');

        db.organizations[idx] = { ...db.organizations[idx], name: cleanName };
        this.engine.writeDb(db);
        return db.organizations[idx];
      },

      updateOrganization: async (
        actorId: string,
        orgId: string,
        updates: { name?: string; icon?: string; color?: string }
      ) => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        if (!can(actor, 'manage_org', { orgId }, db.memberships)) {
          throw new Error('Apenas o Admin pode editar este espaço.');
        }
        const idx = db.organizations.findIndex((o) => o.id === orgId);
        if (idx === -1) throw new Error('Espaço não encontrado.');
        const current = db.organizations[idx];

        const updated: Organization = {
          ...current,
          name:
            updates.name !== undefined
              ? sanitizeText(updates.name.trim(), 80) || current.name
              : current.name,
          icon: updates.icon !== undefined ? updates.icon : current.icon,
          color: updates.color !== undefined ? updates.color : current.color,
        };
        db.organizations[idx] = updated;
        this.engine.writeDb(db);
        return updated;
      },

      deleteOrganization: async (actorId: string, orgId: string) => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        if (!can(actor, 'manage_org', { orgId }, db.memberships)) {
          throw new Error('Apenas o Admin pode excluir a organização.');
        }
        db.organizations = db.organizations.filter((o) => o.id !== orgId);
        db.memberships = db.memberships.filter((m) => m.orgId !== orgId);
        db.invites = db.invites.filter((i) => i.orgId !== orgId);
        db.tags = db.tags.filter((t) => t.spaceId !== orgId);
        db.tasks = db.tasks.filter((t) => t.spaceId !== orgId);
        db.goals = db.goals.filter((g) => g.spaceId !== orgId);
        this.engine.writeDb(db);
      },

      createInvite: async (
        actorId: string,
        orgId: string,
        emailOrOptions?: string | CreateInviteOptions
      ) => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);

        const opts: CreateInviteOptions =
          typeof emailOrOptions === 'string'
            ? { email: emailOrOptions }
            : emailOrOptions || {};

        const targetSpaces =
          opts.spaceIds && opts.spaceIds.length > 0 ? opts.spaceIds : [orgId];

        for (const sid of targetSpaces) {
          if (!can(actor, 'invite_member', { spaceId: sid }, db.memberships)) {
            throw new Error('Apenas o Admin pode gerar convites para este espaço.');
          }
        }

        const invite: Invite = {
          id: generateId('inv'),
          orgId: targetSpaces[0],
          spaceIds: targetSpaces,
          role: opts.role || 'member',
          allowedTabs: opts.allowedTabs,
          code: generateInviteCode(),
          email: opts.email ? sanitizeText(opts.email.trim().toLowerCase(), 120) : undefined,
          status: 'pending',
          createdBy: actorId,
          createdAt: now().toISOString(),
        };
        db.invites.unshift(invite);
        this.engine.writeDb(db);
        return invite;
      },

      revokeInvite: async (actorId: string, inviteId: string) => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.invites.findIndex((i) => i.id === inviteId);
        if (idx === -1) throw new Error('Convite não encontrado.');
        const current = db.invites[idx];
        if (
          current.createdBy !== actorId &&
          !can(actor, 'invite_member', { spaceId: current.orgId }, db.memberships)
        ) {
          throw new Error('Apenas o Admin pode revogar convites.');
        }
        db.invites[idx] = { ...current, status: 'revoked' };
        this.engine.writeDb(db);
        return db.invites[idx];
      },

      getInviteByCode: async (code: string) => {
        const clean = code.trim().toUpperCase();
        const db = this.engine.readDb();
        const invite = db.invites.find((i) => i.code.toUpperCase() === clean);
        if (!invite) return null;
        let organization = db.organizations.find((o) => o.id === invite.orgId);
        if (!organization && isPersonalSpace(invite.orgId)) {
          const ownerId = invite.orgId.slice(9);
          const owner = db.users.find((u) => u.id === ownerId);
          organization = {
            id: invite.orgId,
            name: owner?.preferences.personalSpaceName || `Espaço de ${owner?.name || 'Usuário'}`,
            icon: owner?.preferences.personalSpaceIcon || '👤',
            createdBy: ownerId,
            createdAt: invite.createdAt,
          };
        }
        if (!organization) return null;
        return { invite, organization };
      },

      acceptInviteByCode: async (actorId: string, code: string) => {
        const clean = code.trim().toUpperCase();
        const db = this.engine.readDb();
        const inviteIdx = db.invites.findIndex((i) => i.code.toUpperCase() === clean);
        if (inviteIdx === -1) {
          throw new Error('Código de convite inválido ou não encontrado.');
        }
        const invite = db.invites[inviteIdx];
        if (invite.status === 'revoked') {
          throw new Error('Este convite foi revogado pelo administrador.');
        }

        const targetSpaces =
          invite.spaceIds && invite.spaceIds.length > 0 ? invite.spaceIds : [invite.orgId];
        const grantedRole: OrgRole = invite.role || 'member';
        const nowIso = now().toISOString();

        let primaryOrg: Organization | null = null;
        let primaryMembership: Membership | null = null;

        for (const sid of targetSpaces) {
          let orgObj = db.organizations.find((o) => o.id === sid);
          if (!orgObj && isPersonalSpace(sid)) {
            const ownerId = sid.slice(9);
            const owner = db.users.find((u) => u.id === ownerId);
            // Materialize shared personal space in organizations list if needed so guests can see it
            orgObj = {
              id: sid,
              name:
                owner?.preferences.personalSpaceName ||
                `Espaço Pessoal (${owner?.name.split(' ')[0] || 'Dono'})`,
              icon: owner?.preferences.personalSpaceIcon || '👤',
              createdBy: ownerId,
              createdAt: nowIso,
            };
            db.organizations.push(orgObj);
          }

          if (!orgObj) continue;

          const existingIdx = db.memberships.findIndex(
            (m) => m.orgId === sid && m.userId === actorId
          );
          const membership: Membership = {
            orgId: sid,
            userId: actorId,
            role: sid === `personal:${actorId}` ? 'admin' : grantedRole,
            allowedTabs: invite.allowedTabs,
            joinedAt: nowIso,
          };

          if (existingIdx === -1) {
            db.memberships.push(membership);
          } else {
            db.memberships[existingIdx] = membership;
          }

          if (!primaryOrg) {
            primaryOrg = orgObj;
            primaryMembership = membership;
          }
        }

        if (!primaryOrg || !primaryMembership) {
          throw new Error('O espaço deste convite não existe mais.');
        }

        db.invites[inviteIdx] = {
          ...invite,
          status: 'accepted',
          acceptedBy: actorId,
          acceptedAt: nowIso,
        };

        this.engine.writeDb(db);
        return { organization: primaryOrg, membership: primaryMembership };
      },

      updateMemberRole: async (
        actorId: string,
        orgId: string,
        targetUserId: string,
        role: OrgRole,
        allowedTabs?: AppAreaTab[]
      ): Promise<Membership> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        if (!can(actor, 'manage_org', { spaceId: orgId }, db.memberships)) {
          throw new Error('Apenas um Admin pode alterar cargos e permissões de membros.');
        }

        const idx = db.memberships.findIndex(
          (m) => m.orgId === orgId && m.userId === targetUserId
        );
        const nowIso = now().toISOString();

        if (idx === -1) {
          const created: Membership = {
            orgId,
            userId: targetUserId,
            role,
            allowedTabs,
            joinedAt: nowIso,
          };
          db.memberships.push(created);
          this.engine.writeDb(db);
          return created;
        }

        const updated: Membership = {
          ...db.memberships[idx],
          role,
          allowedTabs: allowedTabs !== undefined ? allowedTabs : db.memberships[idx].allowedTabs,
        };
        db.memberships[idx] = updated;
        this.engine.writeDb(db);
        return updated;
      },

      removeMember: async (actorId: string, orgId: string, targetUserId: string) => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        if (!can(actor, 'remove_member', { spaceId: orgId }, db.memberships)) {
          throw new Error('Apenas o Admin pode remover membros.');
        }
        if (actorId === targetUserId) {
          throw new Error('Você não pode remover a si mesmo como Admin.');
        }

        db.memberships = db.memberships.filter(
          (m) => !(m.orgId === orgId && m.userId === targetUserId)
        );

        const nowIso = now().toISOString();
        db.tasks = db.tasks.map((task) => {
          if (
            task.spaceId === orgId &&
            task.assigneeId === targetUserId &&
            task.status !== 'done'
          ) {
            return {
              ...task,
              assigneeId: null,
              updatedAt: nowIso,
              history: [
                ...task.history,
                {
                  at: nowIso,
                  userId: actorId,
                  event: 'reassigned',
                  details: 'Membro removido do espaço; tarefa ficou sem responsável',
                },
              ],
            };
          }
          return task;
        });

        this.engine.writeDb(db);
      },

      leaveOrganization: async (actorId: string, orgId: string) => {
        const db = this.engine.readDb();
        const membership = db.memberships.find(
          (m) => m.orgId === orgId && m.userId === actorId
        );
        if (!membership) return;
        const org = db.organizations.find((o) => o.id === orgId);
        if (org && org.createdBy === actorId) {
          throw new Error('Você é o criador deste espaço. Exclua-o se desejar removê-lo.');
        }

        db.memberships = db.memberships.filter(
          (m) => !(m.orgId === orgId && m.userId === actorId)
        );
        const nowIso = now().toISOString();
        db.tasks = db.tasks.map((task) => {
          if (task.spaceId === orgId && task.assigneeId === actorId && task.status !== 'done') {
            return {
              ...task,
              assigneeId: null,
              updatedAt: nowIso,
              history: [
                ...task.history,
                {
                  at: nowIso,
                  userId: actorId,
                  event: 'reassigned',
                  details: 'Membro saiu do espaço; tarefa ficou sem responsável',
                },
              ],
            };
          }
          return task;
        });

        this.engine.writeDb(db);
      },
    };
  }

  private createGoalRepository(): GoalRepository {
    return {
      listAccessibleGoals: async (userId: string): Promise<Goal[]> => {
        const db = this.engine.readDb();
        return db.goals.filter((g) => canAccessSpace(userId, g.spaceId, db.memberships));
      },

      createGoal: async (actorId: string, input: CreateGoalInput): Promise<Goal> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        if (!can(actor, 'manage_goal', { spaceId: input.spaceId }, db.memberships)) {
          throw new Error('Apenas administradores podem criar metas neste espaço.');
        }

        const cleanTitle = sanitizeText(input.title.trim(), 160);
        if (!cleanTitle) throw new Error('Informe o título da meta.');

        const goal: Goal = {
          id: generateId('gol'),
          title: cleanTitle,
          spaceId: input.spaceId,
          createdBy: actorId,
          period: input.period,
          deadline: input.deadline,
          createdAt: now().toISOString(),
        };

        db.goals.unshift(goal);
        this.engine.writeDb(db);
        return goal;
      },

      updateGoal: async (
        actorId: string,
        goalId: string,
        updates: UpdateGoalInput
      ): Promise<Goal> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.goals.findIndex((g) => g.id === goalId);
        if (idx === -1) throw new Error('Meta não encontrada.');
        const current = db.goals[idx];

        if (!can(actor, 'manage_goal', { goal: current }, db.memberships)) {
          throw new Error('Sem permissão para editar esta meta.');
        }

        const updated: Goal = {
          ...current,
          title:
            updates.title !== undefined
              ? sanitizeText(updates.title.trim(), 160) || current.title
              : current.title,
          period: updates.period !== undefined ? updates.period : current.period,
          deadline: updates.deadline !== undefined ? updates.deadline : current.deadline,
        };

        db.goals[idx] = updated;
        this.engine.writeDb(db);
        return updated;
      },

      deleteGoal: async (actorId: string, goalId: string): Promise<void> => {
        const db = this.engine.readDb();
        const actor = this.getActor(actorId);
        const idx = db.goals.findIndex((g) => g.id === goalId);
        if (idx === -1) return;
        const current = db.goals[idx];

        if (!can(actor, 'manage_goal', { goal: current }, db.memberships)) {
          throw new Error('Sem permissão para excluir esta meta.');
        }

        db.goals.splice(idx, 1);
        db.tasks = db.tasks.map((t) => (t.goalId === goalId ? { ...t, goalId: null } : t));
        this.engine.writeDb(db);
      },
    };
  }

  private createBackupService(): BackupService & { clearSampleData: () => Promise<void> } {
    return {
      exportUserBackup: async (userId: string): Promise<BackupPayload> => {
        const db = this.engine.readDb();
        const user = this.getActor(userId);
        const myOrgIds = new Set(
          db.memberships.filter((m) => m.userId === userId).map((m) => m.orgId)
        );

        const organizations = db.organizations.filter((o) => myOrgIds.has(o.id));
        const memberships = db.memberships.filter((m) => myOrgIds.has(m.orgId));
        const invites = db.invites.filter((i) => myOrgIds.has(i.orgId));
        const tags = db.tags.filter((t) => canAccessSpace(userId, t.spaceId, db.memberships));
        const tasks = db.tasks.filter((t) => canAccessSpace(userId, t.spaceId, db.memberships));
        const inboxItems = db.inboxItems.filter((i) => i.ownerId === userId);
        const goals = db.goals.filter((g) => canAccessSpace(userId, g.spaceId, db.memberships));

        return {
          schemaVersion: CURRENT_SCHEMA_VERSION,
          exportedAt: now().toISOString(),
          exportedByUserId: userId,
          user,
          organizations,
          memberships,
          invites,
          tags,
          tasks,
          inboxItems,
          goals,
        };
      },

      validateBackupJson: async (rawJson: string): Promise<{ payload: BackupPayload; summary: BackupSummary }> => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(rawJson);
        } catch {
          throw new Error('O arquivo selecionado não é um JSON válido.');
        }

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Estrutura de backup inválida.');
        }

        const p = parsed as Partial<BackupPayload>;
        if (typeof p.schemaVersion !== 'number' || p.schemaVersion > CURRENT_SCHEMA_VERSION) {
          throw new Error('Versão do backup incompatível ou ausente.');
        }
        if (
          !p.user ||
          !Array.isArray(p.organizations) ||
          !Array.isArray(p.memberships) ||
          !Array.isArray(p.tags) ||
          !Array.isArray(p.tasks) ||
          !Array.isArray(p.inboxItems) ||
          !Array.isArray(p.goals)
        ) {
          throw new Error('O arquivo de backup está incompleto ou malformado.');
        }

        const payload: BackupPayload = {
          schemaVersion: p.schemaVersion,
          exportedAt: p.exportedAt || now().toISOString(),
          exportedByUserId: p.exportedByUserId || p.user.id,
          user: p.user,
          organizations: p.organizations,
          memberships: p.memberships,
          invites: Array.isArray(p.invites) ? p.invites : [],
          tags: p.tags,
          tasks: p.tasks,
          inboxItems: p.inboxItems,
          goals: p.goals,
        };

        return {
          payload,
          summary: {
            schemaVersion: payload.schemaVersion,
            exportedAt: payload.exportedAt,
            userName: payload.user.name,
            organizationsCount: payload.organizations.length,
            tasksCount: payload.tasks.length,
            inboxCount: payload.inboxItems.length,
            goalsCount: payload.goals.length,
            tagsCount: payload.tags.length,
          },
        };
      },

      importUserBackup: async (
        userId: string,
        payload: BackupPayload,
        mode: 'replace' | 'merge'
      ): Promise<void> => {
        const db = this.engine.readDb();
        const oldPersonalSpace = `personal:${payload.exportedByUserId}`;
        const newPersonalSpace = `personal:${userId}`;

        const remapSpace = (spaceId: string) =>
          spaceId === oldPersonalSpace ? newPersonalSpace : spaceId;

        const remapUser = (id: string | null | undefined) =>
          id === payload.exportedByUserId ? userId : id ?? null;

        const remappedOrgs: Organization[] = payload.organizations.map((o) => ({
          ...o,
          createdBy: remapUser(o.createdBy) || userId,
        }));

        const remappedMemberships: Membership[] = payload.memberships.map((m) => ({
          ...m,
          userId: remapUser(m.userId) || m.userId,
        }));

        const remappedInvites: Invite[] = (payload.invites ?? []).map((i) => ({
          ...i,
          createdBy: remapUser(i.createdBy) || userId,
        }));

        const remappedTags: Tag[] = payload.tags.map((t) => ({
          ...t,
          spaceId: remapSpace(t.spaceId),
        }));

        const remappedTasks: Task[] = payload.tasks.map((t) => ({
          ...t,
          spaceId: remapSpace(t.spaceId),
          createdBy: remapUser(t.createdBy) || userId,
          assigneeId: remapUser(t.assigneeId),
        }));

        const remappedInbox: InboxItem[] = payload.inboxItems.map((i) => ({
          ...i,
          ownerId: userId,
        }));

        const remappedGoals: Goal[] = payload.goals.map((g) => ({
          ...g,
          spaceId: remapSpace(g.spaceId),
          createdBy: remapUser(g.createdBy) || userId,
        }));

        const userIdx = db.users.findIndex((u) => u.id === userId);
        if (userIdx !== -1 && payload.user?.preferences) {
          db.users[userIdx] = {
            ...db.users[userIdx],
            name: payload.user.name || db.users[userIdx].name,
            preferences: {
              ...db.users[userIdx].preferences,
              ...payload.user.preferences,
            },
          };
        }

        if (mode === 'replace') {
          const myOrgIds = new Set(
            db.memberships.filter((m) => m.userId === userId).map((m) => m.orgId)
          );
          db.organizations = [
            ...db.organizations.filter((o) => !myOrgIds.has(o.id)),
            ...remappedOrgs,
          ];
          db.memberships = [
            ...db.memberships.filter((m) => !myOrgIds.has(m.orgId) && m.userId !== userId),
            ...remappedMemberships,
          ];
          db.invites = [
            ...db.invites.filter((i) => !myOrgIds.has(i.orgId)),
            ...remappedInvites,
          ];
          db.tags = [
            ...db.tags.filter((t) => !canAccessSpace(userId, t.spaceId, remappedMemberships) && t.spaceId !== newPersonalSpace),
            ...remappedTags,
          ];
          db.tasks = [
            ...db.tasks.filter((t) => !canAccessSpace(userId, t.spaceId, remappedMemberships) && t.spaceId !== newPersonalSpace),
            ...remappedTasks,
          ];
          db.inboxItems = [
            ...db.inboxItems.filter((i) => i.ownerId !== userId),
            ...remappedInbox,
          ];
          db.goals = [
            ...db.goals.filter((g) => !canAccessSpace(userId, g.spaceId, remappedMemberships) && g.spaceId !== newPersonalSpace),
            ...remappedGoals,
          ];
        } else {
          const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
            const map = new Map(existing.map((item) => [item.id, item]));
            for (const item of incoming) {
              map.set(item.id, item);
            }
            return Array.from(map.values());
          };

          db.organizations = mergeById(db.organizations, remappedOrgs);
          db.invites = mergeById(db.invites, remappedInvites);
          db.tags = mergeById(db.tags, remappedTags);
          db.tasks = mergeById(db.tasks, remappedTasks);
          db.inboxItems = mergeById(db.inboxItems, remappedInbox);
          db.goals = mergeById(db.goals, remappedGoals);

          for (const m of remappedMemberships) {
            const idx = db.memberships.findIndex(
              (em) => em.orgId === m.orgId && em.userId === m.userId
            );
            if (idx === -1) db.memberships.push(m);
            else db.memberships[idx] = m;
          }
        }

        this.engine.writeDb(db, true);
      },

      seedSampleData: async (targetUserId?: string): Promise<User> => {
        const db = this.engine.readDb();
        const currentToday = todayStr();
        const tomorrow = addDaysToStr(currentToday, 1);
        const inTwoDays = addDaysToStr(currentToday, 2);
        const inThirtyDays = addDaysToStr(currentToday, 30);
        const nowIso = now().toISOString();

        let adminUser = targetUserId ? db.users.find((u) => u.id === targetUserId) : db.users[0];
        if (!adminUser) {
          const salt = generateSaltHex();
          const hash = await hashPasswordWithSalt('12345678', salt);
          adminUser = {
            id: 'usr_demo_admin',
            name: 'Marina Costa',
            email: 'marina@intask.app',
            createdAt: nowIso,
            preferences: {
              accentColor: DEFAULT_ACCENT_COLOR,
              themeMode: 'system',
              rolloverMode: 'ask',
              rolloverHandledDate: null,
              projectsViewMode: 'week',
              sidebarCollapsed: false,
              personalSpaceName: 'Pessoal',
              personalSpaceIcon: '👤',
            },
          };
          db.users.push(adminUser);
          db.credentials.push({
            userId: adminUser.id,
            passwordSalt: salt,
            passwordHash: hash,
          });
        }

        let guestUser = db.users.find((u) => u.email === 'lucas@intask.app');
        if (!guestUser) {
          const salt = generateSaltHex();
          const hash = await hashPasswordWithSalt('12345678', salt);
          guestUser = {
            id: 'usr_demo_member',
            name: 'Lucas Mendes (Convidado)',
            email: 'lucas@intask.app',
            createdAt: nowIso,
            preferences: {
              accentColor: '#059669',
              themeMode: 'system',
              rolloverMode: 'ask',
              rolloverHandledDate: null,
              projectsViewMode: 'kanban',
              sidebarCollapsed: false,
              personalSpaceName: 'Pessoal',
              personalSpaceIcon: '👤',
            },
          };
          db.users.push(guestUser);
          db.credentials.push({
            userId: guestUser.id,
            passwordSalt: salt,
            passwordHash: hash,
          });
        }

        const adminSpace = getPersonalSpaceId(adminUser.id);
        const guestSpace = getPersonalSpaceId(guestUser.id);

        const orgId = 'org_demo_studio';
        if (!db.organizations.some((o) => o.id === orgId)) {
          db.organizations.push({
            id: orgId,
            name: 'Estúdio Produto & Design',
            icon: '🚀',
            color: '#7c3aed',
            createdBy: adminUser.id,
            createdAt: nowIso,
          });
        }
        if (!db.memberships.some((m) => m.orgId === orgId && m.userId === adminUser!.id)) {
          db.memberships.push({
            orgId,
            userId: adminUser.id,
            role: 'admin',
            joinedAt: nowIso,
          });
        }
        if (!db.memberships.some((m) => m.orgId === orgId && m.userId === guestUser!.id)) {
          db.memberships.push({
            orgId,
            userId: guestUser.id,
            role: 'member',
            joinedAt: nowIso,
          });
        }
        if (!db.invites.some((i) => i.code === 'INTASK26')) {
          db.invites.push({
            id: 'inv_demo_1',
            orgId,
            spaceIds: [orgId],
            role: 'member',
            code: 'INTASK26',
            email: 'convidado@intask.app',
            status: 'pending',
            createdBy: adminUser.id,
            createdAt: nowIso,
          });
        }

        const demoTags: Tag[] = [
          { id: 'tag_pessoal_adm', spaceId: adminSpace, name: 'Pessoal', color: '#1c3cee' },
          { id: 'tag_fin_adm', spaceId: adminSpace, name: 'Financeiro', color: '#059669' },
          { id: 'tag_pessoal_gst', spaceId: guestSpace, name: 'Pessoal', color: '#059669' },
          { id: 'tag_fin_gst', spaceId: guestSpace, name: 'Financeiro', color: '#d97706' },
          { id: 'tag_org_lancamento', spaceId: orgId, name: 'Lançamento Q4', color: '#7c3aed' },
          { id: 'tag_org_ux', spaceId: orgId, name: 'Design System', color: '#e11d48' },
        ];
        for (const tg of demoTags) {
          if (!db.tags.some((t) => t.id === tg.id)) {
            db.tags.push(tg);
          }
        }

        const goalOrgId = 'gol_demo_lancamento';
        const goalPersonalId = 'gol_demo_reserva';
        const demoGoals: Goal[] = [
          {
            id: goalOrgId,
            title: 'Entregar o Lançamento da Plataforma v2.0',
            spaceId: orgId,
            createdBy: adminUser.id,
            period: 'quarterly',
            deadline: inThirtyDays,
            createdAt: nowIso,
          },
          {
            id: goalPersonalId,
            title: 'Organizar Planejamento Financeiro Anual',
            spaceId: adminSpace,
            createdBy: adminUser.id,
            period: 'monthly',
            deadline: inThirtyDays,
            createdAt: nowIso,
          },
        ];
        for (const g of demoGoals) {
          if (!db.goals.some((eg) => eg.id === g.id)) {
            db.goals.push(g);
          }
        }

        const demoTasks: Task[] = [
          {
            id: 'tsk_demo_1',
            title: 'Revisar orçamento mensal e conciliar faturas',
            status: 'todo',
            priority: 'high',
            spaceId: adminSpace,
            createdBy: adminUser.id,
            assigneeId: adminUser.id,
            tagIds: ['tag_fin_adm'],
            dueDate: currentToday,
            originalDueDate: currentToday,
            notes: 'Conferir planilha principal em https://financas.exemplo.com.br',
            subtasks: [
              { id: 'sub_1', title: 'Exportar extrato bancário', done: true },
              { id: 'sub_2', title: 'Categorizar despesas fixas', done: false },
            ],
            recurrence: null,
            completions: [],
            goalId: goalPersonalId,
            history: [{ at: nowIso, userId: adminUser.id, event: 'created', details: 'Tarefa criada' }],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'tsk_demo_2',
            title: 'Validar protótipo mobile de navegação com a equipe',
            status: 'doing',
            priority: 'medium',
            spaceId: orgId,
            createdBy: adminUser.id,
            assigneeId: adminUser.id,
            tagIds: ['tag_org_ux'],
            dueDate: currentToday,
            originalDueDate: currentToday,
            notes: 'Testar alvos de toque de 44px em telas de 375px.',
            subtasks: [],
            recurrence: null,
            completions: [],
            goalId: goalOrgId,
            history: [{ at: nowIso, userId: adminUser.id, event: 'created', details: 'Tarefa criada' }],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'tsk_demo_3',
            title: 'Definir arquitetura de sincronização offline',
            status: 'done',
            priority: 'high',
            spaceId: orgId,
            createdBy: adminUser.id,
            assigneeId: adminUser.id,
            tagIds: ['tag_org_lancamento'],
            dueDate: currentToday,
            originalDueDate: currentToday,
            notes: '',
            subtasks: [],
            recurrence: null,
            completions: [],
            goalId: goalOrgId,
            completedAt: nowIso,
            completedBy: adminUser.id,
            history: [{ at: nowIso, userId: adminUser.id, event: 'status_changed', details: 'Tarefa concluída' }],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'tsk_demo_4',
            title: 'Atualizar metas de investimentos do trimestre',
            status: 'done',
            priority: 'medium',
            spaceId: adminSpace,
            createdBy: adminUser.id,
            assigneeId: adminUser.id,
            tagIds: ['tag_fin_adm'],
            dueDate: currentToday,
            originalDueDate: currentToday,
            notes: '',
            subtasks: [],
            recurrence: null,
            completions: [],
            goalId: goalPersonalId,
            completedAt: nowIso,
            completedBy: adminUser.id,
            history: [{ at: nowIso, userId: adminUser.id, event: 'status_changed', details: 'Tarefa concluída' }],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'tsk_demo_5',
            title: 'Responder e-mails prioritários de fornecedores',
            status: 'done',
            priority: 'low',
            spaceId: adminSpace,
            createdBy: adminUser.id,
            assigneeId: adminUser.id,
            tagIds: ['tag_pessoal_adm'],
            dueDate: currentToday,
            originalDueDate: currentToday,
            notes: '',
            subtasks: [],
            recurrence: null,
            completions: [],
            goalId: null,
            completedAt: nowIso,
            completedBy: adminUser.id,
            history: [{ at: nowIso, userId: adminUser.id, event: 'status_changed', details: 'Tarefa concluída' }],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'tsk_demo_approval_1',
            title: 'Especificar tokens de contraste AA no Design System',
            status: 'awaiting_approval',
            priority: 'high',
            spaceId: orgId,
            createdBy: adminUser.id,
            assigneeId: guestUser.id,
            tagIds: ['tag_org_ux'],
            dueDate: currentToday,
            originalDueDate: currentToday,
            notes: 'Todos os tokens --accent-text e --on-accent foram auditados nos modos claro e escuro.',
            subtasks: [
              { id: 's_a1', title: 'Testar cor padrão #1c3cee', done: true },
              { id: 's_a2', title: 'Testar cor rubi #e11d48', done: true },
            ],
            recurrence: null,
            completions: [],
            goalId: goalOrgId,
            approval: {
              submittedAt: nowIso,
            },
            history: [
              { at: nowIso, userId: adminUser.id, event: 'created', details: 'Tarefa delegada a Lucas Mendes' },
              { at: nowIso, userId: guestUser.id, event: 'submitted_for_approval', details: 'Enviada para aprovação' },
            ],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'tsk_demo_delegated_todo',
            title: 'Implementar estados vazios ilustrados para o painel de Metas',
            status: 'todo',
            priority: 'medium',
            spaceId: orgId,
            createdBy: adminUser.id,
            assigneeId: guestUser.id,
            tagIds: ['tag_org_lancamento'],
            dueDate: currentToday,
            originalDueDate: currentToday,
            notes: 'Tarefa atribuída pela Admin Marina. Ao concluir como Membro, será enviada para aprovação.',
            subtasks: [
              { id: 's_d1', title: 'Criar componente de estado vazio', done: true },
              { id: 's_d2', title: 'Revisar textos em PT-BR', done: false },
            ],
            recurrence: null,
            completions: [],
            goalId: goalOrgId,
            history: [
              { at: nowIso, userId: adminUser.id, event: 'created', details: 'Delegada para Lucas Mendes' },
            ],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'tsk_demo_week_1',
            title: 'Preparar apresentação executiva de resultados da sprint',
            status: 'todo',
            priority: 'high',
            spaceId: orgId,
            createdBy: adminUser.id,
            assigneeId: adminUser.id,
            tagIds: ['tag_org_lancamento'],
            dueDate: tomorrow,
            originalDueDate: tomorrow,
            notes: '',
            subtasks: [],
            recurrence: null,
            completions: [],
            goalId: goalOrgId,
            history: [{ at: nowIso, userId: adminUser.id, event: 'created', details: 'Tarefa criada' }],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          {
            id: 'tsk_demo_week_2',
            title: 'Agendar revisão periódica de equipamentos',
            status: 'todo',
            priority: 'low',
            spaceId: adminSpace,
            createdBy: adminUser.id,
            assigneeId: adminUser.id,
            tagIds: ['tag_pessoal_adm'],
            dueDate: inTwoDays,
            originalDueDate: inTwoDays,
            notes: '',
            subtasks: [],
            recurrence: null,
            completions: [],
            goalId: null,
            history: [{ at: nowIso, userId: adminUser.id, event: 'created', details: 'Tarefa criada' }],
            createdAt: nowIso,
            updatedAt: nowIso,
          },
        ];

        const demoTaskIds = new Set(demoTasks.map((t) => t.id));
        db.tasks = [...demoTasks, ...db.tasks.filter((t) => !demoTaskIds.has(t.id))];

        const demoInbox: InboxItem[] = [
          {
            id: 'inb_demo_1',
            ownerId: adminUser.id,
            text: 'Pedir ao Lucas para revisar a documentação de boas-vindas do cliente',
            createdAt: nowIso,
          },
          {
            id: 'inb_demo_2',
            ownerId: adminUser.id,
            text: 'Transferir reserva mensal para o fundo de emergência',
            createdAt: nowIso,
          },
          {
            id: 'inb_demo_3',
            ownerId: adminUser.id,
            text: 'Pesquisar referências de microinterações para o aplicativo mobile',
            createdAt: nowIso,
          },
        ];
        const demoInboxIds = new Set(demoInbox.map((i) => i.id));
        db.inboxItems = [...demoInbox, ...db.inboxItems.filter((i) => !demoInboxIds.has(i.id))];

        const admIdx = db.users.findIndex((u) => u.id === adminUser!.id);
        if (admIdx !== -1) {
          db.users[admIdx] = {
            ...db.users[admIdx],
            preferences: {
              ...db.users[admIdx].preferences,
              rolloverHandledDate: null,
            },
          };
          adminUser = db.users[admIdx];
        }

        this.engine.writeDb(db, true);
        this.engine.setSessionUserId(adminUser.id);
        return adminUser;
      },

      clearSampleData: async (): Promise<void> => {
        const db = this.engine.readDb();
        
        // Remove tudo que contem "_demo_" no ID (contas de demonstração, orgs de teste, etc.)
        db.users = db.users.filter((u) => !u.id.includes('_demo_'));
        db.credentials = db.credentials.filter((c) => !c.userId.includes('_demo_'));
        db.organizations = db.organizations.filter((o) => !o.id.includes('_demo_'));
        db.memberships = db.memberships.filter((m) => !m.userId.includes('_demo_') && !m.orgId.includes('_demo_'));
        db.invites = db.invites.filter((i) => !i.id.includes('_demo_'));
        db.tags = db.tags.filter((t) => !t.id.includes('_demo_') && !t.spaceId.includes('_demo_'));
        db.tasks = db.tasks.filter((t) => !t.id.includes('_demo_'));
        db.inboxItems = db.inboxItems.filter((i) => !i.id.includes('_demo_'));
        db.goals = db.goals.filter((g) => !g.id.includes('_demo_'));
        
        // Se a conta atual era uma demo e foi apagada, tira a sessão ativa
        const currentSession = this.engine.getSessionUserId();
        if (currentSession && currentSession.includes('_demo_')) {
          this.engine.setSessionUserId(null);
        }
        
        this.engine.writeDb(db, true);
      },

      clearAllData: async (): Promise<void> => {
        this.engine.clearAll();
      },
    };
  }
}