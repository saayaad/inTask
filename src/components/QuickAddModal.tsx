import React, { useEffect, useRef, useState } from 'react';
import {
  CornerDownLeft,
  Folder,
  Plus,
  Sparkles,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAppStore } from '../app/store';
import { can } from '../domain/permissions';
import { getPersonalSpaceId, isPersonalSpace, Priority } from '../domain/types';
import { CustomDateDropdown } from './CustomDateDropdown';
import { CustomSelectDropdown } from './CustomSelectDropdown';
import { CustomTagDropdown } from './CustomTagDropdown';
import { PRIORITY_META } from './PriorityBadge';

export const QuickAddModal: React.FC = () => {
  const isOpen = useAppStore((s) => s.isQuickAddOpen);
  const closeQuickAdd = useAppStore((s) => s.closeQuickAdd);
  const user = useAppStore((s) => s.user);
  const organizations = useAppStore((s) => s.organizations);
  const memberships = useAppStore((s) => s.memberships);
  const membersById = useAppStore((s) => s.membersById);
  const tags = useAppStore((s) => s.tags);
  const selectedTodaySpace = useAppStore((s) => s.selectedTodaySpace);
  const quickAddDefaultSpace = useAppStore((s) => s.quickAddDefaultSpace);
  const quickAddDefaultDate = useAppStore((s) => s.quickAddDefaultDate);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);
  const createTask = useAppStore((s) => s.createTask);
  const showToast = useAppStore((s) => s.showToast);

  const inputRef = useRef<HTMLInputElement>(null);

  const personalSpaceId = user ? getPersonalSpaceId(user.id) : '';
  const initialSpace =
    quickAddDefaultSpace ||
    (selectedTodaySpace && selectedTodaySpace !== 'all' ? selectedTodaySpace : personalSpaceId);

  const [title, setTitle] = useState('');
  const [spaceId, setSpaceId] = useState(initialSpace);
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState<string | null>(
    quickAddDefaultDate !== undefined ? quickAddDefaultDate : currentTodayStr
  );
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState<string>(user?.id || '');
  const [addedCount, setAddedCount] = useState(0);

  useEffect(() => {
    if (isOpen && user) {
      const resolvedSpace =
        quickAddDefaultSpace ||
        (selectedTodaySpace && selectedTodaySpace !== 'all'
          ? selectedTodaySpace
          : getPersonalSpaceId(user.id));
      setSpaceId(resolvedSpace);
      setPriority('medium');
      setDueDate(quickAddDefaultDate !== undefined ? quickAddDefaultDate : currentTodayStr);
      setSelectedTagId('');
      setAssigneeId(user.id);
      setAddedCount(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    }
  }, [isOpen, user, quickAddDefaultSpace, quickAddDefaultDate, selectedTodaySpace, currentTodayStr]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeQuickAdd();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeQuickAdd]);

  if (!isOpen || !user) return null;

  const availableTags = tags.filter((t) => t.spaceId === spaceId);
  const isOrgSpace = !isPersonalSpace(spaceId);
  const canAssignOthers = isOrgSpace && can(user, 'assign_others', { spaceId }, memberships);
  const orgMembers = isOrgSpace
    ? memberships
        .filter((m) => m.orgId === spaceId)
        .map((m) => membersById[m.userId])
        .filter(Boolean)
    : [];

  const handleSpaceChange = (nextSpace: string) => {
    setSpaceId(nextSpace);
    setSelectedTagId('');
    setAssigneeId(user.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;

    await createTask({
      title: clean,
      spaceId,
      priority,
      dueDate,
      tagIds: selectedTagId ? [selectedTagId] : [],
      assigneeId: isOrgSpace ? assigneeId : user.id,
    });

    setTitle('');
    setAddedCount((c) => c + 1);
    showToast({
      message: 'Tarefa adicionada! Pressione Enter para adicionar outra ou Esc para fechar.',
      type: 'success',
    });
    inputRef.current?.focus();
  };

  const spaceOptions = [
    { value: personalSpaceId, label: 'Pessoal' },
    ...organizations.map((org) => ({ value: org.id, label: org.name })),
  ];

  const memberOptions = orgMembers.map((m) => ({
    value: m.id,
    label: m.id === user.id ? `Eu (${m.name})` : m.name,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-start sm:pt-[13vh] justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4 animate-backdrop"
      onClick={closeQuickAdd}
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar tarefa rápida"
    >
      {/* Sem overflow-hidden aqui para permitir que os menus flutuantes e o calendário abram livremente */}
      <div
        style={{ boxShadow: 'var(--shadow-elevated)' }}
        className="w-full sm:max-w-xl bg-[var(--surface)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-3xl pb-safe animate-modal-up relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[var(--border)] rounded-full mx-auto mt-3 sm:hidden" />

        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Captura Rápida
            </span>
            {addedCount > 0 && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold tabular-nums animate-pop-in">
                · {addedCount} {addedCount === 1 ? 'criada agora' : 'criadas agora'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeQuickAdd}
            aria-label="Fechar captura rápida"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Main Command Input */}
          <div className="px-5 pt-2 pb-4">
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="O que precisa ser feito? (Enter salva e continua)"
              aria-label="Título da nova tarefa"
              className="w-full bg-transparent text-[var(--text)] placeholder:text-[var(--text-muted)]/50 text-lg sm:text-xl font-extrabold tracking-tight focus:outline-none"
            />
          </div>

          {/* Adjustment Pills Bar (100% Custom Popovers) */}
          <div className="px-5 pb-5 flex flex-wrap items-center gap-2.5">
            {/* 1. Space Selector */}
            <CustomSelectDropdown
              value={spaceId}
              onChange={handleSpaceChange}
              options={spaceOptions}
              icon={<Folder className="w-3.5 h-3.5" />}
            />

            {/* 2. Priority Selector */}
            <div
              className="inline-flex items-center rounded-full bg-[var(--surface-2)] border border-[var(--border)] p-1 shadow-2xs"
              role="group"
              aria-label="Prioridade"
            >
              {(['high', 'medium', 'low'] as Priority[]).map((p) => {
                const active = priority === p;
                const meta = PRIORITY_META[p];
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`h-7 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer btn-press ${
                      active
                        ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs border border-[var(--border)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)] border border-transparent'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 3. Full Visual Calendar Dropdown */}
            <CustomDateDropdown
              value={dueDate}
              onChange={setDueDate}
              currentTodayStr={currentTodayStr}
              align="right"
            />

            {/* 4. Searchable & Creatable Tag Dropdown */}
            <CustomTagDropdown
              value={selectedTagId}
              onChange={setSelectedTagId}
              spaceId={spaceId}
              availableTags={availableTags}
            />

            {/* 5. Assignee Selector */}
            {canAssignOthers && orgMembers.length > 1 && (
              <CustomSelectDropdown
                value={assigneeId}
                onChange={setAssigneeId}
                options={memberOptions}
                icon={<UserIcon className="w-3.5 h-3.5" />}
              />
            )}
          </div>

          {/* Command Footer */}
          <div className="px-5 py-3.5 bg-[var(--surface-2)]/60 border-t border-[var(--border)] rounded-b-none sm:rounded-b-3xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] font-medium">
              <span className="inline-flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px] text-[var(--text)] shadow-2xs">
                  Enter
                </kbd>
                <span>salvar</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--surface)] border border-[var(--border)] font-mono text-[10px] text-[var(--text)] shadow-2xs">
                  Esc
                </kbd>
                <span>fechar</span>
              </span>
            </div>

            <button
              type="submit"
              disabled={!title.trim()}
              style={{
                boxShadow: title.trim() ? '0 6px 16px -3px var(--accent-glow)' : 'none',
              }}
              className="min-h-[42px] px-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-sm font-bold inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap btn-press"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Adicionar</span>
              <CornerDownLeft className="w-3.5 h-3.5 opacity-75 ml-0.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};