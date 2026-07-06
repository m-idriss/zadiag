import type { AppRepository } from './contracts';
import { DemoRepository } from './demoRepository';
import type { AppState, Locale, MonitoringPlan, Role, RoutineValidationMode } from '../domain/models';
import { firebaseEnabled } from './firebaseConfig';
import { isLocalDemoEnvironment } from './browserEnvironment';

const PREFERENCES_KEY = 'zadiag.preferences.v1';

const browserLocale = (): Locale => navigator.language?.startsWith('fr') ? 'fr' : 'en';

const initialRemoteState = (): AppState => {
  const preferences = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') as { locale?: Locale; role?: Role };
  return {
    locale: preferences.locale ?? browserLocale(),
    notificationsEnabled: false,
    role: preferences.role,
    family: { linked: false, childLinked: false, childName: '', linkingCode: '', parentRecoveryCode: '', consented: false },
    routineAssignments: [],
    routinesLoaded: false,
    routinesError: false,
    events: [],
  };
};

class LazyFirebaseRepository implements AppRepository {
  private delegate?: AppRepository;
  private delegatePromise?: Promise<AppRepository>;
  private unsubscribeDelegate?: () => void;
  private readonly listeners = new Set<() => void>();
  private readonly loadingState = initialRemoteState();

  snapshot() {
    return this.delegate?.snapshot() ?? structuredClone(this.loadingState);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    const repository = await this.load();
    await repository.initialize();
    this.emit();
  }

  async selectRole(role: Role) {
    return (await this.load()).selectRole(role);
  }

  async setLocale(locale: Locale) {
    return (await this.load()).setLocale(locale);
  }

  async linkParent(childName: string) {
    return (await this.load()).linkParent(childName);
  }

  async recoverParent(code: string) {
    return (await this.load()).recoverParent(code);
  }

  async linkChild(code: string) {
    return (await this.load()).linkChild(code);
  }

  async regenerateLinkCode() {
    return (await this.load()).regenerateLinkCode();
  }

  async assignRoutine(routineId: string) {
    return (await this.load()).assignRoutine(routineId);
  }

  async deleteRoutine(routineId: string) {
    return (await this.load()).deleteRoutine(routineId);
  }

  async requestCheckNow(routineId?: string) {
    return (await this.load()).requestCheckNow(routineId);
  }

  async updateRoutine(routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode) {
    return (await this.load()).updateRoutine(routineId, plan, validationMode);
  }

  async savePushSubscription(subscription: PushSubscriptionJSON) {
    return (await this.load()).savePushSubscription(subscription);
  }

  async savePlan(plan: MonitoringPlan, routineId?: string) {
    return (await this.load()).savePlan(plan, routineId);
  }

  activeSession() {
    return this.delegate?.activeSession();
  }

  async submitCapture(sessionId: string, capturedAt: Date, imageDataUrl: string) {
    return (await this.load()).submitCapture(sessionId, capturedAt, imageDataUrl);
  }

  async getProofImageUrl(eventId: string) {
    return (await this.load()).getProofImageUrl(eventId);
  }

  async reviewCheck(eventId: string, decision: 'detected' | 'not_detected') {
    return (await this.load()).reviewCheck(eventId, decision);
  }

  async reset() {
    return (await this.load()).reset();
  }

  private async load() {
    if (this.delegate) return this.delegate;
    this.delegatePromise ??= import('./firebaseRepository').then(({ FirebaseRepository }) => {
      const repository = new FirebaseRepository();
      this.delegate = repository;
      this.unsubscribeDelegate?.();
      this.unsubscribeDelegate = repository.subscribe(() => this.emit());
      return repository;
    });
    return this.delegatePromise;
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const createRepository = (): AppRepository => firebaseEnabled
  ? (isLocalDemoEnvironment() ? new DemoRepository() : new LazyFirebaseRepository())
  : new DemoRepository();
