import { useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { addCircleOutline, closeCircleOutline, timeOutline, calendarOutline, eyeOutline } from 'ionicons/icons';
import type { MonitoringPlan, TimeWindow } from '../domain/models';
import type { MessageKey } from '../services/i18n';

const WINDOW_COLORS: Record<string, string> = {
  morning: '#F59E0B',
  midday: '#3B82F6',
  evening: '#8B5CF6',
  night: '#1F2937',
};

export function RoutineEditScreen({
  plan,
  routineId,
  onSave,
  onCancel,
  t,
  busy,
}: {
  plan: MonitoringPlan;
  routineId: string;
  onSave: (plan: MonitoringPlan) => Promise<void>;
  onCancel: () => void;
  t: (key: MessageKey) => string;
  busy: boolean;
}) {
  const [windows, setWindows] = useState<TimeWindow[]>(plan.windows);
  const [weekdays, setWeekdays] = useState<number[]>(plan.weekdays);
  const [error, setError] = useState<string>();

  const handleWindowChange = (index: number, field: 'start' | 'end', value: string) => {
    const newWindows = [...windows];
    newWindows[index] = { ...newWindows[index], [field]: value };
    setWindows(newWindows);
  };

  const addWindow = () => {
    setWindows([...windows, { id: `w${windows.length + 1}`, start: '09:00', end: '17:00' }]);
  };

  const removeWindow = (index: number) => {
    setWindows(windows.filter((_, i) => i !== index));
  };

  const toggleWeekday = (day: number) => {
    if (weekdays.includes(day)) {
      setWeekdays(weekdays.filter((d) => d !== day));
    } else {
      setWeekdays([...weekdays, day].sort());
    }
  };

  const dayShorts = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleSave = async () => {
    setError(undefined);
    if (windows.length === 0) {
      setError('Add at least one time window');
      return;
    }
    if (weekdays.length === 0) {
      setError('Select at least one day');
      return;
    }
    try {
      await onSave({
        ...plan,
        checksPerDay: windows.length,
        windows,
        weekdays,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Save error:', message);
      setError(`Failed to save: ${message}`);
    }
  };

  // Calculate summary
  const startTime = windows.length > 0 ? windows[0].start : '-';
  const endTime = windows.length > 0 ? windows[windows.length - 1].end : '-';
  const activeDaysLabel = (() => {
    if (weekdays.length === 0) return '-';
    if (weekdays.length === 7) return 'Every day';
    if (weekdays.length === 5 && weekdays.every(d => d <= 5)) return 'Mon - Fri';
    return weekdays.map(d => dayShorts[d - 1]).join(', ');
  })();

  const colors = [WINDOW_COLORS.morning, WINDOW_COLORS.midday, WINDOW_COLORS.evening];

  return (
    <div className="content-screen routine-edit-screen">
      <header className="routine-edit-header">
        <button type="button" className="back-btn" onClick={onCancel}>‹</button>
        <div>
          <h1>{t('editMonitoringPlan')}</h1>
          <p>{t('configureMonitoring')}</p>
        </div>
      </header>

      <section className="routine-edit-card">
        <div className="card-header-with-action">
          <div className="card-header">
            <span className="card-icon"><IonIcon icon={timeOutline} /></span>
            <h2>{t('timeWindows')}</h2>
          </div>
          <button type="button" className="add-btn" onClick={addWindow}>
            <IonIcon icon={addCircleOutline} /> {t('addWindow')}
          </button>
        </div>

        <div className="windows-container">
          {windows.map((window, index) => (
            <div key={window.id} className="window-row">
              <div className="window-bar" style={{ backgroundColor: colors[index % colors.length] }}></div>
              <div className="window-inputs">
                <div className="time-group">
                  <label>{t('start')}</label>
                  <input
                    type="time"
                    value={window.start}
                    onChange={(e) => handleWindowChange(index, 'start', e.target.value)}
                  />
                </div>
                <div className="time-group">
                  <label>{t('end')}</label>
                  <input
                    type="time"
                    value={window.end}
                    onChange={(e) => handleWindowChange(index, 'end', e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className="remove-btn"
                onClick={() => removeWindow(index)}
                aria-label={t('removeWindow')}
              >
                <IonIcon icon={closeCircleOutline} />
              </button>
            </div>
          ))}
        </div>

        {windows.length > 0 && (
          <div className="windows-info">
            <span className="info-icon"><IonIcon icon={eyeOutline} /></span>
            <div>
              <strong>{windows.length} {t('windowsConfigured')}</strong>
              <p>{t('youllBeReminded')} {windows.length} {t('remindersPerDay')}</p>
            </div>
          </div>
        )}
      </section>

      <section className="routine-edit-card">
        <div className="card-header">
          <span className="card-icon"><IonIcon icon={calendarOutline} /></span>
          <h2>{t('activeDays')}</h2>
        </div>
        <p className="card-hint">{t('onWhichDays')}</p>

        <div className="days-grid">
          {dayShorts.map((day, index) => (
            <button
              key={index}
              type="button"
              className={`day-btn ${weekdays.includes(index + 1) ? 'active' : ''}`}
              onClick={() => toggleWeekday(index + 1)}
            >
              {day}
              {weekdays.includes(index + 1) && <span className="check">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="routine-edit-card">
        <div className="card-header">
          <span className="card-icon"><IonIcon icon={eyeOutline} /></span>
          <h2>{t('summaryPreview')}</h2>
        </div>
        <p className="card-hint">{t('thisIsHowYourPlanLooks')}</p>

        <div className="summary-items">
          <div className="summary-row">
            <span className="summary-icon">🔔</span>
            <div className="summary-text">
              <span className="summary-label">{windows.length} {t('remindersPerDay')}</span>
            </div>
          </div>
          <div className="summary-row">
            <span className="summary-icon">🕐</span>
            <div className="summary-text">
              <span className="summary-label">{startTime} – {endTime}</span>
              <span className="summary-detail">{t('monitoringPeriod')}</span>
            </div>
          </div>
          <div className="summary-row">
            <span className="summary-icon">📅</span>
            <div className="summary-text">
              <span className="summary-label">{activeDaysLabel}</span>
              <span className="summary-detail">{t('activeDays')}</span>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}

      <div className="routine-edit-actions">
        <IonButton expand="block" fill="outline" onClick={onCancel} disabled={busy}>
          {t('cancel')}
        </IonButton>
        <IonButton expand="block" onClick={handleSave} disabled={busy}>
          {busy ? t('saving') : t('save')}
        </IonButton>
      </div>
    </div>
  );
}
