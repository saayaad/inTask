import { diffInDays } from './clock';
import { isRecurringCompletedOnDate, recurrenceAppliesOnDate } from './recurrence';
import { Goal, Task } from './types';

export interface DailyProgressSummary {
  total: number;
  completed: number;
  percentage: number;
}

/**
 * Calculates daily progress for /hoje:
 * - Tasks with dueDate === currentTodayStr (or completed today) + routines that apply on currentTodayStr
 * - Tasks in 'done' OR 'awaiting_approval' count as completed for the assignee
 */
export function calculateDailyProgress(
  tasks: Task[],
  currentTodayStr: string
): DailyProgressSummary {
  let total = 0;
  let completed = 0;

  for (const task of tasks) {
    if (task.recurrence) {
      if (recurrenceAppliesOnDate(task, currentTodayStr)) {
        total += 1;
        if (isRecurringCompletedOnDate(task, currentTodayStr)) {
          completed += 1;
        }
      }
    } else if (task.dueDate === currentTodayStr) {
      total += 1;
      if (task.status === 'done' || task.status === 'awaiting_approval') {
        completed += 1;
      }
    }
  }

  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

export type GoalComputedState = 'in_progress' | 'completed' | 'overdue';

export interface GoalProgressSummary {
  totalTasks: number;
  completedTasks: number;
  awaitingApprovalTasks: number;
  percentage: number;
  daysDiff: number; // >0 faltam N dias, 0 vence hoje, <0 venceu há N dias
  deadlineLabel: string;
  state: GoalComputedState;
  stateLabel: string;
}

/**
 * Calculates automatic progress for a Goal:
 * - Only non-recurring tasks with goalId === goal.id
 * - Only status === 'done' counts toward completedTasks (tasks in 'awaiting_approval' only count after Admin approves!)
 */
export function calculateGoalProgress(
  goal: Goal,
  allTasks: Task[],
  currentTodayStr: string
): GoalProgressSummary {
  const linked = allTasks.filter((t) => !t.recurrence && t.goalId === goal.id);
  const totalTasks = linked.length;
  const completedTasks = linked.filter((t) => t.status === 'done').length;
  const awaitingApprovalTasks = linked.filter((t) => t.status === 'awaiting_approval').length;
  const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const daysDiff = diffInDays(goal.deadline, currentTodayStr);
  let deadlineLabel = '';
  if (daysDiff > 1) {
    deadlineLabel = `Faltam ${daysDiff} dias`;
  } else if (daysDiff === 1) {
    deadlineLabel = 'Falta 1 dia';
  } else if (daysDiff === 0) {
    deadlineLabel = 'Vence hoje';
  } else if (daysDiff === -1) {
    deadlineLabel = 'Venceu há 1 dia';
  } else {
    deadlineLabel = `Venceu há ${Math.abs(daysDiff)} dias`;
  }

  let state: GoalComputedState = 'in_progress';
  let stateLabel = 'Em andamento';

  if (totalTasks > 0 && percentage === 100) {
    state = 'completed';
    stateLabel = 'Concluída';
  } else if (daysDiff < 0) {
    state = 'overdue';
    stateLabel = 'Atrasada';
  }

  return {
    totalTasks,
    completedTasks,
    awaitingApprovalTasks,
    percentage,
    daysDiff,
    deadlineLabel,
    state,
    stateLabel,
  };
}
