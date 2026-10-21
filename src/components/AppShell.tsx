import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Kanban,
  LogOut,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Tag as TagIcon,
  Target,
  X,
} from 'lucide-react';
import { useAppStore } from '../app/store';
import { can, canAccessTabInSpace } from '../domain/permissions';
import { AppAreaTab, getPersonalSpaceId } from '../domain/types';
import { CustomSelectDropdown, SelectOption } from './CustomSelectDropdown';
import { Logo } from './Logo';
import { QuickAddModal } from './QuickAddModal';
import { TaskDetailSheet } from './task-detail/TaskDetailSheet';
import { WelcomeModal } from './WelcomeModal'; // <-- Importado aqui

export const AppShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const user = useAppStore((s) => s.user);
  const inboxItems = useAppStore((s) => s.inboxItems);
  const tasks = useAppStore((s) => s.tasks);
  const memberships = useAppStore((s) => s.memberships);
  const organizations = useAppStore((s) => s.organizations);
  const simulatedOffsetDays = useAppStore((s) => s.simulatedOffsetDays);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);
  const storageWarning = useAppStore((s) => s.storageWarning);
  const toast = useAppStore((s) => s.toast);

  const selectedTodaySpace = useAppStore((s) => s.selectedTodaySpace);
  const setSelectedTodaySpace = useAppStore((s) => s.setSelectedTodaySpace);

  const openQuickAdd = useAppStore((s) => s.openQuickAdd);
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const logout = useAppStore((s) => s.logout);
  const checkDayRollover = useAppStore((s) => s.checkDayRollover);
  const resetSimulatedClock = useAppStore((s) => s.resetSimulatedClock);
  const dismissToast = useAppStore((s) => s.dismissToast);
  const dismissStorageWarning = useAppStore((s) => s.dismissStorageWarning);

  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const sidebarCollapsed = Boolean(user?.preferences.sidebarCollapsed);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        openQuickAdd();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openQuickAdd]);

  useEffect(() => {
    const onFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkDayRollover();
      }
    };
    window.addEventListener('focus', onFocusOrVisibility);
    document.addEventListener('visibilitychange', onFocusOrVisibility);
    const interval = setInterval(() => {
      void checkDayRollover();
    }, 60_000);

    return () => {
      window.removeEventListener('focus', onFocusOrVisibility);
      document.removeEventListener('visibilitychange', onFocusOrVisibility);
      clearInterval(interval);
    };
  }, [checkDayRollover]);

  if (!user) return null;

  const pendingApprovalsCount = tasks.filter(
    (t) =>
      t.status === 'awaiting_approval' &&
      can(user, 'review_approval', { task: t }, memberships)
  ).length;

  const personalSpaceId = getPersonalSpaceId(user.id);

  const allNavItems: { to: string; tabId: AppAreaTab; label: string; icon: typeof CalendarCheck2; badge: number }[] = [
    { to: '/hoje', tabId: 'hoje', label: 'Hoje', icon: CalendarCheck2, badge: 0 },
    { to: '/inbox', tabId: 'inbox', label: 'Caixa de Entrada', icon: Inbox, badge: inboxItems.length },
    { to: '/projetos', tabId: 'projetos', label: 'Projetos', icon: Kanban, badge: 0 },
    { to: '/organizacoes', tabId: 'organizacoes', label: 'Equipe', icon: Building2, badge: pendingApprovalsCount },
    { to: '/metas', tabId: 'metas', label: 'Metas', icon: Target, badge: 0 },
    { to: '/tags', tabId: 'tags', label: 'Tags', icon: TagIcon, badge: 0 },
  ];

  // Filter accessible tabs based on space permissions
  const navItems = allNavItems.filter((item) =>
    canAccessTabInSpace(user.id, selectedTodaySpace, item.tabId, memberships)
  );

  const personalSpaceName = user.preferences.personalSpaceName || 'Pessoal';
  const personalSpaceIcon = user.preferences.personalSpaceIcon || '👤';

  const spaceOptions: SelectOption[] = [
    { value: 'all', label: 'Todos os Espaços', dotColor: '#3b82f6' },
    { value: personalSpaceId, label: personalSpaceName, dotColor: 'var(--accent)' },
    ...organizations.map((org) => ({
      value: org.id,
      label: org.name,
      dotColor: org.color || '#7c3aed',
    })),
  ];

  const currentSelectedSpaceObj = spaceOptions.find((o) => o.value === selectedTodaySpace);
  const currentSpaceLabel = currentSelectedSpaceObj ? currentSelectedSpaceObj.label : 'Espaços';

  let currentSpaceIconElem = <span className="text-sm">🌐</span>;
  if (selectedTodaySpace === personalSpaceId) {
    currentSpaceIconElem = <span className="text-sm">{personalSpaceIcon}</span>;
  } else if (selectedTodaySpace !== 'all') {
    const foundOrg = organizations.find((o) => o.id === selectedTodaySpace);
    if (foundOrg?.icon) {
      currentSpaceIconElem = <span className="text-sm">{foundOrg.icon}</span>;
    }
  }

  const initials = user.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg)] text-[var(--text)] overflow-x-hidden selection:bg-[var(--accent-soft)] selection:text-[var(--accent-text)]">
      {/* Tablet & Desktop Left Sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-[var(--surface)] border-r border-[var(--border)] sticky top-0 h-screen z-30 transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:w-[78px] ${
          sidebarCollapsed ? 'lg:w-[78px]' : 'lg:w-[260px]'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[var(--border)]/80">
          <NavLink
            to="/hoje"
            className="flex items-center gap-3 overflow-hidden group"
            title="In Task — Ir para Hoje"
          >
            <Logo size={32} showWordmark={false} />
            <div
              className={`hidden ${
                sidebarCollapsed ? 'lg:hidden' : 'lg:flex'
              } flex-col min-w-0`}
            >
              <span className="font-extrabold text-[16px] tracking-tight text-[var(--text)] leading-none whitespace-nowrap">
                In Task
              </span>
              <span className="text-[10px] font-semibold text-[var(--text-muted)] tracking-wider uppercase mt-0.5">
                Workspace
              </span>
            </div>
          </NavLink>

          <button
            type="button"
            onClick={() => void updatePreferences({ sidebarCollapsed: !sidebarCollapsed })}
            aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-all cursor-pointer btn-press"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Quick Capture CTA Button */}
        <div className="p-3.5">
          <button
            type="button"
            onClick={() => openQuickAdd()}
            title="Captura Rápida (Atalho: Q)"
            style={{
              boxShadow: '0 6px 16px -3px var(--accent-glow)',
            }}
            className="w-full min-h-[44px] px-3.5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-bold text-xs flex items-center justify-center lg:justify-between gap-2 hover:bg-[var(--accent-hover)] transition-all cursor-pointer btn-press group"
          >
            <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
              <Plus className="w-4 h-4 stroke-[2.75] shrink-0 transition-transform duration-200 group-hover:rotate-90" />
              <span className={`hidden ${sidebarCollapsed ? 'lg:hidden' : 'lg:inline'}`}>
                Nova Tarefa
              </span>
            </span>
            <kbd
              className={`hidden ${
                sidebarCollapsed ? 'lg:hidden' : 'lg:inline-block'
              } px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-md bg-black/20 text-[var(--on-accent)] border border-white/15`}
            >
              Q
            </kbd>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" aria-label="Menu principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  `group relative min-h-[42px] px-3 rounded-xl flex items-center justify-center lg:justify-between gap-3 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-bold shadow-2xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]/70'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[var(--accent)]"
                      />
                    )}
                    <span className="inline-flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                          isActive ? 'text-[var(--accent-text)]' : ''
                        }`}
                      />
                      <span
                        className={`truncate hidden ${
                          sidebarCollapsed ? 'lg:hidden' : 'lg:inline'
                        }`}
                      >
                        {item.label}
                      </span>
                    </span>
                    {item.badge > 0 && (
                      <span
                        className={`px-2 py-0.5 text-[11px] font-mono tabular-nums font-bold rounded-full bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs hidden ${
                          sidebarCollapsed ? 'lg:hidden' : 'lg:inline-block'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Settings Link */}
        <div className="p-3 border-t border-[var(--border)]/80 space-y-1">
          <NavLink
            to="/configuracoes"
            title="Configurações"
            className={({ isActive }) =>
              `group relative min-h-[42px] px-3 rounded-xl flex items-center justify-center lg:justify-start gap-3 text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]/70'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[var(--accent)]"
                  />
                )}
                <Settings className="w-[18px] h-[18px] shrink-0 transition-transform duration-300 group-hover:rotate-45" />
                <span className={`truncate hidden ${sidebarCollapsed ? 'lg:hidden' : 'lg:inline'}`}>
                  Configurações
                </span>
              </>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Glass Header */}
        <header className="sticky top-0 z-20 h-14 px-4 sm:px-6 glass-panel border-b border-[var(--border)]/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden">
              <Logo size={28} showWordmark={false} />
            </div>

            {/* Global Space Selector Custom Dropdown */}
            <CustomSelectDropdown
              value={selectedTodaySpace}
              onChange={setSelectedTodaySpace}
              options={spaceOptions}
              icon={currentSpaceIconElem}
              dropdownWidth="w-[240px]"
            />

            <button
              type="button"
              onClick={() => openQuickAdd()}
              className="hidden sm:inline-flex items-center gap-2.5 h-9 px-3.5 rounded-full bg-[var(--surface-2)]/80 hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              <span>Captura rápida de tarefa...</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]">
                Q
              </kbd>
            </button>

            {simulatedOffsetDays !== 0 && (
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-medium animate-pop-in">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-mono tabular-nums">
                  Simulado: {currentTodayStr} (+{simulatedOffsetDays}d)
                </span>
                <button
                  type="button"
                  onClick={() => void resetSimulatedClock()}
                  className="underline font-bold hover:opacity-80 cursor-pointer ml-1 whitespace-nowrap"
                >
                  Restaurar
                </button>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAccountMenu((v) => !v)}
              aria-label="Conta e configurações"
              aria-expanded={showAccountMenu}
              className="min-h-[40px] px-2.5 py-1 rounded-xl hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border)] flex items-center gap-2.5 transition-all cursor-pointer btn-press"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 shadow-2xs"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--on-accent)',
                }}
              >
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-[var(--text)] leading-tight truncate max-w-[140px]">
                  {user.name}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] leading-tight truncate max-w-[140px]">
                  {user.email}
                </p>
              </div>
            </button>

            {showAccountMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowAccountMenu(false)}
                />
                <div
                  style={{ boxShadow: 'var(--shadow-elevated)' }}
                  className="absolute right-0 top-12 z-40 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-2 space-y-1 animate-pop-in"
                >
                  <div className="px-3 py-2.5 border-b border-[var(--border)]">
                    <p className="text-xs font-bold text-[var(--text)] truncate">
                      {user.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">{user.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false);
                      navigate('/configuracoes');
                    }}
                    className="w-full min-h-[38px] px-3 rounded-xl text-left text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                    Configurações, Tema e Backup
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false);
                      void logout();
                      navigate('/auth');
                    }}
                    className="w-full min-h-[38px] px-3 rounded-xl text-left text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da conta
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {storageWarning && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-600 dark:text-amber-400 animate-item-enter">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{storageWarning}</span>
            </div>
            <button
              type="button"
              onClick={dismissStorageWarning}
              className="p-1 hover:opacity-75 cursor-pointer"
              aria-label="Dispensar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-36 md:pb-14">
          <div key={location.pathname} className="animate-page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Floating Action Button */}
      {location.pathname !== '/inbox' && (
        <button
          type="button"
          onClick={() => openQuickAdd()}
          aria-label="Adicionar tarefa rápida"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--on-accent)',
            boxShadow: '0 8px 24px -4px var(--accent-glow)',
          }}
          className="md:hidden fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-30 w-13 h-13 rounded-2xl flex items-center justify-center active:scale-92 transition-transform cursor-pointer"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      )}

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navegação inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-panel border-t border-[var(--border)]/80 pb-safe"
      >
        <div className="flex items-center justify-between overflow-x-auto no-scrollbar h-16 px-1.5 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const shortLabel =
              item.to === '/inbox'
                ? 'Inbox'
                : item.to === '/projetos'
                ? 'Projetos'
                : item.to === '/organizacoes'
                ? 'Equipe'
                : item.label;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative flex-1 min-w-[56px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'text-[var(--accent-text)] font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`relative px-2 py-0.5 rounded-full transition-colors ${
                        isActive ? 'bg-[var(--accent-soft)]' : ''
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.badge > 0 && (
                        <span
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--on-accent)',
                          }}
                          className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-mono tabular-nums font-bold flex items-center justify-center"
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] tracking-tight whitespace-nowrap">
                      {shortLabel}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
          className="fixed left-4 right-4 sm:left-auto sm:right-6 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 z-50 sm:max-w-md bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] px-4 py-3 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold animate-modal-up"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                toast.type === 'error'
                  ? 'bg-rose-500'
                  : toast.type === 'success'
                  ? 'bg-emerald-500'
                  : 'bg-[var(--accent)]'
              }`}
            />
            <span className="leading-snug truncate sm:whitespace-normal">{toast.message}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {toast.onUndo && (
              <button
                type="button"
                onClick={() => {
                  const undoFn = toast.onUndo;
                  dismissToast();
                  if (undoFn) void undoFn();
                }}
                className="min-h-[32px] px-3 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] font-bold inline-flex items-center gap-1 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {toast.undoLabel || 'Desfazer'}
              </button>
            )}
            <button
              type="button"
              onClick={dismissToast}
              aria-label="Fechar notificação"
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <QuickAddModal />
      <TaskDetailSheet />
      <WelcomeModal /> {/* <-- Renderizado aqui */}
    </div>
  );
};