import React, { useState } from 'react';
import {
  CalendarCheck2,
  CornerDownLeft,
  Inbox as InboxIcon,
  Plus,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { CustomDateDropdown } from '../../components/CustomDateDropdown';
import { CustomSelectDropdown } from '../../components/CustomSelectDropdown';
import { CustomTagDropdown } from '../../components/CustomTagDropdown';
import { addDaysToStr } from '../../domain/clock';
import { can } from '../../domain/permissions';
import { getPersonalSpaceId } from '../../domain/types';

export const InboxPage: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const inboxItems = useAppStore((s) => s.inboxItems);
  const organizations = useAppStore((s) => s.organizations);
  const memberships = useAppStore((s) => s.memberships);
  const membersById = useAppStore((s) => s.membersById);
  const tags = useAppStore((s) => s.tags);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);

  const addInboxItem = useAppStore((s) => s.addInboxItem);
  const deleteInboxItem = useAppStore((s) => s.deleteInboxItem);
  const triageInboxToTask = useAppStore((s) => s.triageInboxToTask);

  const [captureText, setCaptureText] = useState('');
  const [delegatingItemId, setDelegatingItemId] = useState<string | null>(null);
  const [delegateOrgId, setDelegateOrgId] = useState<string>('');
  const [delegateTagId, setDelegateTagId] = useState<string>('');
  const [delegateAssigneeId, setDelegateAssigneeId] = useState<string>('');
  const [delegateDueDate, setDelegateDueDate] = useState<string | null>(currentTodayStr);

  if (!user) return null;

  const personalSpaceId = getPersonalSpaceId(user.id);

  const handleCaptureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureText.trim()) return;
    await addInboxItem(captureText.trim());
    setCaptureText('');
  };

  const openDelegatePanel = (itemId: string) => {
    const firstOrg = organizations[0]?.id || '';
    setDelegatingItemId(delegatingItemId === itemId ? null : itemId);
    setDelegateOrgId(firstOrg);
    setDelegateTagId('');
    setDelegateAssigneeId(user.id);
    setDelegateDueDate(currentTodayStr);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
            <InboxIcon className="w-3.5 h-3.5" />
            <span>Captura & Triagem</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
            Caixa de Entrada
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Capture ideias e pendências em segundos e faça a triagem com um toque.
          </p>
        </div>

        {inboxItems.length > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text-muted)] self-start sm:self-auto shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            <span className="font-mono tabular-nums text-[var(--text)]">
              {inboxItems.length}
            </span>
            <span>{inboxItems.length === 1 ? 'item pendente' : 'itens pendentes'}</span>
          </div>
        )}
      </header>

      {/* Rapid Capture Command Input */}
      <form
        onSubmit={handleCaptureSubmit}
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="group p-2.5 sm:p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] focus-within:border-[var(--accent)] transition-all flex items-center gap-2.5"
      >
        <div className="pl-2 text-[var(--accent-text)] shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
          placeholder="Capturar ideia rápida na Inbox... (pressione Enter)"
          aria-label="Capturar item na Inbox"
          className="flex-1 h-10 px-1 bg-transparent text-sm font-semibold text-[var(--text)] placeholder:text-[var(--text-muted)]/65 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!captureText.trim()}
          style={{
            boxShadow: captureText.trim() ? '0 4px 12px -2px var(--accent-glow)' : 'none',
          }}
          className="min-h-[40px] px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all cursor-pointer shrink-0 btn-press"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Capturar</span>
          <CornerDownLeft className="w-3.5 h-3.5 opacity-75 hidden sm:inline" />
        </button>
      </form>

      {/* Inbox Items List */}
      {inboxItems.length === 0 ? (
        <div
          style={{ boxShadow: 'var(--shadow-card)' }}
          className="p-10 sm:p-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-3 animate-item-enter"
        >
          <div
            style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent-text)' }}
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center"
          >
            <InboxIcon className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-base font-extrabold text-[var(--text)]">Inbox zerada!</h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Tudo o que você capturou já foi organizado em tarefas pessoais ou delegado para sua equipe.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 stagger-list">
          {inboxItems.map((item) => {
            const isDelegating = delegatingItemId === item.id;

            const canAssignOthersInSelectedOrg =
              delegateOrgId &&
              can(user, 'assign_others', { spaceId: delegateOrgId }, memberships);

            const orgTags = tags.filter((t) => t.spaceId === delegateOrgId);
            const orgMembers = delegateOrgId
              ? memberships
                  .filter((m) => m.orgId === delegateOrgId)
                  .map((m) => membersById[m.userId])
                  .filter(Boolean)
              : [];

            const orgOptions = organizations.map((org) => ({
              value: org.id,
              label: org.name,
            }));

            const memberOptions = orgMembers.map((m) => ({
              value: m.id,
              label: m.id === user.id ? `Eu (${m.name})` : m.name,
            }));

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent-border)] card-interactive space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-semibold text-[var(--text)] leading-snug break-words">
                    {item.text}
                  </p>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-2)] text-[11px] font-mono tabular-nums font-medium text-[var(--text-muted)] shrink-0">
                    {item.createdAt.slice(0, 10)}
                  </span>
                </div>

                {/* 4 One-Tap Triage Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* 1. Hoje */}
                  <button
                    type="button"
                    onClick={() =>
                      void triageInboxToTask(item.id, {
                        title: item.text,
                        spaceId: personalSpaceId,
                        dueDate: currentTodayStr,
                        priority: 'medium',
                      })
                    }
                    className="h-9 px-3.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer btn-press"
                  >
                    <CalendarCheck2 className="w-3.5 h-3.5" />
                    Mover para Hoje
                  </button>

                  {/* 2. Agendar Direto pelo Calendário Visual */}
                  <CustomDateDropdown
                    value={addDaysToStr(currentTodayStr, 1)}
                    onChange={(selectedDate) =>
                      void triageInboxToTask(item.id, {
                        title: item.text,
                        spaceId: personalSpaceId,
                        dueDate: selectedDate,
                        priority: 'medium',
                      })
                    }
                    currentTodayStr={currentTodayStr}
                  />

                  {/* 3. Delegar */}
                  <button
                    type="button"
                    onClick={() => openDelegatePanel(item.id)}
                    className={`h-9 px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-all cursor-pointer btn-press ${
                      isDelegating
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Delegar
                  </button>

                  {/* 4. Excluir */}
                  <button
                    type="button"
                    onClick={() => void deleteInboxItem(item.id, true)}
                    aria-label="Excluir item da Inbox"
                    className="h-9 px-3.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-muted)] hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/5 inline-flex items-center gap-1.5 ml-auto transition-all cursor-pointer btn-press"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>

                {/* Quick Delegate Panel */}
                {isDelegating && (
                  <div className="p-4 rounded-2xl bg-[var(--surface-2)]/80 border border-[var(--border)] space-y-3 animate-item-enter">
                    {organizations.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">
                        Você ainda não participa de nenhuma organização. Crie uma na aba
                        Equipe para delegar tarefas.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Organização
                            </span>
                            <CustomSelectDropdown
                              variant="box"
                              value={delegateOrgId}
                              onChange={(val) => {
                                setDelegateOrgId(val);
                                setDelegateTagId('');
                                setDelegateAssigneeId(user.id);
                              }}
                              options={orgOptions}
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Projeto / Tag
                            </span>
                            <CustomTagDropdown
                              variant="box"
                              value={delegateTagId}
                              onChange={setDelegateTagId}
                              spaceId={delegateOrgId}
                              availableTags={orgTags}
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Responsável
                            </span>
                            <CustomSelectDropdown
                              variant="box"
                              disabled={!canAssignOthersInSelectedOrg}
                              value={canAssignOthersInSelectedOrg ? delegateAssigneeId : user.id}
                              onChange={setDelegateAssigneeId}
                              options={memberOptions}
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              Data (opcional)
                            </span>
                            <CustomDateDropdown
                              variant="box"
                              value={delegateDueDate}
                              onChange={setDelegateDueDate}
                              currentTodayStr={currentTodayStr}
                              align="right"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {canAssignOthersInSelectedOrg
                              ? 'Como Admin, você pode delegar para qualquer membro.'
                              : 'Como Membro, a tarefa será atribuída a você.'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void triageInboxToTask(item.id, {
                                title: item.text,
                                spaceId: delegateOrgId,
                                tagIds: delegateTagId ? [delegateTagId] : [],
                                assigneeId: canAssignOthersInSelectedOrg
                                  ? delegateAssigneeId
                                  : user.id,
                                dueDate: delegateDueDate || null,
                                priority: 'medium',
                              })
                            }
                            className="h-9 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold hover:bg-[var(--accent-hover)] cursor-pointer whitespace-nowrap btn-press"
                          >
                            Confirmar delegação
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};