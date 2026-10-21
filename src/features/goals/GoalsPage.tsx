import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Link2,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { CustomDateDropdown } from '../../components/CustomDateDropdown';
import { CustomSelectDropdown } from '../../components/CustomSelectDropdown';
import { addDaysToStr } from '../../domain/clock';
import { can } from '../../domain/permissions';
import { calculateGoalProgress } from '../../domain/progress';
import {
  getPersonalSpaceId,
  GoalPeriod,
  isPersonalSpace,
} from '../../domain/types';

export const GoalsPage: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const goals = useAppStore((s) => s.goals);
  const tasks = useAppStore((s) => s.tasks);
  const organizations = useAppStore((s) => s.organizations);
  const memberships = useAppStore((s) => s.memberships);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);

  const createGoal = useAppStore((s) => s.createGoal);
  const deleteGoal = useAppStore((s) => s.deleteGoal);
  const createTask = useAppStore((s) => s.createTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const openTaskDetail = useAppStore((s) => s.openTaskDetail);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('quarterly');
  const [deadline, setDeadline] = useState(addDaysToStr(currentTodayStr, 30));

  const [linkingGoalId, setLinkingGoalId] = useState<string | null>(null);
  const [newTaskTitleForGoal, setNewTaskTitleForGoal] = useState('');
  const [existingTaskIdToLink, setExistingTaskIdToLink] = useState('');

  useEffect(() => {
    setDeadline(addDaysToStr(currentTodayStr, 30));
  }, [currentTodayStr]);

  if (!user) return null;

  const personalSpaceId = getPersonalSpaceId(user.id);
  const effectiveSpaceId = spaceId || personalSpaceId;

  const adminOrgs = organizations.filter((org) =>
    can(user, 'manage_goal', { spaceId: org.id }, memberships)
  );

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !deadline) return;
    await createGoal({
      title: title.trim(),
      spaceId: effectiveSpaceId,
      period,
      deadline,
    });
    setTitle('');
    setShowCreateForm(false);
  };

  const periodLabels: Record<GoalPeriod, string> = {
    monthly: 'Mensal',
    quarterly: 'Trimestral',
    yearly: 'Anual',
  };

  const spaceOptions = [
    { value: personalSpaceId, label: 'Pessoal' },
    ...adminOrgs.map((org) => ({ value: org.id, label: `Org: ${org.name}` })),
  ];

  const periodOptions = [
    { value: 'monthly', label: 'Mensal' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'yearly', label: 'Anual' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
            <Target className="w-3.5 h-3.5" />
            <span>Visão de Longo Prazo</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
            Metas
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Progresso automático reativo calculado pelas tarefas vinculadas concluídas ou aprovadas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSpaceId(personalSpaceId);
            setDeadline(addDaysToStr(currentTodayStr, 30));
            setShowCreateForm((v) => !v);
          }}
          style={{
            boxShadow: '0 6px 16px -3px var(--accent-glow)',
          }}
          className="min-h-[42px] px-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-all cursor-pointer self-start sm:self-auto whitespace-nowrap btn-press"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Nova Meta
        </button>
      </header>

      {showCreateForm && (
        <form
          style={{ boxShadow: 'var(--shadow-card)' }}
          onSubmit={handleCreateGoal}
          className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4 animate-item-enter"
        >
          <h2 className="text-sm font-bold text-[var(--text)]">Criar Nova Meta</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="sm:col-span-2 space-y-1 block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Título da meta
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Entregar Lançamento v2.0"
                className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>

            <div className="space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Espaço
              </span>
              <CustomSelectDropdown
                variant="box"
                value={effectiveSpaceId}
                onChange={setSpaceId}
                options={spaceOptions}
              />
            </div>

            <div className="space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Período
              </span>
              <CustomSelectDropdown
                variant="box"
                value={period}
                onChange={(val) => setPeriod(val as GoalPeriod)}
                options={periodOptions}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2">
            <div className="space-y-1 w-full sm:w-56">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Prazo final
              </span>
              <CustomDateDropdown
                variant="box"
                value={deadline}
                onChange={(val) => setDeadline(val || currentTodayStr)}
                currentTodayStr={currentTodayStr}
                allowClear={false}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="min-h-[38px] px-3.5 rounded-full text-xs font-bold text-[var(--text-muted)] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="min-h-[38px] px-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold disabled:opacity-45 cursor-pointer btn-press"
              >
                Salvar Meta
              </button>
            </div>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="p-10 sm:p-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-3 animate-item-enter"
        >
          <Target className="w-8 h-8 text-[var(--accent-text)] mx-auto" />
          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-extrabold text-[var(--text)]">Nenhuma meta cadastrada</h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Crie metas mensais, trimestrais ou anuais e vincule tarefas para acompanhar o progresso automaticamente.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-list">
          {goals.map((goal) => {
            const prog = calculateGoalProgress(goal, tasks, currentTodayStr);
            const linkedTasks = tasks.filter((t) => !t.recurrence && t.goalId === goal.id);
            const unlinkedSpaceTasks = tasks.filter(
              (t) =>
                !t.recurrence &&
                t.spaceId === goal.spaceId &&
                t.goalId !== goal.id
            );
            const canManageGoal = can(user, 'manage_goal', { goal }, memberships);
            const org = !isPersonalSpace(goal.spaceId)
              ? organizations.find((o) => o.id === goal.spaceId)
              : null;

            const isLinking = linkingGoalId === goal.id;

            const unlinkedOptions = [
              { value: '', label: 'Escolher tarefa existente...' },
              ...unlinkedSpaceTasks.map((ut) => ({ value: ut.id, label: ut.title })),
            ];

            return (
              <article
                key={goal.id}
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent-border)] card-interactive flex flex-col justify-between gap-4"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)]">
                        <span className="font-bold text-[var(--text)]">{org ? org.name : 'Pessoal'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{periodLabels[goal.period]}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-bold ${
                            prog.state === 'completed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : prog.state === 'overdue'
                              ? 'text-rose-500'
                              : 'text-[var(--accent-text)]'
                          }`}
                        >
                          {prog.stateLabel}
                        </span>
                      </div>
                      <h2 className="text-base font-extrabold text-[var(--text)] leading-snug">
                        {goal.title}
                      </h2>
                    </div>

                    {canManageGoal && (
                      <button
                        type="button"
                        onClick={() => void deleteGoal(goal.id)}
                        aria-label={`Excluir meta ${goal.title}`}
                        className="p-2 text-[var(--text-muted)] hover:text-rose-500 rounded-lg cursor-pointer shrink-0 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`inline-flex items-center gap-1 font-bold tabular-nums ${
                        prog.daysDiff < 0 && prog.state !== 'completed'
                          ? 'text-rose-500'
                          : prog.daysDiff === 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {prog.daysDiff < 0 && prog.state !== 'completed' ? (
                        <AlertCircle className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      {prog.deadlineLabel} ({goal.deadline})
                    </span>

                    <span className="text-base font-extrabold font-mono tabular-nums text-[var(--accent-text)]">
                      {prog.percentage}%
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-label={`Progresso da meta ${goal.title}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={prog.percentage}
                    className="w-full h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden"
                  >
                    <div
                      style={{
                        width: `${prog.percentage}%`,
                        backgroundColor: 'var(--accent)',
                      }}
                      className="h-full rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] tabular-nums">
                    {prog.totalTasks === 0 ? (
                      <span className="italic">0% — vincule tarefas para calcular o progresso</span>
                    ) : (
                      <span>
                        {prog.completedTasks} de {prog.totalTasks} concluídas
                        {prog.awaitingApprovalTasks > 0
                          ? ` (${prog.awaitingApprovalTasks} aguardando aprovação)`
                          : ''}
                      </span>
                    )}
                  </div>

                  {linkedTasks.length > 0 && (
                    <ul className="space-y-1.5 pt-2 border-t border-[var(--border)]">
                      {linkedTasks.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between gap-2 text-xs py-1"
                        >
                          <button
                            type="button"
                            onClick={() => openTaskDetail(t.id)}
                            className="flex items-center gap-2 text-left min-w-0 hover:underline cursor-pointer"
                          >
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 ${
                                t.status === 'done'
                                  ? 'text-emerald-500'
                                  : t.status === 'awaiting_approval'
                                  ? 'text-amber-500'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            />
                            <span
                              className={`truncate font-semibold ${
                                t.status === 'done'
                                  ? 'line-through text-[var(--text-muted)]'
                                  : 'text-[var(--text)]'
                              }`}
                            >
                              {t.title}
                            </span>
                          </button>
                          <span className="text-[10px] font-bold text-[var(--text-muted)] shrink-0">
                            {t.status === 'done'
                              ? 'Concluída'
                              : t.status === 'awaiting_approval'
                              ? 'Em aprovação'
                              : 'Aberta'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--border)] space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkingGoalId(isLinking ? null : goal.id);
                      setExistingTaskIdToLink('');
                      setNewTaskTitleForGoal('');
                    }}
                    className="text-xs font-bold text-[var(--accent-text)] inline-flex items-center gap-1.5 hover:underline cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {isLinking ? 'Fechar vínculo de tarefas' : 'Vincular tarefa existente ou nova'}
                  </button>

                  {isLinking && (
                    <div className="p-3.5 rounded-xl bg-[var(--surface-2)] space-y-2.5 animate-item-enter">
                      {unlinkedSpaceTasks.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <CustomSelectDropdown
                              variant="box"
                              value={existingTaskIdToLink}
                              onChange={setExistingTaskIdToLink}
                              options={unlinkedOptions}
                              dropdownWidth="w-[260px]"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={!existingTaskIdToLink}
                            onClick={async () => {
                              if (!existingTaskIdToLink) return;
                              await updateTask(existingTaskIdToLink, { goalId: goal.id });
                              setExistingTaskIdToLink('');
                            }}
                            className="h-10 px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold disabled:opacity-45 cursor-pointer btn-press shrink-0"
                          >
                            Vincular
                          </button>
                        </div>
                      )}

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!newTaskTitleForGoal.trim()) return;
                          await createTask({
                            title: newTaskTitleForGoal.trim(),
                            spaceId: goal.spaceId,
                            dueDate: currentTodayStr,
                            goalId: goal.id,
                          });
                          setNewTaskTitleForGoal('');
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={newTaskTitleForGoal}
                          onChange={(e) => setNewTaskTitleForGoal(e.target.value)}
                          placeholder="Ou criar nova tarefa já vinculada..."
                          className="flex-1 h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!newTaskTitleForGoal.trim()}
                          className="h-10 px-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text)] disabled:opacity-45 cursor-pointer btn-press"
                        >
                          Criar
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};