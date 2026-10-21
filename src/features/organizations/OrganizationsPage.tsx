import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FolderPlus,
  KeyRound,
  LogOut,
  Palette,
  Plus,
  Share2,
  Shield,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { CustomColorPopover } from '../../components/CustomColorPopover';
import { CustomSelectDropdown } from '../../components/CustomSelectDropdown';
import { TaskRow } from '../../components/TaskRow';
import {
  addDaysToStr,
  formatShortPtDate,
  getWeekDaysMondayToSunday,
} from '../../domain/clock';
import { normalizeHexColor, PRESET_ACCENT_COLORS } from '../../domain/color';
import { can, getUserRoleInOrg } from '../../domain/permissions';
import {
  AppAreaTab,
  getPersonalSpaceId,
  isPersonalSpace,
  Organization,
  OrgRole,
} from '../../domain/types';

const ALL_APP_TABS: { id: AppAreaTab; label: string }[] = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'inbox', label: 'Caixa de Entrada' },
  { id: 'projetos', label: 'Projetos & Kanban' },
  { id: 'organizacoes', label: 'Equipe & Aprovações' },
  { id: 'metas', label: 'Metas' },
  { id: 'tags', label: 'Tags' },
];

const SPACE_ICON_OPTIONS = ['🏢', '🚀', '⭐', '💡', '🎯', '💼', '🧪', '🛠️', '🎨', '🔥'];

export const OrganizationsPage: React.FC = () => {
  const { code: routeInviteCode } = useParams<{ code?: string }>();
  const navigate = useNavigate();

  const user = useAppStore((s) => s.user);
  const localAccounts = useAppStore((s) => s.localAccounts);
  const organizations = useAppStore((s) => s.organizations);
  const memberships = useAppStore((s) => s.memberships);
  const membersById = useAppStore((s) => s.membersById);
  const invites = useAppStore((s) => s.invites);
  const tasks = useAppStore((s) => s.tasks);
  const tags = useAppStore((s) => s.tags);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);

  const createOrganization = useAppStore((s) => s.createOrganization);
  const renameOrganization = useAppStore((s) => s.renameOrganization);
  const updateOrganization = useAppStore((s) => s.updateOrganization);
  const deleteOrganization = useAppStore((s) => s.deleteOrganization);
  const createInvite = useAppStore((s) => s.createInvite);
  const revokeInvite = useAppStore((s) => s.revokeInvite);
  const acceptInviteByCode = useAppStore((s) => s.acceptInviteByCode);
  const updateMemberRole = useAppStore((s) => s.updateMemberRole);
  const removeMember = useAppStore((s) => s.removeMember);
  const leaveOrganization = useAppStore((s) => s.leaveOrganization);
  const reviewApproval = useAppStore((s) => s.reviewApproval);
  const createTag = useAppStore((s) => s.createTag);
  const openQuickAdd = useAppStore((s) => s.openQuickAdd);
  const showToast = useAppStore((s) => s.showToast);

  const personalSpaceId = user ? getPersonalSpaceId(user.id) : '';

  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    organizations[0]?.id || personalSpaceId
  );
  const [activeTab, setActiveTab] = useState<
    'tasks' | 'approvals' | 'roles' | 'manage' | 'team'
  >('tasks');

  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgIcon, setNewOrgIcon] = useState('🏢');
  const [newOrgColor, setNewOrgColor] = useState('#1c3cee');
  const [showNewSpaceColorPicker, setShowNewSpaceColorPicker] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [joinCodeInput, setJoinCodeInput] = useState(routeInviteCode || '');
  const [joinError, setJoinError] = useState('');

  const [delegationFilter, setDelegationFilter] = useState<'mine' | 'others' | 'all'>('all');
  const [memberFilterId, setMemberFilterId] = useState<string>('all');

  const [rejectingTaskId, setRejectingTaskId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const [teamWeekRefStr, setTeamWeekRefStr] = useState<string>(currentTodayStr);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [inviteSpaceIds, setInviteSpaceIds] = useState<string[]>([]);
  const [inviteAllowedTabs, setInviteAllowedTabs] = useState<AppAreaTab[]>(
    ALL_APP_TABS.map((t) => t.id)
  );

  const [selectedLocalUserToAdd, setSelectedLocalUserToAdd] = useState<string>('');

  const [newTagName, setNewTagName] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  const [editSpaceIcon, setEditSpaceIcon] = useState('🏢');
  const [editSpaceColor, setEditSpaceColor] = useState('#1c3cee');
  const [showEditColorPicker, setShowEditColorPicker] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  useEffect(() => {
    setTeamWeekRefStr(currentTodayStr);
  }, [currentTodayStr]);

  const personalSpaceVirtualOrg: Organization | null = user
    ? {
        id: personalSpaceId,
        name: user.preferences.personalSpaceName || 'Meu Espaço Pessoal',
        icon: user.preferences.personalSpaceIcon || '👤',
        color: user.preferences.accentColor,
        createdBy: user.id,
        createdAt: user.createdAt,
      }
    : null;

  const allManageableSpaces: Organization[] = personalSpaceVirtualOrg
    ? [
        personalSpaceVirtualOrg,
        ...organizations.filter((o) => o.id !== personalSpaceId),
      ]
    : organizations;

  useEffect(() => {
    if (!selectedOrgId && allManageableSpaces.length > 0) {
      setSelectedOrgId(allManageableSpaces[0].id);
    } else if (
      selectedOrgId &&
      !allManageableSpaces.some((o) => o.id === selectedOrgId)
    ) {
      setSelectedOrgId(allManageableSpaces[0]?.id || '');
    }
  }, [allManageableSpaces.length, selectedOrgId]);

  const activeOrg =
    allManageableSpaces.find((o) => o.id === selectedOrgId) || null;

  useEffect(() => {
    if (activeOrg) {
      setRenameDraft(activeOrg.name);
      setEditSpaceIcon(activeOrg.icon || '🏢');
      setEditSpaceColor(activeOrg.color || '#1c3cee');
      setDeleteConfirmName('');
      setInviteSpaceIds([activeOrg.id]);
    }
  }, [activeOrg?.id, activeOrg?.name, activeOrg?.icon, activeOrg?.color]);

  useEffect(() => {
    if (routeInviteCode && user) {
      setJoinCodeInput(routeInviteCode.toUpperCase());
    }
  }, [routeInviteCode, user]);

  if (!user) return null;

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    const created = await createOrganization(
      newOrgName.trim(),
      newOrgIcon,
      newOrgColor
    );
    setNewOrgName('');
    setShowCreateModal(false);
    setSelectedOrgId(created.id);
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setJoinError('');
    try {
      const joined = await acceptInviteByCode(joinCodeInput.trim());
      setJoinCodeInput('');
      setSelectedOrgId(joined.id);
      if (routeInviteCode) {
        navigate('/organizacoes', { replace: true });
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Código inválido.');
    }
  };

  const myRole = activeOrg
    ? getUserRoleInOrg(user.id, activeOrg.id, memberships)
    : null;
  const isAdmin = myRole === 'admin';
  const isActivePersonal = activeOrg ? isPersonalSpace(activeOrg.id) : false;

  const orgTasks = activeOrg ? tasks.filter((t) => t.spaceId === activeOrg.id) : [];

  const rawMemberships = activeOrg
    ? memberships.filter((m) => m.orgId === activeOrg.id)
    : [];
  const orgMemberships: typeof memberships =
    activeOrg &&
    isActivePersonal &&
    !rawMemberships.some((m) => m.userId === user.id)
      ? [
          {
            orgId: activeOrg.id,
            userId: user.id,
            role: 'admin',
            joinedAt: user.createdAt,
          },
          ...rawMemberships,
        ]
      : rawMemberships;

  const orgInvites = activeOrg
    ? invites.filter(
        (i) =>
          i.orgId === activeOrg.id ||
          (i.spaceIds && i.spaceIds.includes(activeOrg.id))
      )
    : [];
  const orgTags = activeOrg ? tags.filter((t) => t.spaceId === activeOrg.id) : [];

  const awaitingApprovalTasks = orgTasks.filter(
    (t) => t.status === 'awaiting_approval'
  );

  const filteredDelegationTasks = orgTasks.filter((t) => {
    if (delegationFilter === 'mine' && t.assigneeId !== user.id) return false;
    if (delegationFilter === 'others' && t.assigneeId === user.id) return false;
    if (memberFilterId !== 'all' && t.assigneeId !== memberFilterId) return false;
    return true;
  });

  const memberFilterOptions = [
    { value: 'all', label: 'Todos os membros' },
    ...orgMemberships
      .map((m) => {
        const u = membersById[m.userId] || (m.userId === user.id ? user : null);
        if (!u) return null;
        return {
          value: m.userId,
          label: `${u.name} (${m.role === 'admin' ? 'Admin' : 'Membro'})`,
        };
      })
      .filter((x): x is { value: string; label: string } => Boolean(x)),
  ];

  const teamWeekDays = getWeekDaysMondayToSunday(teamWeekRefStr);
  const weekStartStr = teamWeekDays[0];
  const weekEndStr = teamWeekDays[6];

  const completedInSelectedWeek = orgTasks.filter((t) => {
    if (t.status !== 'done') return false;
    const approvalOrCompletionDate = (
      t.approval?.reviewedAt ||
      t.completedAt ||
      t.updatedAt
    ).slice(0, 10);
    return (
      approvalOrCompletionDate >= weekStartStr &&
      approvalOrCompletionDate <= weekEndStr
    );
  });

  const maxMemberDeliveries = Math.max(
    1,
    ...orgMemberships.map(
      (m) => completedInSelectedWeek.filter((t) => t.assigneeId === m.userId).length
    )
  );

  const toggleInviteSpace = (sid: string) => {
    setInviteSpaceIds((prev) =>
      prev.includes(sid)
        ? prev.length > 1
          ? prev.filter((id) => id !== sid)
          : prev
        : [...prev, sid]
    );
  };

  const toggleInviteTab = (tabId: AppAreaTab) => {
    setInviteAllowedTabs((prev) =>
      prev.includes(tabId)
        ? prev.length > 1
          ? prev.filter((t) => t !== tabId)
          : prev
        : [...prev, tabId]
    );
  };

  const nonMemberLocalAccounts = localAccounts.filter(
    (acc) => !orgMemberships.some((m) => m.userId === acc.id)
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
            <Building2 className="w-3.5 h-3.5" />
            <span>Gestão de Espaços e Equipe</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
            Áreas de Trabalho & Espaços
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Crie novos espaços, escolha ícones, defina administradores e controle acessos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          style={{
            boxShadow: '0 6px 16px -3px var(--accent-glow)',
          }}
          className="min-h-[42px] px-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-all cursor-pointer self-start sm:self-auto whitespace-nowrap btn-press"
        >
          <FolderPlus className="w-4 h-4 stroke-[2.5]" />
          Criar Novo Espaço
        </button>
      </header>

      {/* Modal para Criar Novo Espaço */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-backdrop"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{ boxShadow: 'var(--shadow-elevated)' }}
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 space-y-5 animate-modal-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-extrabold text-[var(--text)]">Criar Novo Espaço de Trabalho</h2>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Nome do Espaço
                </label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Ex.: Marketing, Projetos Pessoais, Testes..."
                  className="w-full h-11 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:border-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Ícone do Espaço
                </span>
                <div className="flex flex-wrap gap-2">
                  {SPACE_ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewOrgIcon(ic)}
                      className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer btn-press ${
                        newOrgIcon === ic
                          ? 'bg-[var(--accent-soft)] border-[var(--accent)] scale-105 shadow-2xs'
                          : 'bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Cor Destaque
                </span>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowNewSpaceColorPicker(!showNewSpaceColorPicker)}
                      style={{ backgroundColor: normalizeHexColor(newOrgColor) }}
                      className="w-11 h-11 rounded-xl border border-[var(--border)] shadow-2xs cursor-pointer btn-press"
                    />
                    {showNewSpaceColorPicker && (
                      <CustomColorPopover
                        color={newOrgColor}
                        onChange={setNewOrgColor}
                        onClose={() => setShowNewSpaceColorPicker(false)}
                      />
                    )}
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--text-muted)]">{newOrgColor}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 px-4 rounded-full text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newOrgName.trim()}
                  className="h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold disabled:opacity-45 cursor-pointer btn-press"
                >
                  Criar Espaço
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Code Form */}
      <form
        onSubmit={handleJoinByCode}
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2"
      >
        <KeyRound className="w-4 h-4 text-[var(--accent-text)] shrink-0 ml-1" />
        <input
          type="text"
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
          placeholder="Entrar com código de convite (ex.: INTASK26)..."
          maxLength={12}
          className="flex-1 h-10 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono uppercase text-[var(--text)] font-bold tracking-wider focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={!joinCodeInput.trim()}
          className="min-h-[40px] px-5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text)] disabled:opacity-45 cursor-pointer shrink-0 transition-colors btn-press"
        >
          Entrar com Código
        </button>
      </form>
      {joinError && <p className="text-xs text-rose-500 font-bold pl-1">{joinError}</p>}

      {/* Space Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-list">
        {allManageableSpaces.map((org) => {
          const isSelected = org.id === selectedOrgId;
          const role = getUserRoleInOrg(user.id, org.id, memberships);
          const isPers = isPersonalSpace(org.id);
          const mCount = isPers
            ? memberships.filter((m) => m.orgId === org.id && m.userId !== user.id).length + 1
            : memberships.filter((m) => m.orgId === org.id).length;
          const openCount = tasks.filter(
            (t) => t.spaceId === org.id && t.status !== 'done'
          ).length;
          const pendingApprovals = tasks.filter(
            (t) => t.spaceId === org.id && t.status === 'awaiting_approval'
          ).length;

          return (
            <button
              key={org.id}
              type="button"
              onClick={() => setSelectedOrgId(org.id)}
              style={{ boxShadow: isSelected ? 'var(--shadow-card)' : 'var(--shadow-xs)' }}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2.5 ${
                isSelected
                  ? 'bg-[var(--surface)] border-[var(--accent)] ring-2 ring-[var(--accent-border)] shadow-2xs'
                  : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent-border)] card-interactive'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg leading-none shrink-0">
                    {org.icon || (isPers ? '👤' : '🏢')}
                  </span>
                  <h2 className="text-sm font-bold text-[var(--text)] truncate">
                    {org.name}
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-[10px] font-bold uppercase tracking-wider shrink-0">
                  {role === 'admin' ? 'Admin' : 'Membro'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-muted)] tabular-nums">
                <span>
                  {mCount} {mCount === 1 ? 'pessoa' : 'pessoas'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{openCount} abertas</span>
                {pendingApprovals > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {pendingApprovals} em aprovação
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {activeOrg && (
        <div key={activeOrg.id} className="space-y-5 animate-item-enter">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'tasks', label: `Tarefas (${orgTasks.length})` },
                {
                  id: 'approvals',
                  label: 'Aprovações',
                  badge: awaitingApprovalTasks.length,
                },
                {
                  id: 'roles',
                  label: 'Cargos & Permissões (Admins)',
                },
                { id: 'manage', label: 'Convidar Pessoas & Acessos' },
                { id: 'team', label: 'Produtividade' },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`min-h-[38px] px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap btn-press ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs'
                        : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {Boolean(tab.badge && tab.badge > 0) && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums bg-amber-500 text-white font-extrabold">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => openQuickAdd(activeOrg.id, currentTodayStr)}
              style={{
                boxShadow: '0 4px 12px -2px var(--accent-glow)',
              }}
              className="min-h-[38px] px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[var(--accent-hover)] cursor-pointer whitespace-nowrap btn-press"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Nova Tarefa neste Espaço
            </button>
          </div>

          {/* ABA 1: TAREFAS */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]"
              >
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="group"
                  aria-label="Filtro de delegação"
                >
                  {[
                    { id: 'all', label: 'Todas' },
                    { id: 'mine', label: 'Minhas tarefas' },
                    {
                      id: 'others',
                      label: isAdmin ? 'Atribuídas a outras pessoas' : 'Do restante',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setDelegationFilter(opt.id as 'all' | 'mine' | 'others')
                      }
                      className={`min-h-[36px] px-3.5 rounded-full text-xs font-bold transition-all cursor-pointer btn-press ${
                        delegationFilter === opt.id
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <CustomSelectDropdown
                  value={memberFilterId}
                  onChange={setMemberFilterId}
                  options={memberFilterOptions}
                  icon={<UserIcon className="w-3.5 h-3.5" />}
                  align="right"
                  dropdownWidth="w-[240px]"
                />
              </div>

              {filteredDelegationTasks.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
                  Nenhuma tarefa encontrada para este filtro neste espaço.
                </div>
              ) : (
                <div className="space-y-2 stagger-list">
                  {filteredDelegationTasks.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      showSpaceLabel={false}
                      showDueDate
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: APROVAÇÕES */}
          {activeTab === 'approvals' && (
            <div className="space-y-4">
              <div
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    {isAdmin
                      ? 'Fila de Aprovação do Administrador'
                      : 'Meus Envios e Status de Aprovação'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isAdmin
                      ? 'Como Admin deste espaço, você pode aprovar ou devolver qualquer tarefa livremente.'
                      : 'Acompanhe as tarefas que você enviou para aprovação.'}
                  </p>
                </div>
              </div>

              {awaitingApprovalTasks.length === 0 ? (
                <div
                  style={{ boxShadow: 'var(--shadow-card)' }}
                  className="p-10 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-2.5"
                >
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-[var(--text)]">
                    Nenhuma tarefa aguardando aprovação neste espaço
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Todas as entregas já foram revisadas.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 stagger-list">
                  {awaitingApprovalTasks.map((task) => {
                    const assignee = task.assigneeId
                      ? membersById[task.assigneeId]
                      : null;
                    const subDone = task.subtasks.filter((s) => s.done).length;
                    const subTotal = task.subtasks.length;
                    const canApproveThis = can(
                      user,
                      'review_approval',
                      { task },
                      memberships
                    );

                    return (
                      <div
                        key={task.id}
                        style={{ boxShadow: 'var(--shadow-card)' }}
                        className="p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-amber-500/40 space-y-3.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              Aguardando aprovação
                            </span>
                            <h4 className="text-base font-extrabold text-[var(--text)]">
                              {task.title}
                            </h4>
                          </div>
                          <div className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
                            Enviada em: {(task.approval?.submittedAt || task.updatedAt).slice(0, 10)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
                          <span>
                            Responsável:{' '}
                            <strong className="text-[var(--text)]">
                              {assignee?.name || 'Membro'}
                            </strong>
                          </span>
                          {subTotal > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                Checklist: {subDone}/{subTotal} concluídos
                              </span>
                            </>
                          )}
                        </div>

                        {task.notes && (
                          <p className="p-3.5 rounded-xl bg-[var(--surface-2)] text-xs text-[var(--text)] leading-relaxed">
                            {task.notes}
                          </p>
                        )}

                        {canApproveThis && (
                          <div className="pt-3 border-t border-[var(--border)]">
                            {rejectingTaskId !== task.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void reviewApproval(task.id, 'approved')}
                                  className="min-h-[40px] px-4 rounded-full bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 hover:bg-emerald-700 transition-all cursor-pointer shadow-2xs btn-press"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Aprovar entrega
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectingTaskId(task.id);
                                    setRejectComment('');
                                  }}
                                  className="min-h-[40px] px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-amber-500 transition-all cursor-pointer btn-press"
                                >
                                  Pedir ajustes
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2.5 animate-item-enter">
                                <textarea
                                  rows={2}
                                  value={rejectComment}
                                  onChange={(e) => setRejectComment(e.target.value)}
                                  placeholder="Explique os ajustes necessários (obrigatório)..."
                                  className="w-full p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setRejectingTaskId(null)}
                                    className="h-9 px-3 rounded-lg text-xs font-bold text-[var(--text-muted)] cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!rejectComment.trim()}
                                    onClick={() => {
                                      void reviewApproval(
                                        task.id,
                                        'changes_requested',
                                        rejectComment.trim()
                                      );
                                      setRejectingTaskId(null);
                                    }}
                                    className="h-9 px-4 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-45 cursor-pointer btn-press"
                                  >
                                    Confirmar pedido de ajustes
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: CARGOS & PERMISSÕES (ADMINS) */}
          {activeTab === 'roles' && (
            <div className="space-y-4 animate-item-enter">
              <div
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-2"
              >
                <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--text)]">
                  <ShieldCheck className="w-5 h-5 text-[var(--accent-text)]" />
                  <span>Controle de Administradores e Permissões de "{activeOrg.name}"</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Defina quem é <strong>Admin</strong> (pode aprovar tarefas, editar qualquer item, gerir tags, metas e convites) e quem é <strong>Membro Convidado</strong> (conclui tarefas via aprovação e acede apenas às áreas permitidas abaixo).
                </p>

                {isAdmin && nonMemberLocalAccounts.length > 0 && (
                  <div className="pt-3 mt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text)]">
                      Adicionar conta existente neste dispositivo:
                    </span>
                    <CustomSelectDropdown
                      value={selectedLocalUserToAdd}
                      onChange={setSelectedLocalUserToAdd}
                      options={[
                        { value: '', label: 'Escolher pessoa...' },
                        ...nonMemberLocalAccounts.map((acc) => ({
                          value: acc.id,
                          label: `${acc.name} (${acc.email})`,
                        })),
                      ]}
                      dropdownWidth="w-[260px]"
                    />
                    <button
                      type="button"
                      disabled={!selectedLocalUserToAdd}
                      onClick={async () => {
                        if (!selectedLocalUserToAdd) return;
                        await updateMemberRole(
                          activeOrg.id,
                          selectedLocalUserToAdd,
                          'member',
                          ALL_APP_TABS.map((t) => t.id)
                        );
                        setSelectedLocalUserToAdd('');
                      }}
                      className="h-9 px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold disabled:opacity-40 cursor-pointer btn-press inline-flex items-center gap-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Dar Acesso ao Espaço
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 stagger-list">
                {orgMemberships.map((m) => {
                  const memberUser =
                    membersById[m.userId] || (m.userId === user.id ? user : null);
                  if (!memberUser) return null;

                  const isOwner = activeOrg.createdBy === memberUser.id;
                  const currentAllowed =
                    m.allowedTabs && m.allowedTabs.length > 0
                      ? m.allowedTabs
                      : ALL_APP_TABS.map((t) => t.id);

                  return (
                    <div
                      key={m.userId}
                      style={{ boxShadow: 'var(--shadow-card)' }}
                      className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: 'var(--on-accent)',
                            }}
                          >
                            {memberUser.name
                              .split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-extrabold text-[var(--text)] truncate">
                                {memberUser.name}{' '}
                                {memberUser.id === user.id ? '(Você)' : ''}
                              </p>
                              {isOwner && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                                  Dono da Conta
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] truncate">
                              {memberUser.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="inline-flex p-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                            <button
                              type="button"
                              disabled={!isAdmin}
                              onClick={() =>
                                void updateMemberRole(
                                  activeOrg.id,
                                  memberUser.id,
                                  'admin',
                                  currentAllowed
                                )
                              }
                              className={`h-8 px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                                m.role === 'admin'
                                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs'
                                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                              }`}
                            >
                              <Shield className="w-3.5 h-3.5" />
                              Admin
                            </button>
                            <button
                              type="button"
                              disabled={!isAdmin || isOwner}
                              title={
                                isOwner
                                  ? 'O dono principal do espaço é sempre Admin'
                                  : 'Definir como Membro Convidado'
                              }
                              onClick={() =>
                                void updateMemberRole(
                                  activeOrg.id,
                                  memberUser.id,
                                  'member',
                                  currentAllowed
                                )
                              }
                              className={`h-8 px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 ${
                                m.role === 'member'
                                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs'
                                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                              }`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              Membro
                            </button>
                          </div>

                          {isAdmin && !isOwner && memberUser.id !== user.id && (
                            <button
                              type="button"
                              onClick={() => void removeMember(activeOrg.id, memberUser.id)}
                              title="Remover acesso"
                              className="h-9 w-9 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {m.role === 'member' && (
                        <div className="pt-3 border-t border-[var(--border)] space-y-2">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            Áreas do site que {memberUser.name.split(' ')[0]} pode acessar:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {ALL_APP_TABS.map((tab) => {
                              const allowed = currentAllowed.includes(tab.id);
                              return (
                                <button
                                  key={tab.id}
                                  type="button"
                                  disabled={!isAdmin}
                                  onClick={() => {
                                    const nextTabs = allowed
                                      ? currentAllowed.length > 1
                                        ? currentAllowed.filter((t) => t !== tab.id)
                                        : currentAllowed
                                      : [...currentAllowed, tab.id];
                                    void updateMemberRole(
                                      activeOrg.id,
                                      memberUser.id,
                                      'member',
                                      nextTabs
                                    );
                                  }}
                                  className={`h-8 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-all cursor-pointer btn-press ${
                                    allowed
                                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]'
                                      : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] opacity-60'
                                  }`}
                                >
                                  {allowed && <Check className="w-3 h-3 stroke-[3]" />}
                                  <span>{tab.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ABA 4: CONVIDAR PESSOAS & GESTÃO DO ESPAÇO */}
          {activeTab === 'manage' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-item-enter">
              <div
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-5"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-[var(--text)] flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[var(--accent-text)]" />
                    Convidar Nova Pessoa (Escolhendo Espaços e Abas)
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Gere um código de convite para este espaço ou selecione múltiplos espaços.
                  </p>
                </div>

                {isAdmin ? (
                  <>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await createInvite(activeOrg.id, {
                          email: inviteEmail || undefined,
                          spaceIds:
                            inviteSpaceIds.length > 0
                              ? inviteSpaceIds
                              : [activeOrg.id],
                          role: inviteRole,
                          allowedTabs: inviteAllowedTabs,
                        });
                        setInviteEmail('');
                        showToast({
                          message: 'Convite gerado com sucesso!',
                          type: 'success',
                        });
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          1. Espaços a que o convidado terá acesso:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {allManageableSpaces.map((sp) => {
                            const selected = inviteSpaceIds.includes(sp.id);
                            return (
                              <button
                                key={sp.id}
                                type="button"
                                onClick={() => toggleInviteSpace(sp.id)}
                                className={`h-9 px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-all cursor-pointer btn-press ${
                                  selected
                                    ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-2xs'
                                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]'
                                }`}
                              >
                                <span>{sp.icon || '🏢'}</span>
                                <span>{sp.name}</span>
                                {selected && <Check className="w-3.5 h-3.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          2. Cargo inicial
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setInviteRole('member')}
                            className={`h-9 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                              inviteRole === 'member'
                                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent)]'
                                : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]'
                            }`}
                          >
                            Membro Convidado
                          </button>
                          <button
                            type="button"
                            onClick={() => setInviteRole('admin')}
                            className={`h-9 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                              inviteRole === 'admin'
                                ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent)]'
                                : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)]'
                            }`}
                          >
                            Administrador (Admin)
                          </button>
                        </div>
                      </div>

                      {inviteRole === 'member' && (
                        <div className="space-y-2">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            3. Áreas permitidas para o convidado
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {ALL_APP_TABS.map((tab) => {
                              const checked = inviteAllowedTabs.includes(tab.id);
                              return (
                                <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => toggleInviteTab(tab.id)}
                                  className={`h-8 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                                    checked
                                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--accent-border)]'
                                      : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] opacity-60'
                                  }`}
                                >
                                  {checked && <Check className="w-3 h-3" />}
                                  <span>{tab.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="E-mail do convidado (opcional)..."
                          className="flex-1 h-10 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:border-[var(--accent)]"
                        />
                        <button
                          type="submit"
                          className="min-h-[40px] px-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold hover:bg-[var(--accent-hover)] cursor-pointer whitespace-nowrap btn-press"
                        >
                          Gerar Código
                        </button>
                      </div>
                    </form>

                    <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                      {orgInvites.map((inv) => {
                        const shareUrl = `${window.location.origin}/convite/${inv.code}`;
                        return (
                          <div
                            key={inv.id}
                            className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-mono font-extrabold text-sm text-[var(--text)] tracking-wider">
                                  {inv.code}
                                </p>
                                <span className="px-2 py-0.5 rounded-full bg-[var(--surface)] text-[10px] font-bold text-[var(--accent-text)]">
                                  {inv.role === 'admin' ? 'Admin' : 'Membro'}
                                </span>
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)] truncate">
                                {inv.status === 'pending'
                                  ? 'Ativo'
                                  : inv.status === 'accepted'
                                  ? 'Aceito'
                                  : 'Revogado'}
                              </p>
                            </div>

                            {inv.status !== 'revoked' && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(inv.code);
                                    showToast({
                                      message: `Código ${inv.code} copiado!`,
                                      type: 'info',
                                    });
                                  }}
                                  className="h-8 px-2.5 rounded-full bg-[var(--surface)] border border-[var(--border)] font-semibold inline-flex items-center gap-1 cursor-pointer btn-press"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Código
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(shareUrl);
                                    showToast({
                                      message: 'Link copiado!',
                                      type: 'info',
                                    });
                                  }}
                                  className="h-8 px-2.5 rounded-full bg-[var(--surface)] border border-[var(--border)] font-semibold inline-flex items-center gap-1 cursor-pointer btn-press"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                  Link
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void revokeInvite(inv.id)}
                                  className="h-8 px-2.5 rounded-full text-rose-500 hover:bg-rose-500/10 font-bold cursor-pointer"
                                >
                                  Revogar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">
                    Apenas um Admin pode gerar convites para este espaço.
                  </p>
                )}
              </div>

              {/* Configurar Nome, Ícone e Cor do Espaço */}
              <div
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-5"
              >
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-[var(--text)] flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[var(--accent-text)]" />
                    Personalizar Espaço
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Altere o nome, o ícone ou a cor de destaque deste espaço.
                  </p>
                </div>

                {isAdmin ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Nome do Espaço
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className="flex-1 h-10 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:border-[var(--accent)]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            void updateOrganization(activeOrg.id, { name: renameDraft })
                          }
                          className="h-10 px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold cursor-pointer hover:border-[var(--accent)] btn-press"
                        >
                          Salvar Nome
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Ícone do Espaço
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {SPACE_ICON_OPTIONS.map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => {
                              setEditSpaceIcon(ic);
                              void updateOrganization(activeOrg.id, { icon: ic });
                            }}
                            className={`w-9 h-9 rounded-xl text-base flex items-center justify-center border transition-all cursor-pointer btn-press ${
                              editSpaceIcon === ic
                                ? 'bg-[var(--accent-soft)] border-[var(--accent)] shadow-2xs scale-105'
                                : 'bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                            }`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>

                    {!isActivePersonal && (
                      <div className="pt-4 border-t border-[var(--border)]">
                        <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                          <p className="text-xs font-bold text-rose-500">
                            Excluir este espaço (digite "{activeOrg.name}")
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={deleteConfirmName}
                              onChange={(e) => setDeleteConfirmName(e.target.value)}
                              placeholder={activeOrg.name}
                              className="flex-1 h-9 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)]"
                            />
                            <button
                              type="button"
                              disabled={deleteConfirmName.trim() !== activeOrg.name}
                              onClick={() => void deleteOrganization(activeOrg.id)}
                              className="h-9 px-4 rounded-full bg-rose-600 text-white text-xs font-bold disabled:opacity-30 inline-flex items-center gap-1 cursor-pointer btn-press"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void leaveOrganization(activeOrg.id)}
                    className="min-h-[40px] px-4 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-rose-500/20 cursor-pointer btn-press"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair deste espaço
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ABA 5: PRODUTIVIDADE */}
          {activeTab === 'team' && (
            <div className="space-y-4 animate-item-enter">
              <div
                style={{ boxShadow: 'var(--shadow-card)' }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)]"
              >
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-5 h-5 text-[var(--accent-text)]" />
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text)]">
                      Produtividade Semanal do Espaço
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] tabular-nums">
                      {formatShortPtDate(weekStartStr)} a {formatShortPtDate(weekEndStr)} (Seg–Dom)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTeamWeekRefStr(addDaysToStr(teamWeekRefStr, -7))}
                    aria-label="Semana anterior"
                    className="h-9 w-9 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center cursor-pointer transition-colors hover:border-[var(--accent)] btn-press"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamWeekRefStr(currentTodayStr)}
                    className="h-9 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold cursor-pointer transition-colors hover:border-[var(--accent)] btn-press"
                  >
                    Esta semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamWeekRefStr(addDaysToStr(teamWeekRefStr, 7))}
                    aria-label="Próxima semana"
                    className="h-9 w-9 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center cursor-pointer transition-colors hover:border-[var(--accent)] btn-press"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-list">
                {orgMemberships.map((m) => {
                  const memberUser =
                    membersById[m.userId] || (m.userId === user.id ? user : null);
                  if (!memberUser) return null;
                  const memberDeliveries = completedInSelectedWeek.filter(
                    (t) => t.assigneeId === m.userId
                  );
                  const barPercent = Math.round(
                    (memberDeliveries.length / maxMemberDeliveries) * 100
                  );

                  return (
                    <div
                      key={m.userId}
                      style={{ boxShadow: 'var(--shadow-card)' }}
                      className="p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-[var(--text)]">
                            {memberUser.name}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {m.role === 'admin' ? 'Administrador' : 'Membro Convidado'}
                          </p>
                        </div>
                        <span className="text-lg font-extrabold font-mono tabular-nums text-[var(--accent-text)]">
                          {memberDeliveries.length}{' '}
                          <span className="text-xs font-normal text-[var(--text-muted)]">
                            {memberDeliveries.length === 1 ? 'entrega' : 'entregas'}
                          </span>
                        </span>
                      </div>

                      <div className="w-full h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                        <div
                          style={{
                            width: `${memberDeliveries.length === 0 ? 0 : Math.max(8, barPercent)}%`,
                            backgroundColor: 'var(--accent)',
                          }}
                          className="h-full rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        />
                      </div>

                      {memberDeliveries.length > 0 ? (
                        <ul className="space-y-1.5 pt-1">
                          {memberDeliveries.map((del) => (
                            <li
                              key={del.id}
                              className="text-xs flex items-center justify-between gap-2 text-[var(--text)]"
                            >
                              <span className="truncate">✓ {del.title}</span>
                              <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] shrink-0">
                                {(
                                  del.approval?.reviewedAt ||
                                  del.completedAt ||
                                  del.updatedAt
                                ).slice(0, 10)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-[var(--text-muted)]">
                          Nenhuma entrega concluída/aprovada nesta semana.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};