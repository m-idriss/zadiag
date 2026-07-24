import { useEffect, useState } from 'react';
import type { RewardPoolStatus } from '../services/contracts';
import type { MessageKey } from '../services/i18n';
import { ActionButton } from './ui';

export function RewardPoolManager({ routineId, load, add, revoke, t }: {
  routineId: string;
  load: (routineId: string) => Promise<RewardPoolStatus>;
  add: (routineId: string, codes: string[], claimLifetimeHours: number) => Promise<RewardPoolStatus>;
  revoke: (routineId: string) => Promise<RewardPoolStatus>;
  t: (key: MessageKey) => string;
}) {
  const [status, setStatus] = useState<RewardPoolStatus>();
  const [codes, setCodes] = useState('');
  const [hours, setHours] = useState(24);
  const [feedback, setFeedback] = useState<'saved' | 'revoked' | 'error'>();
  const [busy, setBusy] = useState(false);
  useEffect(() => { void load(routineId).then((next) => { setStatus(next); setHours(next.claimLifetimeHours); }).catch(() => setFeedback('error')); }, [load, routineId]);
  const save = async () => {
    setBusy(true);
    setFeedback(undefined);
    try {
      const next = await add(routineId, codes.split(/\r?\n/), hours);
      setStatus(next);
      setCodes('');
      setFeedback('saved');
    } catch {
      setFeedback('error');
    } finally {
      setBusy(false);
    }
  };
  const revokeUnused = async () => {
    setBusy(true);
    try {
      setStatus(await revoke(routineId));
      setFeedback('revoked');
    } catch {
      setFeedback('error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card reward-pool-manager">
      <h2>{t('rewardPoolTitle')}</h2>
      <p>{t('rewardPoolHint')}</p>
      <strong>{status?.remainingCount ?? '—'} {t('rewardPoolCount')}</strong>
      <label><span>{t('rewardExpiryHours')}</span><input type="number" min={1} max={168} value={hours} onChange={(event) => setHours(Number(event.target.value))} /></label>
      <label><span>{t('rewardCodesLabel')}</span><textarea value={codes} maxLength={24_100} onChange={(event) => setCodes(event.target.value)} /></label>
      <ActionButton disabled={busy || !codes.trim()} onClick={() => { void save(); }}>{t('rewardPoolSave')}</ActionButton>
      {status?.remainingCount ? <ActionButton fill="outline" disabled={busy} onClick={() => { void revokeUnused(); }}>{t('rewardPoolRevoke')}</ActionButton> : null}
      {feedback ? <p role={feedback === 'error' ? 'alert' : 'status'} className={feedback === 'error' ? 'form-error' : undefined}>{t(feedback === 'saved' ? 'rewardPoolSaved' : feedback === 'revoked' ? 'rewardPoolRevoked' : 'rewardPoolError')}</p> : null}
    </section>
  );
}
