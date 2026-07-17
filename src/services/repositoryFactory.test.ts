import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppRepository } from './contracts';
import type { AppState, Locale, MonitoringPlan, Role, VerificationEvent } from '../domain/models';
import { createBlankRoutinePackage, type RoutineDraft } from '../domain/routineDraft';

const configuredFirebaseEnv = {
  VITE_FIREBASE_API_KEY: 'api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'zadiag.test',
  VITE_FIREBASE_PROJECT_ID: 'zadiag-test',
  VITE_FIREBASE_STORAGE_BUCKET: 'zadiag-test.appspot.com',
  VITE_FIREBASE_APP_ID: 'app-id',
  VITE_FIREBASE_APP_CHECK_SITE_KEY: 'site-key',
  VITE_USE_FIREBASE: 'true',
};

const emptyState = (): AppState => ({
  locale: 'en',
  notificationsEnabled: false,
  family: { linked: false, childLinked: false, childName: '', linkingCode: '', parentRecoveryCode: '', consented: false },
  routineAssignments: [],
  routinesLoaded: true,
  routinesError: false,
  events: [],
});

class FakeFirebaseRepository implements AppRepository {
  private state = emptyState();
  private listeners = new Set<() => void>();

  snapshot() { return structuredClone(this.state); }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    this.state = { ...this.state, role: 'parent', family: { ...this.state.family, linked: true, childName: 'Maya' } };
    this.listeners.forEach((listener) => listener());
  }

  async selectRole(role: Role) { this.state = { ...this.state, role }; }
  async selectActiveParticipant(participantId: string) { this.state.activeParticipantId = participantId; }
  async createParticipant() { return 'participant-1'; }
  async inviteParticipantMember() { return { code: 'ZI-123456', expiresAt: '2026-07-12T00:00:00.000Z' }; }
  async acceptParticipantInvitation() { return 'participant-1'; }
  async leaveParticipant() {}
  async createRelationshipRecovery() { return { recoveryCode: 'PR-2345-6789-ABCD', expiresAt: '2026-10-01T00:00:00.000Z' }; }
  async recoverRelationship() { return { participantId: 'participant-1' }; }
  async setLocale(locale: Locale) { this.state = { ...this.state, locale }; }
  async linkParent() {}
  async recoverParent() {}
  async linkChild() {}
  async regenerateLinkCode() {}
  async assignRoutine() {}
  async deleteRoutine() {}
  async listRoutineDrafts(): Promise<RoutineDraft[]> { return []; }
  async createRoutineDraft(_participantId: string, routinePackage: RoutineDraft['package']): Promise<RoutineDraft> { return { id: 'draft-1', ownerId: 'owner', revision: 1, state: 'active', package: routinePackage, validation: { status: 'incomplete', issues: [{ code: 'required_field', path: 'routine.name' }] }, createdAt: '2026-07-17T00:00:00.000Z', updatedAt: '2026-07-17T00:00:00.000Z' }; }
  async requestCheckNow() {}
  async updateRoutine(_routineId: string, _plan: MonitoringPlan) {}
  async savePushSubscription() {}
  async sendTestPushNotification() {}
  async savePlan() {}
  activeSession() { return undefined; }
  async submitCapture(): Promise<VerificationEvent> { throw new Error('not implemented'); }
  async getProofImageUrl(): Promise<string> { throw new Error('not implemented'); }
  async reviewCheck(): Promise<VerificationEvent> { throw new Error('not implemented'); }
  async reset() {}
}

describe('repository factory', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock('./firebaseRepository');
  });

  it('keeps the Firebase repository out of the startup path until initialization', async () => {
    Object.entries(configuredFirebaseEnv).forEach(([key, value]) => vi.stubEnv(key, value));
    let firebaseRepositoryLoaded = false;
    vi.doMock('./firebaseRepository', () => {
      firebaseRepositoryLoaded = true;
      return { FirebaseRepository: FakeFirebaseRepository };
    });

    const { createRepository } = await import('./repositoryFactory');
    const repository = createRepository();

    expect(firebaseRepositoryLoaded).toBe(false);
    expect(repository.snapshot()).toMatchObject({ routinesLoaded: false, family: { linked: false } });

    const listener = vi.fn();
    repository.subscribe(listener);
    await repository.initialize();

    expect(firebaseRepositoryLoaded).toBe(true);
    expect(repository.snapshot()).toMatchObject({ role: 'parent', family: { linked: true, childName: 'Maya' } });
    expect(listener).toHaveBeenCalled();
    await expect(repository.inviteParticipantMember?.('participant-1', 'caregiver')).resolves.toMatchObject({ code: 'ZI-123456' });
    await expect(repository.createRelationshipRecovery?.('participant-1')).resolves.toMatchObject({ recoveryCode: 'PR-2345-6789-ABCD' });
    expect(repository.listRoutineDrafts).toBeTypeOf('function');
    await expect(repository.createRoutineDraft?.('participant-1', createBlankRoutinePackage('en', 'private-test'))).resolves.toMatchObject({ id: 'draft-1' });
  });
});
