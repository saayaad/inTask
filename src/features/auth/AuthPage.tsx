import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Sparkles,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useAppStore } from '../../app/store';
import { Logo } from '../../components/Logo';
import { auth, dataProvider } from '../../data/firebaseAdapter';

export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const localAccounts = useAppStore((s) => s.localAccounts);
  const login = useAppStore((s) => s.login);
  const register = useAppStore((s) => s.register);
  const switchAccount = useAppStore((s) => s.switchAccount);
  const seedSampleData = useAppStore((s) => s.seedSampleData);
  const refreshUserData = useAppStore((s) => s.refreshUserData);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/hoje" replace />;
  }

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};
    if (mode === 'register' && name.trim().length < 2) {
      errors.name = 'Informe seu nome completo (mínimo de 2 caracteres).';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Informe um endereço de e-mail válido.';
    }
    if (password.length < 8) {
      errors.password = 'A senha deve ter no mínimo 8 caracteres.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setFieldErrors({});
    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ name, email, password });
      }
      navigate('/hoje', { replace: true });
    } catch (err) {
      setFieldErrors({
        general: err instanceof Error ? err.message : 'Não foi possível autenticar.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setFieldErrors({});
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      const accounts = await dataProvider.auth.listLocalAccounts();
      let matchedAccount = accounts.find(
        (acc) => acc.email.toLowerCase() === (googleUser.email || '').toLowerCase()
      );

      if (!matchedAccount) {
        matchedAccount = await dataProvider.auth.register({
          name: googleUser.displayName || 'Usuário Google',
          email: googleUser.email || `google_${googleUser.uid}@intask.app`,
          password: `GoogleAuthPass_${googleUser.uid.slice(0, 10)}`,
        });
      }

      await switchAccount(matchedAccount.id);
      await refreshUserData(matchedAccount);
      navigate('/hoje', { replace: true });
    } catch (err) {
      setFieldErrors({
        general: err instanceof Error ? err.message : 'Falha na autenticação com o Google.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden">
      {/* Ambient Decorative Background Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div
          style={{
            background:
              'radial-gradient(circle, rgba(28, 60, 238, 0.14) 0%, rgba(28, 60, 238, 0) 70%)',
          }}
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full blur-2xl"
        />
      </div>

      <div
        style={{ boxShadow: 'var(--shadow-elevated)' }}
        className="relative z-10 w-full max-w-[440px] bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--border)] rounded-3xl p-6 sm:p-8 space-y-6 animate-page-enter"
      >
        {/* Brand Header with fixed #1c3cee on login screen */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <Logo size={48} fixedBrandColor showWordmark={false} />
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">
              In Task
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-xs leading-relaxed">
              Foco do dia, planejamento semanal, delegação em equipe e metas de longo prazo.
            </p>
          </div>
        </div>

        {/* Mode Switcher Pill */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setFieldErrors({});
            }}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              mode === 'login'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setFieldErrors({});
            }}
            className={`min-h-[40px] rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              mode === 'register'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Criar conta
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5 animate-item-enter">
              <label
                htmlFor="auth-name"
                className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
              >
                Seu nome
              </label>
              <div className="relative group">
                <UserIcon className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[#1c3cee] transition-colors absolute left-3.5 top-3.5" />
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Marina Costa"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] focus:border-[#1c3cee] focus:bg-[var(--surface)] text-sm font-medium text-[var(--text)] transition-all"
                />
              </div>
              {fieldErrors.name && (
                <p className="text-xs text-rose-500 font-semibold animate-item-enter">
                  {fieldErrors.name}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="auth-email"
              className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
            >
              E-mail
            </label>
            <div className="relative group">
              <Mail className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[#1c3cee] transition-colors absolute left-3.5 top-3.5" />
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com.br"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] focus:border-[#1c3cee] focus:bg-[var(--surface)] text-sm font-medium text-[var(--text)] transition-all"
              />
            </div>
            {fieldErrors.email && (
              <p className="text-xs text-rose-500 font-semibold animate-item-enter">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="auth-password"
              className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]"
            >
              Senha (mínimo de 8 caracteres)
            </label>
            <div className="relative group">
              <Lock className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[#1c3cee] transition-colors absolute left-3.5 top-3.5" />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] focus:border-[#1c3cee] focus:bg-[var(--surface)] text-sm font-medium text-[var(--text)] transition-all"
              />
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-rose-500 font-semibold animate-item-enter">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {fieldErrors.general && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-semibold animate-pop-in">
              {fieldErrors.general}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              backgroundColor: '#1c3cee',
              color: '#ffffff',
              boxShadow: '0 8px 20px -4px rgba(28, 60, 238, 0.4)',
            }}
            className="w-full min-h-[46px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer btn-press group"
          >
            <span>
              {isSubmitting
                ? 'Processando...'
                : mode === 'login'
                ? 'Entrar no In Task'
                : 'Criar minha conta'}
            </span>
            <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
          </button>
        </form>

        {/* Google Auth Button */}
        <div className="space-y-2.5 pt-2">
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[var(--border)] w-full" />
            <span className="bg-[var(--surface)] px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              ou
            </span>
            <div className="border-t border-[var(--border)] w-full" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full min-h-[44px] px-4 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text)] flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 btn-press"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.5 1.18-4.22 1.18-3.25 0-6-2.2-6.98-5.15H1.01v3.14C3.02 21.16 7.2 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.02 14.02c-.25-.74-.39-1.54-.39-2.36s.14-1.62.39-2.36V6.16H1.01C.37 7.44 0 8.88 0 11.66s.37 4.22 1.01 5.5l4.01-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.2 0 3.02 2.84 1.01 6.84l4.01 3.14c.98-2.95 3.73-5.23 6.98-5.23Z"
              />
            </svg>
            <span>{isSubmitting ? 'Conectando...' : 'Continuar com Google'}</span>
          </button>
        </div>

        {/* Local Accounts Quick Switcher / Demo Loader */}
        <div className="pt-4 border-t border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Contas neste dispositivo
            </span>
            <button
              type="button"
              onClick={async () => {
                await seedSampleData();
                navigate('/hoje', { replace: true });
              }}
              className="text-xs font-bold text-[#1c3cee] dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Dados de exemplo
            </button>
          </div>

          {localAccounts.length > 0 ? (
            <div className="space-y-2 stagger-list">
              {localAccounts.map((acc) => {
                const initials = acc.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={async () => {
                      await switchAccount(acc.id);
                      navigate('/hoje', { replace: true });
                    }}
                    className="group w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl bg-[var(--surface-2)]/70 hover:bg-[var(--surface-2)] hover:border-[#1c3cee]/50 border border-[var(--border)] flex items-center justify-between gap-3 text-xs transition-all cursor-pointer btn-press"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#1c3cee]/12 text-[#1c3cee] dark:text-indigo-400 font-extrabold text-[11px] flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-bold text-[var(--text)] truncate">{acc.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {acc.email}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-[#1c3cee] dark:text-indigo-400 shrink-0 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Entrar →
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[var(--surface-2)]/50 border border-dashed border-[var(--border)] text-center">
              <p className="text-xs text-[var(--text-muted)] flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Crie uma conta acima ou carregue os dados de exemplo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};