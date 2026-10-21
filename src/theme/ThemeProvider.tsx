import React, { useEffect } from 'react';
import { useAppStore } from '../app/store';
import { computeThemeVariables, DEFAULT_ACCENT_COLOR, normalizeHexColor } from '../domain/color';

const THEME_SNAPSHOT_KEY = 'intask_theme_snapshot';

export function applyThemeToDom(accentHex: string, resolvedDark: boolean, persistSnapshot = true): void {
  const root = document.documentElement;
  const cleanAccent = normalizeHexColor(accentHex || DEFAULT_ACCENT_COLOR);
  const vars = computeThemeVariables(cleanAccent, resolvedDark);

  if (resolvedDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  (Object.keys(vars) as Array<keyof typeof vars>).forEach((key) => {
    root.style.setProperty(key, vars[key]);
  });

  const metaTheme = document.getElementById('meta-theme-color');
  if (metaTheme) {
    metaTheme.setAttribute('content', cleanAccent);
  }

  if (persistSnapshot) {
    try {
      window.localStorage.setItem(
        THEME_SNAPSHOT_KEY,
        JSON.stringify({
          accentColor: cleanAccent,
          themeMode: resolvedDark ? 'dark' : 'light',
          vars,
        })
      );
    } catch {
      // Ignore storage errors
    }
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAppStore((s) => s.user);
  const accentColor = user?.preferences.accentColor || DEFAULT_ACCENT_COLOR;
  const themeMode = user?.preferences.themeMode || 'system';

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const syncTheme = () => {
      const isDark =
        themeMode === 'dark' ? true : themeMode === 'light' ? false : mediaQuery.matches;
      applyThemeToDom(accentColor, isDark, Boolean(user));
    };

    syncTheme();

    const listener = () => {
      if (themeMode === 'system') {
        syncTheme();
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [accentColor, themeMode, user]);

  return <>{children}</>;
};
