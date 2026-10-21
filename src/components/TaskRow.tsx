import React from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  Clock,
  MessageSquareWarning,
  Repeat,
  Send,
  Target,
  User as UserIcon,
} from 'lucide-react';
import { useAppStore } from '../app/store';
import { formatShortPtDate } from '../domain/clock';
import { taskRequiresApproval } from '../domain/permissions';
import { isRecurringCompletedOnDate } from '../domain/recurrence';
import { isTaskPostponed } from '../domain/rollover';
import { isPersonalSpace, Task } from '../domain/types';
import { PriorityLabel } from './PriorityBadge';

interface TaskRowProps {
  task: Task;
  dateContextStr?: string;
  showSpaceLabel?: boolean;
  showDueDate?: boolean;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  dateContextStr,
  showSpaceLabel = true,
  showDueDate = false,
}) => {
  const user = useAppStore((s) => s.user);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);
  const memberships = useAppStore((s) => s.memberships);
  const organizations = useAppStore((s) => s.organizations);
  const tags = useAppStore((s) => s.tags);
  const goals = useAppStore((s) => s.goals);
  const membersById = useAppStore((s) => s.membersById);
  const toggleTaskCompletion = useAppStore((s) => s.toggleTaskCompletion);
  const openTaskDetail = useAppStore((s) => s.openTaskDetail);

  const effectiveDate = dateContextStr || currentTodayStr;

  const isCompleted = task.recurrence
    ? isRecurringCompletedOnDate(task, effectiveDate)
    : task.status === 'done' || task.status === 'awaiting_approval';

  const isAwaitingApproval = !task.recurrence && task.status === 'awaiting_approval';
  const hasChangesRequested =
    !task.recurrence &&
    task.status === 'doing' &&
    task.approval?.decision === 'changes_requested';

  const needsApprovalOnComplete =
    user &&
    !task.recurrence &&
    task.status !== 'done' &&
    task.status !== 'awaiting_approval' &&
    taskRequiresApproval(task, memberships) &&
    task.assigneeId === user.id;

  const postponed = isTaskPostponed(task);
  const org = !isPersonalSpace(task.spaceId)
    ? organizations.find((o) => o.id === task.spaceId)
    : null;
  const taskTags = tags.filter((t) => task.tagIds.includes(t.id));
  const linkedGoal = task.goalId ? goals.find((g) => g.id === task.goalId) : null;
  const assignee = task.assigneeId ? membersById[task.assigneeId] : null;

  const subtasksDone = task.subtasks.filter((s) => s.done).length;
  const subtasksTotal = task.subtasks.length;

  const priorityAccentClass =
    task.priority === 'high'
      ? 'before:bg-rose-500'
      : task.priority === 'medium'
      ? 'before:bg-amber-500'
      : 'before:bg-sky-500';

  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-[var(--surface)] border transition-all duration-200 before:content-[''] before:absolute before:left-0 before:top-3.5 before:bottom-3.5 before:w-[3.5px] before:rounded-r-full before:transition-all ${priorityAccentClass} ${
        isCompleted
          ? 'border-[var(--border)]/60 opacity-60 bg-[var(--surface)]/50'
          : hasChangesRequested
          ? 'border-amber-500/45 hover:border-amber-500/80 card-interactive'
          : 'border-[var(--border)] hover:border-[var(--accent-border)] card-interactive'
      }`}
    >
      {/* 44x44px Accessible One-Tap Completion Hitbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void toggleTaskCompletion(task.id, effectiveDate);
        }}
        aria-label={
          isCompleted
            ? `Reabrir tarefa ${task.title}`
            : needsApprovalOnComplete
            ? `Enviar tarefa ${task.title} para aprovação`
            : `Concluir tarefa ${task.title}`
        }
        title={
          needsApprovalOnComplete
            ? 'Enviar para aprovação do Admin'
            : isCompleted
            ? 'Marcar como pendente'
            : 'Concluir tarefa'
        }
        className="min-h-[44px] min-w-[44px] -ml-2 -my-2 flex items-center justify-center shrink-0 cursor-pointer"
      >
        <span
          className={`w-[21px] h-[21px] rounded-full flex items-center justify-center border-[1.75px] transition-all duration-200 group-active:scale-90 ${
            isAwaitingApproval
              ? 'border-amber-500 bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.45)] animate-check-pop'
              : isCompleted
              ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_0_10px_var(--accent-glow)] animate-check-pop'
              : 'border-[var(--text-muted)]/40 group-hover:border-[var(--accent)] bg-[var(--surface-2)]/60'
          }`}
        >
          {isAwaitingApproval ? (
            <Clock className="w-3 h-3 stroke-[2.5]" />
          ) : isCompleted ? (
            <Check className="w-3 h-3 stroke-[3]" />
          ) : needsApprovalOnComplete ? (
            <Send className="w-2.5 h-2.5 text-[var(--accent-text)] opacity-0 group-hover:opacity-100 transition-opacity" />
          ) : (
            <Check className="w-2.5 h-2.5 text-[var(--accent-text)] opacity-0 group-hover:opacity-50 transition-opacity stroke-[2.5]" />
          )}
        </span>
      </button>

      {/* Main clickable body -> opens TaskDetail */}
      <button
        type="button"
        onClick={() => openTaskDetail(task.id)}
        className="flex-1 min-w-0 text-left space-y-2 cursor-pointer py-0.5"
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className={`text-[14px] font-semibold leading-snug break-words transition-colors duration-150 ${
              isCompleted
                ? 'line-through text-[var(--text-muted)]'
                : 'text-[var(--text)] group-hover:text-[var(--accent-text)]'
            }`}
          >
            {task.title}
          </span>
          <PriorityLabel priority={task.priority} />
        </div>

        {/* Requested adjustments warning banner for Member */}
        {hasChangesRequested && task.approval?.comment && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-600 dark:text-amber-400 font-medium max-w-full">
            <MessageSquareWarning className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Ajustes solicitados: {task.approval.comment}</span>
          </div>
        )}

        {/* Structured metadata pills & indicators */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          {showSpaceLabel && (
            <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] font-semibold text-[var(--text)]/80 border border-[var(--border)]/60">
              {org ? org.name : 'Pessoal'}
            </span>
          )}

          {taskTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--border)]/60 font-medium text-[var(--text)]"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span>{tag.name}</span>
            </span>
          ))}

          {showDueDate && task.dueDate && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-2)] tabular-nums font-medium">
              <Calendar className="w-3 h-3 text-[var(--text-muted)]" />
              {formatShortPtDate(task.dueDate)}
            </span>
          )}

          {postponed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
              Adiada ({task.originalDueDate?.slice(8, 10)}/{task.originalDueDate?.slice(5, 7)})
            </span>
          )}

          {isAwaitingApproval && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-600 dark:text-amber-400 font-semibold">
              <Clock className="w-3 h-3" />
              Aguardando aprovação
            </span>
          )}

          {needsApprovalOnComplete && !isCompleted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold">
              Exige aprovação
            </span>
          )}

          {task.recurrence && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-2)] font-medium">
              <Repeat className="w-3 h-3 text-[var(--accent-text)]" />
              Rotina
            </span>
          )}

          {subtasksTotal > 0 && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md tabular-nums font-mono font-semibold ${
                subtasksDone === subtasksTotal
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
              }`}
            >
              <CheckSquare className="w-3 h-3" />
              {subtasksDone}/{subtasksTotal}
            </span>
          )}

          {linkedGoal && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] font-semibold truncate max-w-[190px]">
              <Target className="w-3 h-3 shrink-0" />
              <span className="truncate">{linkedGoal.title}</span>
            </span>
          )}

          {org && assignee && user && assignee.id !== user.id && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--surface-2)] font-medium text-[var(--text)]">
              <UserIcon className="w-3 h-3 text-[var(--text-muted)]" />
              {assignee.name.split(' ')[0]}
            </span>
          )}
        </div>
      </button>
    </div>
  );
};