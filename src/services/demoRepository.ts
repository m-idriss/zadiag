import type {
  AnalysisResult,
  AppState,
  MonitoringPlan,
  Role,
  RoutineAssignment,
  VerificationEvent,
} from '../domain/models';
import { createDefaultRoutineAssignment, DEFAULT_ROUTINE_ID, primaryRoutineAssignment } from '../domain/models';
import { isFreshCapture } from '../domain/adherence';
import type { AppRepository } from './contracts';

const STORAGE_KEY = 'zadiag.demo.v1';

function seedEvents(now = new Date()): VerificationEvent[] {
  const minutes = (value: number) => new Date(now.getTime() + value * 60_000).toISOString();
  const days = (value: number) => new Date(now.getTime() + value * 86_400_000).toISOString();
  return [
    {
      id: 'active',
      routineId: DEFAULT_ROUTINE_ID,
      sessionId: crypto.randomUUID(),
      requestedAt: minutes(-2),
      expiresAt: minutes(18),
      status: 'pending',
    },
    {
      id: 'yesterday',
      routineId: DEFAULT_ROUTINE_ID,
      sessionId: 'closed-1',
      requestedAt: days(-1),
      expiresAt: days(-1),
      capturedAt: days(-1),
      status: 'detected',
      confidence: 0.94,
      imageQuality: 0.91,
    },
    {
      id: 'two-days',
      routineId: DEFAULT_ROUTINE_ID,
      sessionId: 'closed-2',
      requestedAt: days(-2),
      expiresAt: days(-2),
      capturedAt: days(-2),
      status: 'uncertain',
      confidence: 0.62,
      imageQuality: 0.66,
      reason: 'low_light',
    },
    {
      id: 'three-days',
      routineId: DEFAULT_ROUTINE_ID,
      sessionId: 'closed-3',
      requestedAt: days(-3),
      expiresAt: days(-3),
      capturedAt: days(-3),
      status: 'detected',
      confidence: 0.9,
      imageQuality: 0.87,
    },
  ];
}

function initialState(): AppState {
  return {
    locale: 'en',
    notificationsEnabled: false,
    family: {
      linked: false,
      childLinked: false,
      childName: 'Maya',
      linkingCode: 'ZD-4821',
      parentRecoveryCode: 'PR-2345-6789-ABCD',
      consented: false,
    },
    routineAssignments: [createDefaultRoutineAssignment()],
    routinesLoaded: true,
    routinesError: false,
    events: seedEvents(),
  };
}

export class DemoRepository implements AppRepository {
  private state: AppState;
  private consumedSessions = new Set<string>();
  private listeners = new Set<() => void>();

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.state = saved ? this.migrateState(JSON.parse(saved) as AppState & { plan?: MonitoringPlan }) : initialState();
    if (saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.state.family.childLinked ??= this.state.role === 'child';
    this.ensureActiveSession();
  }

  snapshot() {
    return structuredClone(this.state);
  }

  async initialize() {}

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async selectRole(role: Role) {
    this.state.role = role;
    this.persist();
  }

  async setLocale(locale: AppState['locale']) {
    this.state.locale = locale;
    this.persist();
  }

  async linkParent(childName: string) {
    this.state.family = {
      ...this.state.family,
      childName,
      linked: true,
      childLinked: false,
      parentRecoveryCode: 'PR-2345-6789-ABCD',
      consented: true,
    };
    this.persist();
  }

  async recoverParent(code: string) {
    if (code.trim().toUpperCase() !== this.state.family.parentRecoveryCode) {
      throw new Error('invalid_code');
    }
    this.state.role = 'parent';
    this.state.family.linked = true;
    this.state.family.consented = true;
    this.state.family.parentRecoveryCode = 'PR-EFGH-JKLM-NPQR';
    this.persist();
  }

  async linkChild(code: string) {
    if (code.trim().toUpperCase() !== this.state.family.linkingCode) {
      throw new Error('invalid_code');
    }
    this.state.family.linked = true;
    this.state.family.childLinked = true;
    this.persist();
  }

  async regenerateLinkCode() {
    this.state.family.linkingCode = `ZD-${Math.floor(100000 + Math.random() * 900000)}`;
    this.persist();
  }

  async requestCheckNow() {
    if (this.activeSession()) {
      this.persist();
      return;
    }
    const now = new Date();
    const assignment = primaryRoutineAssignment(this.state);
    if (!assignment) throw new Error('routine_not_found');
    this.state.events.unshift({
      id: crypto.randomUUID(),
      routineId: assignment.routineId,
      sessionId: crypto.randomUUID(),
      requestedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + assignment.plan.expiryMinutes * 60_000).toISOString(),
      status: 'pending',
    });
    this.persist();
  }

  async updateRoutine(routineId: string, plan: MonitoringPlan) {
    const assignment = this.state.routineAssignments.find((r) => r.routineId === routineId);
    if (assignment) {
      assignment.plan = plan;
      this.persist();
    }
  }

  async savePushSubscription(_subscription: PushSubscriptionJSON) {
    this.state.notificationsEnabled = true;
    this.persist();
  }

  async savePlan(plan: MonitoringPlan, routineId = DEFAULT_ROUTINE_ID) {
    const assignment = this.state.routineAssignments.find((item) => item.routineId === routineId);
    if (!assignment) throw new Error('routine_not_found');
    assignment.plan = structuredClone(plan);
    this.persist();
  }

  activeSession() {
    const now = new Date();
    return this.state.events.find(
      (event) => event.status === 'pending' && new Date(event.expiresAt) > now,
    );
  }

  async submitCapture(sessionId: string, capturedAt: Date, _imageDataUrl: string): Promise<VerificationEvent> {
    const event = this.state.events.find((item) => item.sessionId === sessionId);
    if (!event) throw new Error('unknown_session');
    if (this.consumedSessions.has(sessionId) || !isFreshCapture(event, capturedAt)) {
      throw new Error('invalid_or_replayed_capture');
    }
    this.consumedSessions.add(sessionId);
    event.status = 'analyzing';
    this.persist();
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    const analysis: AnalysisResult = {
      status: 'detected',
      confidence: 0.94,
      imageQuality: 0.91,
    };
    Object.assign(event, analysis, { capturedAt: capturedAt.toISOString() });
    this.persist();
    return structuredClone(event);
  }

  async reset() {
    this.state = initialState();
    this.consumedSessions.clear();
    this.persist();
  }

  private ensureActiveSession() {
    if (this.activeSession()) return;
    const now = new Date();
    this.state.events.unshift({
      id: crypto.randomUUID(),
      routineId: primaryRoutineAssignment(this.state)?.routineId ?? DEFAULT_ROUTINE_ID,
      sessionId: crypto.randomUUID(),
      requestedAt: new Date(now.getTime() - 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + 19 * 60_000).toISOString(),
      status: 'pending',
    });
    this.persist();
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((listener) => listener());
  }

  private migrateState(state: AppState & { plan?: MonitoringPlan }): AppState {
    const legacyPlan = state.plan;
    const routineAssignments: RoutineAssignment[] = state.routineAssignments?.length
      ? state.routineAssignments
      : [{ ...createDefaultRoutineAssignment(), ...(legacyPlan ? { plan: legacyPlan } : {}) }];
    return {
      ...state,
      routineAssignments,
      events: state.events.map((event) => ({ ...event, routineId: event.routineId ?? DEFAULT_ROUTINE_ID })),
    };
  }
}
