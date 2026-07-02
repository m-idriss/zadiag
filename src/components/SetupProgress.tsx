import type { MessageKey } from '../services/i18n';

export function SetupProgress({ current, t }: { current: 1 | 2 | 3; t: (key: MessageKey) => string }) {
  const steps: Array<{ number: 1 | 2 | 3; label: MessageKey }> = [
    { number: 1, label: 'setupInstallShort' },
    { number: 2, label: 'setupLinkShort' },
    { number: 3, label: 'setupNotifyShort' },
  ];

  return (
    <ol className="setup-progress" aria-label={t('setupProgressLabel')}>
      {steps.map((step) => {
        const state = step.number < current ? 'complete' : step.number === current ? 'active' : 'upcoming';
        return (
          <li className={state} key={step.number} aria-current={state === 'active' ? 'step' : undefined}>
            <span>{state === 'complete' ? '✓' : step.number}</span>
            <small>{t(step.label)}</small>
          </li>
        );
      })}
    </ol>
  );
}
