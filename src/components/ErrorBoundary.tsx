import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado na interface.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)]">
          <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold">Algo deu errado</h1>
              <p className="text-sm text-[var(--text-muted)]">
                O aplicativo encontrou um problema inesperado, mas seus dados locais estão seguros.
              </p>
            </div>
            <p className="text-xs font-mono bg-[var(--surface-2)] p-3 rounded-xl text-[var(--text-muted)] break-words">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
