import { describe, expect, it, vi } from 'vitest';
import { answerPendingCheck } from './synthetic-proof.mjs';

const locator = (overrides = {}) => ({
  first() { return this; },
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
  };
  return { page, contact, continueButton, declinePilot };
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
});
