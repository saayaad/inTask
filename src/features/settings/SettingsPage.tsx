import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Clock,
  Database,
  Download,
  FastForward,
  LogOut,
  Moon,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { CustomColorPopover } from '../../components/CustomColorPopover';
import { BackupSummary } from '../../data/interfaces';
import {
  DEFAULT_ACCENT_COLOR,
  isValidHexColor,
  normalizeHexColor,
  PRESET_ACCENT_COLORS,
} from '../../domain/color';
import {
  BackupPayload,
  RolloverMode,
  ThemeMode,
} from '../../domain/types';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const localAccounts = useAppStore((s) => s.localAccounts);
  const currentTodayStr = useAppStore((s) => s.currentTodayStr);
  const simulatedOffsetDays = useAppStore((s) => s.simulatedOffsetDays);

  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const updateUserName = useAppStore((s) => s.updateUserName);
  const exportBackup = useAppStore((s) => s.exportBackup);
  const validateBackup = useAppStore((s) => s.validateBackup);
  const importBackup = useAppStore((s) => s.importBackup);
  const simulateNextDay = useAppStore((s) => s.simulateNextDay);
  const resetSimulatedClock = useAppStore((s) => s.resetSimulatedClock);
  const seedSampleData = useAppStore((s) => s.seedSampleData);
  const clearAllData = useAppStore((s) => s.clearAllData);
  const switchAccount = useAppStore((s) => s.switchAccount);
  const logout = useAppStore((s) => s.logout);
  const showToast = useAppStore((s) => s.showToast);

  const [hexInput, setHexInput] = useState(user?.preferences.accentColor || DEFAULT_ACCENT_COLOR);
  const [hexError, setHexError] = useState('');
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [showThemeColorPicker, setShowThemeColorPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<{
    payload: BackupPayload;
    summary: BackupSummary;
  } | null>(null);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    if (user) {
      setHexInput(user.preferences.accentColor || DEFAULT_ACCENT_COLOR);
      setHexError('');
      setNameInput(user.name);
    }
  }, [user?.id, user?.name, user?.preferences.accentColor]);

  if (!user) return null;

  const handleApplyHex = (rawHex: string) => {
    setHexInput(rawHex);
    if (isValidHexColor(rawHex)) {
      setHexError('');
      const normalized = normalizeHexColor(rawHex);
      void updatePreferences({ accentColor: normalized });
    } else {
      setHexError('Use o formato #RGB ou #RRGGBB (ex.: #e11d48).');
    }
  };

  const handleExportJson = async () => {
    const payload = await exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intask-backup-${currentTodayStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast({ message: 'Backup JSON exportado com sucesso!', type: 'success' });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const validated = await validateBackup(text);
      setPendingBackup(validated);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Arquivo inválido.');
      setPendingBackup(null);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
          <Palette className="w-3.5 h-3.5" />
          <span>Preferências & Sistema</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
          Configurações
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          Personalize sua cor de destaque, modo escuro/claro, virada de dia e backups.
        </p>
      </header>

      {/* APARÊNCIA E COR DO TEMA */}
      <section
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-[var(--accent-text)]" />
            <h2 className="text-base font-bold text-[var(--text)]">Aparência e Cor do Tema</h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setHexInput(DEFAULT_ACCENT_COLOR);
              setHexError('');
              void updatePreferences({ accentColor: DEFAULT_ACCENT_COLOR });
            }}
            className="min-h-[36px] px-3.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] inline-flex items-center gap-1.5 cursor-pointer transition-colors btn-press"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar padrão
          </button>
        </div>

        <div className="space-y-2.5">
          <span className="block text-xs font-bold text-[var(--text-muted)]">
            Cores predefinidas
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            {PRESET_ACCENT_COLORS.map((preset) => {
              const isSelected =
                user.preferences.accentColor.toLowerCase() === preset.hex.toLowerCase();
              return (
                <button
                  key={preset.hex}
                  type="button"
                  onClick={() => {
                    setHexInput(preset.hex);
                    setHexError('');
                    void updatePreferences({ accentColor: preset.hex });
                  }}
                  title={`${preset.name} (${preset.hex})`}
                  aria-label={`Escolher cor ${preset.name} ${preset.hex}`}
                  style={{ backgroundColor: preset.hex }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform cursor-pointer shadow-2xs btn-press ${
                    isSelected ? 'ring-2 ring-offset-2 ring-[var(--text)] scale-108' : 'hover:scale-105'
                  }`}
                >
                  {isSelected && <Check className="w-5 h-5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border)]">
          <div className="space-y-1.5">
            <label
              htmlFor="hex-color-input"
              className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"
            >
              Seletor livre e código Hex (#RGB ou #RRGGBB)
            </label>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowThemeColorPicker(!showThemeColorPicker)}
                  style={{ backgroundColor: normalizeHexColor(hexInput) }}
                  className="w-11 h-11 rounded-xl border border-[var(--border)] shrink-0 shadow-2xs cursor-pointer btn-press"
                  aria-label="Abrir seletor de cor customizado"
                />
                {showThemeColorPicker && (
                  <CustomColorPopover
                    color={hexInput}
                    onChange={(newHex) => {
                      setHexInput(newHex);
                      handleApplyHex(newHex);
                    }}
                    onClose={() => setShowThemeColorPicker(false)}
                  />
                )}
              </div>
              <input
                id="hex-color-input"
                type="text"
                value={hexInput}
                onChange={(e) => handleApplyHex(e.target.value)}
                placeholder="#1c3cee ou #e11d48"
                className="flex-1 h-11 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm font-mono font-bold text-[var(--text)] focus:border-[var(--accent)]"
              />
            </div>
            {hexError && <p className="text-xs text-rose-500 font-bold">{hexError}</p>}
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Modo Escuro / Claro
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'light', label: 'Claro', icon: Sun },
                  { id: 'dark', label: 'Escuro', icon: Moon },
                  { id: 'system', label: 'Sistema', icon: Sparkles },
                ] as { id: ThemeMode; label: string; icon: typeof Sun }[]
              ).map((m) => {
                const Icon = m.icon;
                const active = user.preferences.themeMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => void updatePreferences({ themeMode: m.id })}
                    className={`min-h-[44px] rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 border transition-all cursor-pointer btn-press ${
                      active
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)] shadow-2xs'
                        : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--accent-border)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* VIRADA DE DIA */}
      <section
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-[var(--accent-text)]" />
          <h2 className="text-base font-bold text-[var(--text)]">Comportamento na Virada de Dia</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              {
                id: 'ask',
                title: 'Perguntar ao abrir o app (Padrão)',
                desc: 'Exibe um cartão no topo de Hoje permitindo mover todas ou revisar item a item.',
              },
              {
                id: 'auto',
                title: 'Automática',
                desc: 'Move automaticamente as pendências de ontem para Hoje uma vez por dia, com opção Desfazer.',
              },
            ] as { id: RolloverMode; title: string; desc: string }[]
          ).map((opt) => {
            const active = user.preferences.rolloverMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  void updatePreferences({
                    rolloverMode: opt.id,
                    rolloverHandledDate: null,
                  })
                }
                className={`p-4 rounded-2xl border text-left space-y-1 transition-all cursor-pointer ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40 shadow-2xs'
                    : 'border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--accent-border)] card-interactive'
                }`}
              >
                <p className="text-xs font-bold text-[var(--text)]">{opt.title}</p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* BACKUP */}
      <section
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-[var(--accent-text)]" />
            <h2 className="text-base font-bold text-[var(--text)]">Backup e Armazenamento</h2>
          </div>

          <span className="text-xs font-mono font-semibold text-[var(--text-muted)]">
            Armazenamento: local
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleExportJson()}
            style={{
              boxShadow: '0 4px 12px -2px var(--accent-glow)',
            }}
            className="min-h-[42px] px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] cursor-pointer btn-press"
          >
            <Download className="w-4 h-4" />
            Exportar backup (.json)
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[42px] px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] inline-flex items-center gap-2 cursor-pointer transition-colors btn-press"
          >
            <Upload className="w-4 h-4" />
            Importar backup (.json)
          </button>
        </div>

        {importError && <p className="text-xs text-rose-500 font-bold">{importError}</p>}

        {pendingBackup && (
          <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--accent)] space-y-3 animate-item-enter">
            <h3 className="text-xs font-bold text-[var(--text)]">
              Resumo do Backup Validado (v{pendingBackup.summary.schemaVersion})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[var(--text-muted)] tabular-nums font-medium">
              <span>Usuário: {pendingBackup.summary.userName}</span>
              <span>Tarefas: {pendingBackup.summary.tasksCount}</span>
              <span>Organizações: {pendingBackup.summary.organizationsCount}</span>
              <span>Metas: {pendingBackup.summary.goalsCount}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  await importBackup(pendingBackup.payload, 'replace');
                  setPendingBackup(null);
                }}
                className="min-h-[36px] px-3.5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold cursor-pointer btn-press"
              >
                Substituir dados atuais
              </button>
              <button
                type="button"
                onClick={async () => {
                  await importBackup(pendingBackup.payload, 'merge');
                  setPendingBackup(null);
                }}
                className="min-h-[36px] px-3.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text)] cursor-pointer btn-press"
              >
                Mesclar por ID
              </button>
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="min-h-[36px] px-3 rounded-full text-xs font-bold text-[var(--text-muted)] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      {/* CONTA E FERRAMENTAS AVANÇADAS */}
      <section
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-5"
      >
        <div className="flex items-center gap-2.5">
          <UserIcon className="w-5 h-5 text-[var(--accent-text)]" />
          <h2 className="text-base font-bold text-[var(--text)]">Conta e Ferramentas Avançadas</h2>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nameInput.trim()) return;
            await updateUserName(nameInput.trim());
            showToast({ message: 'Nome atualizado!', type: 'success' });
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            aria-label="Seu nome"
            className="flex-1 h-10 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            className="min-h-[40px] px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] cursor-pointer transition-colors btn-press"
          >
            Salvar nome
          </button>
        </form>

        {localAccounts.length > 1 && (
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Alternar conta local
            </span>
            <div className="flex flex-wrap gap-2">
              {localAccounts.map((acc) => {
                const isMe = acc.id === user.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={isMe}
                    onClick={() => void switchAccount(acc.id)}
                    className={`min-h-[38px] px-3.5 rounded-full text-xs font-bold border transition-all cursor-pointer btn-press ${
                      isMe
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                        : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {acc.name} {isMe ? '(Conectado)' : '→ Entrar'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={async () => {
              await simulateNextDay();
              navigate('/hoje');
            }}
            className="min-h-[40px] px-4 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold inline-flex items-center gap-2 hover:bg-[var(--accent-hover)] cursor-pointer shadow-2xs btn-press"
          >
            <FastForward className="w-4 h-4" />
            Simular o dia seguinte
          </button>

          {simulatedOffsetDays !== 0 && (
            <button
              type="button"
              onClick={() => void resetSimulatedClock()}
              className="min-h-[40px] px-3.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] cursor-pointer btn-press"
            >
              Restaurar data real
            </button>
          )}

          <button
            type="button"
            onClick={() => void seedSampleData()}
            className="min-h-[40px] px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] hover:border-[var(--accent)] inline-flex items-center gap-1.5 cursor-pointer btn-press"
          >
            <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
            Carregar dados de exemplo
          </button>

          <button
            type="button"
            onClick={async () => {
              await clearAllData();
              navigate('/auth');
            }}
            className="min-h-[40px] px-4 rounded-full bg-rose-500/10 text-rose-500 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-rose-500/20 cursor-pointer btn-press"
          >
            <Trash2 className="w-4 h-4" />
            Apagar todos os dados
          </button>

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/auth');
            }}
            className="min-h-[40px] px-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] inline-flex items-center gap-1.5 ml-auto cursor-pointer btn-press"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </section>
    </div>
  );
};