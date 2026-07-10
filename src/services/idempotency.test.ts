import { describe, expect, it, vi } from 'vitest';
import { coalesceInFlight } from './idempotency';

describe('coalesceInFlight', () => {
  it('shares the same promise while an operation is in flight', async () => {
    const inFlight = new Map<string, Promise<unknown>>();
    let resolve!: (value: string) => void;
    const operation = vi.fn(() => new Promise<string>((done) => { resolve = done; }));

    const first = coalesceInFlight(inFlight, 'request-check:routine', operation);
    const second = coalesceInFlight(inFlight, 'request-check:routine', operation);
    resolve('ok');

    await expect(first).resolves.toBe('ok');
    await expect(second).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('clears the key after completion or failure', async () => {
    const inFlight = new Map<string, Promise<unknown>>();
    const operation = vi.fn()
      .mockResolvedValueOnce('first')
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValueOnce('third');

    await expect(coalesceInFlight(inFlight, 'reset', operation)).resolves.toBe('first');
    await expect(coalesceInFlight(inFlight, 'reset', operation)).rejects.toThrow('failed');
    await expect(coalesceInFlight(inFlight, 'reset', operation)).resolves.toBe('third');
    expect(operation).toHaveBeenCalledTimes(3);
  });
});
