import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  History,
  ListChecks,
  MessageSquareWarning,
  Plus,
  Repeat,
  Send,
  Tag as TagIcon,
  Target,
  Trash2,
  User as UserIcon,
  X,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { generateId } from '../../data/crypto';
import { can, taskRequiresApproval } from '../../domain/permissions';
import { parseSafeLinks } from '../../domain/sanitize';
import {
  getPersonalSpaceId,
  isPersonalSpace,
  Priority,
  RecurrenceType,
  TaskStatus,
} from '../../domain/types';
import { CustomDateDropdown } from '../CustomDateDropdown';
import { CustomSelectDropdown } from '../CustomSelectDropdown';
import { CustomTagDropdown } from '../CustomTagDropdown';
import { PRIORITY_META } from '../PriorityBadge';

export const TaskDetailSheet: React.FC = () => {
  const activeTaskId = useAppStore((s) => s.activeTaskId);
  const openTaskDetail = useAppStore((s) => s.openTaskDetail);
  const tasks = useAppStore((s) => s.tasks);
  const user = useAppStore((s) => s.user);
  const organizations = useAppStore((s) => s.organizations);
  const memberships = useAppStore((s) => s.memberships);
  const membersById = useAppStore((s) => s.membersById);
  const tags = useAppStore((s) => s.tags);
  const goals = useAppStore((s) => s.goals);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);

  const updateTask = useAppStore((s) => s.updateTask);
  const submitForApproval = useAppStore((s) => s.submitForApproval);
  const reviewApproval = useAppStore((s) => s.reviewApproval);
  const deleteTask = useAppStore((s) => s.deleteTask);

  const task = tasks.find((t) => t.id === activeTaskId) ?? null;

  const [titleDraft, setTitleDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

  const touchStartY = useRef<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  const debounceTitleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceNotesRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canEdit = Boolean(user && task && can(user, 'edit_task', { task }, memberships));

  const flushPendingChanges = useCallback(() => {
    if (!task || !canEdit) return;
    if (debounceTitleRef.current) {
      clearTimeout(debounceTitleRef.current);
      debounceTitleRef.current = null;
      if (titleDraft.trim() && titleDraft.trim() !== task.title) {
        void updateTask(task.id, { title: titleDraft.trim() });
      }
    }
    if (debounceNotesRef.current) {
      clearTimeout(debounceNotesRef.current);
      debounceNotesRef.current = null;
      if (notesDraft !== task.notes) {
        void updateTask(task.id, { notes: notesDraft });
      }
    }
  }, [task, canEdit, titleDraft, notesDraft, updateTask]);

  const handleClose = useCallback(() => {
    flushPendingChanges();
    openTaskDetail(null);
  }, [flushPendingChanges, openTaskDetail]);

  useEffect(() => {
    if (debounceTitleRef.current) {
      clearTimeout(debounceTitleRef.current);
      debounceTitleRef.current = null;
    }
    if (debounceNotesRef.current) {
      clearTimeout(debounceNotesRef.current);
      debounceNotesRef.current = null;
    }
    if (task) {
      setTitleDraft(task.title);
      setNotesDraft(task.notes);
      setNewSubtaskTitle('');
      setShowRejectBox(false);
      setReviewComment('');
      setDragOffsetY(0);
    }
  }, [task?.id]);

  useEffect(() => {
    if (task && !debounceTitleRef.current) {
      setTitleDraft(task.title);
    }
  }, [task?.title]);

  useEffect(() => {
    if (task && !debounceNotesRef.current) {
      setNotesDraft(task.notes);
    }
  }, [task?.notes]);

  useEffect(() => {
    if (!activeTaskId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTaskId, handleClose]);

  if (!task || !user) return null;

  const canDelete = can(user, 'delete_task', { task }, memberships);
  const canReview = can(user, 'review_approval', { task }, memberships);
  const canAssignOthers = can(user, 'assign_others', { spaceId: task.spaceId }, memberships);
  const needsApproval = taskRequiresApproval(task, memberships);

  const personalSpaceId = getPersonalSpaceId(user.id);
  const spaceTags = tags.filter((t) => t.spaceId === task.spaceId);
  const spaceGoals = goals.filter((g) => g.spaceId === task.spaceId);
  const isOrg = !isPersonalSpace(task.spaceId);
  const orgMembers = isOrg
    ? memberships
        .filter((m) => m.orgId === task.spaceId)
        .map((m) => membersById[m.userId])
        .filter(Boolean)
    : [];

  const handleTitleChange = (val: string) => {
    setTitleDraft(val);
    if (!canEdit) return;
    if (debounceTitleRef.current) clearTimeout(debounceTitleRef.current);
    const targetTaskId = task.id;
    const originalTitle = task.title;
    debounceTitleRef.current = setTimeout(() => {
      debounceTitleRef.current = null;
      if (val.trim() && val.trim() !== originalTitle) {
        void updateTask(targetTaskId, { title: val.trim() });
      }
    }, 300);
  };

  const handleNotesChange = (val: string) => {
    setNotesDraft(val);
    if (!canEdit) return;
    if (debounceNotesRef.current) clearTimeout(debounceNotesRef.current);
    const targetTaskId = task.id;
    const originalNotes = task.notes;
    debounceNotesRef.current = setTimeout(() => {
      debounceNotesRef.current = null;
      if (val !== originalNotes) {
        void updateTask(targetTaskId, { notes: val });
      }
    }, 350);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !newSubtaskTitle.trim()) return;
    const nextSubtasks = [
      ...task.subtasks,
      { id: generateId('sub'), title: newSubtaskTitle.trim(), done: false },
    ];
    setNewSubtaskTitle('');
    void updateTask(task.id, { subtasks: nextSubtasks });
  };

  const handleToggleSubtask = (subId: string) => {
    if (!canEdit) return;
    const nextSubtasks = task.subtasks.map((s) =>
      s.id === subId ? { ...s, done: !s.done } : s
    );
    void updateTask(task.id, { subtasks: nextSubtasks });
  };

  const handleDeleteSubtask = (subId: string) => {
    if (!canEdit) return;
    const nextSubtasks = task.subtasks.filter((s) => s.id !== subId);
    void updateTask(task.id, { subtasks: nextSubtasks });
  };

  const subtasksDoneCount = task.subtasks.filter((s) => s.done).length;
  const noteSegments = parseSafeLinks(notesDraft);
  const hasLinksInNotes = noteSegments.some((s) => s.type === 'link');

  const statusConfig: Record<
    TaskStatus,
    { label: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    todo: { label: 'A Fazer', icon: Circle },
    doing: { label: 'Em Andamento', icon: Zap },
    awaiting_approval: { label: 'Aguardando Aprovação', icon: Clock },
    done: { label: 'Concluído', icon: CheckCircle2 },
  };

  const spaceOptions = [
    { value: personalSpaceId, label: 'Pessoal (Privado)' },
    ...organizations.map((org) => ({ value: org.id, label: `Org: ${org.name}` })),
  ];

  const memberOptions = [
    { value: '', label: 'Sem responsável' },
    ...orgMembers.map((m) => ({
      value: m.id,
      label: m.id === user.id ? `Eu (${m.name})` : m.name,
    })),
  ];

  const recurrenceOptions = [
    { value: '', label: 'Nenhuma (Tarefa única)' },
    { value: 'daily', label: 'Diariamente' },
    { value: 'weekdays', label: 'Dias úteis (Seg–Sex)' },
    { value: 'weekly', label: 'Semanalmente' },
    { value: 'monthly', label: 'Mensalmente' },
  ];

  const goalOptions = [
    { value: '', label: 'Nenhuma meta vinculada' },
    ...spaceGoals.map((g) => ({ value: g.id, label: g.title })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes da tarefa"
    >
      <aside
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          boxShadow: 'var(--shadow-elevated)',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0].clientY;
        }}
        onTouchMove={(e) => {
          if (touchStartY.current === null) return;
          const delta = e.touches[0].clientY - touchStartY.current;
          if (delta > 0) {
            setDragOffsetY(delta);
          }
        }}
        onTouchEnd={() => {
          if (dragOffsetY > 90) {
            handleClose();
          } else {
            setDragOffsetY(0);
          }
          touchStartY.current = null;
        }}
        className="mt-auto lg:mt-0 w-full max-h-[92vh] lg:max-h-screen lg:h-full lg:w-[475px] bg-[var(--surface)] border-t lg:border-t-0 lg:border-l border-[var(--border)] rounded-t-3xl lg:rounded-none flex flex-col overflow-hidden animate-sheet-right"
      >
        <div className="lg:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-11 h-1.5 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border)] glass-panel flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="font-semibold">Salvamento automático</span>
            {needsApproval && (
              <>
                <span aria-hidden="true">·</span>
                <span className="px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] font-bold">
                  Exige aprovação
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canDelete && (
              <button
                type="button"
                onClick={() => void deleteTask(task.id)}
                aria-label="Excluir tarefa"
                title="Excluir tarefa"
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fechar detalhes da tarefa"
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 pb-safe">
          {/* 1. TÍTULO E STATUS */}
          <div className="space-y-3.5">
            <label className="block">
              <span className="sr-only">Título da tarefa</span>
              <input
                type="text"
                value={titleDraft}
                disabled={!canEdit}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={flushPendingChanges}
                className="w-full text-lg sm:text-xl font-extrabold tracking-tight bg-transparent text-[var(--text)] border-b border-transparent focus:border-[var(--accent)] pb-1.5 focus:outline-none transition-colors"
                placeholder="Título da tarefa"
              />
            </label>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(['todo', 'doing', 'awaiting_approval', 'done'] as TaskStatus[]).map((st) => {
                  const cfg = statusConfig[st];
                  const Icon = cfg.icon;
                  const isActive = task.status === st;
                  const isDisabled =
                    !canEdit ||
                    (st === 'awaiting_approval' &&
                      !needsApproval &&
                      task.status !== 'awaiting_approval');

                  if (
                    st === 'awaiting_approval' &&
                    !needsApproval &&
                    task.status !== 'awaiting_approval'
                  ) {
                    return null;
                  }

                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (st === 'awaiting_approval' && needsApproval && !canReview) {
                          void submitForApproval(task.id);
                        } else {
                          void updateTask(task.id, { status: st });
                        }
                      }}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-all whitespace-nowrap cursor-pointer btn-press ${
                        isActive
                          ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-2xs'
                          : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {st === 'done' && needsApproval && !canReview
                          ? 'Enviar para Aprovação'
                          : cfg.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {needsApproval &&
                !canReview &&
                task.status !== 'awaiting_approval' &&
                task.status !== 'done' && (
                  <button
                    type="button"
                    onClick={() => void submitForApproval(task.id)}
                    className="w-full min-h-[42px] px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer btn-press"
                  >
                    <Send className="w-4 h-4" />
                    Enviar para Aprovação do Admin
                  </button>
                )}

              {task.approval?.decision === 'changes_requested' && task.approval.comment && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1 animate-item-enter">
                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <MessageSquareWarning className="w-4 h-4 shrink-0" />
                    Ajustes solicitados pelo Admin
                  </div>
                  <p className="text-[var(--text)] leading-relaxed">{task.approval.comment}</p>
                </div>
              )}

              {task.status === 'awaiting_approval' && canReview && (
                <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-amber-500/35 space-y-3 animate-item-enter">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text)]">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Esta tarefa aguarda sua aprovação como Admin
                  </div>
                  {!showRejectBox ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void reviewApproval(task.id, 'approved')}
                        className="flex-1 min-h-[40px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors cursor-pointer btn-press"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprovar entrega
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRejectBox(true)}
                        className="flex-1 min-h-[40px] px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold hover:bg-[var(--bg)] transition-colors cursor-pointer"
                      >
                        Pedir ajustes
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 animate-item-enter">
                      <textarea
                        rows={2}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Descreva os ajustes necessários (obrigatório)..."
                        className="w-full p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowRejectBox(false)}
                          className="h-9 px-3 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={!reviewComment.trim()}
                          onClick={() => {
                            void reviewApproval(
                              task.id,
                              'changes_requested',
                              reviewComment.trim()
                            );
                            setShowRejectBox(false);
                          }}
                          className="h-9 px-3.5 rounded-lg bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                        >
                          Enviar pedido de ajustes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. PRIORIDADE */}
          <div className="space-y-2">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Prioridade
            </span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Prioridade da tarefa">
              {(['high', 'medium', 'low'] as Priority[]).map((p) => {
                const active = task.priority === p;
                const meta = PRIORITY_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => void updateTask(task.id, { priority: p })}
                    className={`min-h-[40px] rounded-xl text-xs font-bold border inline-flex items-center justify-center gap-2 transition-all cursor-pointer btn-press ${
                      active
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)] shadow-2xs'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. ESPAÇO E TAG DE PROJETO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <Folder className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                Espaço
              </span>
              <CustomSelectDropdown
                variant="box"
                disabled={!canEdit}
                value={task.spaceId}
                onChange={(val) => void updateTask(task.id, { spaceId: val })}
                options={spaceOptions}
              />
            </div>

            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <TagIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                Tag / Projeto
              </span>
              <CustomTagDropdown
                variant="box"
                value={task.tagIds[0] || ''}
                onChange={(val) => void updateTask(task.id, { tagIds: val ? [val] : [] })}
                spaceId={task.spaceId}
                availableTags={spaceTags}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* 4. RESPONSÁVEL */}
          {isOrg && (
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <UserIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                Responsável
              </span>
              <CustomSelectDropdown
                variant="box"
                disabled={!canEdit || !canAssignOthers}
                value={task.assigneeId || ''}
                onChange={(val) => void updateTask(task.id, { assigneeId: val || null })}
                options={memberOptions}
              />
              {!canAssignOthers && (
                <span className="block text-[11px] text-[var(--text-muted)]">
                  Como Membro, apenas o Admin pode reatribuir tarefas para outras pessoas.
                </span>
              )}
            </div>
          )}

          {/* 5. DATA */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <Calendar className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              Data de execução
            </span>
            <CustomDateDropdown
              variant="box"
              value={task.dueDate}
              onChange={(val) => void updateTask(task.id, { dueDate: val })}
              currentTodayStr={currentTodayStr}
              disabled={!canEdit}
            />
          </div>

          {/* 6. RECORRÊNCIA */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <Repeat className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              Recorrência (Rotina)
            </span>
            <CustomSelectDropdown
              variant="box"
              disabled={!canEdit}
              value={task.recurrence || ''}
              onChange={(val) => {
                const rec = (val || null) as RecurrenceType;
                void updateTask(task.id, {
                  recurrence: rec,
                  dueDate: rec && !task.dueDate ? currentTodayStr : task.dueDate,
                });
              }}
              options={recurrenceOptions}
            />
          </div>

          {/* 7. META */}
          <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              <Target className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              Meta vinculada
            </span>
            <CustomSelectDropdown
              variant="box"
              disabled={!canEdit || Boolean(task.recurrence)}
              value={task.goalId || ''}
              onChange={(val) => void updateTask(task.id, { goalId: val || null })}
              options={goalOptions}
            />
            {task.recurrence && (
              <span className="block text-[11px] text-[var(--text-muted)]">
                Rotinas recorrentes não podem ser vinculadas a metas de longo prazo.
              </span>
            )}
          </div>

          {/* 8. BLOCO DE NOTAS */}
          <div className="space-y-2">
            <label className="space-y-1.5 block">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <FileText className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                Bloco de notas
              </span>
              <textarea
                rows={4}
                disabled={!canEdit}
                value={notesDraft}
                onChange={(e) => handleNotesChange(e.target.value)}
                onBlur={flushPendingChanges}
                placeholder="Adicione observações, contexto ou links https://..."
                className="w-full p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] leading-relaxed focus:border-[var(--accent)] focus:outline-none transition-colors"
              />
            </label>

            {hasLinksInNotes && (
              <div className="p-3 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)] text-xs space-y-1.5">
                <span className="font-semibold text-[var(--text-muted)] block text-[11px]">
                  Links detectados nas notas:
                </span>
                <div className="flex flex-wrap gap-2">
                  {noteSegments
                    .filter((seg) => seg.type === 'link' && seg.href)
                    .map((seg, i) => (
                      <a
                        key={i}
                        href={seg.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--accent-text)] hover:underline font-medium break-all"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {seg.content}
                      </a>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* 9. CHECKLIST DE SUB-PASSOS */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <ListChecks className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                Checklist de sub-passos
              </span>
              <span className="text-xs font-mono tabular-nums text-[var(--accent-text)] font-bold">
                {subtasksDoneCount}/{task.subtasks.length}
              </span>
            </div>

            {task.subtasks.length > 0 && (
              <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  style={{
                    width: `${Math.round((subtasksDoneCount / task.subtasks.length) * 100)}%`,
                    backgroundColor: 'var(--accent)',
                  }}
                  className="h-full rounded-full transition-all duration-300"
                />
              </div>
            )}

            {task.subtasks.length > 0 && (
              <ul className="space-y-1.5 stagger-list">
                {task.subtasks.map((sub) => (
                  <li
                    key={sub.id}
                    className="group flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent-border)] transition-colors"
                  >
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => handleToggleSubtask(sub.id)}
                      aria-label={
                        sub.done ? `Desmarcar passo ${sub.title}` : `Concluir passo ${sub.title}`
                      }
                      className={`w-4.5 h-4.5 rounded-md flex items-center justify-center border transition-all shrink-0 cursor-pointer ${
                        sub.done
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)] animate-check-pop'
                          : 'border-[var(--text-muted)]/60 bg-[var(--surface)]'
                      }`}
                    >
                      {sub.done && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                    <span
                      className={`flex-1 text-xs font-medium leading-snug ${
                        sub.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'
                      }`}
                    >
                      {sub.title}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubtask(sub.id)}
                        aria-label={`Remover passo ${sub.title}`}
                        className="p-1 text-[var(--text-muted)] hover:text-rose-500 opacity-70 group-hover:opacity-100 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canEdit && (
              <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Novo sub-passo (pressione Enter)..."
                  className="flex-1 h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newSubtaskTitle.trim()}
                  aria-label="Adicionar sub-passo"
                  className="h-9 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar
                </button>
              </form>
            )}
          </div>

          {/* 10. HISTÓRICO RECOLHIDO */}
          <div className="pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="w-full min-h-[40px] flex items-center justify-between text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" />
                Histórico de alterações ({task.history.length})
              </span>
              {showHistory ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showHistory && (
              <ul className="mt-2.5 space-y-2.5 text-xs text-[var(--text-muted)] pl-3 border-l-2 border-[var(--border)] animate-item-enter">
                {task.history.map((h, i) => {
                  const actorName = membersById[h.userId]?.name || 'Usuário';
                  return (
                    <li key={i} className="space-y-0.5">
                      <p className="text-[var(--text)] font-medium">{h.details}</p>
                      <p className="text-[11px] font-mono tabular-nums">
                        {actorName} · {h.at.slice(0, 10)} às {h.at.slice(11, 16)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};