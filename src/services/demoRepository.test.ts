import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DemoRepository } from './demoRepository';
import { createDefaultRoutineAssignment, DEFAULT_ROUTINE_ID, defaultPlan } from '../domain/models';

describe('DemoRepository compatibility', () => {
  beforeEach(() => localStorage.clear());

  test('keeps the local fallback link flow asynchronous and observable', async () => {
    const repository = new DemoRepository();
    const listener = vi.fn();
    repository.subscribe(listener);

    await repository.selectRole('parent');
    await repository.linkParent('Maya');

    expect(repository.snapshot().family).toMatchObject({ linked: true, childName: 'Maya', consented: true });
    expect(repository.snapshot().routineAssignments).toHaveLength(0);
    expect(repository.snapshot().events).toHaveLength(0);
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

  test('resends an immediate check without duplicating it', async () => {
    const repository = new DemoRepository();
    const before = repository.snapshot().events.filter((event) => event.status === 'pending').length;

    await expect(repository.requestCheckNow()).resolves.toBeUndefined();

    expect(repository.snapshot().events.filter((event) => event.status === 'pending').length).toBe(before);
  });

  test('keeps notification setup complete after a reload', async () => {
    const repository = new DemoRepository();
    await repository.savePushSubscription({ endpoint: 'https://push.example/subscription' });

    expect(new DemoRepository().snapshot().notificationsEnabled).toBe(true);
  });

  test('adds demo progress events to existing local states so the heatmap is visible', () => {
    localStorage.setItem('zadiag.demo.v1', JSON.stringify({
      locale: 'en',
      role: 'child',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [createDefaultRoutineAssignment()],
      events: [],
    }));

    const events = new DemoRepository().snapshot().events;

    expect(events.filter((event) => event.id.startsWith('demo-progress-')).length).toBeGreaterThan(0);
    expect(events.some((event) => event.status === 'detected')).toBe(true);
    expect(events.some((event) => event.status === 'uncertain')).toBe(true);
    expect(events.some((event) => event.status === 'missed')).toBe(true);
  });

  test('marks the participant as already linked after parent recovery', async () => {
    const repository = new DemoRepository();

    await repository.recoverParent(repository.snapshot().family.parentRecoveryCode);

    expect(repository.snapshot().family.childLinked).toBe(true);
  });

  test('self-validates participant-created routines without AI analysis', async () => {
    const repository = new DemoRepository();
    await repository.selectRole('child');
    await repository.deleteRoutine(DEFAULT_ROUTINE_ID);
    await repository.deleteRoutine('daily-hydration');
    await repository.assignRoutine('medication');

    const assignment = repository.snapshot().routineAssignments[0];
    expect(assignment).toMatchObject({ routineId: 'medication', createdBy: 'child', validationMode: 'auto' });

    await repository.requestCheckNow('medication');
    const sessionId = repository.snapshot().events.find((event) => event.routineId === 'medication' && event.status === 'pending')?.sessionId;
    expect(sessionId).toBeTruthy();

    const result = await repository.submitCapture(sessionId!, new Date(), 'data:image/png;base64,photo');

    expect(result.status).toBe('detected');
    expect(result.analysisSource).toBe('self');
  });

  test('migrates legacy local state to the default routine idempotently', () => {
    localStorage.setItem('zadiag.demo.v1', JSON.stringify({
      locale: 'en',
      notificationsEnabled: false,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      plan: defaultPlan,
      events: [{ id: 'legacy', sessionId: 'session', requestedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), status: 'pending' }],
    }));

    const first = new DemoRepository().snapshot();
    const second = new DemoRepository().snapshot();
    expect(first.routineAssignments).toHaveLength(1);
    expect(first.routineAssignments[0].routineId).toBe(DEFAULT_ROUTINE_ID);
    expect(first.events.every((event) => event.routineId === DEFAULT_ROUTINE_ID)).toBe(true);
    expect(second.routineAssignments).toEqual(first.routineAssignments);
  });
});
