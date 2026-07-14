import type { Role } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon } from './Icon';

export function SetupProgress({ current, role = 'child', t }: { current: 1 | 2 | 3; role?: Role; t: (key: MessageKey) => string }) {
  const labels: Record<Role, [MessageKey, MessageKey, MessageKey]> = {
    child: ['setupInstallShort', 'setupLinkShort', 'setupNotifyShort'],
    parent: ['parentSetupCreateShort', 'parentSetupLinkShort', 'parentSetupRoutineShort'],
  };
  const steps = labels[role].map((label, index) => ({ number: (index + 1) as 1 | 2 | 3, label }));

  return (
    <ol className="setup-progress" aria-label={t('setupProgressLabel')}>
      {steps.map((step) => {
        const state = step.number < current ? 'complete' : step.number === current ? 'active' : 'upcoming';
        return (
          <li className={state} key={step.number} aria-current={state === 'active' ? 'step' : undefined}>
            <span>{state === 'complete' ? <AppIcon name="check" /> : step.number}</span>
            <small>{t(step.label)}</small>
          </li>
        );
      })}
    </ol>
  );
}
