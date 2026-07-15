import { useEffect, useRef, useState } from 'react';
import { checkmarkOutline, copyOutline } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';
import { copyTextToClipboard } from '../services/clipboard';
import { SvgIcon } from './SvgIcon';

export function CopyableText({ value, t, compact = false }: {
  value: string;
  t: (key: MessageKey) => string;
  compact?: boolean;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');
  const resetTimer = useRef<number | null>(null);
  const label = t(state === 'copied' ? 'copiedCode' : state === 'error' ? 'copyCodeError' : 'copyCode');

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  const copy = async () => {
    try {
      await copyTextToClipboard(value);
      setState('copied');
    } catch {
      setState('error');
    }
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setState('idle'), 1_200);
  };

  return (
    <span className={`copyable-text${compact ? ' compact' : ''}`}>
      <strong>{value}</strong>
      <button type="button" className={state} aria-label={label} title={label} onClick={() => { void copy(); }}>
        <SvgIcon icon={state === 'copied' ? checkmarkOutline : copyOutline} />
      </button>
    </span>
  );
}
