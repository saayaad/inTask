import { getDaysInMonth } from 'date-fns';
import { parseLocalDate } from './clock';
import { Task } from './types';

/**
 * Checks whether a recurring task applies on a given YYYY-MM-DD date string.
 * - daily: every day on or after anchor date
 * - weekdays: Monday (1) to Friday (5) on or after anchor date
 * - weekly: same day of week as anchor date
 * - monthly: same day of month as anchor date (clamped to last day of short months, e.g. Jan 31 -> Feb 28/29)
 */
export function recurrenceAppliesOnDate(task: Task, targetDateStr: string): boolean {
  if (!task.recurrence) return false;

  const anchorStr = task.dueDate || task.originalDueDate || task.createdAt.slice(0, 10);
  if (targetDateStr < anchorStr) {
    return false;
  }

  const targetDate = parseLocalDate(targetDateStr);
  const anchorDate = parseLocalDate(anchorStr);

  switch (task.recurrence) {
    case 'daily':
      return true;

    case 'weekdays': {
      const dow = targetDate.getDay();
      return dow >= 1 && dow <= 5;
    }

    case 'weekly': {
      return targetDate.getDay() === anchorDate.getDay();
    }

    case 'monthly': {
      const anchorDay = anchorDate.getDate();
      const maxDaysInTargetMonth = getDaysInMonth(targetDate);
      const expectedDay = Math.min(anchorDay, maxDaysInTargetMonth);
      return targetDate.getDate() === expectedDay;
    }

    default:
      return false;
  }
}

export function isRecurringCompletedOnDate(task: Task, targetDateStr: string): boolean {
  if (!task.recurrence) return false;
  return task.completions.some((c) => c.date === targetDateStr);
}

export function toggleRecurringCompletion(
  task: Task,
  targetDateStr: string,
  userId: string,
  timestampIso: string
): Task {
  if (!task.recurrence) return task;
  const exists = isRecurringCompletedOnDate(task, targetDateStr);
  const nextCompletions = exists
    ? task.completions.filter((c) => c.date !== targetDateStr)
    : [...task.completions, { date: targetDateStr, userId, completedAt: timestampIso }];

  return {
    ...task,
    completions: nextCompletions,
    updatedAt: timestampIso,
  };
}
