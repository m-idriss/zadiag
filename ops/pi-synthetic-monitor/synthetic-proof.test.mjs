import { describe, expect, it, vi } from 'vitest';
import { answerPendingCheck, collectPiConnectivity, resolveSyntheticRoutineId } from './synthetic-proof.mjs';

const locator = (overrides = {}) => ({
  first() { return this; },
  filter() { return this; },
  getByRole() { return this; },
  innerText: vi.fn().mockResolvedValue('Santé du Raspberry Pi'),
  isVisible: vi.fn().mockResolvedValue(false),
  waitFor: vi.fn().mockRejectedValue(new Error('not visible')),
  fill: vi.fn(),
  click: vi.fn(),
  ...overrides,
});

const onboardingPage = () => {
  const contact = locator({ isVisible: vi.fn().mockResolvedValue(true) });
  const continueButton = locator();
  const declinePilot = locator({ waitFor: vi.fn().mockResolvedValue(undefined) });
  const proof = locator();
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    getByRole: vi.fn((role, options) => {
      const name = options?.name;
      if (role === 'textbox') return contact;
      if (String(name).includes('without participating')) return declinePilot;
      if (name?.test?.('Continue')) return continueButton;
      if (name?.test?.('Proof')) return proof;
      return locator();
    }),
    locator: vi.fn((selector) => selector.startsWith('.today-routine-card')
      ? proof
      : locator({ waitFor: vi.fn().mockResolvedValue(undefined) })),
    evaluate: vi.fn().mockResolvedValue(undefined),
    waitForFunction: vi.fn().mockResolvedValue({ jsonValue: vi.fn().mockResolvedValue({ result: 'Validé' }) }),
  };
  return { page, contact, continueButton, declinePilot, proof };
};

describe('Pi synthetic proof onboarding recovery', () => {
  it('registers the operational email and declines pilot measurement before looking for a check', async () => {
    const context = { addInitScript: vi.fn().mockResolvedValue(undefined) };
    const { page, contact, continueButton, declinePilot } = onboardingPage();

    await expect(answerPendingCheck({
      context,
      page,
      appUrl: 'https://www.zadiag.com',
      contactEmail: 'pi@example.com',
    })).resolves.toEqual({ outcome: 'already_settled' });

    expect(contact.fill).toHaveBeenCalledWith('pi@example.com');
    expect(continueButton.click).toHaveBeenCalledOnce();
    expect(declinePilot.click).toHaveBeenCalledOnce();
  });

  it('does not submit the contact form without a configured operational email', async () => {
    const context = { addInitScript: vi.fn().mockResolvedValue(undefined) };
    const { page } = onboardingPage();

    await expect(answerPendingCheck({
      context,
      page,
      appUrl: 'https://www.zadiag.com',
    })).rejects.toThrow('Synthetic monitor contact email is required');
  });

  it('injects Raspberry Pi health evidence for generic and legacy routine ids', async () => {
    const context = { addInitScript: vi.fn().mockResolvedValue(undefined) };
    const { page, proof } = onboardingPage();
    const healthEvidence = { timestamp: '18/07/2026 20:00:00', rows: [] };
    proof.waitFor.mockResolvedValue(undefined);
    page.evaluate.mockResolvedValueOnce('Santé du Raspberry Pi').mockResolvedValueOnce(undefined);

    await expect(answerPendingCheck({
      context,
      page,
      appUrl: 'https://www.zadiag.com',
      contactEmail: 'pi@example.com',
      routineId: 'raspberry-pi-health',
      healthEvidence,
    })).resolves.toEqual({ outcome: 'Validé' });

    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), {
      currentRoutineId: 'raspberry-pi-health',
      currentEvidence: healthEvidence,
    });
  });

  it('injects connectivity evidence for a private routine recognized by its visible title', async () => {
    const context = { addInitScript: vi.fn().mockResolvedValue(undefined) };
    const { page, proof } = onboardingPage();
    const connectivityEvidence = { title: 'Raspberry Pi Connectivity', timestamp: '21/07/2026 17:30:00', rows: [] };
    proof.waitFor.mockResolvedValue(undefined);
    proof.innerText.mockResolvedValue('Connectivité du Raspberry Pi');

    await expect(answerPendingCheck({
      context,
      page,
      appUrl: 'https://www.zadiag.com',
      contactEmail: 'pi@example.com',
      routineId: 'private-connectivity-routine',
      evidence: connectivityEvidence,
    })).resolves.toEqual({ outcome: 'Validé' });

    expect(page.locator).toHaveBeenCalledWith('.today-routine-card[data-routine-id="private-connectivity-routine"]');
    expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), {
      currentRoutineId: 'raspberry-pi-connectivity',
      currentEvidence: connectivityEvidence,
    });
  });
});

describe('Pi synthetic routine resolution', () => {
  it('recognizes the health routine from a notification or the visible French title', () => {
    expect(resolveSyntheticRoutineId({ routineId: 'nemu-health' })).toBe('nemu-health');
    expect(resolveSyntheticRoutineId({ pageText: 'Contrôle · Santé du Raspberry Pi' })).toBe('raspberry-pi-health');
  });

  it('recognizes a private connectivity routine from its exact visible title', () => {
    expect(resolveSyntheticRoutineId({ routineId: 'raspberry-pi-connectivity' })).toBe('raspberry-pi-connectivity');
    expect(resolveSyntheticRoutineId({ routineId: 'private-routine', pageText: 'Connectivité du Raspberry Pi' })).toBe('raspberry-pi-connectivity');
  });

  it('refuses unrelated and unidentified routines instead of submitting a wrong proof', () => {
    expect(resolveSyntheticRoutineId({ routineId: 'orthodontic-elastics' })).toBeUndefined();
    expect(resolveSyntheticRoutineId({ pageText: 'Élastiques orthodontiques' })).toBeUndefined();
  });
});

describe('Pi connectivity evidence', () => {
  it('collects a bounded green dashboard when every network probe succeeds', async () => {
    const execFileImpl = vi.fn(async (command, args) => {
      if (command === 'ip') return { stdout: 'default via 192.168.1.1 dev eth0 proto dhcp\n' };
      if (command === 'ping') return { stdout: '1 packets transmitted, 1 received' };
      if (command === 'getent') return { stdout: '203.0.113.10 STREAM www.zadiag.com\n' };
      if (command === 'timedatectl' && args.some((argument) => argument.includes('NTPSynchronized'))) return { stdout: 'yes\n' };
      throw new Error(`Unexpected command ${command}`);
    });
    const clockValues = [0, 42, 100, 130, 200, 340];
    const evidence = await collectPiConnectivity({
      execFileImpl,
      readFileImpl: vi.fn().mockResolvedValue('up\n'),
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      clock: () => clockValues.shift(),
      now: new Date('2026-07-21T15:30:00.000Z'),
    });

    expect(evidence.title).toBe('Raspberry Pi Connectivity');
    expect(evidence.rows.map((row) => row.label)).toEqual(['Interface', 'Passerelle', 'DNS', 'Zadiag HTTPS', 'Horloge NTP', 'Agent']);
    expect(evidence.rows.every((row) => row.status === 'ok')).toBe(true);
    expect(evidence.rows[1].value).toBe('42 ms');
    expect(evidence.rows[3].value).toBe('HTTP 200 · 140 ms');
  });

  it('reports failures without throwing when network probes are unavailable', async () => {
    const evidence = await collectPiConnectivity({
      execFileImpl: vi.fn().mockRejectedValue(new Error('offline')),
      readFileImpl: vi.fn().mockRejectedValue(new Error('missing')),
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')),
      clock: () => 0,
    });

    expect(evidence.rows.slice(0, 4).map((row) => row.status)).toEqual(['failure', 'failure', 'failure', 'failure']);
    expect(evidence.rows[4]).toMatchObject({ label: 'Horloge NTP', status: 'warning' });
    expect(evidence.rows[5]).toMatchObject({ label: 'Agent', status: 'ok' });
  });
});
