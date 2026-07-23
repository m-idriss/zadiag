import type {
  AnalysisResult,
  AppState,
  MembershipRole,
  ProfileColorKey,
  MonitoringPlan,
  Role,
  PilotParticipation,
  RoutineAssignment,
  RoutineAppearance,
  RoutineResponseSubmission,
  RoutineValidationMode,
  VerificationEvent,
} from '../domain/models';
import { createDefaultRoutineAssignment, DEFAULT_ROUTINE_ID, normalizeAppPreferences, primaryRoutineAssignment, type AppPreferences } from '../domain/models';
import { routineFromCatalog } from '../domain/routineCatalog';
import { activeParticipantAccess } from '../domain/participantAccess';
import { isFreshCapture } from '../domain/adherence';
import { responseWindowExpiresAt } from '../domain/monitoringPlan';
import type { AppRepository, JourneySource, JourneyStage } from './contracts';
import { browserLocale } from './appStateDefaults';
import { pilotParticipationRecord } from '../domain/pilotParticipation';

const STORAGE_KEY = 'zadiag.demo.v1';
const HYDRATION_ROUTINE_ID = 'daily-hydration';
const DEMO_PROGRESS_EVENT_PREFIX = 'demo-progress-';

const dayInMonth = (now: Date, monthOffset: number, dayOfMonth: number, hour: number) => {
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dayOfMonth, lastDay), hour, 0, 0, 0);
};

const progressEvent = (
  requestedAt: Date,
  slot: number,
  status: VerificationEvent['status'],
): VerificationEvent => {
  const expiresAt = new Date(requestedAt);
  expiresAt.setHours(expiresAt.getHours() + 1);
  const dayKey = requestedAt.toISOString().slice(0, 10);
  const id = `${DEMO_PROGRESS_EVENT_PREFIX}${dayKey}-${slot}-${status}`;
  return {
    id,
    routineId: DEFAULT_ROUTINE_ID,
    sessionId: id,
    requestedAt: requestedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    capturedAt: ['detected', 'not_detected', 'uncertain'].includes(status) ? requestedAt.toISOString() : undefined,
    status,
    confidence: status === 'detected' ? 0.9 : status === 'uncertain' ? 0.58 : undefined,
    imageQuality: status === 'detected' ? 0.88 : status === 'uncertain' ? 0.64 : undefined,
    reason: status === 'uncertain' ? 'demo_mixed_day' : undefined,
    proofImagePath: status === 'uncertain' ? 'demo-proof' : undefined,
    proofImageExpiresAt: status === 'uncertain' ? new Date(Date.now() + 30 * 86_400_000).toISOString() : undefined,
    reviewStatus: status === 'uncertain' ? 'pending' : undefined,
  };
};

function demoProgressEvents(now = new Date()): VerificationEvent[] {
  const currentDay = now.getDate();
  const specs: Array<{ monthOffset: number; day: number; statuses: VerificationEvent['status'][] }> = [
    { monthOffset: -1, day: 3, statuses: ['detected', 'uncertain'] },
    { monthOffset: -1, day: 7, statuses: ['detected', 'detected', 'missed'] },
    { monthOffset: -1, day: 14, statuses: ['detected', 'uncertain', 'missed'] },
    { monthOffset: -1, day: 21, statuses: ['detected', 'detected', 'detected', 'uncertain'] },
    { monthOffset: -1, day: 27, statuses: ['missed'] },
    { monthOffset: 0, day: Math.max(1, currentDay - 4), statuses: ['detected', 'detected', 'uncertain'] },
    { monthOffset: 0, day: Math.max(1, currentDay - 2), statuses: ['detected', 'missed'] },
    { monthOffset: 0, day: currentDay, statuses: ['detected', 'uncertain', 'missed'] },
  ];

  return specs.flatMap(({ monthOffset, day, statuses }) =>
    statuses.map((status, slot) => progressEvent(dayInMonth(now, monthOffset, day, 8 + slot * 2), slot, status)));
}

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
      id: 'expired-morning',
      routineId: DEFAULT_ROUTINE_ID,
      sessionId: 'expired-morning',
      requestedAt: minutes(-150),
      expiresAt: minutes(-110),
      status: 'pending',
    },
    {
      id: 'expired-midday',
      routineId: DEFAULT_ROUTINE_ID,
      sessionId: 'expired-midday',
      requestedAt: minutes(-95),
      expiresAt: minutes(-55),
      status: 'pending',
    },
    {
      id: 'hydration-expired-morning',
      routineId: HYDRATION_ROUTINE_ID,
      sessionId: 'hydration-expired-morning',
      requestedAt: minutes(-180),
      expiresAt: minutes(-140),
      status: 'pending',
    },
    {
      id: 'hydration-expired-midday',
      routineId: HYDRATION_ROUTINE_ID,
      sessionId: 'hydration-expired-midday',
      requestedAt: minutes(-125),
      expiresAt: minutes(-85),
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
      proofImagePath: 'demo-proof',
      proofImageExpiresAt: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      reviewStatus: 'pending',
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
    ...demoProgressEvents(now),
  ];
}

function initialState(): AppState {
  const defaultAssignment = createDefaultRoutineAssignment();
  const hydrationRoutine = routineFromCatalog(HYDRATION_ROUTINE_ID);
  return {
    locale: browserLocale(),
    contactEmail: 'demo@zadiag.com',
    accessStatus: 'active',
    accountDisplayName: 'Responsable démo',
    notificationsEnabled: false,
    pushHealth: { permission: 'default', endpointPresent: false },
    preferences: normalizeAppPreferences(),
    family: {
      linked: false,
      childLinked: false,
      childName: 'Maya',
      linkingCode: 'ZD-4821',
      parentRecoveryCode: 'PR-2345-6789-ABCD',
      consented: false,
    },
    participantAccess: [],
    routineAssignments: [
      defaultAssignment,
      ...(hydrationRoutine ? [{
        id: hydrationRoutine.id,
        routineId: hydrationRoutine.id,
        routine: structuredClone(hydrationRoutine),
        plan: structuredClone(defaultAssignment.plan),
        status: 'active' as const,
        assignedAt: new Date().toISOString(),
        createdBy: 'parent' as const,
        validationMode: 'ai' as const,
      }] : []),
    ],
    routinesLoaded: true,
    routinesError: false,
    events: seedEvents(),
  };
}

const readStoredState = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return undefined;
  try {
    return JSON.parse(saved) as AppState & { plan?: MonitoringPlan };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return undefined;
  }
};

export class DemoRepository implements AppRepository {
  private state: AppState;
  private consumedSessions = new Set<string>();
  private listeners = new Set<() => void>();

  constructor() {
    const savedState = readStoredState();
    this.state = savedState ? this.migrateState(savedState) : initialState();
    if (savedState) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.state.family.childLinked ??= this.state.role === 'child';
    this.ensureDemoProgressEvents();
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

  async selectActiveParticipant(participantId: string) {
    const access = activeParticipantAccess(this.state.participantAccess, participantId);
    if (!access) throw new Error('participant_access_not_found');
    this.state.activeParticipantId = participantId;
    this.state.family.childName = access.participant.displayName;
    this.persist();
  }

  async updateAccountProfile(displayName: string) {
    const normalizedName = displayName.trim();
    this.state.accountDisplayName = normalizedName;
    this.state.participantAccess = this.state.participantAccess?.map((entry) => ({
      ...entry,
      members: entry.members?.map((member) => member.isCurrentUser
        ? { ...member, displayName: normalizedName }
        : member),
    }));
    this.persist();
    return normalizedName;
  }

  async renameParticipant(participantId: string, displayName: string) {
    const normalizedName = displayName.trim();
    if (!normalizedName) throw new Error('invalid_participant_name');
    const access = activeParticipantAccess(this.state.participantAccess, participantId);
    if (!access || (
      access.membership.permissions?.manageParticipant !== true
      && access.membership.role !== 'owner'
      && !(access.participant.selfManaged && access.membership.role === 'participant')
    )) throw new Error('participant_rename_not_authorized');
    access.participant.displayName = normalizedName;
    if (this.state.activeParticipantId === participantId) this.state.family.childName = normalizedName;
    this.persist();
    return normalizedName;
  }

  async updateParticipantColor(participantId: string, profileColor: ProfileColorKey) {
    const access = activeParticipantAccess(this.state.participantAccess, participantId);
    if (!access || !['owner', 'participant'].includes(access.membership.role)) throw new Error('permission_denied');
    access.participant.profileColor = profileColor;
    this.persist();
    return profileColor;
  }

  async createParticipant(displayName: string, selfManaged = false) {
    const participantId = `demo-${Date.now()}`;
    this.state.participantAccess = [
      ...(this.state.participantAccess ?? []),
      {
        participant: { id: participantId, displayName: displayName.trim(), selfManaged },
        membership: { role: 'owner', status: 'active', ...(selfManaged ? { label: 'self' as const } : {}) },
        members: [{ uid: 'demo-current', displayName: this.state.accountDisplayName, role: 'owner', status: 'active', isCurrentUser: true }],
      },
    ];
    this.state.activeParticipantId = participantId;
    this.state.family.childName = displayName.trim();
    this.persist();
    return participantId;
  }

  async inviteParticipantMember(participantId: string, role: MembershipRole) {
    if (!activeParticipantAccess(this.state.participantAccess, participantId) || role === 'viewer' && this.state.role === 'child') {
      throw new Error('permission_denied');
    }
    return { code: 'ZI-123456', expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
  }

  async acceptParticipantInvitation(code: string) {
    if (code.trim().toUpperCase() !== 'ZI-123456') throw new Error('invalid_code');
    const participantId = 'demo-invited';
    if (!this.state.participantAccess?.some((entry) => entry.participant.id === participantId)) {
      this.state.participantAccess = [
        ...(this.state.participantAccess ?? []),
        {
          participant: { id: participantId, displayName: 'Invited participant' },
          membership: { role: 'caregiver', status: 'active' },
        },
      ];
    }
    this.state.activeParticipantId = participantId;
    this.state.role = 'parent';
    this.state.family.id = participantId;
    this.state.family.linked = true;
    this.state.family.childLinked = true;
    this.state.family.childName = 'Invited participant';
    this.state.family.consented = true;
    this.persist();
    return participantId;
  }

  async leaveParticipant(participantId: string) {
    const target = activeParticipantAccess(this.state.participantAccess, participantId);
    if (!target) throw new Error('participant_access_not_found');
    const ownerCount = (this.state.participantAccess ?? []).filter((entry) => (
      entry.participant.id === participantId && entry.membership.role === 'owner' && entry.membership.status === 'active'
    )).length;
    if (target.membership.role === 'owner' && ownerCount <= 1) throw new Error('last_owner');
    this.state.participantAccess = (this.state.participantAccess ?? []).filter((entry) => entry.participant.id !== participantId);
    const next = this.state.participantAccess[0];
    this.state.activeParticipantId = next?.participant.id;
    if (next) this.state.family.childName = next.participant.displayName;
    this.persist();
  }

  async removeParticipantMember(participantId: string, targetUid: string) {
    const target = activeParticipantAccess(this.state.participantAccess, participantId);
    if (!target || target.membership.role !== 'owner') throw new Error('permission_denied');
    const member = target.members?.find((item) => item.uid === targetUid && !item.isCurrentUser);
    if (!member) throw new Error('membership_not_found');
    target.members = target.members?.filter((item) => item.uid !== targetUid);
    this.persist();
    return structuredClone(target.members ?? []);
  }

  async deleteParticipant(participantId: string) {
    const target = activeParticipantAccess(this.state.participantAccess, participantId);
    if (!target || target.membership.role !== 'owner') throw new Error('permission_denied');
    this.state.participantAccess = (this.state.participantAccess ?? []).filter((entry) => entry.participant.id !== participantId);
    const next = this.state.participantAccess[0];
    this.state.activeParticipantId = next?.participant.id;
    if (next) this.state.family.childName = next.participant.displayName;
    this.persist();
  }

  async createRelationshipRecovery(participantId: string) {
    if (!activeParticipantAccess(this.state.participantAccess, participantId)) throw new Error('participant_access_not_found');
    return { recoveryCode: 'PR-2345-6789-ABCD', expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
  }

  async recoverRelationship(code: string) {
    if (code.trim().toUpperCase() !== 'PR-2345-6789-ABCD') throw new Error('invalid_code');
    const participantId = await this.acceptParticipantInvitation('ZI-123456');
    return { participantId, recoveryCode: 'PR-EFGH-JKLM-NPQR', expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
  }

  async setLocale(locale: AppState['locale']) {
    this.state.locale = locale;
    this.persist();
  }

  async setPreferences(preferences: Partial<AppPreferences>) {
    this.state.preferences = normalizeAppPreferences({ ...this.state.preferences, ...preferences });
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
    this.state.routineAssignments = [];
    this.state.events = [];
    this.state.participantAccess = [{
      participant: { id: 'demo-participant', displayName: childName },
      membership: { role: 'owner', status: 'active', label: 'parent' },
    }];
    this.state.activeParticipantId = 'demo-participant';
    this.persist();
  }

  async recoverParent(code: string) {
    if (code.trim().toUpperCase() !== this.state.family.parentRecoveryCode) {
      throw new Error('invalid_code');
    }
    this.state.role = 'parent';
    this.state.family.linked = true;
    this.state.family.childLinked = true;
    this.state.family.consented = true;
    this.state.family.parentRecoveryCode = 'PR-EFGH-JKLM-NPQR';
    this.state.participantAccess ??= [{
      participant: { id: 'demo-participant', displayName: this.state.family.childName },
      membership: { role: 'owner', status: 'active', label: 'parent' },
    }];
    this.state.activeParticipantId ??= 'demo-participant';
    this.persist();
  }

  async linkChild(code: string) {
    if (code.trim().toUpperCase() !== this.state.family.linkingCode) {
      throw new Error('invalid_code');
    }
    this.state.family.linked = true;
    this.state.family.childLinked = true;
    this.state.participantAccess = [{
      participant: { id: 'demo-participant', displayName: this.state.family.childName },
      membership: { role: 'participant', status: 'active' },
    }];
    this.state.activeParticipantId = 'demo-participant';
    this.persist();
  }

  async regenerateLinkCode() {
    this.state.family.linkingCode = `ZD-${Math.floor(100000 + Math.random() * 900000)}`;
    this.persist();
  }

  async assignRoutine(routineId: string) {
    if (this.state.role !== 'parent') throw new Error('permission_denied');
    if (this.state.routineAssignments.some((assignment) => assignment.routineId === routineId)) {
      throw new Error('routine_already_assigned');
    }
    const routine = routineFromCatalog(routineId);
    if (!routine) throw new Error('routine_not_found');
    this.state.routineAssignments.push({
      id: routine.id,
      routineId: routine.id,
      routine: structuredClone(routine),
      plan: structuredClone(this.state.routineAssignments[0]?.plan ?? createDefaultRoutineAssignment().plan),
      status: 'active',
      assignedAt: new Date().toISOString(),
      createdBy: 'parent',
      validationMode: 'ai',
    });
    this.persist();
  }

  async deleteRoutine(routineId: string) {
    if (this.state.role !== 'parent') throw new Error('permission_denied');
    const assignment = this.state.routineAssignments.find((item) => item.routineId === routineId);
    if (!assignment) throw new Error('routine_not_found');
    if (this.state.routineAssignments.length <= 1) throw new Error('last_routine_required');
    this.state.routineAssignments = this.state.routineAssignments.filter((item) => item.routineId !== routineId);
    this.state.events = this.state.events.filter((event) => event.routineId !== routineId);
    this.persist();
  }

  async requestCheckNow(routineId?: string) {
    if (this.state.role !== 'parent') throw new Error('permission_denied');
    const now = new Date();
    const assignment = routineId
      ? this.state.routineAssignments.find((routine) => routine.routineId === routineId)
      : primaryRoutineAssignment(this.state);
    if (!assignment) throw new Error('routine_not_found');
    const activeSession = this.activeSession(assignment.routineId);
    if (activeSession) {
      activeSession.responsibleActions = [...(activeSession.responsibleActions ?? []), {
        type: 'reminded', at: now.toISOString(), actorUid: 'demo-current', actorName: this.state.accountDisplayName ?? 'Responsable démo',
      }];
      this.persist();
      return;
    }
    this.state.events.unshift({
      id: crypto.randomUUID(),
      routineId: assignment.routineId,
      sessionId: crypto.randomUUID(),
      requestedAt: now.toISOString(),
      expiresAt: responseWindowExpiresAt(assignment.plan, now).toISOString(),
      status: 'pending',
      responsibleActions: [{ type: 'requested', at: now.toISOString(), actorUid: 'demo-current', actorName: this.state.accountDisplayName ?? 'Responsable démo' }],
    });
    this.persist();
  }

  async updateRoutine(routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode, appearance?: RoutineAppearance) {
    if (this.state.role !== 'parent') throw new Error('permission_denied');
    const assignment = this.state.routineAssignments.find((r) => r.routineId === routineId);
    if (assignment) {
      assignment.plan = plan;
      if (validationMode && assignment.createdBy === 'child') assignment.validationMode = validationMode;
      if (appearance) {
        const translations = Object.fromEntries(Object.entries(assignment.routine.translations ?? {}).map(([locale, content]) => [
          locale,
          { ...content, name: appearance.name },
        ]));
        assignment.routine = { ...assignment.routine, ...appearance, ...(Object.keys(translations).length ? { translations } : {}) };
      }
      this.persist();
    }
  }

  async savePushSubscription(_subscription: PushSubscriptionJSON) {
    this.state.notificationsEnabled = true;
    this.state.pushHealth = {
      permission: 'granted',
      endpointPresent: true,
      lastSuccessfulSaveAt: new Date().toISOString(),
    };
    this.persist();
  }

  async sendTestPushNotification() {
    if (!this.state.notificationsEnabled) throw new Error('push_not_enabled');
    this.state.pushHealth = {
      permission: this.state.pushHealth?.permission ?? 'granted',
      endpointPresent: this.state.pushHealth?.endpointPresent ?? true,
      ...this.state.pushHealth,
      lastDispatchResult: 'success',
      lastDispatchAt: new Date().toISOString(),
    };
    this.persist();
  }

  async recordJourneyEvent(_stage: JourneyStage, _source: JourneySource, _contextId?: string) {}

  async updatePilotParticipation(status: PilotParticipation['status']) {
    if (!this.state.role) throw new Error('role_required');
    this.state.pilotParticipation = pilotParticipationRecord(status, this.state.role);
    this.persist();
    return structuredClone(this.state.pilotParticipation);
  }

  async savePlan(plan: MonitoringPlan, routineId = DEFAULT_ROUTINE_ID) {
    const assignment = this.state.routineAssignments.find((item) => item.routineId === routineId);
    if (!assignment) throw new Error('routine_not_found');
    assignment.plan = structuredClone(plan);
    this.persist();
  }

  activeSession(routineId?: string) {
    const now = new Date();
    return this.state.events.find(
      (event) => event.status === 'pending' && new Date(event.expiresAt) > now && (!routineId || event.routineId === routineId),
    );
  }

  async submitCapture(sessionId: string, capturedAt: Date, _imageDataUrl: string): Promise<VerificationEvent> {
    const event = this.state.events.find((item) => item.sessionId === sessionId);
    if (!event) throw new Error('unknown_session');
    const isRetake = ['not_detected', 'uncertain'].includes(event.status);
    if ((!isRetake && this.consumedSessions.has(sessionId)) || !isFreshCapture(event, capturedAt)) {
      throw new Error('invalid_or_replayed_capture');
    }
    this.consumedSessions.add(sessionId);
    const assignment = this.state.routineAssignments.find((item) => item.routineId === event.routineId);
    const response = event.challenge?.response;
    if (assignment?.validationMode === 'auto' && response?.kind !== 'photo_checklist') {
      Object.assign(event, {
        status: 'detected' as const,
        capturedAt: capturedAt.toISOString(),
        analysisSource: 'self' as const,
        reason: 'self_validated',
      });
      this.persist();
      return structuredClone(event);
    }
    event.status = 'analyzing';
    this.persist();
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    if (response?.kind === 'photo_checklist') {
      Object.assign(event, {
        status: 'detected' as const,
        automatedStatus: 'detected' as const,
        capturedAt: capturedAt.toISOString(),
        analysisSource: 'ai' as const,
        analysisProvider: 'demo',
        analysisModel: 'demo',
        analysisPromptVersion: 'photo-checklist-v1',
        imageQuality: 0.91,
        photoChecklistItems: response.criteria.map((criterion) => ({
          criterionId: criterion.id,
          status: 'detected' as const,
          confidence: 0.94,
          reason: 'Visible in the demo proof.',
          decision: { source: 'ai' as const },
        })),
      });
      this.persist();
      return structuredClone(event);
    }
    const analysis: AnalysisResult = {
      status: 'detected',
      confidence: 0.94,
      imageQuality: 0.91,
    };
    Object.assign(event, analysis, { capturedAt: capturedAt.toISOString() });
    this.persist();
    return structuredClone(event);
  }

  async submitRoutineResponse(sessionId: string, submittedAt: Date, submission: RoutineResponseSubmission): Promise<VerificationEvent> {
    const event = this.state.events.find((item) => item.sessionId === sessionId);
    if (!event || event.status !== 'pending' || submittedAt > new Date(event.expiresAt)) throw new Error('invalid_or_replayed_response');
    const quizResult = submission.kind === 'quiz' ? {
      score: 1, correctCount: submission.answers.length, totalCount: submission.answers.length, concepts: ['demo'],
      corrections: submission.answers.map((answer) => ({ questionId: answer.questionId, selectedChoiceId: answer.choiceId, correctChoiceId: answer.choiceId, correct: true, explanation: 'Demo answer.' })),
      provider: 'demo', model: 'demo', promptVersion: 'demo-v1',
    } : undefined;
    Object.assign(event, { status: 'answered' as const, submittedAt: submittedAt.toISOString(), submission: structuredClone(submission), ...(quizResult ? { quizResult } : {}) });
    this.persist();
    return structuredClone(event);
  }

  async prepareQuizChallenge(sessionId: string): Promise<VerificationEvent> {
    const event = this.state.events.find((item) => item.sessionId === sessionId);
    if (!event?.challenge || event.challenge.response.kind !== 'quiz') throw new Error('quiz_unavailable');
    event.challenge.quiz ??= {
      generatedAt: new Date().toISOString(), provider: 'demo', model: 'demo', promptVersion: 'demo-v1',
      questions: Array.from({ length: event.challenge.response.questionCount }, (_, index) => ({
        id: `q-${index + 1}`, prompt: `Demo question ${index + 1}`, concept: 'demo',
        choices: Array.from({ length: event.challenge!.response.kind === 'quiz' ? event.challenge!.response.choiceCount : 3 }, (_choice, choiceIndex) => ({ id: `q-${index + 1}-c-${choiceIndex + 1}`, label: `Choice ${choiceIndex + 1}` })),
      })),
    };
    this.persist();
    return structuredClone(event);
  }
  async reportQuizQuestion(_sessionId: string, _questionId: string) { /* Demo reports remain local and contain no content. */ }

  async getProofImageUrl(eventId: string) {
    const event = this.state.events.find((item) => item.id === eventId);
    if (!event?.proofImagePath) throw new Error('proof_image_unavailable');
    return 'data:image/svg+xml;utf8,' + encodeURIComponent([
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">',
      '<rect width="640" height="480" rx="28" fill="#e8f6f2"/>',
      '<circle cx="320" cy="214" r="86" fill="#fff"/>',
      '<path d="M244 262c44 40 108 40 152 0" fill="none" stroke="#087f6d" stroke-width="22" stroke-linecap="round"/>',
      '<text x="320" y="384" text-anchor="middle" font-family="Arial" font-size="34" font-weight="700" fill="#102a43">Demo proof photo</text>',
      '</svg>',
    ].join(''));
  }

  async reviewCheck(eventId: string, decision: import('../domain/models').ReviewCheckDecision) {
    const event = this.state.events.find((item) => item.id === eventId);
    if (!event) throw new Error('check_not_reviewable');
    const reviewedAt = new Date().toISOString();
    if (typeof decision !== 'string') {
      if (event.status !== 'uncertain') {
        const repeated = decision.itemDecisions.every((reviewed) => {
          const item = event.photoChecklistItems?.find((candidate) => candidate.criterionId === reviewed.criterionId);
          return item?.decision.source === 'responsible'
            && item.status === reviewed.status
            && item.reason === reviewed.reason.trim();
        });
        if (repeated) return structuredClone(event);
        throw new Error('check_not_reviewable');
      }
      const decisions = new Map(decision.itemDecisions.map((item) => [item.criterionId, item]));
      event.photoChecklistItems = event.photoChecklistItems?.map((item) => {
        const reviewed = decisions.get(item.criterionId);
        if (!reviewed) return item;
        if (item.status !== 'uncertain') throw new Error('check_not_reviewable');
        const reason = reviewed.reason.trim();
        if (!reason || reason.length > 220) throw new Error('invalid_review_reason');
        return { ...item, status: reviewed.status, confidence: 1, reason, decision: { source: 'responsible', actorUid: 'demo-parent', decidedAt: reviewedAt } };
      });
      if (event.photoChecklistItems?.some((item) => item.status === 'uncertain')) {
        this.persist();
        return structuredClone(event);
      }
      const criteria = event.challenge?.response.kind === 'photo_checklist' ? event.challenge.response.criteria : [];
      decision = criteria.some((criterion) => criterion.required
        && event.photoChecklistItems?.find((item) => item.criterionId === criterion.id)?.status === 'not_detected')
        ? 'not_detected'
        : 'detected';
    }
    if (event.status !== 'uncertain') throw new Error('check_not_reviewable');
    Object.assign(event, {
      status: decision,
      reviewStatus: decision === 'detected' ? 'approved' : 'rejected',
      reviewedAt,
      reviewedBy: 'demo-parent',
      responsibleActions: [...(event.responsibleActions ?? []), {
        type: decision === 'detected' ? 'approved' : 'rejected',
        at: reviewedAt, actorUid: 'demo-parent', actorName: this.state.accountDisplayName ?? 'Responsable démo',
      }],
    });
    delete event.proofImagePath;
    delete event.proofImageExpiresAt;
    this.persist();
    return structuredClone(event);
  }

  async retryRemoteSync() {}

  async reset() {
    this.state = initialState();
    this.consumedSessions.clear();
    this.persist();
  }

  private ensureActiveSession() {
    const assignment = primaryRoutineAssignment(this.state);
    if (!assignment) return;
    if (this.activeSession()) return;
    const now = new Date();
    this.state.events.unshift({
      id: crypto.randomUUID(),
      routineId: assignment.routineId,
      sessionId: crypto.randomUUID(),
      requestedAt: new Date(now.getTime() - 60_000).toISOString(),
      expiresAt: new Date(now.getTime() + 19 * 60_000).toISOString(),
      status: 'pending',
    });
    this.persist();
  }

  private ensureDemoProgressEvents() {
    if (!this.state.routineAssignments.some((assignment) => assignment.routineId === DEFAULT_ROUTINE_ID)) return;
    const existingIds = new Set(this.state.events.map((event) => event.id));
    const missingEvents = demoProgressEvents().filter((event) => !existingIds.has(event.id));
    if (!missingEvents.length) return;
    this.state.events.push(...missingEvents);
    this.persist();
  }

  private persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    this.listeners.forEach((listener) => listener());
  }

  private migrateState(state: AppState & { plan?: MonitoringPlan }): AppState {
    const legacyPlan = state.plan;
    const routineAssignments: RoutineAssignment[] = state.routineAssignments?.length
      ? state.routineAssignments.map((assignment) => ({
          ...assignment,
          createdBy: assignment.createdBy ?? 'parent',
          validationMode: assignment.validationMode ?? 'ai',
        }))
      : [{ ...createDefaultRoutineAssignment(), ...(legacyPlan ? { plan: legacyPlan } : {}) }];
    return {
      ...state,
      preferences: normalizeAppPreferences(state.preferences),
      participantAccess: state.participantAccess ?? [],
      routineAssignments,
      events: state.events.map((event) => ({ ...event, routineId: event.routineId ?? DEFAULT_ROUTINE_ID })),
    };
  }
}
