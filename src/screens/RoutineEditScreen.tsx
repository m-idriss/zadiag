import { IonIcon } from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import type { MonitoringPlan, RoutineValidationMode, ScheduleGroup } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import {
  buildMonitoringPlanFromGroups,
  flattenScheduleGroups,
  groupsFromLegacyPlan,
  MAX_SCHEDULE_GROUPS,
  MAX_TIME_WINDOWS,
  nextScheduleGroupId,
  nextWindowId,
  normalizeWeekdays,
  summarizeWeekdays,
  validateScheduleGroupsDraft,
} from '../domain/monitoringPlan';

const dayOptions = [
  { label: 'mondayShort', longLabel: 'monday', day: 1 },
  { label: 'tuesdayShort', longLabel: 'tuesday', day: 2 },
  { label: 'wednesdayShort', longLabel: 'wednesday', day: 3 },
  { label: 'thursdayShort', longLabel: 'thursday', day: 4 },
  { label: 'fridayShort', longLabel: 'friday', day: 5 },
  { label: 'saturdayShort', longLabel: 'saturday', day: 6 },
  { label: 'sundayShort', longLabel: 'sunday', day: 7 },
] as const;

const defaultGroupLabel = (index: number, group: ScheduleGroup, t: (key: MessageKey) => string) => {
  const label = group.label?.trim();
  if (!label || label === summarizeWeekdays(group.weekdays, t)) return `${t('monitoringPeriod')} ${index + 1}`;
  return label;
};

const scheduleGroupsSignature = (groups: ScheduleGroup[]) => JSON.stringify(groups.map((group) => ({
  id: group.id,
  label: group.label?.trim() ?? '',
  weekdays: normalizeWeekdays(group.weekdays),
  windows: group.windows.map((window) => ({
    id: window.id,
    start: window.start,
    end: window.end,
  })),
})));

const timeHours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const timeMinutes = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));
const responseWindowOptions = [15, 30, 60, 120, 0] as const;

const normalizedExpiryMinutes = (value: number | undefined) =>
  Number.isInteger(value) && responseWindowOptions.includes(Number(value) as typeof responseWindowOptions[number])
    ? Number(value)
    : 0;

const storedExpiryMinutes = (value: number | undefined) =>
  Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 120
    ? Number(value)
    : 0;

type TimePickerState = {
  groupId: string;
  windowId: string;
  field: 'start' | 'end';
  hour: string;
  minute: string;
};

export function RoutineEditScreen({
  plan,
  validationMode = 'ai',
  canEditValidationMode = false,
  routineId,
  onSave,
  onCancel,
  t,
  busy,
  embedded = false,
}: {
  plan: MonitoringPlan;
  validationMode?: RoutineValidationMode;
  canEditValidationMode?: boolean;
  routineId: string;
  onSave: (plan: MonitoringPlan, validationMode?: RoutineValidationMode) => Promise<void>;
  onCancel: () => void;
  t: (key: MessageKey) => string;
  busy: boolean;
  embedded?: boolean;
}) {
  const [groups, setGroups] = useState<ScheduleGroup[]>(groupsFromLegacyPlan(plan));
  const [draftValidationMode, setDraftValidationMode] = useState<RoutineValidationMode>(validationMode);
  const [draftExpiryMinutes, setDraftExpiryMinutes] = useState(() => normalizedExpiryMinutes(plan.expiryMinutes));
  const [error, setError] = useState<string>();
  const [timePicker, setTimePicker] = useState<TimePickerState>();
  const flattened = flattenScheduleGroups(groups);
  const totalWindowCount = flattened.windows.length;
  const initialGroupsSignature = useMemo(() => scheduleGroupsSignature(groupsFromLegacyPlan(plan)), [plan]);
  const initialExpiryMinutes = useMemo(() => storedExpiryMinutes(plan.expiryMinutes), [plan.expiryMinutes]);
  const currentGroupsSignature = useMemo(() => scheduleGroupsSignature(groups), [groups]);
  const hasChanges = currentGroupsSignature !== initialGroupsSignature
    || draftExpiryMinutes !== initialExpiryMinutes
    || (canEditValidationMode && draftValidationMode !== validationMode);

  const resetDraft = () => {
    setGroups(groupsFromLegacyPlan(plan));
    setDraftValidationMode(validationMode);
    setDraftExpiryMinutes(normalizedExpiryMinutes(plan.expiryMinutes));
    setError(undefined);
    setTimePicker(undefined);
  };

  useEffect(() => {
    resetDraft();
  }, [plan, routineId, validationMode]);

  const updateGroup = (groupId: string, updater: (group: ScheduleGroup) => ScheduleGroup) => {
    setGroups((current) => current.map((group) => group.id === groupId ? updater(group) : group));
  };

  const addGroup = () => {
    if (groups.length >= MAX_SCHEDULE_GROUPS) {
      setError(t('maxScheduleGroupsError'));
      return;
    }
    if (totalWindowCount >= MAX_TIME_WINDOWS) {
      setError(t('maxTimeWindowsError'));
      return;
    }
    setGroups((current) => [...current, {
      id: nextScheduleGroupId(current),
      weekdays: [6, 7],
      windows: [{ id: 'w1', start: '10:00', end: '12:00' }],
    }]);
  };

  const removeGroup = (groupId: string) => {
    setGroups((current) => current.length === 1 ? current : current.filter((group) => group.id !== groupId));
  };

  const addWindow = (groupId: string) => {
    if (totalWindowCount >= MAX_TIME_WINDOWS) {
      setError(t('maxTimeWindowsError'));
      return;
    }
    updateGroup(groupId, (group) => ({
      ...group,
      windows: [...group.windows, { id: nextWindowId(group.windows), start: '09:00', end: '17:00' }],
    }));
  };

  const removeWindow = (groupId: string, windowId: string) => {
    updateGroup(groupId, (group) => ({
      ...group,
      windows: group.windows.length === 1 ? group.windows : group.windows.filter((window) => window.id !== windowId),
    }));
  };

  const updateWindow = (groupId: string, windowId: string, field: 'start' | 'end', value: string) => {
    updateGroup(groupId, (group) => ({
      ...group,
      windows: group.windows.map((window) => window.id === windowId ? { ...window, [field]: value } : window),
    }));
  };

  const openTimePicker = (groupId: string, windowId: string, field: 'start' | 'end', value: string) => {
    const [hour = '09', minute = '00'] = value.split(':');
    setTimePicker({
      groupId,
      windowId,
      field,
      hour: hour.padStart(2, '0'),
      minute: minute.padStart(2, '0'),
    });
  };

  const confirmTimePicker = () => {
    if (!timePicker) return;
    updateWindow(timePicker.groupId, timePicker.windowId, timePicker.field, `${timePicker.hour}:${timePicker.minute}`);
    setTimePicker(undefined);
  };

  const toggleWeekday = (groupId: string, day: number) => {
    updateGroup(groupId, (group) => ({
      ...group,
      weekdays: group.weekdays.includes(day)
        ? group.weekdays.filter((currentDay) => currentDay !== day)
        : normalizeWeekdays([...group.weekdays, day]),
    }));
  };

  const handleSave = async () => {
    setError(undefined);
    const validationError = validateScheduleGroupsDraft(groups);
    if (validationError) {
      setError(t(validationError));
      return;
    }
    try {
      await onSave(buildMonitoringPlanFromGroups({ ...plan, expiryMinutes: draftExpiryMinutes }, groups), canEditValidationMode ? draftValidationMode : undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Save error:', message);
      setError(`${t('savePlanError')} ${message}`);
    }
  };

  const handleCancel = () => {
    if (embedded) {
      resetDraft();
      return;
    }
    onCancel();
  };

  return (
    <div className={embedded ? 'routine-edit-screen routine-edit-embedded' : 'content-screen routine-edit-screen'} data-routine-id={routineId}>
      {!embedded && (
        <header className="screen-header routine-edit-header">
          <button type="button" className="edit-back-button" onClick={onCancel} aria-label={t('cancel')}>‹</button>
          <div>
            <small>{t('monitoringPlan')}</small>
            <h1>{t('editMonitoringPlan')}</h1>
          </div>
        </header>
      )}

      {canEditValidationMode && <section className="card plan-editor-section routine-validation-card">
        <div className="card-title routine-edit-card-title">
          <h2><span aria-hidden="true">✓</span>{t('routineValidation')}</h2>
        </div>
        <p>{t('routineValidationHint')}</p>
        <div className="routine-validation-toggle" role="group" aria-label={t('routineValidation')}>
          <button
            type="button"
            className={draftValidationMode === 'auto' ? 'active' : ''}
            aria-pressed={draftValidationMode === 'auto'}
            onClick={() => setDraftValidationMode('auto')}
          >
            <strong>{t('validationAuto')}</strong>
            <span>{t('validationAutoHint')}</span>
          </button>
          <button
            type="button"
            className={draftValidationMode === 'ai' ? 'active' : ''}
            aria-pressed={draftValidationMode === 'ai'}
            onClick={() => setDraftValidationMode('ai')}
          >
            <strong>{t('validationAi')}</strong>
            <span>{t('validationAiHint')}</span>
          </button>
        </div>
      </section>}

      <section className="card plan-editor-section response-window-card">
        <div className="card-title routine-edit-card-title">
          <h2><span aria-hidden="true">⏱</span>{t('responseWindowTitle')}</h2>
        </div>
        <p>{t('responseWindowHint')}</p>
        <div className="response-window-options" role="group" aria-label={t('responseWindowTitle')}>
          {responseWindowOptions.map((minutes) => (
            <button
              type="button"
              className={`${draftExpiryMinutes === minutes ? 'active' : ''}${minutes === 0 ? ' response-window-full' : ''}`}
              aria-pressed={draftExpiryMinutes === minutes}
              onClick={() => setDraftExpiryMinutes(minutes)}
              key={minutes}
            >
              {minutes === 0 ? t('responseWindowFullOption') : `${minutes}m`}
            </button>
          ))}
        </div>
      </section>

      {groups.map((group, groupIndex) => (
        <section className="card plan-editor-section schedule-group-card" key={group.id}>
          <div className="card-title routine-edit-card-title">
            <h2><span aria-hidden="true">◷</span>{defaultGroupLabel(groupIndex, group, t)}</h2>
            <button type="button" className="schedule-group-remove" disabled={groups.length === 1} onClick={() => removeGroup(group.id)} aria-label={t('removeScheduleGroup')}>
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="plan-days-grid schedule-group-days">
            {dayOptions.map(({ label, longLabel, day }) => {
              const active = group.weekdays.includes(day);
              return (
                <button
                  type="button"
                  className={active ? 'active' : ''}
                  aria-pressed={active}
                  aria-label={t(longLabel)}
                  onClick={() => toggleWeekday(group.id, day)}
                  key={day}
                >
                  <span>{t(label)}</span>
                </button>
              );
            })}
          </div>

          <div className="plan-window-list">
            {group.windows.map((window, windowIndex) => (
              <article className="plan-window-card" key={window.id}>
                <div className="plan-window-index">
                  <span>{windowIndex + 1}</span>
                </div>
                <div className="plan-time-fields">
                  <button type="button" className="plan-time-button" aria-label={`${t('start')} ${window.start}`} onClick={() => openTimePicker(group.id, window.id, 'start', window.start)}>
                    <span>{t('start')}</span><b>{window.start}</b>
                  </button>
                  <button type="button" className="plan-time-button" aria-label={`${t('end')} ${window.end}`} onClick={() => openTimePicker(group.id, window.id, 'end', window.end)}>
                    <span>{t('end')}</span><b>{window.end}</b>
                  </button>
                </div>
                <button type="button" className="plan-remove-button" onClick={() => removeWindow(group.id, window.id)} aria-label={t('removeWindow')} disabled={group.windows.length === 1}>
                  <span aria-hidden="true">×</span>
                </button>
              </article>
            ))}
          </div>
          <button type="button" className="plan-add-button schedule-add-window" disabled={totalWindowCount >= MAX_TIME_WINDOWS} onClick={() => addWindow(group.id)}>
            <IonIcon icon={addOutline} aria-hidden="true" />{t('addTimeSlot')}
          </button>
        </section>
      ))}

      <button type="button" className="plan-add-button schedule-add-group" disabled={groups.length >= MAX_SCHEDULE_GROUPS || totalWindowCount >= MAX_TIME_WINDOWS} onClick={addGroup}>
        <IonIcon icon={addOutline} aria-hidden="true" />{t('addScheduleGroup')}
      </button>

      {error && <p className="form-error">{error}</p>}

      <div className="routine-edit-actions">
        <button type="button" className="regenerate-code routine-edit-cancel" onClick={handleCancel} disabled={busy || !hasChanges}>
          {t('cancel')}
        </button>
        <button type="button" className="request-check routine-edit-save" onClick={handleSave} disabled={busy || !hasChanges}>
          {busy ? t('saving') : t('save')}
        </button>
      </div>

      {timePicker ? (
        <div className="time-picker-backdrop" role="presentation" onClick={() => setTimePicker(undefined)}>
          <section className="time-picker-sheet" role="dialog" aria-modal="true" aria-label={t('chooseTime')} onClick={(event) => event.stopPropagation()}>
            <div className="time-picker-header">
              <div>
                <small>{timePicker.field === 'start' ? t('start') : t('end')}</small>
                <h2>{t('chooseTime')}</h2>
              </div>
              <strong>{timePicker.hour}:{timePicker.minute}</strong>
            </div>
            <div className="time-picker-columns">
              <div>
                <span>{t('hours')}</span>
                <div className="time-picker-grid hours">
                  {timeHours.map((hour) => (
                    <button type="button" className={timePicker.hour === hour ? 'active' : ''} onClick={() => setTimePicker((current) => current ? { ...current, hour } : current)} key={hour}>
                      {hour}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span>{t('minutes')}</span>
                <div className="time-picker-grid minutes">
                  {timeMinutes.map((minute) => (
                    <button type="button" className={timePicker.minute === minute ? 'active' : ''} onClick={() => setTimePicker((current) => current ? { ...current, minute } : current)} key={minute}>
                      {minute}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="time-picker-actions">
              <button type="button" className="regenerate-code" onClick={() => setTimePicker(undefined)}>{t('cancel')}</button>
              <button type="button" className="request-check" onClick={confirmTimePicker}>{t('confirm')}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
