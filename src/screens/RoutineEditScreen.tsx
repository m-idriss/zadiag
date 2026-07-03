import { useState } from 'react';
import { IonButton, IonInput, IonToggle } from '@ionic/react';
import type { MonitoringPlan, TimeWindow } from '../domain/models';
import type { MessageKey } from '../services/i18n';

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
  const [checksPerDay, setChecksPerDay] = useState(String(plan.checksPerDay));
  const [windows, setWindows] = useState<TimeWindow[]>(plan.windows);
  const [weekdays, setWeekdays] = useState<number[]>(plan.weekdays);
  const [error, setError] = useState<string>();

  const handleWindowChange = (index: number, field: 'start' | 'end', value: string) => {
    const newWindows = [...windows];
    newWindows[index] = { ...newWindows[index], [field]: value };
    setWindows(newWindows);
  };

  const toggleWeekday = (day: number) => {
    if (weekdays.includes(day)) {
      setWeekdays(weekdays.filter((d) => d !== day));
    } else {
      setWeekdays([...weekdays, day].sort());
    }
  };

  const handleSave = async () => {
    setError(undefined);
    const checksNum = parseInt(checksPerDay, 10);
    if (Number.isNaN(checksNum) || checksNum < 1 || checksNum > 10) {
      setError('Invalid checks per day');
      return;
    }
    if (weekdays.length === 0) {
      setError('Select at least one day');
      return;
    }
    try {
      await onSave({
        ...plan,
        checksPerDay: checksNum,
        windows,
        weekdays,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Save error:', message);
      setError(`Failed to save: ${message}`);
    }
  };

  const dayLabels = [t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday'), t('sunday')];

  return (
    <div className="content-screen routine-edit-screen">
      <button type="button" className="back-button" onClick={onCancel}>‹</button>
      <header className="screen-header"><div><h1>{t('editMonitoringPlan')}</h1></div></header>
      
      <section className="card edit-section">
        <h2>{t('checksDay')}</h2>
        <IonInput
          label={t('checksPerDay')}
          labelPlacement="stacked"
          type="number"
          min="1"
          max="10"
          value={checksPerDay}
          onIonInput={(e) => setChecksPerDay(String(e.detail.value ?? ''))}
        />
      </section>

      <section className="card edit-section">
        <h2>{t('timeWindows')}</h2>
        {windows.map((window, index) => (
          <div key={window.id} className="time-window-editor">
            <small>{window.id}</small>
            <IonInput
              label={t('start')}
              labelPlacement="stacked"
              type="time"
              value={window.start}
              onIonInput={(e) => handleWindowChange(index, 'start', String(e.detail.value ?? ''))}
            />
            <IonInput
              label={t('end')}
              labelPlacement="stacked"
              type="time"
              value={window.end}
              onIonInput={(e) => handleWindowChange(index, 'end', String(e.detail.value ?? ''))}
            />
          </div>
        ))}
      </section>

      <section className="card edit-section">
        <h2>{t('activeOn')}</h2>
        <div className="weekday-toggles">
          {dayLabels.map((label, index) => (
            <label key={index} className="weekday-toggle">
              <IonToggle
                checked={weekdays.includes(index + 1)}
                onIonChange={() => toggleWeekday(index + 1)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      {error && <p className="form-error">{error || t('invalidInput')}</p>}

      <div className="edit-actions">
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
