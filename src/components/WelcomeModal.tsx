import React, { useEffect, useState } from "react";
import { Sparkles, CalendarCheck2, Inbox, Kanban, Target, Building2, CheckCircle2, X } from "lucide-react";
import { useAppStore } from "../app/store";

export const WelcomeModal: React.FC = () => {
  const user = useAppStore((s) => s.user);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      const storageKey = `intask_welcomed_${user.id}`;
      const hasWelcomed = localStorage.getItem(storageKey);
      if (!hasWelcomed) {
        setIsOpen(true);
      }
    }
  }, [user]);

  const handleClose = () => {
    if (user) {
      localStorage.setItem(`intask_welcomed_${user.id}`, "true");
    }
    setIsOpen(false);
  };

  if (!isOpen || !user) return null;

  const features = [
    { icon: CalendarCheck2, title: "Foco Diário (Hoje)", desc: "Organize suas tarefas por prioridade e acompanhe seu progresso em tempo real." },
    { icon: Inbox, title: "Caixa de Entrada (Inbox)", desc: "Capture ideias rápidas e faça a triagem transformando-as em tarefas ou delegando-as." },
    { icon: Kanban, title: "Planejador & Projetos", desc: "Gerencie seu fluxo semanal em formato de calendário ou colunas Kanban arrastáveis." },
    { icon: Building2, title: "Equipe & Aprovações", desc: "Trabalhe com convites por código, defina administradores e aprove entregas." },
    { icon: Target, title: "Metas de Longo Prazo", desc: "Vincule tarefas a objetivos mensais ou trimestrais e veja o progresso avançar automaticamente." },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-backdrop"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{ boxShadow: "var(--shadow-elevated)" }}
        className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 space-y-6 animate-modal-up relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 p-6">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 text-left">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Bem-vindo(a) ao In Task!
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--text)]">
            Olá, {user.name.split(" ")[0]}! 👋
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            O seu aplicativo completo de produtividade pessoal e em equipe está pronto. Conheça rapidamente o que você pode fazer:
          </p>
        </div>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[var(--surface-2)]/70 border border-[var(--border)]">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h3 className="text-xs font-bold text-[var(--text)]">{f.title}</h3>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleClose}
          style={{ boxShadow: "0 8px 20px -4px var(--accent-glow)" }}
          className="w-full min-h-[46px] rounded-full bg-[var(--accent)] text-[var(--on-accent)] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] transition-all cursor-pointer btn-press"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Começar a usar o In Task</span>
        </button>
      </div>
    </div>
  );
};

