import { Task } from './types';

/**
 * Finds pending tasks from previous days for a user:
 * - Assigned to userId
 * - Non-recurring (!task.recurrence)
 * - Status is 'todo' or 'doing' (excludes 'awaiting_approval' and 'done')
 * - dueDate is set and strictly before todayStr (dueDate < todayStr)
 */
export function getPendingRolloverTasks(
  tasks: Task[],
  userId: string,
  currentTodayStr: string
): Task[] {
  return tasks.filter(
    (t) =>
      t.assigneeId === userId &&
      !t.recurrence &&
      (t.status === 'todo' || t.status === 'doing') &&
      t.dueDate !== null &&
      t.dueDate < currentTodayStr
  );
}

/**
 * Moves a pending task to todayStr, preserving originalDueDate and recording a rollover entry in history.
 */
export function rolloverTaskToToday(
  task: Task,
  currentTodayStr: string,
  actorUserId: string,
  nowIso: string
): Task {
  if (task.dueDate === currentTodayStr) return task;
  const originalDueDate = task.originalDueDate || task.dueDate;
  const previousDueDate = task.dueDate;

  return {
    ...task,
    dueDate: currentTodayStr,
    originalDueDate,
    updatedAt: nowIso,
    history: [
      ...task.history,
      {
        at: nowIso,
        userId: actorUserId,
        event: 'rollover',
        details: `Movida de ${previousDueDate ?? 'sem data'} para ${currentTodayStr} na virada do dia`,
      },
    ],
  };
}

export function isTaskPostponed(task: Task): boolean {
  return Boolean(
    !task.recurrence &&
      task.originalDueDate &&
      task.dueDate &&
      task.originalDueDate !== task.dueDate
  );
}
