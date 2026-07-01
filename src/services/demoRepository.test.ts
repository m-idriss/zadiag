import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DemoRepository } from './demoRepository';

describe('DemoRepository compatibility', () => {
  beforeEach(() => localStorage.clear());

  test('keeps the local fallback link flow asynchronous and observable', async () => {
    const repository = new DemoRepository();
    const listener = vi.fn();
    repository.subscribe(listener);

    await repository.selectRole('parent');
    await repository.linkParent('Maya');

    expect(repository.snapshot().family).toMatchObject({ linked: true, childName: 'Maya', consented: true });
    expect(listener).toHaveBeenCalled();
  });

  test('rejects an invalid child linking code', async () => {
    const repository = new DemoRepository();
    await expect(repository.linkChild('ZD-0000')).rejects.toThrow('invalid_code');
  });

  test('generates a fresh six-digit child linking code', async () => {
    const repository = new DemoRepository();
    const previousCode = repository.snapshot().family.linkingCode;

    await repository.regenerateLinkCode();

    expect(repository.snapshot().family.linkingCode).toMatch(/^ZD-\d{6}$/);
    expect(repository.snapshot().family.linkingCode).not.toBe(previousCode);
  });

  test('does not create a duplicate immediate check', async () => {
    const repository = new DemoRepository();

    await expect(repository.requestCheckNow()).rejects.toThrow('active_check_exists');
  });
});
