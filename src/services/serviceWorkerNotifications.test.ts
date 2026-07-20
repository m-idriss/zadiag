import { describe, expect, it, vi } from 'vitest';
import { clearBadgeAndCheckNotifications, isCheckNotificationTag, pushPayloadFromData, reportPushReceipt, reportSyntheticPushReceipt } from './serviceWorkerNotifications';

describe('service worker notification helpers', () => {
  it('matches only check and reminder notification tags', () => {
    expect(isCheckNotificationTag('verification')).toBe(true);
    expect(isCheckNotificationTag('verification:session-1')).toBe(true);
    expect(isCheckNotificationTag('reminder:session-1')).toBe(true);
    expect(isCheckNotificationTag('calendar:session-1')).toBe(false);
    expect(isCheckNotificationTag()).toBe(false);
  });

  it('clears badges and closes only check notifications', async () => {
    const closeVerification = vi.fn();
    const closeReminder = vi.fn();
    const closeOther = vi.fn();
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    const registration = {
      getNotifications: vi.fn().mockResolvedValue([
        { tag: 'verification:session-1', close: closeVerification },
        { tag: 'reminder:session-2', close: closeReminder },
        { tag: 'calendar:event-1', close: closeOther },
      ]),
    };

    await clearBadgeAndCheckNotifications(registration, { clearAppBadge });

    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(registration.getNotifications).toHaveBeenCalledTimes(1);
    expect(closeVerification).toHaveBeenCalledTimes(1);
    expect(closeReminder).toHaveBeenCalledTimes(1);
    expect(closeOther).not.toHaveBeenCalled();
  });
});

describe('synthetic push receipts', () => {
  it('reports a synthetic receipt without leaking it into normal notifications', async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const reported = await reportSyntheticPushReceipt({
      kind: 'check-ready',
      sessionId: 'session-1',
      routineId: 'routine-1',
      syntheticReceipt: {
        monitorId: 'monitor-1',
        receiptId: 'receipt-1',
        token: 'secret-token',
        url: 'https://europe-west1-project.cloudfunctions.net/recordSyntheticPushReceipt',
      },
    }, 'received', (async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      return { ok: true } as Response;
    }) as typeof fetch);

    expect(reported).toBe(true);
    expect(requests).toEqual([{
      url: 'https://europe-west1-project.cloudfunctions.net/recordSyntheticPushReceipt',
      body: {
        monitorId: 'monitor-1',
        receiptId: 'receipt-1',
        token: 'secret-token',
        stage: 'received',
        kind: 'check-ready',
        sessionId: 'session-1',
        routineId: 'routine-1',
      },
    }]);
  });

  it('rejects non-HTTPS and non-Cloud-Functions receipt endpoints', async () => {
    const fetcher = vi.fn();
    const base = { monitorId: 'monitor-1', receiptId: 'receipt-1', token: 'secret-token' };
    await expect(reportSyntheticPushReceipt({ syntheticReceipt: { ...base, url: 'http://example.com/receipt' } }, 'received', fetcher)).resolves.toBe(false);
    await expect(reportSyntheticPushReceipt({ syntheticReceipt: { ...base, url: 'https://example.com/receipt' } }, 'received', fetcher)).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('device push receipts', () => {
  it('normalizes declarative payloads for the service worker', () => {
    expect(pushPayloadFromData({
      web_push: 8030,
      notification: {
        title: 'Check ready',
        body: 'Send proof.',
        tag: 'verification:session-1',
        navigate: '/?open=verification&session=session-1',
        data: { kind: 'check-ready', sessionId: 'session-1' },
      },
    })).toEqual({
      title: 'Check ready',
      body: 'Send proof.',
      tag: 'verification:session-1',
      path: '/?open=verification&session=session-1',
      kind: 'check-ready',
      sessionId: 'session-1',
    });
  });

  it('reports delivery with the subscription-scoped receipt', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await expect(reportPushReceipt({
      deliveryReceipt: {
        aggregate: 'participants',
        aggregateId: 'participant-1',
        subscriptionId: 'user-1',
        receiptId: 'receipt-1',
        token: 'receipt-secret',
        url: 'https://europe-west1-project.cloudfunctions.net/recordPushReceipt',
      },
    }, 'received', fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('https://europe-west1-project.cloudfunctions.net/recordPushReceipt'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregate: 'participants',
          aggregateId: 'participant-1',
          subscriptionId: 'user-1',
          receiptId: 'receipt-1',
          token: 'receipt-secret',
          stage: 'received',
        }),
      },
    );
  });

  it('rejects untrusted device receipt endpoints', async () => {
    const fetcher = vi.fn();
    await expect(reportPushReceipt({ deliveryReceipt: {
      aggregate: 'participants', aggregateId: 'participant-1', subscriptionId: 'user-1', receiptId: 'receipt-1', token: 'secret', url: 'https://example.com/receipt',
    } }, 'received', fetcher)).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
