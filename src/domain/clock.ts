import { addDays, format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const CLOCK_OFFSET_STORAGE_KEY = 'intask_clock_offset_days';

let customNowFn: (() => Date) | null = null;
let simulatedOffsetDays = 0;

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(CLOCK_OFFSET_STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        simulatedOffsetDays = parsed;
      }
    }
  }
} catch {
  // Ignore storage errors during module init
}

export function setCustomClock(fn: (() => Date) | null): void {
  customNowFn = fn;
}

export function getSimulatedOffsetDays(): number {
  return simulatedOffsetDays;
}

export function setSimulatedOffsetDays(days: number): void {
  simulatedOffsetDays = days;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (days === 0) {
        window.localStorage.removeItem(CLOCK_OFFSET_STORAGE_KEY);
      } else {
        window.localStorage.setItem(CLOCK_OFFSET_STORAGE_KEY, String(days));
      }
    }
  } catch {
    // Ignore
  }
}

export function advanceSimulatedDay(step = 1): number {
  setSimulatedOffsetDays(simulatedOffsetDays + step);
  return simulatedOffsetDays;
}

export function now(): Date {
  const base = customNowFn ? customNowFn() : new Date();
  if (simulatedOffsetDays !== 0) {
    return addDays(base, simulatedOffsetDays);
  }
  return base;
}

export function toDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayStr(): string {
  return toDateStr(now());
}

export function parseLocalDate(dateStr: string): Date {
  // Parse YYYY-MM-DD in local time without UTC shift bugs
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function addDaysToStr(dateStr: string, days: number): string {
  return toDateStr(addDays(parseLocalDate(dateStr), days));
}

export function getNextMondayStr(fromDateStr: string): string {
  const d = parseLocalDate(fromDateStr);
  const day = d.getDay(); // 0 = Sun, 1 = Mon ...
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  return toDateStr(addDays(d, daysUntilMonday));
}

export function getWeekDaysMondayToSunday(referenceDateStr: string): string[] {
  const ref = parseLocalDate(referenceDateStr);
  const start = startOfWeek(ref, { weekStartsOn: 1 });
  const end = endOfWeek(ref, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end }).map(toDateStr);
}

export function formatFullPtDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const formatted = format(d, "EEEE, d 'de' MMMM", { locale: ptBR });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatShortPtDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return format(d, "dd 'de' MMM", { locale: ptBR });
}

export function formatWeekdayShort(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return format(d, 'EEE', { locale: ptBR }).replace('.', '');
}

export function getGreetingPt(currentDate = now()): string {
  const hour = currentDate.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function diffInDays(targetDateStr: string, baseDateStr: string = todayStr()): number {
  const t = parseLocalDate(targetDateStr);
  const b = parseLocalDate(baseDateStr);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((t.getTime() - b.getTime()) / msPerDay);
}

export function isWithinLastDays(isoOrDateStr: string | null | undefined, days: number, refTodayStr = todayStr()): boolean {
  if (!isoOrDateStr) return false;
  const datePart = isoOrDateStr.slice(0, 10);
  const diff = diffInDays(refTodayStr, datePart);
  return diff >= 0 && diff <= days;
}
