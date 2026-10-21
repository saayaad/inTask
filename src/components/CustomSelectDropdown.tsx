import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  dotColor?: string;
  badge?: string;
}

interface CustomSelectDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: SelectOption[];
  icon?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  variant?: 'pill' | 'box';
  className?: string;
  dropdownWidth?: string;
}

export const CustomSelectDropdown: React.FC<CustomSelectDropdownProps> = ({
  value,
  onChange,
  options,
  icon,
  placeholder = 'Selecionar...',
  disabled = false,
  align = 'left',
  variant = 'pill',
  className = '',
  dropdownWidth = 'w-[220px]',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

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

  const baseClasses =
    variant === 'pill'
      ? 'h-9 px-3.5 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold shadow-2xs'
      : 'h-10 px-3.5 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold w-full';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${variant === 'box' ? 'w-full' : ''} ${className}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((v) => !v)}
        className={`${baseClasses} inline-flex items-center justify-between gap-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
          variant === 'box' ? 'w-full' : ''
        }`}
      >
        <span className="inline-flex items-center gap-2 min-w-0 truncate">
          {icon && <span className="text-[var(--accent-text)] shrink-0">{icon}</span>}
          {selected?.dotColor && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: selected.dotColor }}
            />
          )}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
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
          className={`absolute top-[calc(100%+6px)] ${
            align === 'right' ? 'right-0' : 'left-0'
          } z-[70] ${dropdownWidth} max-h-[260px] overflow-y-auto p-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pop-in flex flex-col gap-0.5`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-left text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-text)]'
                    : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <span className="inline-flex items-center gap-2 min-w-0 truncate">
                  {opt.dotColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: opt.dotColor }}
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[var(--surface-2)] text-[10px] font-mono text-[var(--text-muted)]">
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-[var(--accent-text)]" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};