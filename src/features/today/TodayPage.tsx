import React, { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { TaskRow } from '../../components/TaskRow';
import { addDaysToStr, formatFullPtDate, getGreetingPt } from '../../domain/clock';
import { calculateDailyProgress } from '../../domain/progress';
import { isRecurringCompletedOnDate, recurrenceAppliesOnDate } from '../../domain/recurrence';
import { getPendingRolloverTasks } from '../../domain/rollover';

export const TodayPage: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const tasks = useAppStore((s) => s.tasks);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);
  const selectedTodaySpace = useAppStore((s) => s.selectedTodaySpace);

  const openQuickAdd = useAppStore((s) => s.openQuickAdd);
  const rolloverTasks = useAppStore((s) => s.rolloverTasks);
  const dismissRolloverForToday = useAppStore((s) => s.dismissRolloverForToday);
  const updateTask = useAppStore((s) => s.updateTask);

  const [isReviewingRollover, setIsReviewingRollover] = useState(false);
  const [keptTaskIds, setKeptTaskIds] = useState<string[]>([]);
  const [showCompletedSection, setShowCompletedSection] = useState(true);

  if (!user) return null;

  // Filter tasks where current user is the assignee, and matching selected space filter (global)
  const myAssignedTasks = tasks.filter((t) => {
    if (t.assigneeId !== user.id) return false;
    if (selectedTodaySpace === 'all') return true;
    return t.spaceId === selectedTodaySpace;
  });

  // Pending rollover tasks from previous days (mode === 'ask')
  const allPendingRollover = getPendingRolloverTasks(
    tasks.filter((t) => t.assigneeId === user.id),
    user.id,
    currentTodayStr
  ).filter((t) => !keptTaskIds.includes(t.id));

  const showRolloverAskBanner =
    user.preferences.rolloverMode === 'ask' &&
    user.preferences.rolloverHandledDate !== currentTodayStr &&
    allPendingRollover.length > 0;

  // Daily progress calculation for today
  const progress = calculateDailyProgress(myAssignedTasks, currentTodayStr);

  // Separate Today's active tasks by Priority & Routines vs Completed Today
  const todayNonRecurring = myAssignedTasks.filter(
    (t) => !t.recurrence && t.dueDate === currentTodayStr
  );
  const todayRoutines = myAssignedTasks.filter(
    (t) => Boolean(t.recurrence) && recurrenceAppliesOnDate(t, currentTodayStr)
  );

  const activeHigh = todayNonRecurring.filter(
    (t) => t.priority === 'high' && t.status !== 'done' && t.status !== 'awaiting_approval'
  );
  const activeMedium = todayNonRecurring.filter(
    (t) => t.priority === 'medium' && t.status !== 'done' && t.status !== 'awaiting_approval'
  );
  const activeLow = todayNonRecurring.filter(
    (t) => t.priority === 'low' && t.status !== 'done' && t.status !== 'awaiting_approval'
  );
  const activeRoutines = todayRoutines.filter(
    (t) => !isRecurringCompletedOnDate(t, currentTodayStr)
  );

  const completedTodayList = [
    ...todayNonRecurring.filter(
      (t) => t.status === 'done' || t.status === 'awaiting_approval'
    ),
    ...todayRoutines.filter((t) => isRecurringCompletedOnDate(t, currentTodayStr)),
  ];

  const greeting = getGreetingPt();
  const firstName = user.name.split(' ')[0];
  const fullDateLabel = formatFullPtDate(currentTodayStr);

  return (
    <div className="space-y-6">
      {/* Header: Dynamic Greeting, Full PT-BR Date */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)]">{fullDateLabel}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
            {greeting}, {firstName}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => openQuickAdd()}
          className="hidden sm:inline-flex min-h-[42px] px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold items-center gap-2 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer self-start sm:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Adicionar para Hoje
        </button>
      </header>

      {/* Daily Progress Bar Card */}
      <section
        aria-label="Progresso do dia"
        className="p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
              <span>Foco de Hoje</span>
              {progress.total > 0 && progress.percentage === 100 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  Dia 100% concluído! Parabéns!
                </span>
              )}
            </h2>
            <p className="text-xs text-[var(--text-muted)] tabular-nums">
              {progress.completed} de {progress.total}{' '}
              {progress.total === 1 ? 'tarefa concluída' : 'tarefas concluídas'}
            </p>
          </div>

          <span className="text-xl font-bold font-mono tabular-nums text-[var(--accent-text)]">
            {progress.percentage}%
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Progresso das tarefas de hoje"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percentage}
          className="w-full h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden"
        >
          <div
            style={{
              width: `${progress.percentage}%`,
              backgroundColor: 'var(--accent)',
            }}
            className="h-full rounded-full transition-all duration-200"
          />
        </div>
      </section>

      {/* Day Rollover Banner (Virada de Dia — Modo "ask") */}
      {showRolloverAskBanner && (
        <section
          aria-label="Tarefas pendentes de dias anteriores"
          className="p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-amber-500/40 space-y-4 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--text)]">
                  Você tem {allPendingRollover.length}{' '}
                  {allPendingRollover.length === 1
                    ? 'tarefa pendente de ontem.'
                    : 'tarefas pendentes de ontem.'}
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Deseja trazê-las para a sua lista de foco de hoje mantendo o histórico original?
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  void rolloverTasks(
                    allPendingRollover.map((t) => t.id),
                    true
                  )
                }
                className="min-h-[40px] px-3.5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold hover:bg-[var(--accent-hover)] transition-colors cursor-pointer whitespace-nowrap"
              >
                Mover todas para Hoje
              </button>
              <button
                type="button"
                onClick={() => setIsReviewingRollover((v) => !v)}
                className="min-h-[40px] px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition-colors cursor-pointer whitespace-nowrap"
              >
                {isReviewingRollover ? 'Ocultar revisão' : 'Revisar'}
              </button>
              <button
                type="button"
                onClick={() => void dismissRolloverForToday()}
                className="min-h-[40px] px-2.5 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer whitespace-nowrap"
              >
                Dispensar hoje
              </button>
            </div>
          </div>

          {isReviewingRollover && (
            <div className="pt-3 border-t border-[var(--border)] space-y-2">
              {allPendingRollover.map((pendingTask) => (
                <div
                  key={pendingTask.id}
                  className="p-3 rounded-xl bg-[var(--surface-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text)] truncate">
                      {pendingTask.title}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                      Data anterior: {pendingTask.dueDate}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void rolloverTasks([pendingTask.id], false)}
                      className="h-8 px-2.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Mover para Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void updateTask(pendingTask.id, {
                          dueDate: addDaysToStr(currentTodayStr, 1),
                        })
                      }
                      className="h-8 px-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-medium text-[var(--text)] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Calendar className="w-3 h-3" />
                      Amanhã
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextKept = [...keptTaskIds, pendingTask.id];
                        setKeptTaskIds(nextKept);
                        if (nextKept.length >= allPendingRollover.length) {
                          void dismissRolloverForToday();
                        }
                      }}
                      className="h-8 px-2.5 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer whitespace-nowrap"
                    >
                      Deixar como está
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty State when no tasks for Today */}
      {progress.total === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-3">
          <div
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
          >
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-base font-bold text-[var(--text)]">
              Tudo limpo para hoje neste espaço
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Adicione as prioridades do seu dia para acompanhar sua barra de progresso.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openQuickAdd()}
            className="min-h-[44px] px-5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-semibold inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Criar primeira tarefa de hoje
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Priority High Section */}
          {activeHigh.length > 0 && (
            <section className="space-y-2.5" aria-label="Prioridade Alta">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <span aria-hidden="true">🔴</span>
                  <span>Prioridade Alta</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                  {activeHigh.length}
                </span>
              </div>
              <div className="space-y-2">
                {activeHigh.map((t) => (
                  <TaskRow key={t.id} task={t} dateContextStr={currentTodayStr} />
                ))}
              </div>
            </section>
          )}

          {/* Priority Medium Section */}
          {activeMedium.length > 0 && (
            <section className="space-y-2.5" aria-label="Prioridade Média">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <span aria-hidden="true">🟡</span>
                  <span>Prioridade Média</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                  {activeMedium.length}
                </span>
              </div>
              <div className="space-y-2">
                {activeMedium.map((t) => (
                  <TaskRow key={t.id} task={t} dateContextStr={currentTodayStr} />
                ))}
              </div>
            </section>
          )}

          {/* Priority Low Section */}
          {activeLow.length > 0 && (
            <section className="space-y-2.5" aria-label="Prioridade Baixa">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <span aria-hidden="true">🔵</span>
                  <span>Prioridade Baixa</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                  {activeLow.length}
                </span>
              </div>
              <div className="space-y-2">
                {activeLow.map((t) => (
                  <TaskRow key={t.id} task={t} dateContextStr={currentTodayStr} />
                ))}
              </div>
            </section>
          )}

          {/* Daily Routines Section */}
          {activeRoutines.length > 0 && (
            <section className="space-y-2.5" aria-label="Rotinas Diárias">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Repeat className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Rotinas Diárias</span>
                </h3>
                <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                  {activeRoutines.length}
                </span>
              </div>
              <div className="space-y-2">
                {activeRoutines.map((t) => (
                  <TaskRow key={t.id} task={t} dateContextStr={currentTodayStr} />
                ))}
              </div>
            </section>
          )}

          {/* Collapsible Completed Today Section */}
          {completedTodayList.length > 0 && (
            <section className="pt-2 border-t border-[var(--border)] space-y-2.5">
              <button
                type="button"
                onClick={() => setShowCompletedSection((v) => !v)}
                className="w-full min-h-[40px] px-1 flex items-center justify-between text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  {showCompletedSection ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span>Concluídas Hoje</span>
                </span>
                <span className="font-mono tabular-nums">{completedTodayList.length}</span>
              </button>

              {showCompletedSection && (
                <div className="space-y-2">
                  {completedTodayList.map((t) => (
                    <TaskRow key={t.id} task={t} dateContextStr={currentTodayStr} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};