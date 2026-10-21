import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAppStore } from './app/store';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthPage } from './features/auth/AuthPage';
import { GoalsPage } from './features/goals/GoalsPage';
import { InboxPage } from './features/inbox/InboxPage';
import { OrganizationsPage } from './features/organizations/OrganizationsPage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TagsPage } from './features/tags/TagsPage';
import { TodayPage } from './features/today/TodayPage';
import { ThemeProvider } from './theme/ThemeProvider';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAppStore((s) => s.user);
  const isInitialized = useAppStore((s) => s.isInitialized);

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <div className="h-8 w-40 rounded-xl bg-[var(--surface-2)] animate-pulse" />
          <div className="h-24 w-full rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          <div className="h-16 w-full rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  const initialize = useAppStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/hoje" replace />} />
              <Route path="/hoje" element={<TodayPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/projetos" element={<ProjectsPage />} />
              <Route path="/organizacoes" element={<OrganizationsPage />} />
              <Route path="/convite/:code" element={<OrganizationsPage />} />
              <Route path="/metas" element={<GoalsPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/hoje" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}