import { useState } from 'react';
import type { RewardClaimReveal } from '../services/contracts';
import type { MessageKey } from '../services/i18n';
import { ActionButton } from './ui';

export function RewardReveal({ eventId, outcome, reveal, t }: {
  eventId: string;
  outcome: 'claimed' | 'exhausted' | 'expired' | 'revoked';
  reveal: (eventId: string) => Promise<RewardClaimReveal>;
  t: (key: MessageKey) => string;
}) {
  const [result, setResult] = useState<RewardClaimReveal>();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'copied' | 'error'>();
  const status = result?.status ?? outcome;
  const revealCode = async () => {
    setBusy(true);
    try {
      setResult(await reveal(eventId));
    } catch {
      setResult({ status: 'unavailable' });
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!result?.value) return;
    try {
      await navigator.clipboard.writeText(result.value);
      setCopied('copied');
    } catch {
      setCopied('error');
    }
  };
  if (status !== 'claimed') {
    const key: MessageKey = status === 'expired'
      ? 'rewardExpired'
      : status === 'exhausted'
        ? 'rewardExhausted'
        : status === 'revoked'
          ? 'rewardRevoked'
          : 'rewardUnavailable';
    return <section className="reward-card" aria-live="polite"><h2>{t('rewardTitle')}</h2><p>{t(key)}</p></section>;
  }
  return (
    <section className="reward-card" aria-live="polite">
      <h2>{t('rewardTitle')}</h2>
      <p>{result?.value ? t('rewardRevealHint') : t('rewardClaimedHint')}</p>
      {result?.value ? (
        <div className="reward-code">
          <strong>{result.value}</strong>
          <button type="button" onClick={() => { void copy(); }}>{t(copied === 'copied' ? 'copiedCode' : 'copyCode')}</button>
          {copied === 'error' ? <span role="alert">{t('copyCodeError')}</span> : null}
        </div>
      ) : <ActionButton disabled={busy} aria-busy={busy} onClick={() => { void revealCode(); }}>{t(busy ? 'rewardRevealing' : 'rewardRevealAction')}</ActionButton>}
    </section>
  );
}
