import { describe, expect, it } from 'vitest';
import {
  computeThemeVariables,
  getContrastRatio,
  isValidHexColor,
  normalizeHexColor,
} from './color';
import { can, taskRequiresApproval } from './permissions';
import { calculateDailyProgress, calculateGoalProgress } from './progress';
import { recurrenceAppliesOnDate } from './recurrence';
import { getPendingRolloverTasks, isTaskPostponed, rolloverTaskToToday } from './rollover';
import { Goal, Membership, Task, User } from './types';

const mockAdmin: User = {
  id: 'u-admin',
  name: 'Ana Admin',
  email: 'ana@intask.app',
  createdAt: '2026-10-01T10:00:00Z',
  preferences: {
    accentColor: '#1c3cee',
    themeMode: 'light',
    rolloverMode: 'ask',
    rolloverHandledDate: null,
  },
};

const mockMember: User = {
  id: 'u-member',
  name: 'Bruno Membro',
  email: 'bruno@intask.app',
  createdAt: '2026-10-01T10:00:00Z',
  preferences: {
    accentColor: '#e11d48',
    themeMode: 'dark',
    rolloverMode: 'auto',
    rolloverHandledDate: null,
  },
};

const memberships: Membership[] = [
  { orgId: 'org-1', userId: 'u-admin', role: 'admin', joinedAt: '2026-10-01T10:00:00Z' },
  { orgId: 'org-1', userId: 'u-member', role: 'member', joinedAt: '2026-10-02T10:00:00Z' },
];

function createSampleTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-1',
    title: 'Tarefa teste',
    status: 'todo',
    priority: 'medium',
    spaceId: 'personal:u-admin',
    createdBy: 'u-admin',
    assigneeId: 'u-admin',
    tagIds: [],
    dueDate: '2026-10-20',
    originalDueDate: '2026-10-20',
    notes: '',
    subtasks: [],
    recurrence: null,
    completions: [],
    history: [],
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}

describe('Domain: Color & WCAG Contrast', () => {
  it('validates and normalizes #RGB and #RRGGBB hex codes', () => {
    expect(isValidHexColor('#1c3cee')).toBe(true);
    expect(isValidHexColor('#f0a')).toBe(true);
    expect(isValidHexColor('1c3cee')).toBe(false);
    expect(normalizeHexColor('#f0a')).toBe('#ff00aa');
  });

  it('maintains WCAG AA contrast >= 4.5 for --accent-text in both light and dark modes', () => {
    const colors = ['#1c3cee', '#e11d48', '#eab308', '#22c55e', '#38bdf8'];
    for (const hex of colors) {
      const lightVars = computeThemeVariables(hex, false);
      const darkVars = computeThemeVariables(hex, true);
      expect(getContrastRatio(lightVars['--accent-text'], '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(darkVars['--accent-text'], '#0b0f19')).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Domain: Day Rollover (Virada de Dia)', () => {
  it('finds only non-recurring todo/doing tasks before today and preserves originalDueDate on rollover', () => {
    const tasks: Task[] = [
      createSampleTask({ id: 't1', dueDate: '2026-10-20', status: 'todo' }),
      createSampleTask({ id: 't2', dueDate: '2026-10-20', status: 'doing' }),
      createSampleTask({ id: 't3', dueDate: '2026-10-20', status: 'done' }),
      createSampleTask({ id: 't4', dueDate: '2026-10-20', status: 'awaiting_approval' }),
      createSampleTask({ id: 't5', dueDate: '2026-10-20', status: 'todo', recurrence: 'daily' }),
    ];

    const pending = getPendingRolloverTasks(tasks, 'u-admin', '2026-10-21');
    expect(pending.map((t) => t.id)).toEqual(['t1', 't2']);

    const rolled = rolloverTaskToToday(pending[0], '2026-10-21', 'u-admin', '2026-10-21T08:00:00Z');
    expect(rolled.dueDate).toBe('2026-10-21');
    expect(rolled.originalDueDate).toBe('2026-10-20');
    expect(isTaskPostponed(rolled)).toBe(true);
    expect(rolled.history).toHaveLength(1);
    expect(rolled.history[0].event).toBe('rollover');
  });
});

describe('Domain: Recurrence Rules', () => {
  it('handles monthly recurrence on short months (Jan 31 -> Feb 28)', () => {
    const monthlyTask = createSampleTask({
      dueDate: '2026-01-31',
      recurrence: 'monthly',
    });
    expect(recurrenceAppliesOnDate(monthlyTask, '2026-02-28')).toBe(true);
    expect(recurrenceAppliesOnDate(monthlyTask, '2026-02-27')).toBe(false);
    expect(recurrenceAppliesOnDate(monthlyTask, '2026-04-30')).toBe(true);
  });

  it('handles weekdays and weekly recurrence', () => {
    const weekdayTask = createSampleTask({
      dueDate: '2026-10-19', // Monday
      recurrence: 'weekdays',
    });
    expect(recurrenceAppliesOnDate(weekdayTask, '2026-10-21')).toBe(true); // Wednesday
    expect(recurrenceAppliesOnDate(weekdayTask, '2026-10-24')).toBe(false); // Saturday
  });
});

describe('Domain: Permissions & Approval Workflow', () => {
  it('requires approval only when delegated by someone else to a Member in an organization', () => {
    const delegatedTask = createSampleTask({
      spaceId: 'org-1',
      createdBy: 'u-admin',
      assigneeId: 'u-member',
    });
    const selfCreatedMemberTask = createSampleTask({
      spaceId: 'org-1',
      createdBy: 'u-member',
      assigneeId: 'u-member',
    });

    expect(taskRequiresApproval(delegatedTask, memberships)).toBe(true);
    expect(taskRequiresApproval(selfCreatedMemberTask, memberships)).toBe(false);
    expect(can(mockMember, 'submit_for_approval', { task: delegatedTask }, memberships)).toBe(true);
    expect(can(mockMember, 'complete_direct', { task: delegatedTask }, memberships)).toBe(false);
    expect(can(mockAdmin, 'review_approval', { task: delegatedTask }, memberships)).toBe(true);
  });

  it('prevents members from viewing another user personal space', () => {
    expect(can(mockMember, 'view_space', { spaceId: 'personal:u-admin' }, memberships)).toBe(false);
  });
});

describe('Domain: Progress Calculations', () => {
  it('counts awaiting_approval as completed in Daily Progress (/hoje), but only done in Goal Progress (/metas)', () => {
    const goal: Goal = {
      id: 'g-1',
      title: 'Meta Trimestral',
      spaceId: 'org-1',
      createdBy: 'u-admin',
      period: 'quarterly',
      deadline: '2026-12-31',
      createdAt: '2026-10-01T10:00:00Z',
    };

    const t1 = createSampleTask({
      id: 't1',
      dueDate: '2026-10-21',
      status: 'awaiting_approval',
      goalId: 'g-1',
    });
    const t2 = createSampleTask({
      id: 't2',
      dueDate: '2026-10-21',
      status: 'done',
      goalId: 'g-1',
    });

    const daily = calculateDailyProgress([t1, t2], '2026-10-21');
    expect(daily.percentage).toBe(100);

    const goalProgBeforeApproval = calculateGoalProgress(goal, [t1, t2], '2026-10-21');
    expect(goalProgBeforeApproval.percentage).toBe(50);

    const goalProgAfterApproval = calculateGoalProgress(
      goal,
      [{ ...t1, status: 'done' }, t2],
      '2026-10-21'
    );
    expect(goalProgAfterApproval.percentage).toBe(100);
  });
});
