import React, { useEffect, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addDaysToStr, getNextMondayStr, parseLocalDate, toDateStr } from '../domain/clock';

interface CustomDateDropdownProps {
  value: string | null;
  onChange: (dateStr: string | null) => void;
  currentTodayStr: string;
  align?: 'left' | 'right';
  disabled?: boolean;
  allowClear?: boolean;
  variant?: 'pill' | 'box';
}

export const CustomDateDropdown: React.FC<CustomDateDropdownProps> = ({
  value,
  onChange,
  currentTodayStr,
  align = 'left',
  disabled = false,
  allowClear = true,
  variant = 'pill',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    parseLocalDate(value || currentTodayStr)
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setViewMonth(parseLocalDate(value || currentTodayStr));
    }
  }, [isOpen, value, currentTodayStr]);

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

  const tomorrowStr = addDaysToStr(currentTodayStr, 1);
  const nextMondayStr = getNextMondayStr(currentTodayStr);

  const handleSelect = (val: string | null) => {
    onChange(val);
    setIsOpen(false);
  };

  const getDisplay = () => {
    if (value === currentTodayStr)
      return `Hoje (${currentTodayStr.slice(8, 10)}/${currentTodayStr.slice(5, 7)})`;
    if (value === tomorrowStr)
      return `Amanhã (${tomorrowStr.slice(8, 10)}/${tomorrowStr.slice(5, 7)})`;
    if (value === nextMondayStr)
      return `Próx. Seg (${nextMondayStr.slice(8, 10)}/${nextMondayStr.slice(5, 7)})`;
    if (value === null) return 'Sem data';
    return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  };

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const monthLabel = format(viewMonth, 'MMMM yyyy', { locale: ptBR });
  const formattedMonthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

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
        onClick={() => setIsOpen((v) => !v)}
        className={`${baseClasses} inline-flex items-center justify-between gap-2 text-[var(--text)] focus:outline-none focus:border-[var(--accent)] transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed ${
          variant === 'box' ? 'w-full' : ''
        }`}
      >
        <span className="inline-flex items-center gap-2 truncate">
          <Calendar className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
          <span className="truncate tabular-nums">{getDisplay()}</span>
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
          } z-[80] w-[284px] p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pop-in space-y-3`}
        >
          {/* Atalhos Rápidos */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleSelect(currentTodayStr)}
              className={`h-8 rounded-xl text-[11px] font-bold transition-all cursor-pointer btn-press ${
                value === currentTodayStr
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs'
                  : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => handleSelect(tomorrowStr)}
              className={`h-8 rounded-xl text-[11px] font-bold transition-all cursor-pointer btn-press ${
                value === tomorrowStr
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs'
                  : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              Amanhã
            </button>
            <button
              type="button"
              onClick={() => handleSelect(nextMondayStr)}
              className={`h-8 rounded-xl text-[11px] font-bold transition-all cursor-pointer btn-press ${
                value === nextMondayStr
                  ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-2xs'
                  : 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              Próx. Seg
            </button>
          </div>

          {/* Navegação do Mês */}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              className="h-7 w-7 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text)] cursor-pointer transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-extrabold text-[var(--text)]">
              {formattedMonthLabel}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              className="h-7 w-7 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--text)] cursor-pointer transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Cabeçalho dos Dias da Semana */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
              <span
                key={i}
                className="text-[10px] font-extrabold text-[var(--text-muted)] uppercase"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Grade de Dias do Calendário */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((dayDate) => {
              const dayStr = toDateStr(dayDate);
              const isSelected = value === dayStr;
              const isToday = dayStr === currentTodayStr;
              const isCurrentMonth = isSameMonth(dayDate, viewMonth);

              return (
                <button
                  key={dayStr}
                  type="button"
                  onClick={() => handleSelect(dayStr)}
                  className={`h-8 w-8 rounded-xl text-xs font-mono tabular-nums font-bold flex items-center justify-center transition-all cursor-pointer btn-press ${
                    isSelected
                      ? 'bg-[var(--accent)] text-[var(--on-accent)] shadow-xs scale-105'
                      : isToday
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--accent-border)]'
                      : isCurrentMonth
                      ? 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                      : 'text-[var(--text-muted)]/35 hover:bg-[var(--surface-2)]/50'
                  }`}
                >
                  {dayDate.getDate()}
                </button>
              );
            })}
          </div>

          {allowClear && (
            <div className="pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="w-full h-8 rounded-xl hover:bg-rose-500/10 text-xs font-bold text-rose-500 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Sem data (Kanban)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};