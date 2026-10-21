import React, { useEffect, useState } from 'react';
import { Folder, Plus, Tag as TagIcon, Trash2 } from 'lucide-react';
import { useAppStore } from '../../app/store';
import { CustomColorPopover } from '../../components/CustomColorPopover';
import { CustomSelectDropdown } from '../../components/CustomSelectDropdown';
import { normalizeHexColor } from '../../domain/color';
import { can } from '../../domain/permissions';
import { getPersonalSpaceId } from '../../domain/types';

export const TagsPage: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const tags = useAppStore((s) => s.tags);
  const tasks = useAppStore((s) => s.tasks);
  const organizations = useAppStore((s) => s.organizations);
  const memberships = useAppStore((s) => s.memberships);

  const createTag = useAppStore((s) => s.createTag);
  const deleteTag = useAppStore((s) => s.deleteTag);

  const [tagSpaceId, setTagSpaceId] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#1c3cee');
  const [showTagColorPicker, setShowTagColorPicker] = useState(false);

  useEffect(() => {
    if (user && !tagSpaceId) {
      setTagSpaceId(getPersonalSpaceId(user.id));
    }
  }, [user, tagSpaceId]);

  if (!user) return null;

  const personalSpaceId = getPersonalSpaceId(user.id);
  const activeTagSpace = tagSpaceId || personalSpaceId;
  const canManageTagsInSelectedSpace = can(
    user,
    'manage_tags',
    { spaceId: activeTagSpace },
    memberships
  );

  const visibleSpaceTags = tags.filter((t) => t.spaceId === activeTagSpace);

  const spaceOptions = [
    { value: personalSpaceId, label: 'Pessoal (Privado)' },
    ...organizations.map((org) => ({ value: org.id, label: `Org: ${org.name}` })),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
            <TagIcon className="w-3.5 h-3.5" />
            <span>Categorização</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text)]">
            Tags e Categorias
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Gerencie suas tags pessoais e de organizações com cores personalizadas.
          </p>
        </div>

        <CustomSelectDropdown
          value={activeTagSpace}
          onChange={setTagSpaceId}
          options={spaceOptions}
          icon={<Folder className="w-3.5 h-3.5" />}
          align="right"
          dropdownWidth="w-[240px]"
        />
      </header>

      <section
        style={{ boxShadow: 'var(--shadow-card)' }}
        className="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-6 animate-item-enter"
      >
        {canManageTagsInSelectedSpace ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newTagName.trim()) return;
              await createTag(activeTagSpace, newTagName.trim(), newTagColor);
              setNewTagName('');
            }}
            className="flex flex-wrap items-center gap-2.5 pb-5 border-b border-[var(--border)]"
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTagColorPicker(!showTagColorPicker)}
                style={{ backgroundColor: normalizeHexColor(newTagColor) }}
                className="w-10 h-10 rounded-xl border border-[var(--border)] cursor-pointer shrink-0 shadow-2xs btn-press"
                aria-label="Selecionar cor da nova tag"
              />
              {showTagColorPicker && (
                <CustomColorPopover
                  color={newTagColor}
                  onChange={setNewTagColor}
                  onClose={() => setShowTagColorPicker(false)}
                />
              )}
            </div>

            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Digite o nome da nova tag..."
              className="flex-1 min-w-[200px] h-10 px-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            <button
              type="submit"
              disabled={!newTagName.trim()}
              style={{
                boxShadow: newTagName.trim() ? '0 4px 12px -2px var(--accent-glow)' : 'none',
              }}
              className="h-10 px-5 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold disabled:opacity-45 cursor-pointer btn-press inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Criar Tag
            </button>
          </form>
        ) : (
          <p className="text-xs text-[var(--text-muted)] pb-4 border-b border-[var(--border)]">
            Nas organizações, apenas o Admin pode criar ou remover tags.
          </p>
        )}

        {visibleSpaceTags.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[var(--surface-2)]/50 border border-dashed border-[var(--border)] text-center">
            <p className="text-xs text-[var(--text-muted)]">
              Nenhuma tag criada neste espaço ainda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger-list">
            {visibleSpaceTags.map((tg) => {
              const count = tasks.filter((t) => t.tagIds.includes(tg.id)).length;
              return (
                <div
                  key={tg.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--surface-2)]/70 border border-[var(--border)] hover:border-[var(--accent-border)] transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs"
                      style={{ backgroundColor: tg.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text)] truncate">#{tg.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)] tabular-nums">
                        {count} {count === 1 ? 'tarefa vinculada' : 'tarefas vinculadas'}
                      </p>
                    </div>
                  </div>
                  {canManageTagsInSelectedSpace && (
                    <button
                      type="button"
                      onClick={() => void deleteTag(tg.id)}
                      aria-label={`Excluir tag ${tg.name}`}
                      className="h-8 w-8 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};