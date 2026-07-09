import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { checkmarkOutline, copyOutline, eyeOffOutline, eyeOutline } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';
import { SvgIcon } from './SvgIcon';

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('copy_failed');
}

export function CodeBox({
  label,
  hint,
  value,
  action,
  maskValue = false,
  t,
  className = '',
}: {
  label: string;
  hint: string;
  value: string;
  action?: ReactNode;
  maskValue?: boolean;
  t: (key: MessageKey) => string;
  className?: string;
  }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [revealed, setRevealed] = useState(!maskValue);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    setCopyState('idle');
    setRevealed(!maskValue);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, [value, maskValue]);

  const handleCopy = async () => {
    try {
      await copyToClipboard(value);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    } finally {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopyState('idle'), 1200);
    }
  };

  useEffect(() => () => {
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
  }, []);

  const copyLabel = copyState === 'copied'
    ? t('copiedCode')
    : copyState === 'error'
      ? t('copyCodeError')
      : t('copyCode');
  const visibilityLabel = revealed ? t('hideCode') : t('showCode');
  const visibleValue = revealed ? value : '•'.repeat(value.length);

  return (
    <section className={`card code-box ${className}`.trim()}>
      <div className="code-box-header">
        <div>
          <small className="code-box-label">{label}</small>
          <div className="code-box-value-row">
            <strong>{visibleValue}</strong>
            {maskValue ? (
              <button
                type="button"
                className="toggle-code-visibility"
                aria-label={visibilityLabel}
                title={visibilityLabel}
                onClick={() => setRevealed((current) => !current)}
              >
                <SvgIcon icon={revealed ? eyeOffOutline : eyeOutline} />
                <span>{visibilityLabel}</span>
              </button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className={`copy-code-button ${copyState}`}
          aria-label={copyLabel}
          title={copyLabel}
          aria-live="polite"
          onClick={() => { void handleCopy(); }}
        >
          <SvgIcon icon={copyState === 'copied' ? checkmarkOutline : copyOutline} />
          <span className="copy-code-label">{copyLabel}</span>
        </button>
      </div>
      <span>{hint}</span>
      {copyState !== 'idle' ? <small className={`copy-code-feedback ${copyState}`} role="status" aria-live="polite">{copyLabel}</small> : null}
      {action ? <div className="code-box-actions">{action}</div> : null}
    </section>
  );
}
