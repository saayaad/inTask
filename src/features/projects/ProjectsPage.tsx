import React, { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Kanban as KanbanIcon,
  Plus,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { PriorityLabel } from '../../components/PriorityBadge';
import { TaskRow } from '../../components/TaskRow';
import {
  addDaysToStr,
  formatShortPtDate,
  formatWeekdayShort,
  getWeekDaysMondayToSunday,
  isWithinLastDays,
} from '../../domain/clock';
import { can } from '../../domain/permissions';
import { isRecurringCompletedOnDate, recurrenceAppliesOnDate } from '../../domain/recurrence';
import { getPersonalSpaceId, Task, TaskStatus } from '../../domain/types';

interface DraggableTaskCardProps {
  task: Task;
  dragId: string;
  onClick: () => void;
  onMovePrev?: () => void;
  onMoveNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  dateContextStr?: string;
}

const DraggableTaskCard: React.FC<DraggableTaskCardProps> = ({
  task,
  dragId,
  onClick,
  onMovePrev,
  onMoveNext,
  prevLabel,
  nextLabel,
  dateContextStr,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { task },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.65 : 1,
    zIndex: isDragging ? 40 : undefined,
  };

  const isRoutine = Boolean(task.recurrence);
  const completed =
    isRoutine && dateContextStr
      ? isRecurringCompletedOnDate(task, dateContextStr)
      : task.status === 'done' || task.status === 'awaiting_approval';

  const priorityAccentClass =
    task.priority === 'high'
      ? 'before:bg-rose-500'
      : task.priority === 'medium'
      ? 'before:bg-amber-500'
      : 'before:bg-sky-500';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent-border)] card-interactive space-y-2 before:content-[''] before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-r-full ${priorityAccentClass} ${
        isDragging ? 'scale-[1.03] ring-2 ring-[var(--accent)]' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {!isRoutine && (
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`Arrastar tarefa ${task.title}`}
            className="mt-0.5 p-1 -ml-1 text-[var(--text-muted)]/60 hover:text-[var(--text)] cursor-grab active:cursor-grabbing shrink-0 transition-colors"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={onClick}
          className="flex-1 text-left min-w-0 space-y-2 cursor-pointer"
        >
          <p
            className={`text-xs font-bold leading-snug break-words transition-colors ${
              completed
                ? 'line-through text-[var(--text-muted)]'
                : 'text-[var(--text)] group-hover:text-[var(--accent-text)]'
            }`}
          >
            {task.title}
          </p>
          <div className="flex items-center justify-between gap-1">
            <PriorityLabel priority={task.priority} />
            {task.subtasks.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[10px] font-mono font-bold tabular-nums text-[var(--text-muted)]">
                {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {!isRoutine && (onMovePrev || onMoveNext) && (
        <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-[var(--border)]/60">
          {onMovePrev && (
            <button
              type="button"
              onClick={onMovePrev}
              title={prevLabel || 'Mover para trás'}
              aria-label={prevLabel || 'Mover para trás'}
              className="h-6 px-2 rounded-lg bg-[var(--surface-2)] text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] inline-flex items-center gap-0.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
            </button>
          )}
          {onMoveNext && (
            <button
              type="button"
              onClick={onMoveNext}
              title={nextLabel || 'Mover para frente'}
              aria-label={nextLabel || 'Mover para frente'}
              className="h-6 px-2 rounded-lg bg-[var(--surface-2)] text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] inline-flex items-center gap-0.5 cursor-pointer transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const DroppableColumn: React.FC<{
  id: string;
  children: React.ReactNode;
  className?: string;
}> = ({ id, children, className = '' }) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-all duration-200 ${
        isOver ? 'ring-2 ring-[var(--accent)] bg-[var(--accent-soft)]/40 scale-[1.005]' : ''
      }`}
    >
      {children}
    </div>
  );
};

export const ProjectsPage: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const tasks = useAppStore((s) => s.tasks);
  const tags = useAppStore((s) => s.tags);
  const organizations = useAppStore((s) => s.organizations);
  const memberships = useAppStore((s) => s.memberships);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);

  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const updateTask = useAppStore((s) => s.updateTask);
  const openTaskDetail = useAppStore((s) => s.openTaskDetail);
  const openQuickAdd = useAppStore((s) => s.openQuickAdd);
  const showToast = useAppStore((s) => s.showToast);

  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [weekRefDateStr, setWeekRefDateStr] = useState<string>(currentTodayStr);
  const [mobileSelectedDay, setMobileSelectedDay] = useState<string>(currentTodayStr);

  useEffect(() => {
    setWeekRefDateStr(currentTodayStr);
    setMobileSelectedDay(currentTodayStr);
  }, [currentTodayStr]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  if (!user) return null;

  const viewMode = user.preferences.projectsViewMode || 'week';
  const personalSpaceId = getPersonalSpaceId(user.id);

  const filterOptions: { id: string; label: string; type: 'all' | 'space' | 'tag' }[] = [
    { id: 'all', label: 'Todas', type: 'all' },
    { id: `space:${personalSpaceId}`, label: 'Pessoal', type: 'space' },
    ...tags.map((tg) => ({
      id: `tag:${tg.id}`,
      label: `#${tg.name}`,
      type: 'tag' as const,
    })),
    ...organizations.map((org) => ({
      id: `space:${org.id}`,
      label: org.name,
      type: 'space' as const,
    })),
  ];

  const effectiveFilter = filterOptions.some((opt) => opt.id === selectedFilter)
    ? selectedFilter
    : 'all';

  const filteredTasks = tasks.filter((task) => {
    if (effectiveFilter === 'all') return true;
    if (effectiveFilter.startsWith('space:')) {
      return task.spaceId === effectiveFilter.slice(6);
    }
    if (effectiveFilter.startsWith('tag:')) {
      return task.tagIds.includes(effectiveFilter.slice(4));
    }
    return true;
  });

  const weekDays = getWeekDaysMondayToSunday(weekRefDateStr);

  const getTasksForDay = (dayStr: string): Task[] => {
    return filteredTasks.filter((t) => {
      if (t.recurrence) {
        return recurrenceAppliesOnDate(t, dayStr);
      }
      return t.dueDate === dayStr;
    });
  };

  const handleWeekDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const targetDayStr = String(over.id);
    const draggedTask = active.data.current?.task as Task | undefined;
    if (!draggedTask || draggedTask.recurrence) return;
    if (draggedTask.dueDate !== targetDayStr) {
      void updateTask(draggedTask.id, { dueDate: targetDayStr });
    }
  };

  const handleKanbanDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const nextStatus = String(over.id) as TaskStatus;
    const draggedTask = active.data.current?.task as Task | undefined;
    if (!draggedTask || draggedTask.status === nextStatus) return;

    if (
      draggedTask.status === 'awaiting_approval' &&
      (nextStatus === 'done' || nextStatus === 'doing') &&
      !can(user, 'review_approval', { task: draggedTask }, memberships)
    ) {
      showToast({
        message: 'Apenas o Admin pode aprovar ou devolver tarefas da coluna Aguardando Aprovação.',
        type: 'error',
      });
      return;
    }

    void updateTask(draggedTask.id, { status: nextStatus });
  };

  const kanbanColumns: { id: TaskStatus; title: string; dotClass: string }[] = [
    { id: 'todo', title: 'A Fazer', dotClass: 'bg-slate-400' },
    { id: 'doing', title: 'Em Andamento', dotClass: 'bg-sky-500' },
    { id: 'awaiting_approval', title: 'Aguardando Aprovação', dotClass: 'bg-amber-500' },
    { id: 'done', title: 'Concluído (7 dias)', dotClass: 'bg-emerald-500' },
  ];

  const kanbanTasks = filteredTasks.filter((t) => {
    if (t.recurrence) return false;
    if (t.status === 'done') {
      return isWithinLastDays(t.completedAt || t.updatedAt, 7, currentTodayStr);
    }
    return true;
  });

  const resolvedDefaultSpace = effectiveFilter.startsWith('space:')
    ? effectiveFilter.slice(6)
    : personalSpaceId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
              <KanbanIcon className="w-3.5 h-3.5" />
              <span>Fluxo & Calendário</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
              Projetos e Planejamento
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Planeje a semana de segunda a domingo ou gerencie o fluxo completo no Kanban.
            </p>
          </div>

          <div
            style={{ boxShadow: 'var(--shadow-xs)' }}
            className="inline-flex items-center p-1 rounded-2xl bg-[var(--surface)] border border-[var(--border)] self-start sm:self-auto"
            role="group"
            aria-label="Modo de visualização"
          >
            <button
              type="button"
              onClick={() => void updatePreferences({ projectsViewMode: 'week' })}
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap btn-press ${
                viewMode === 'week'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Semana
            </button>
            <button
              type="button"
              onClick={() => void updatePreferences({ projectsViewMode: 'kanban' })}
              className={`min-h-[36px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap btn-press ${
                viewMode === 'kanban'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <KanbanIcon className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
          role="tablist"
          aria-label="Filtrar por tag ou organização"
        >
          {filterOptions.map((opt) => {
            const active = effectiveFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedFilter(opt.id)}
                className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer btn-press ${
                  active
                    ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs'
                    : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--accent-border)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* VIEW 1: SEMANA */}
      {viewMode === 'week' && (
        <div key={`week_${effectiveFilter}_${weekRefDateStr}`} className="space-y-4 animate-item-enter">
          <div
            style={{ boxShadow: 'var(--shadow-card)' }}
            className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]"
          >
            <span className="text-xs sm:text-sm font-extrabold text-[var(--text)] tabular-nums">
              Semana: {formatShortPtDate(weekDays[0])} a {formatShortPtDate(weekDays[6])}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const prev = addDaysToStr(weekRefDateStr, -7);
                  setWeekRefDateStr(prev);
                  setMobileSelectedDay(prev);
                }}
                aria-label="Semana anterior"
                className="h-9 w-9 rounded-xl bg-[var(--surface-2)] flex items-center justify-center text-[var(--text)] hover:border-[var(--accent)] border border-[var(--border)] cursor-pointer transition-colors btn-press"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setWeekRefDateStr(currentTodayStr);
                  setMobileSelectedDay(currentTodayStr);
                }}
                className="h-9 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] cursor-pointer transition-colors btn-press"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = addDaysToStr(weekRefDateStr, 7);
                  setWeekRefDateStr(next);
                  setMobileSelectedDay(next);
                }}
                aria-label="Próxima semana"
                className="h-9 w-9 rounded-xl bg-[var(--surface-2)] flex items-center justify-center text-[var(--text)] hover:border-[var(--accent)] border border-[var(--border)] cursor-pointer transition-colors btn-press"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MOBILE WEEK VIEW (<1024px) */}
          <div className="lg:hidden space-y-4">
            <div
              style={{ boxShadow: 'var(--shadow-card)' }}
              className="grid grid-cols-7 gap-1 p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)]"
            >
              {weekDays.map((dayStr) => {
                const isSelected = mobileSelectedDay === dayStr;
                const isToday = dayStr === currentTodayStr;
                const count = getTasksForDay(dayStr).length;
                return (
                  <button
                    key={dayStr}
                    type="button"
                    onClick={() => setMobileSelectedDay(dayStr)}
                    className={`min-h-[60px] rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer btn-press ${
                      isSelected
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] font-bold shadow-xs'
                        : isToday
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-bold'
                        : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold">
                      {formatWeekdayShort(dayStr)}
                    </span>
                    <span className="text-sm font-mono tabular-nums">{dayStr.slice(8, 10)}</span>
                    <span className="text-[10px] font-mono tabular-nums opacity-80">
                      {count > 0 ? `${count}` : '·'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div key={mobileSelectedDay} className="space-y-2.5 animate-item-enter">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-extrabold text-[var(--text)]">
                  {formatShortPtDate(mobileSelectedDay)}
                  {mobileSelectedDay === currentTodayStr ? ' (Hoje)' : ''}
                </h2>
                <button
                  type="button"
                  onClick={() => openQuickAdd(resolvedDefaultSpace, mobileSelectedDay)}
                  className="h-9 px-3.5 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors btn-press"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  Adicionar neste dia
                </button>
              </div>

              {getTasksForDay(mobileSelectedDay).length === 0 ? (
                <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
                  Nenhuma tarefa agendada para este dia.
                </div>
              ) : (
                <div className="space-y-2 stagger-list">
                  {getTasksForDay(mobileSelectedDay).map((t) => (
                    <TaskRow key={t.id} task={t} dateContextStr={mobileSelectedDay} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* DESKTOP WEEK VIEW (>=1024px) */}
          <div className="hidden lg:block">
            <DndContext sensors={sensors} onDragEnd={handleWeekDragEnd}>
              <div className="grid grid-cols-7 gap-2.5 items-stretch stagger-list">
                {weekDays.map((dayStr, dayIndex) => {
                  const isToday = dayStr === currentTodayStr;
                  const dayTasks = getTasksForDay(dayStr);

                  return (
                    <DroppableColumn
                      key={dayStr}
                      id={dayStr}
                      className={`min-h-[440px] p-2.5 rounded-2xl border flex flex-col justify-between gap-2 ${
                        isToday
                          ? 'bg-[var(--accent-soft)]/25 border-[var(--accent)] shadow-xs'
                          : 'bg-[var(--surface-2)]/55 border-[var(--border)]'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1 pb-2 border-b border-[var(--border)]">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              {formatWeekdayShort(dayStr)}
                            </p>
                            <p
                              className={`text-sm font-extrabold font-mono tabular-nums ${
                                isToday ? 'text-[var(--accent-text)]' : 'text-[var(--text)]'
                              }`}
                            >
                              {dayStr.slice(8, 10)}/{dayStr.slice(5, 7)}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)]/60 text-[10px] font-mono tabular-nums font-bold text-[var(--text-muted)]">
                            {dayTasks.length}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {dayTasks.map((t) => (
                            <DraggableTaskCard
                              key={`${t.id}_${dayStr}`}
                              dragId={`${t.id}_${dayStr}`}
                              task={t}
                              dateContextStr={dayStr}
                              onClick={() => openTaskDetail(t.id)}
                              onMovePrev={
                                !t.recurrence && dayIndex > 0
                                  ? () =>
                                      void updateTask(t.id, {
                                        dueDate: weekDays[dayIndex - 1],
                                      })
                                  : undefined
                              }
                              onMoveNext={
                                !t.recurrence && dayIndex < 6
                                  ? () =>
                                      void updateTask(t.id, {
                                        dueDate: weekDays[dayIndex + 1],
                                      })
                                  : undefined
                              }
                              prevLabel="Mover para o dia anterior"
                              nextLabel="Mover para o próximo dia"
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openQuickAdd(resolvedDefaultSpace, dayStr)}
                        className="w-full min-h-[36px] px-2 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--surface)]/60 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        adicionar
                      </button>
                    </DroppableColumn>
                  );
                })}
              </div>
            </DndContext>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN */}
      {viewMode === 'kanban' && (
        <DndContext sensors={sensors} onDragEnd={handleKanbanDragEnd}>
          <div
            key={`kanban_${effectiveFilter}`}
            className="flex flex-col lg:grid lg:grid-cols-4 gap-4 stagger-list"
          >
            {kanbanColumns.map((col, colIndex) => {
              const colTasks = kanbanTasks.filter((t) => t.status === col.id);

              return (
                <DroppableColumn
                  key={col.id}
                  id={col.id}
                  className="min-h-[220px] lg:min-h-[480px] p-3.5 rounded-2xl bg-[var(--surface-2)]/65 border border-[var(--border)] flex flex-col justify-between gap-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1 pb-2.5 border-b border-[var(--border)]">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${col.dotClass}`} />
                        <h2 className="text-xs font-extrabold uppercase tracking-wider text-[var(--text)]">
                          {col.title}
                        </h2>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)]/60 text-xs font-mono tabular-nums font-bold text-[var(--text-muted)]">
                        {colTasks.length}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {colTasks.length === 0 ? (
                        <p className="py-8 text-center text-xs text-[var(--text-muted)]">
                          Nenhuma tarefa nesta etapa.
                        </p>
                      ) : (
                        colTasks.map((t) => (
                          <DraggableTaskCard
                            key={t.id}
                            dragId={t.id}
                            task={t}
                            onClick={() => openTaskDetail(t.id)}
                            onMovePrev={
                              colIndex > 0
                                ? () =>
                                    void updateTask(t.id, {
                                      status: kanbanColumns[colIndex - 1].id,
                                    })
                                : undefined
                            }
                            onMoveNext={
                              colIndex < kanbanColumns.length - 1
                                ? () =>
                                    void updateTask(t.id, {
                                      status: kanbanColumns[colIndex + 1].id,
                                    })
                                : undefined
                            }
                            prevLabel="Mover para coluna anterior"
                            nextLabel="Mover para próxima coluna"
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {col.id === 'todo' && (
                    <button
                      type="button"
                      onClick={() => openQuickAdd(resolvedDefaultSpace, null)}
                      className="w-full min-h-[38px] px-3 rounded-xl border border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--surface)]/60 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--accent-text)] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      Adicionar tarefa sem data
                    </button>
                  )}
                </DroppableColumn>
              );
            })}
          </div>
        </DndContext>
      )}
    </div>
  );
};