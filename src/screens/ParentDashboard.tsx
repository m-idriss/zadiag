import { adherenceSummary } from '../domain/adherence';
import type { AppState } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { StatusPill } from '../components/StatusPill';

export function ParentDashboard({ state, t }: { state: AppState; t: (key: MessageKey) => string }) {
  const summary = adherenceSummary(state.events);
  const attention = state.events.filter((event) => ['uncertain', 'missed', 'expired', 'not_detected'].includes(event.status));
  return (
    <div className="content-screen">
      <header className="screen-header">
        <div><small>{t('overview')}</small><h1>{state.family.childName} · {t('routine')}</h1></div>
        <div className="avatar">{state.family.childName.charAt(0)}</div>
      </header>
      <section className="card summary-card">
        <div className="progress-ring" style={{ '--progress': `${summary.rate * 360}deg` } as React.CSSProperties}>
          <span>{Math.round(summary.rate * 100)}%</span>
        </div>
        <div><h2>{t('lastSeven')}</h2><p>{summary.successful} {t('clearChecks')} {summary.completed}</p><strong>{t('progressEncouragement')}</strong></div>
      </section>
      <section className="card plan-card">
        <div className="card-title"><h2>▣ {t('monitoringPlan')}</h2><button>{t('edit')}</button></div>
        <p><b>{state.plan.checksPerDay}</b> {t('checksDay')} · <b>{state.plan.expiryMinutes}</b> {t('minutesRespond')}</p>
        <div className="chips">{state.plan.windows.map((window) => <span key={window.id}>◷ {window.start}–{window.end}</span>)}</div>
      </section>
      <div className="section-heading"><h2>{t('attention')}</h2><span>{attention.length}</span></div>
      {attention.map((event) => (
        <section className="card history-row" key={event.id}>
          <div><strong>{new Date(event.requestedAt).toLocaleDateString()}</strong><small>{event.reason?.replace('_', ' ')}</small></div>
          <StatusPill status={event.status} t={t} />
        </section>
      ))}
    </div>
  );
}
