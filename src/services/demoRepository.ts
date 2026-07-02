import type {
  AnalysisResult,
  AppState,
  MonitoringPlan,
  Role,
  VerificationEvent,
} from '../domain/models';
import { defaultPlan } from '../domain/models';
import { isFreshCapture } from '../domain/adherence';
import type { AppRepository } from './contracts';

const STORAGE_KEY = 'zadiag.demo.v1';

function seedEvents(now = new Date()): VerificationEvent[] {
  const minutes = (value: number) => new Date(now.getTime() + value * 60_000).toISOString();
  const days = (value: number) => new Date(now.getTime() + value * 86_400_000).toISOString();
  return [
    {
      id: 'active',
      sessionId: crypto.randomUUID(),
      requestedAt: minutes(-2),
      expiresAt: minutes(18),
      status: 'pending',
    },
    {
      id: 'yesterday',
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
      consented: false,
    },
    plan: defaultPlan,
    events: seedEvents(),
  };
}

export class DemoRepository implements AppRepository {
  private state: AppState;
  private consumedSessions = new Set<string>();
  private listeners = new Set<() => void>();

  constructor() {
    const saved = localStorage.getItem(STORAGE_KEY);
    this.state = saved ? (JSON.parse(saved) as AppState) : initialState();
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
      consented: true,
    };
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
    this.state.events.unshift({
      id: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      requestedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.state.plan.expiryMinutes * 60_000).toISOString(),
      status: 'pending',
    });
    this.persist();
  }

  async savePushSubscription(_subscription: PushSubscriptionJSON) {
    this.state.notificationsEnabled = true;
    this.persist();
  }

  async savePlan(plan: MonitoringPlan) {
    this.state.plan = structuredClone(plan);
    this.persist();
  }

  activeSession() {
    const now = new Date();
    return this.state.events.find(
      (event) => event.status === 'pending' && new Date(event.expiresAt) > now,
    );
  }

  async submitCapture(sessionId: string, capturedAt: Date): Promise<VerificationEvent> {
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
}
