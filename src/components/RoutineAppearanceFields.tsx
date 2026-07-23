import { useState, type CSSProperties } from 'react';
import type { Locale, RoutineAppearance } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from './Icon';
import { RoutineIconPicker } from './RoutineIconPicker';

export function RoutineAppearanceFields({
  appearance,
  locale,
  onChange,
  t,
  namePlaceholder,
}: {
  appearance: RoutineAppearance;
  locale: Locale;
  onChange: (patch: Partial<RoutineAppearance>) => void;
  t: (key: MessageKey) => string;
  namePlaceholder?: string;
}) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  return (
    <div className="routine-appearance-fields" style={{ '--routine-accent': appearance.accentColor } as CSSProperties}>
      <label className="native-input-field">
        <span>{t('routineDraftName')}</span>
        <input
          value={appearance.name}
          maxLength={120}
          placeholder={namePlaceholder}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <fieldset>
        <legend>{t('routineIcon')}</legend>
        <button type="button" className="routine-icon-picker-trigger" onClick={() => setIconPickerOpen(true)}>
          <AppIcon name={routineIconName(appearance.icon)} />
          <span>{t('routineIconChoose')}</span>
          <AppIcon name="chevron-forward" />
        </button>
      </fieldset>
      <label className="routine-appearance-color">
        <span>{t('routineDraftAccentColor')}</span>
        <input type="color" value={appearance.accentColor} onChange={(event) => onChange({ accentColor: event.target.value.toUpperCase() })} />
      </label>
      {iconPickerOpen ? (
        <RoutineIconPicker
          selected={routineIconName(appearance.icon)}
          locale={locale}
          close={() => setIconPickerOpen(false)}
          select={(icon) => onChange({ icon })}
          t={t}
        />
      ) : null}
    </div>
  );
}
