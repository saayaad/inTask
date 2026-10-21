import React from 'react';
import { Priority } from '../domain/types';

export const PRIORITY_META: Record<
  Priority,
  {
    label: string;
    symbol: string;
    dotColor: string;
    textColor: string;
    badgeBg: string;
  }
> = {
  high: {
    label: 'Alta',
    symbol: '🔴',
    dotColor: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.65)]',
    textColor: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10 border-rose-500/20',
  },
  medium: {
    label: 'Média',
    symbol: '🟡',
    dotColor: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.55)]',
    textColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10 border-amber-500/20',
  },
  low: {
    label: 'Baixa',
    symbol: '🔵',
    dotColor: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.55)]',
    textColor: 'text-sky-600 dark:text-sky-400',
    badgeBg: 'bg-sky-500/10 border-sky-500/20',
  },
};

export const PriorityLabel: React.FC<{ priority: Priority; compact?: boolean }> = ({
  priority,
  compact = false,
}) => {
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold leading-tight tracking-tight ${meta.badgeBg} ${meta.textColor} whitespace-nowrap shrink-0 transition-transform duration-150`}
      title={`Prioridade ${meta.label}`}
    >
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotColor}`} />
      {!compact && <span>{meta.label}</span>}
    </span>
  );
};