import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import type { AppRepository } from '../services/contracts';
import type { AppState, MonitoringPlan, VerificationEvent } from '../domain/models';
import { createDefaultRoutineAssignment, DEFAULT_ROUTINE_ID, defaultPlan } from '../domain/models';
import { pilotParticipationRecord } from '../domain/pilotParticipation';

let fakeRepository: AppRepository;

vi.mock('../screens/ChildDashboard', () => ({
  ChildDashboard: ({ start, state }: { start: () => void; state: { family: { childName: string } } }) => (
    <div>
      <h1>Hi {state.family.childName} 👋</h1>
      <p>Ready for a quick photo?</p>
      <button type="button" onClick={start}>Start check</button>
    </div>
  ),
}));

vi.mock('../screens/LinkScreen', () => ({
  LinkScreen: () => <div data-testid="link-screen">Link account flow</div>,
}));

vi.mock('../screens/CameraScreen', () => ({
  CameraScreen: ({ submit }: { submit: (capturedAt: Date, imageDataUrl: string) => Promise<void> }) => (
    <div>
      <h1>Guided photo</h1>
      <button type="button" onClick={() => { void submit(new Date('2026-07-02T10:00:00.000Z'), 'data:image/png;base64,TEST_IMAGE'); }}>Use test photo</button>
    </div>
  ),
}));

vi.mock('../screens/ResultScreen', () => ({
  ResultScreen: ({ done, event }: { done: () => void; event: { status: string; analysisSource?: string; reason?: string } }) => (
    <div>
      <h1>All set!</h1>
      <p>Elastics visible</p>
      <p>{event.analysisSource ?? ''}</p>
      <p>{event.reason ?? ''}</p>
      <button type="button" onClick={done}>Back to today</button>
    </div>
  ),
}));

vi.mock('../components/BottomNav', () => ({
  BottomNav: ({ onChange }: { onChange: (tab: 'home' | 'history' | 'settings' | 'routines') => void }) => (
    <nav>
      <button type="button" onClick={() => onChange('settings')}>Settings</button>
    </nav>
  ),
}));

vi.mock('../components/SplashScreen', () => ({
  SplashScreen: () => null,
}));

vi.mock('../services/repositoryFactory', () => ({
  createRepository: () => fakeRepository,
}));

vi.mock('../components/CameraCapture', () => ({
  CameraCapture: ({ onSubmit }: { onSubmit: (capturedAt: Date, imageDataUrl: string) => Promise<void> }) => (
    <div>
      <h2>Guided photo</h2>
      <button
        type="button"
        onClick={() => { void onSubmit(new Date('2026-07-02T10:00:00.000Z'), 'data:image/png;base64,TEST_IMAGE'); }}
      >
        Use test photo
      </button>
    </div>
  ),
}));

const makeActiveEvent = (): VerificationEvent => ({
  id: 'active',
  routineId: DEFAULT_ROUTINE_ID,
  sessionId: 'session-1',
  requestedAt: new Date(Date.now() - 60_000).toISOString(),
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  status: 'pending',
});

const makeState = (): AppState => ({
  role: 'child',
  locale: 'en',
  notificationsEnabled: true,
  pilotParticipation: pilotParticipationRecord('declined', 'child'),
  family: {
    id: 'family-1',
    linked: true,
    childLinked: true,
    childName: 'Maya',
    linkingCode: 'ZD-123456',
    parentRecoveryCode: 'PR-1234-5678-ABCD',
    consented: true,
  },
  routineAssignments: [{ ...createDefaultRoutineAssignment(), plan: structuredClone(defaultPlan) as MonitoringPlan }],
  events: [makeActiveEvent()],
});

const makeUnrestoredState = (): AppState => ({
  ...makeState(),
  notificationsEnabled: false,
  family: {
    linked: false,
    childLinked: false,
    childName: '',
    linkingCode: '',
    parentRecoveryCode: '',
    consented: false,
  },
  routineAssignments: [],
  events: [],
});

const createFakeRepository = (initialState = makeState()): AppRepository => {
  let state = initialState;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    async initialize() {},
    snapshot() { return structuredClone(state); },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async selectRole(role) {
      state = { ...makeUnrestoredState(), role };
      emit();
    },
    async setLocale() {},
    async linkParent() {},
    async recoverParent() {},
    async linkChild() {},
    async regenerateLinkCode() {},
    async assignRoutine() {},
    async deleteRoutine() {},
    async requestCheckNow() {},
    async updateRoutine() {},
    async savePushSubscription() {
      state = { ...state, notificationsEnabled: true };
      emit();
    },
    async sendTestPushNotification() {},
    async savePlan(plan: MonitoringPlan, routineId = DEFAULT_ROUTINE_ID) {
      state = {
        ...state,
        routineAssignments: state.routineAssignments.map((assignment) =>
          assignment.routineId === routineId ? { ...assignment, plan: structuredClone(plan) } : assignment),
      };
      emit();
    },
    activeSession() {
      return state.events.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now());
    },
    async submitCapture(sessionId: string, capturedAt: Date, imageDataUrl: string) {
      const event = state.events.find((item) => item.sessionId === sessionId);
      if (!event) throw new Error('missing_session');
      Object.assign(event, {
        capturedAt: capturedAt.toISOString(),
        status: 'detected',
        analysisSource: 'ai',
        confidence: 0.93,
        imageQuality: 0.97,
        reason: `image:${imageDataUrl.slice(0, 18)}`,
      });
      emit();
      return structuredClone(event);
    },
    async reset() {
      state = makeUnrestoredState();
      emit();
    },
  };
};

const createFailingStartupRepository = (): AppRepository => {
  const state = makeUnrestoredState();
  return {
    ...createFakeRepository(),
    async initialize() {
      throw new Error('firebase_restore_failed');
    },
    snapshot() { return structuredClone(state); },
    subscribe() {
      return () => {};
    },
    activeSession() {
      return undefined;
    },
  };
};

async function flush() {
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

async function waitForText(text: string, timeoutMs = 2500) {
  const startedAt = Date.now();
  while (!document.body.textContent?.includes(text)) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for text: ${text}. Current DOM: ${document.body.textContent ?? '<empty>'}`);
    }
    await flush();
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
}

describe('Zadiag smoke flow', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return false; },
      }),
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fakeRepository = createFakeRepository();
  });

  it('renders the child check flow and shows the analysis result', async () => {
    const { App } = await import('../App');

    root.render(<App />);

    await waitForText('Ready for a quick photo?');

    const startButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Start check')) as HTMLButtonElement | undefined;
    expect(startButton).toBeDefined();

    startButton?.click();

    await waitForText('Guided photo');

    const usePhotoButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Use test photo')) as HTMLButtonElement | undefined;
    expect(usePhotoButton).toBeDefined();

    usePhotoButton?.click();
    await flush();
    await waitForText('All set!');

    expect(document.body.textContent).toContain('All set!');
    expect(document.body.textContent).toContain('Elastics visible');
    expect(document.body.textContent).toContain('ai');
    expect(document.body.textContent).toContain('image:data:image/png');

    const backButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Back to today')) as HTMLButtonElement | undefined;
    expect(backButton).toBeDefined();

    backButton?.click();
    await waitForText('Ready for a quick photo?');
  }, 15000);

  it('does not expose the account linking flow when startup restore fails', async () => {
    fakeRepository = createFailingStartupRepository();
    const { App } = await import('../App');

    root.render(<App />);

    await waitForText('We could not restart Zadiag correctly');

    expect(document.body.textContent).not.toContain('Link account flow');
    expect(document.body.textContent).toContain('Your account has not been reset.');
    expect(document.body.textContent).toContain('Restart Zadiag');
  }, 15000);

  it('lets a participant reset and continue as responsible', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { App } = await import('../App');

    root.render(<App />);

    await waitForText('Ready for a quick photo?');

    const settingsButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Settings')) as HTMLButtonElement | undefined;
    settingsButton?.click();
    await waitForText('Delete account data');

    const resetButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Delete account data')) as HTMLButtonElement | undefined;
    resetButton?.click();

    await waitForText('Continue as');

    const responsibleButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Responsible')) as HTMLButtonElement | undefined;
    responsibleButton?.click();

    await waitForText('Link account flow');

    expect(fakeRepository.snapshot().role).toBe('parent');
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  }, 15000);

  it('lets a responsible device reset and continue as participant', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fakeRepository = createFakeRepository({
      ...makeState(),
      role: 'parent',
      family: { id: 'family-1', linked: true, childLinked: true, childName: 'Maya', linkingCode: 'ZD-123456', parentRecoveryCode: 'PR-1234-5678-ABCD', consented: true },
    });
    const { App } = await import('../App');

    root.render(<App />);

    await waitForText('Settings');

    const settingsButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Settings')) as HTMLButtonElement | undefined;
    settingsButton?.click();
    await waitForText('Delete account data');

    const resetButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Delete account data')) as HTMLButtonElement | undefined;
    resetButton?.click();

    await waitForText('Continue as');

    const participantButton = Array.from(document.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Participant')) as HTMLButtonElement | undefined;
    participantButton?.click();

    await waitForText('Link account flow');

    expect(fakeRepository.snapshot().role).toBe('child');
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  }, 15000);
});
