import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, Tag as TagIcon, X } from 'lucide-react';
import { useAppStore } from '../app/store';
import { Tag } from '../domain/types';

interface CustomTagDropdownProps {
  value: string;
  onChange: (val: string) => void;
  spaceId: string;
  availableTags: Tag[];
  disabled?: boolean;
  variant?: 'pill' | 'box';
}

export const CustomTagDropdown: React.FC<CustomTagDropdownProps> = ({
  value,
  onChange,
  spaceId,
  availableTags,
  disabled = false,
  variant = 'pill',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingName, setPendingName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const createTag = useAppStore((s) => s.createTag);
  const selectedTag = availableTags.find((t) => t.id === value);

  useEffect(() => {
    if (pendingName) {
      const found = availableTags.find(
        (t) => t.name.toLowerCase() === pendingName.toLowerCase()
      );
      if (found) {
        onChange(found.id);
        setPendingName(null);
        setIsOpen(false);
      }
    }
  }, [availableTags, pendingName, onChange]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleCreate = async () => {
    const clean = search.trim();
    if (!clean) return;
    await createTag(spaceId, clean, '#1c3cee');
    setPendingName(clean);
    setSearch('');
  };

  const filtered = availableTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const exactMatch = availableTags.some(
    (t) => t.name.toLowerCase() === search.trim().toLowerCase()
  );

  const baseClasses =
    variant === 'pill'
      ? 'h-9 px-3.5 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold shadow-2xs'
      : 'h-10 px-3.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold w-full';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${variant === 'box' ? 'w-full' : ''}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setIsOpen((v) => !v);
          setSearch('');
        }}
        className={`${baseClasses} inline-flex items-center justify-between gap-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
          variant === 'box' ? 'w-full' : ''
        }`}
      >
        <span className="inline-flex items-center gap-2 min-w-0 truncate">
          <TagIcon className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
          {selectedTag && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selectedTag.color }}
            />
          )}
          <span className="truncate">
            {selectedTag ? `#${selectedTag.name}` : 'Sem tag'}
          </span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--text)]' : ''
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div
          style={{ boxShadow: 'var(--shadow-elevated)' }}
          className="absolute top-[calc(100%+6px)] left-0 z-[80] w-[240px] p-2 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pop-in flex flex-col gap-1"
        >
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim() && !exactMatch) {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
              placeholder="Buscar ou criar tag..."
              className="w-full h-8 pl-8 pr-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="max-h-[160px] overflow-y-auto flex flex-col gap-0.5 pt-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                !value
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <X className="w-3.5 h-3.5" />
                Sem tag
              </span>
              {!value && <Check className="w-3.5 h-3.5" />}
            </button>

            {filtered.map((t) => {
              const isSelected = t.id === value;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                      : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="truncate">#{t.name}</span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {search.trim() && !exactMatch && (
            <button
              type="button"
              onClick={() => void handleCreate()}
              className="mt-1 px-3 py-2 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-xs font-bold flex items-center gap-2 hover:bg-[var(--accent-hover)] transition-colors cursor-pointer btn-press"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Criar "#{search.trim()}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};