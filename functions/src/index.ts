import { initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { GoogleAuth } from 'google-auth-library';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { randomBytes } from 'node:crypto';
import webpush, { type PushSubscription } from 'web-push';
import { assertChildName, createLinkCode, createRecoveryCode, createRelationshipInvitationCode, hashLinkCode, isFirestoreDocumentId, isFreshCheckSubmission, isLegacyRecoveryCode, isRecoveryCode, isRelationshipInvitationCode, normalizeLinkCode, sensitiveCodeAttemptState } from './helpers.js';
import { analyzeWithGemini, parseImageDataUrl, routeAnalysisStatusForReview, type AnalysisResult, type RoutineAnalysisContext } from './analysis.js';
import { checkExpiresAt, getLocalDateKey, getWindowForDate, monitoringPlanSchema, plannedCheckDispatchSchedule, shouldAutoDispatchCheck } from './planning.js';
import { challengeForAssignment, createDefaultRoutineAssignment, createDraftRoutineAssignment, createRoutineAssignment, createRoutineAssignmentVersionChange, DEFAULT_ROUTINE_ID, isRoutineValidationMode, parseRoutineResponseSubmission, routineAssignmentProvenance, routineFromCatalog, RoutineResponseInputError, shouldCreateDefaultRoutineAssignment, type RoutineAssignmentDocument, type RoutineDocument, type RoutineResponseDefinition } from './routines.js';
import { buildCheckNotificationPayload, buildDeclarativePushPayload, buildReviewNotificationPayload, buildTestNotificationPayload, normalizePushPreferences, normalizePushSubscription, notificationWindowIsOpen, type SyntheticReceiptPayload } from './notifications.js';
import { isCheckRequestRateLimited } from './reminders.js';
import { recordAuditEvent, recordJourneyEvent, type JourneyStage } from './audit.js';
import { expiredPendingCheckCleanupUpdate, shouldDeleteProofAfterReview, staleCleanupCutoffs } from './cleanup.js';
import { reportOperationalAlert, reportOperationalEvent, reportOperationalRecovery } from './observability.js';
import { shouldRecoverSyntheticPush } from './syntheticMonitor.js';
import { canLeaveMembership, canRemoveMembership, canRenameParticipant, createMembership, hasParticipantPermission, isCompatibleLegacyContentTarget, isCompatibleMembershipMigration, isCompatibleParticipantMigration, isCompatibleParticipantRefMigration, isProfileColorKey, membershipRoles, migrateLegacyFamilyRelationships, participantRenameUpdates, pushRolesForMembership, scheduledAggregatePaths, type MembershipPushRole, type MembershipRole } from './relationships.js';
import { assertRoutineDraftRevision, createAssignmentForkPackage, createRoutineDraftDocument, routineDraftSessionId, RoutineDraftConflictError, RoutineDraftInputError, selectReusableAssignmentDraft, updateRoutineDraftDocument, type IdentifiedRoutineDraft, type PublishedRoutineVersionDocument, type RoutineDraftDocument } from './routineDrafts.js';
import { ROUTINE_PACKAGE_MIME, parseRoutinePackageEnvelope, serializeRoutinePackage } from './routinePackages.js';
import { assertExternalPackageResponse, verifyExternalRegistryIndex } from './externalRoutineRegistry.js';
import { marketplaceEntryAuthorizedForInstall, marketplaceEntryInstallable, marketplaceRole, moderateMarketplaceStatus, type ModerationAction, type ModerationStatus } from './routineMarketplaceGovernance.js';
import { AiAuthoringDisabledError, aiAuthoringCapabilityEnabled, aiAuthoringRegistry, defaultAiAuthoringConfig, parseAiAuthoringConfig, requireAiAuthoringCapability, unapprovedAiDraft } from './aiAuthoring.js';
import { generateQuizWithGemini, gradeQuizSubmission, type GeneratedQuiz, type PublicQuizQuestion, type QuizAnswerKeyEntry } from './quizGeneration.js';
import { generateRoutineProposalWithGemini, parseRoutineProposal, type ProposedResponseKind } from './routineGeneration.js';
import { aggregatePilotReport, pilotReportPeriod } from './pilotReport.js';
import { shouldMarkPushUnconfirmed } from './pushDelivery.js';

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
  ?? (process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : undefined);

initializeApp(storageBucket ? { storageBucket } : undefined);
const db = getFirestore();
const bucket = getStorage().bucket();
const region = 'europe-west1';
const vapidPrivateKey = defineSecret('WEB_PUSH_VAPID_PRIVATE_KEY');
const vapidPublicKey = defineSecret('WEB_PUSH_VAPID_PUBLIC_KEY');
const resendApiKey = defineSecret('RESEND_API_KEY');
const moderationEmail = defineSecret('USER_MODERATION_EMAIL');
const moderationFromEmail = defineSecret('USER_MODERATION_FROM_EMAIL');
const aiAuthoringConfig = defineString('AI_AUTHORING_CONFIG', {
  default: JSON.stringify(defaultAiAuthoringConfig),
  description: 'Global and per-capability AI authoring switches plus approvals for sensitive capabilities.',
});
const currentAiAuthoringConfig = () => parseAiAuthoringConfig(aiAuthoringConfig.value());
const pilotConsentVersion = '2026-07-17';
const geminiAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/generative-language'],
});
const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const assertActivatableAiRoutine = (routine: RoutineDocument) => {
  if (routine.response?.kind === 'quiz' && routine.response.mode === 'generated'
    && !aiAuthoringCapabilityEnabled(currentAiAuthoringConfig(), 'dynamicQuizGeneration')) {
    throw new HttpsError('failed-precondition', 'Dynamic quiz generation is disabled.');
  }
};
const cors = [
  'https://zadiag.vercel.app',
  'https://zadiag.com',
  'https://www.zadiag.com',
  /^https:\/\/zadiag-.*\.vercel\.app$/,
  'http://localhost:5173',
  /^http:\/\/localhost:\d+$/,
];

const syncExternalRoutineRegistryCache = async () => {
  const registryUrl = process.env.ROUTINE_REGISTRY_URL;
  const publicKeys = JSON.parse(process.env.ROUTINE_REGISTRY_PUBLIC_KEYS ?? '{}') as Record<string, string>;
  if (!registryUrl || new URL(registryUrl).protocol !== 'https:' || !Object.keys(publicKeys).length) return { status: 'disabled' as const };
  try {
    const indexResponse = await fetch(registryUrl, { signal: AbortSignal.timeout(10_000) });
    if (!indexResponse.ok) throw new Error(`registry_http_${indexResponse.status}`);
    const payload = verifyExternalRegistryIndex(await indexResponse.text(), publicKeys);
    const resolved = await Promise.all(payload.entries.map(async (entry) => {
      const response = await fetch(entry.packageUrl, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error(`registry_package_http_${response.status}`);
      const content = await response.text();
      assertExternalPackageResponse(content, response.headers.get('content-type'), entry.sha256);
      const envelope = parseRoutinePackageEnvelope(content, ROUTINE_PACKAGE_MIME);
      if (envelope.package.routine.id !== entry.id || envelope.package.version !== entry.version) throw new Error('registry_package_provenance_invalid');
      return { entry, package: envelope.package };
    }));
    const now = new Date().toISOString();
    const previous = await db.collection('routineCatalogEntries').where('source', '==', 'external').get();
    const batch = db.batch();
    previous.docs.forEach((doc) => batch.update(doc.ref, { revokedAt: now, visibility: 'unlisted' }));
    resolved.forEach(({ entry, package: routinePackage }) => {
      const id = `external-${hashLinkCode(`${entry.id}:${entry.version}`)}`;
      batch.set(db.collection('routineCatalogEntries').doc(id), { source: 'external', ownerId: 'external-registry', authorName: entry.authorName, routineId: entry.id, version: entry.version, visibility: 'listed', package: routinePackage, publishedAt: payload.generatedAt, sharedAt: now, license: entry.license, registryUrl, checksum: entry.sha256 });
    });
    batch.set(db.collection('routineRegistry').doc('state'), { status: 'healthy', registryUrl, generatedAt: payload.generatedAt, syncedAt: now, entries: resolved.length });
    await batch.commit();
    return { status: 'healthy' as const, entries: resolved.length };
  } catch (error) {
    await db.collection('routineRegistry').doc('state').set({ status: 'degraded', lastAttemptAt: new Date().toISOString(), error: error instanceof Error ? error.message.slice(0, 160) : 'unknown' }, { merge: true });
    throw error;
  }
};

export const syncExternalRoutineRegistry = onSchedule({ region, schedule: 'every 6 hours', timeoutSeconds: 300 }, async () => { await syncExternalRoutineRegistryCache(); });

interface RoutineNotificationNames {
  routineName: string;
  routineIcon?: string;
  routineNames: {
    en?: string;
    fr?: string;
  };
}

type PushRecipientRole = MembershipPushRole;
type PushNotificationDocument = FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot;
type PushDispatchResult = 'success' | 'failed' | 'invalidated' | 'skipped';

interface PushDispatchSummary {
  recipients: number;
  success: number;
  failed: number;
  invalidated: number;
  skipped: number;
}

interface SyntheticMonitorTarget {
  monitorId: string;
  participantId: string;
  receiptToken: string;
  receiptTokenHash: string;
  receiptUrl: string;
}

const pushDispatchSummary = (results: PushDispatchResult[]): PushDispatchSummary => ({
  recipients: results.length,
  success: results.filter((result) => result === 'success').length,
  failed: results.filter((result) => result === 'failed').length,
  invalidated: results.filter((result) => result === 'invalidated').length,
  skipped: results.filter((result) => result === 'skipped').length,
});

const loadSyntheticMonitorTarget = async (
  aggregateRef: FirebaseFirestore.DocumentReference,
): Promise<SyntheticMonitorTarget | undefined> => {
  if (aggregateRef.parent.id !== 'participants') return undefined;
  const participant = await aggregateRef.get();
  const monitorId = participant.data()?.syntheticMonitorUid;
  if (!isFirestoreDocumentId(monitorId)) return undefined;
  const monitor = await db.collection('syntheticMonitors').doc(monitorId).get();
  const data = monitor.data();
  if (!monitor.exists || data?.enabled !== true || data.participantId !== aggregateRef.id) return undefined;
  const receiptToken = typeof data.receiptToken === 'string' ? data.receiptToken : '';
  const receiptTokenHash = typeof data.receiptTokenHash === 'string' ? data.receiptTokenHash : '';
  const receiptUrl = typeof data.receiptUrl === 'string' ? data.receiptUrl : '';
  if (receiptToken.length < 32 || receiptToken.length > 256 || receiptTokenHash !== hashLinkCode(receiptToken)) return undefined;
  try {
    const url = new URL(receiptUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudfunctions.net')) return undefined;
  } catch {
    return undefined;
  }
  return { monitorId, participantId: aggregateRef.id, receiptToken, receiptTokenHash, receiptUrl };
};

const syntheticReceiptPayload = (
  target: SyntheticMonitorTarget | undefined,
  recipientId: string,
  receiptId: string,
): SyntheticReceiptPayload | undefined => target && target.monitorId === recipientId
  ? {
      monitorId: target.monitorId,
      receiptId,
      token: target.receiptToken,
      url: target.receiptUrl,
    }
  : undefined;

interface DeliveryReceiptPayload {
  aggregate: 'families' | 'participants';
  aggregateId: string;
  subscriptionId: string;
  receiptId: string;
  token: string;
  url: string;
}

const deliveryReceiptPayload = (
  subscriptionDocument: PushNotificationDocument,
  receiptId: string,
): DeliveryReceiptPayload | undefined => {
  const data = subscriptionDocument.data();
  const token = typeof data?.receiptToken === 'string' ? data.receiptToken : '';
  if (token.length < 32 || token.length > 256 || data?.receiptTokenHash !== hashLinkCode(token)) return undefined;
  const aggregateRef = subscriptionDocument.ref.parent.parent;
  const aggregate = aggregateRef?.parent.id;
  const projectId = process.env.GCLOUD_PROJECT;
  if (!aggregateRef || (aggregate !== 'families' && aggregate !== 'participants') || !projectId) return undefined;
  return {
    aggregate,
    aggregateId: aggregateRef.id,
    subscriptionId: subscriptionDocument.id,
    receiptId,
    token,
    url: `https://${region}-${projectId}.cloudfunctions.net/recordPushReceipt`,
  };
};

const getRoutineAnalysisContext = (
  assignment: Partial<RoutineAssignmentDocument> | undefined,
  routineId: string,
  locale: 'en' | 'fr',
): RoutineAnalysisContext | undefined => {
  const routine = routineFromCatalog(routineId) ?? assignment?.routine ?? routineFromCatalog(DEFAULT_ROUTINE_ID);
  if (!routine) return undefined;
  const localized = routine.translations?.[locale];
  const analysis = {
    ...routine.analysis,
    ...localized?.analysis,
  };
  if (!analysis.expectedEvidence || !analysis.detectedCriteria || !analysis.notDetectedCriteria) return undefined;
  return {
    routineName: localized?.name ?? routine.name,
    expectedEvidence: analysis.expectedEvidence,
    detectedCriteria: analysis.detectedCriteria,
    notDetectedCriteria: analysis.notDetectedCriteria,
    uncertaintyCriteria: analysis.uncertaintyCriteria,
  };
};

const requireAuthenticatedUid = (auth: { uid: string } | undefined) => {
  if (!auth) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return auth.uid;
};

const requireUid = async (auth: { uid: string } | undefined) => {
  const uid = requireAuthenticatedUid(auth);
  const access = await db.collection('userAccess').doc(uid).get();
  if (access.data()?.status === 'suspended') {
    throw new HttpsError('permission-denied', 'This account has been suspended.');
  }
  return uid;
};

const contactEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeContactEmail = (value: unknown) => {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !contactEmailPattern.test(email)) {
    throw new HttpsError('invalid-argument', 'A valid contact email is required.');
  }
  return email;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[character] ?? character));

const moderationUrl = (token: string) => {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('GCLOUD_PROJECT is required to build the moderation link.');
  return `https://${region}-${projectId}.cloudfunctions.net/moderateUserAccess?token=${encodeURIComponent(token)}`;
};

const sendNewUserEmail = async (uid: string, email: string, token: string) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: moderationFromEmail.value(),
      to: [moderationEmail.value()],
      subject: 'Nouvel utilisateur Zadiag',
      html: `<h1>Nouvel utilisateur Zadiag</h1><p><strong>${escapeHtml(email)}</strong></p><p>Identifiant appareil : ${escapeHtml(uid)}</p><p>L’accès est actif.</p><p><a href="${moderationUrl(token)}">Désapprouver cet utilisateur</a></p>`,
    }),
  });
  if (!response.ok) throw new Error(`Moderation email failed with status ${response.status}.`);
};

const requireDocumentId = (value: unknown, label: string) => {
  if (!isFirestoreDocumentId(value)) throw new HttpsError('invalid-argument', `${label} is invalid.`);
  return value;
};

const defaultPlan = {
  checksPerDay: 3,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  windows: [
    { id: 'morning', start: '07:30', end: '09:30' },
    { id: 'midday', start: '12:00', end: '14:00' },
    { id: 'evening', start: '17:00', end: '20:00' },
  ],
  expiryMinutes: 0,
  timeZone: 'Europe/Paris',
};
const recoveryLifetimeMs = 90 * 24 * 60 * 60 * 1000;
const relationshipInvitationLifetimeMs = 24 * 60 * 60 * 1000;
const maxImageDataUrlLength = 5 * 1024 * 1024;
const proofImageSignedUrlMinutes = 5;
const proofImageRetentionDays = 30;
const createRecoveryRecord = (familyId: string, expiresAt: Date) => ({
  familyId,
  expiresAt: expiresAt.toISOString(),
  createdAt: new Date().toISOString(),
});
type ReviewedCheckPayload = Record<string, unknown> & {
  id: string;
  proofImagePath?: unknown;
  proofImageExpiresAt?: unknown;
};

const requireAggregatePermission = async (
  uid: string,
  aggregateId: string,
  permission: Parameters<typeof hasParticipantPermission>[1],
  legacyRole?: 'parent' | 'child',
) => {
  const familyRef = db.collection('families').doc(aggregateId);
  const participantRef = db.collection('participants').doc(aggregateId);
  const [profile, family, participant, membership] = await Promise.all([
    db.collection('users').doc(uid).get(),
    familyRef.get(),
    participantRef.get(),
    participantRef.collection('memberships').doc(uid).get(),
  ]);
  const profileMatches = profile.exists
    && profile.data()?.familyId === aggregateId
    && (!legacyRole || profile.data()?.role === legacyRole);
  const familyMatches = family.exists
    && (!legacyRole
      ? typeof family.data()?.members?.[uid] === 'string'
      : family.data()?.members?.[uid] === legacyRole);
  if (profileMatches || familyMatches) return familyRef;
  if (participant.exists && hasParticipantPermission(membership.data(), permission)) return participantRef;
  throw new HttpsError('permission-denied', 'This account does not have permission for the followed person.');
};

const requireFamilyRole = async (uid: string, familyId: string, role: 'parent' | 'child') => {
  const permission = role === 'parent' ? 'reviewProofs' : 'submitChecks';
  return requireAggregatePermission(uid, familyId, permission, role);
};

const requireFamilyMember = (uid: string, familyId: string) => requireAggregatePermission(uid, familyId, 'view');

const requireParticipantRoutineDraftAccess = async (uid: string, participantId: string) => {
  const participantRef = db.collection('participants').doc(participantId);
  const [participant, membership] = await Promise.all([
    participantRef.get(),
    participantRef.collection('memberships').doc(uid).get(),
  ]);
  if (!participant.exists || !hasParticipantPermission(membership.data(), 'manageRoutines')) {
    throw new HttpsError('permission-denied', 'This account cannot manage routine drafts for the followed person.');
  }
  return participantRef;
};

const requireParticipantRoutineDraftTransactionAccess = async (
  transaction: FirebaseFirestore.Transaction,
  participantRef: FirebaseFirestore.DocumentReference,
  uid: string,
) => {
  const [participant, membership] = await Promise.all([
    transaction.get(participantRef),
    transaction.get(participantRef.collection('memberships').doc(uid)),
  ]);
  if (!participant.exists || !hasParticipantPermission(membership.data(), 'manageRoutines')) {
    throw new HttpsError('permission-denied', 'This account cannot manage routine drafts for the followed person.');
  }
};

const requireDraftRevision = (value: unknown) => {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new HttpsError('invalid-argument', 'A valid draft revision is required.');
  return Number(value);
};

const routineDraftInputError = (error: unknown) => {
  if (error instanceof RoutineDraftInputError) throw new HttpsError('invalid-argument', error.message);
  if (error instanceof RoutineDraftConflictError) throw new HttpsError('aborted', 'The routine draft changed on another device. Reload and try again.');
  throw error;
};

const responsibleActorName = async (uid: string) => {
  const profile = await db.collection('users').doc(uid).get();
  return String(profile.data()?.displayName ?? '').trim() || 'Responsable';
};

const pushRolesForAggregate = async (uid: string, aggregateRef: FirebaseFirestore.DocumentReference): Promise<PushRecipientRole[]> => {
  if (aggregateRef.parent.id === 'families') {
    const profile = await db.collection('users').doc(uid).get();
    return [profile.data()?.role === 'child' ? 'child' : 'parent'];
  }
  const membership = await aggregateRef.collection('memberships').doc(uid).get();
  return pushRolesForMembership(membership.data());
};

const primaryPushRole = (roles: PushRecipientRole[]): PushRecipientRole => roles.includes('child') ? 'child' : 'parent';

const journeyStages = new Set<JourneyStage>(['app_ready', 'notifications_enabled', 'notification_opened', 'check_opened', 'routine_authoring_started', 'routine_authoring_proposal', 'routine_authoring_refinement', 'routine_authoring_approved', 'routine_authoring_activated']);
const journeySources = new Set(['startup', 'settings', 'push', 'notification_center', 'dashboard', 'history', 'routine_composer']);

export const recordClientJourney = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const aggregateId = requireDocumentId(request.data?.aggregateId, 'Profile ID');
  const stage = String(request.data?.stage ?? '') as JourneyStage;
  if (!journeyStages.has(stage)) throw new HttpsError('invalid-argument', 'A valid journey stage is required.');
  const contextId = request.data?.contextId === undefined ? undefined : requireDocumentId(request.data.contextId, 'Context ID');
  const source = String(request.data?.source ?? '');
  if (!journeySources.has(source)) throw new HttpsError('invalid-argument', 'A valid journey source is required.');
  const aggregateRef = await requireFamilyMember(uid, aggregateId);
  const participation = (await db.collection('users').doc(uid).get()).data()?.pilotParticipation;
  if (participation?.version !== pilotConsentVersion || participation?.status !== 'accepted') {
    throw new HttpsError('failed-precondition', 'Pilot participation is not active.');
  }
  const checkScoped = stage === 'notification_opened' || stage === 'check_opened';
  if (checkScoped && !contextId) throw new HttpsError('invalid-argument', 'This journey stage requires a check context.');
  if (!checkScoped && contextId) throw new HttpsError('invalid-argument', 'This journey stage does not accept a check context.');
  if (contextId && !(await aggregateRef.collection('checks').doc(contextId).get()).exists) {
    throw new HttpsError('not-found', 'The check could not be found.');
  }
  const role = primaryPushRole(await pushRolesForAggregate(uid, aggregateRef));
  await recordJourneyEvent(db, {
    stage,
    actorUid: uid,
    ...(aggregateRef.parent.id === 'participants' ? { participantId: aggregateId } : { familyId: aggregateId }),
    role: role === 'child' ? 'child' as const : 'parent' as const,
    contextId,
    metadata: { source, pilotConsentVersion, ...(contextId ? { contextId } : {}) },
  });
});

export const updatePilotParticipation = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const aggregateId = requireDocumentId(request.data?.aggregateId, 'Profile ID');
  const status = String(request.data?.status ?? '') as 'accepted' | 'declined' | 'withdrawn';
  if (!['accepted', 'declined', 'withdrawn'].includes(status)) {
    throw new HttpsError('invalid-argument', 'A valid pilot participation choice is required.');
  }
  const aggregateRef = await requireFamilyMember(uid, aggregateId);
  const role = primaryPushRole(await pushRolesForAggregate(uid, aggregateRef));
  const recordedAt = new Date().toISOString();
  const pilotParticipation = {
    version: pilotConsentVersion,
    status,
    role: (role === 'child' ? 'child' : 'parent') as 'child' | 'parent',
    recordedAt,
  };
  await db.collection('users').doc(uid).set({ pilotParticipation, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await recordAuditEvent(db, {
    action: status === 'accepted' ? 'accept_pilot_participation' : status === 'declined' ? 'decline_pilot_participation' : 'withdraw_pilot_participation',
    actorUid: uid,
    ...(aggregateRef.parent.id === 'participants' ? { participantId: aggregateId } : { familyId: aggregateId }),
    role: pilotParticipation.role,
    metadata: { version: pilotConsentVersion },
  });
  return pilotParticipation;
});

export const getPilotAggregateReport = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  await requireUid(request.auth);
  const operationsRole = request.auth?.token.operationsRole;
  if (operationsRole !== 'operator' && operationsRole !== 'admin') {
    throw new HttpsError('permission-denied', 'Pilot operator access is required.');
  }
  let period: ReturnType<typeof pilotReportPeriod>;
  try {
    period = pilotReportPeriod(request.data?.from, request.data?.to);
  } catch {
    throw new HttpsError('invalid-argument', 'A completed period of at most 35 days is required.');
  }
  const snapshot = await db.collection('auditEvents')
    .where('createdAt', '>=', Timestamp.fromDate(period.start))
    .where('createdAt', '<', Timestamp.fromDate(period.end))
    .orderBy('createdAt')
    .limit(5001)
    .get();
  if (snapshot.size > 5000) throw new HttpsError('resource-exhausted', 'The pilot period contains too many records. Use a shorter period.');
  return {
    from: period.start.toISOString(),
    to: period.end.toISOString(),
    ...aggregatePilotReport(snapshot.docs.map((document) => document.data())),
  };
});

const imageExtensionFor = (mimeType: string) => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
};

const storeProofImage = async (aggregate: 'families' | 'participants', familyId: string, checkId: string, imageDataUrl: string) => {
  const { mimeType, data } = parseImageDataUrl(imageDataUrl);
  const path = `${aggregate}/${familyId}/checks/${checkId}/proof.${imageExtensionFor(mimeType)}`;
  const file = bucket.file(path);
  await file.save(Buffer.from(data, 'base64'), {
    resumable: false,
    metadata: {
      contentType: mimeType,
      cacheControl: 'private, max-age=0, no-transform',
      metadata: { familyId, checkId },
    },
  });
  return path;
};

const ensureFamilyRoutineMigration = async (familyRef: FirebaseFirestore.DocumentReference) => {
  const assignmentRef = familyRef.collection('routineAssignments').doc(DEFAULT_ROUTINE_ID);
  const [currentFamily, currentAssignment] = await Promise.all([
    familyRef.get(),
    assignmentRef.get(),
  ]);
  if (!currentFamily.exists) throw new HttpsError('not-found', 'The family could not be found.');
  if (!shouldCreateDefaultRoutineAssignment(currentFamily.data()?.routineMigrationVersion, currentAssignment.exists)) return currentAssignment;

  await db.runTransaction(async (transaction) => {
    const [family, assignment] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(assignmentRef),
    ]);
    if (!family.exists) throw new HttpsError('not-found', 'The family could not be found.');
    if (!shouldCreateDefaultRoutineAssignment(family.data()?.routineMigrationVersion, assignment.exists)) return;
    const legacyPlan = monitoringPlanSchema.safeParse(family.data()?.plan);
    const assignedAt = String(family.data()?.createdAt ?? new Date().toISOString());
    transaction.create(assignmentRef, createDefaultRoutineAssignment(
      legacyPlan.success ? legacyPlan.data : defaultPlan,
      assignedAt,
    ));
  });

  const migratedFamily = await familyRef.get();
  if (Number(migratedFamily.data()?.routineMigrationVersion ?? 0) >= 1) return assignmentRef.get();
  const checks = await familyRef.collection('checks').get();
  const legacyChecks = checks.docs.filter((check) => !check.data().routineId);
  if (legacyChecks.length) {
    const writer = db.bulkWriter();
    legacyChecks.forEach((check) => writer.update(check.ref, { routineId: DEFAULT_ROUTINE_ID }));
    await writer.close();
  }
  await familyRef.update({
    plan: FieldValue.delete(),
    routineMigrationVersion: 1,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return assignmentRef.get();
};

const copyLegacyParticipantSubcollection = async (
  familyId: string,
  source: FirebaseFirestore.CollectionReference,
  target: FirebaseFirestore.CollectionReference,
) => {
  const sourceSnapshot = await source.get();
  const chunkSize = 150;
  for (let offset = 0; offset < sourceSnapshot.docs.length; offset += chunkSize) {
    const sourceDocuments = sourceSnapshot.docs.slice(offset, offset + chunkSize);
    await db.runTransaction(async (transaction) => {
      const targetRefs = sourceDocuments.map((document) => target.doc(document.id));
      const targetSnapshots = await transaction.getAll(...targetRefs);
      sourceDocuments.forEach((sourceDocument, index) => {
        const targetSnapshot = targetSnapshots[index];
        if (!isCompatibleLegacyContentTarget(targetSnapshot.data(), familyId, sourceDocument.ref.path)) {
          throw new HttpsError('already-exists', `Conflicting migrated content at ${targetRefs[index].path}.`);
        }
        if (!targetSnapshot.exists) {
          transaction.create(targetRefs[index], {
            ...sourceDocument.data(),
            relationshipSourceFamilyId: familyId,
            relationshipSourcePath: sourceDocument.ref.path,
          });
        }
      });
    });
  }
  return sourceSnapshot.size;
};

const deleteQueryDocumentsInBatches = async (
  query: FirebaseFirestore.Query,
  batchSize = 400,
) => {
  let deleted = 0;
  while (true) {
    const snapshot = await query.limit(batchSize).get();
    if (snapshot.empty) return deleted;
    const batch = db.batch();
    snapshot.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    deleted += snapshot.size;
    if (snapshot.size < batchSize) return deleted;
  }
};

const recordSensitiveCodeAttempt = async (uid: string) => {
  const attemptRef = db.collection('recoveryAttempts').doc(uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(attemptRef);
    const data = snapshot.data();
    const attempt = sensitiveCodeAttemptState(data);
    if (attempt.blocked) throw new HttpsError('resource-exhausted', 'Too many code attempts. Try again later.');
    transaction.set(attemptRef, {
      attempts: attempt.attempts,
      windowStartedAt: attempt.windowStartedAt,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
};

const pushRecipientRoles = (subscriptionDocument: PushNotificationDocument): PushRecipientRole[] => {
  const roles = subscriptionDocument.data()?.roles;
  if (Array.isArray(roles)) return roles.filter((role): role is PushRecipientRole => role === 'child' || role === 'parent');
  const role = subscriptionDocument.data()?.role;
  return [role === 'parent' ? 'parent' : 'child'];
};

const sendPushPayload = async (
  subscriptionDocument: PushNotificationDocument,
  payload: unknown,
  ttl = 120,
): Promise<PushDispatchResult> => {
  const subscription = subscriptionDocument.data() as PushSubscription & { locale?: string } | undefined;
  if (!subscription) return 'skipped';
  const receiptId = crypto.randomUUID();
  const receipt = deliveryReceiptPayload(subscriptionDocument, receiptId);
  const visiblePayload = receipt && payload && typeof payload === 'object'
    ? { ...payload as Record<string, unknown>, deliveryReceipt: receipt }
    : payload;
  const outboundPayload = visiblePayload && typeof visiblePayload === 'object'
    && typeof (visiblePayload as { title?: unknown }).title === 'string'
    && typeof (visiblePayload as { body?: unknown }).body === 'string'
    && typeof (visiblePayload as { tag?: unknown }).tag === 'string'
    && typeof (visiblePayload as { path?: unknown }).path === 'string'
    ? buildDeclarativePushPayload(visiblePayload as Parameters<typeof buildDeclarativePushPayload>[0])
    : visiblePayload;
  const recordDispatch = async (result: 'success' | 'failed' | 'invalidated', error?: unknown) => {
    await subscriptionDocument.ref.set({
      lastDispatchResult: result,
      lastDispatchAt: FieldValue.serverTimestamp(),
      ...(result === 'success' && receipt ? {
        lastPushExpectedAt: FieldValue.serverTimestamp(),
        lastExpectedReceiptId: receiptId,
        deliveryStatus: 'expected',
      } : {}),
      ...(error ? { lastDispatchError: String((error as { message?: string }).message ?? error).slice(0, 180) } : { lastDispatchError: FieldValue.delete() }),
    }, { merge: true });
  };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(outboundPayload), { TTL: ttl });
    await recordDispatch('success');
    return 'success';
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await recordDispatch('invalidated', error);
      reportOperationalAlert({
        kind: 'push_subscription_invalidated',
        familyId: subscriptionDocument.ref.parent.parent?.id,
        actorUid: subscriptionDocument.id,
        details: { statusCode: statusCode ?? null },
        error,
      });
      await subscriptionDocument.ref.delete();
      return 'invalidated';
    } else {
      await recordDispatch('failed', error);
      reportOperationalAlert({
        kind: 'push_send_failed',
        familyId: subscriptionDocument.ref.parent.parent?.id,
        actorUid: subscriptionDocument.id,
        details: { statusCode: statusCode ?? null },
        error,
      });
      console.error('Unable to send Web Push notification', error);
      return 'failed';
    }
  }
};

const markSyntheticPushExpected = async (
  target: SyntheticMonitorTarget,
  receiptId: string,
  expectedAt: Date,
) => {
  await db.collection('syntheticMonitors').doc(target.monitorId).set({
    lastPushExpectedAt: expectedAt,
    lastExpectedReceiptId: receiptId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
};

const sendCheckPushNotification = async (
  subscriptionDocument: PushNotificationDocument,
  check: { checkId: string; sessionId: string; routineId: string } & RoutineNotificationNames,
  resend: boolean,
  syntheticMonitor?: SyntheticMonitorTarget,
) => {
  if (!pushRecipientRoles(subscriptionDocument).includes('child')) return 'skipped' as const;
  const subscription = subscriptionDocument.data() as { locale?: string } | undefined;
  const basePayload = buildCheckNotificationPayload({
    sessionId: check.sessionId,
    routineId: check.routineId,
    routineName: check.routineName,
    routineNames: check.routineNames,
    routineIcon: check.routineIcon,
    resend,
    locale: subscription?.locale,
  });
  const receipt = syntheticReceiptPayload(syntheticMonitor, subscriptionDocument.id, check.checkId);
  const payload = receipt ? { ...basePayload, checkId: check.checkId, syntheticReceipt: receipt } : basePayload;
  const expectedAt = new Date();
  const result = await sendPushPayload(subscriptionDocument, payload);
  if (result === 'success' && receipt && syntheticMonitor) {
    await markSyntheticPushExpected(syntheticMonitor, receipt.receiptId, expectedAt);
  }
  return result;
};

const sendReviewPushNotification = async (
  subscriptionDocument: PushNotificationDocument,
  check: { checkId: string; routineId: string } & RoutineNotificationNames,
): Promise<PushDispatchResult> => {
  if (!pushRecipientRoles(subscriptionDocument).includes('parent')) return 'skipped';
  const subscription = subscriptionDocument.data() as { locale?: string } | undefined;
  const payload = buildReviewNotificationPayload({
    participantId: subscriptionDocument.ref.parent.parent!.id,
    checkId: check.checkId,
    routineId: check.routineId,
    routineName: check.routineName,
    routineNames: check.routineNames,
    routineIcon: check.routineIcon,
    locale: subscription?.locale,
  });
  return sendPushPayload(subscriptionDocument, payload);
};

const dispatchPushNotifications = async (
  subscriptions: PushNotificationDocument[],
  context: {
    familyId: string;
    checkId?: string;
    routineId?: string;
    notificationType: 'check' | 'review' | 'test';
  },
  dispatch: (document: PushNotificationDocument) => Promise<PushDispatchResult>,
): Promise<PushDispatchSummary> => {
  const settled = await Promise.allSettled(subscriptions.map(dispatch));
  const results = settled.map((result, index): PushDispatchResult => {
    if (result.status === 'fulfilled') return result.value;
    reportOperationalAlert({
      kind: 'push_send_failed',
      familyId: context.familyId,
      checkId: context.checkId,
      routineId: context.routineId,
      actorUid: subscriptions[index]?.id,
      details: { notificationType: context.notificationType, phase: 'dispatch_unhandled_rejection' },
      error: result.reason,
    });
    return 'failed';
  });
  const summary = pushDispatchSummary(results);
  reportOperationalEvent({
    kind: 'push_dispatch_summary',
    familyId: context.familyId,
    checkId: context.checkId,
    routineId: context.routineId,
    details: { notificationType: context.notificationType, ...summary },
  });
  if (summary.success > 0 && summary.failed === 0) reportOperationalRecovery('push_send_failed');
  return summary;
};

const firestoreTimestampMillis = (value: unknown) => (
  value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : undefined
);

const markUnconfirmedPushSubscriptions = async (
  subscriptions: FirebaseFirestore.QuerySnapshot,
  now: Date,
) => {
  const updates = subscriptions.docs.filter((subscription) => {
    const data = subscription.data();
    return shouldMarkPushUnconfirmed({
      expectedAtMs: firestoreTimestampMillis(data.lastPushExpectedAt),
      receivedAtMs: firestoreTimestampMillis(data.lastPushReceivedAt),
      expectedReceiptId: typeof data.lastExpectedReceiptId === 'string' ? data.lastExpectedReceiptId : undefined,
      recoveryExpectedReceiptId: typeof data.recoveryExpectedReceiptId === 'string' ? data.recoveryExpectedReceiptId : undefined,
    }, now.getTime());
  });
  await Promise.all(updates.map((subscription) => subscription.ref.set({
    deliveryStatus: 'unconfirmed',
    recoveryRequired: true,
    recoveryExpectedReceiptId: subscription.data().lastExpectedReceiptId,
    deliveryUnconfirmedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })));
  updates.forEach((subscription) => {
    reportOperationalAlert({
      kind: 'push_delivery_unconfirmed',
      familyId: subscription.ref.parent.parent?.id,
      actorUid: subscription.id,
      details: { recovery: 'renew_subscription' },
    });
  });
  return updates.length;
};

const sendCheckPushNotifications = async (
  familyRef: FirebaseFirestore.DocumentReference,
  check: { checkId: string; sessionId: string; routineId: string } & RoutineNotificationNames,
  resend: boolean,
): Promise<PushDispatchSummary> => {
  const [subscriptions, syntheticMonitor] = await Promise.all([
    familyRef.collection('pushSubscriptions').get(),
    loadSyntheticMonitorTarget(familyRef),
  ]);
  if (!subscriptions.empty) {
    webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());
  }
  return dispatchPushNotifications(subscriptions.docs, {
    familyId: familyRef.id,
    checkId: check.checkId,
    routineId: check.routineId,
    notificationType: 'check',
  }, (document) => sendCheckPushNotification(document, check, resend, syntheticMonitor));
};

const sendReviewPushNotifications = async (
  familyRef: FirebaseFirestore.DocumentReference,
  check: { checkId: string; routineId: string } & RoutineNotificationNames,
): Promise<PushDispatchSummary> => {
  const subscriptions = await familyRef.collection('pushSubscriptions').get();
  if (!subscriptions.empty) {
    webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());
  }
  return dispatchPushNotifications(subscriptions.docs, {
    familyId: familyRef.id,
    checkId: check.checkId,
    routineId: check.routineId,
    notificationType: 'review',
  }, (document) => sendReviewPushNotification(document, check));
};

const getRoutineNotificationNames = (
  assignmentData: FirebaseFirestore.DocumentData | undefined,
  fallback: string,
): RoutineNotificationNames => {
  const routine = assignmentData?.routine as {
    name?: unknown;
    icon?: unknown;
    translations?: {
      en?: { name?: unknown };
      fr?: { name?: unknown };
    };
  } | undefined;
  const englishName = typeof routine?.name === 'string' && routine.name.trim() ? routine.name : fallback;
  return {
    routineName: englishName,
    routineIcon: typeof routine?.icon === 'string' && routine.icon.trim() ? routine.icon : undefined,
    routineNames: {
      en: typeof routine?.translations?.en?.name === 'string' ? routine.translations.en.name : englishName,
      fr: typeof routine?.translations?.fr?.name === 'string' ? routine.translations.fr.name : undefined,
    },
  };
};

export const registerContactEmail = onCall({
  region,
  cors,
  enforceAppCheck: true,
  secrets: [resendApiKey, moderationEmail, moderationFromEmail],
}, async (request) => {
  const uid = requireAuthenticatedUid(request.auth);
  const email = normalizeContactEmail(request.data?.email);
  const accessRef = db.collection('userAccess').doc(uid);
  const existing = await accessRef.get();
  if (existing.data()?.status === 'suspended') {
    throw new HttpsError('permission-denied', 'This account has been suspended.');
  }
  const existingEmail = typeof existing.data()?.contactEmail === 'string' ? existing.data()!.contactEmail : '';
  if (existingEmail && existing.data()?.moderationNotifiedAt) return { email: existingEmail };
  const registeredEmail = existingEmail || email;

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashLinkCode(token);
  const now = new Date().toISOString();
  const effectiveEmail = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(accessRef);
    if (current.data()?.status === 'suspended') throw new HttpsError('permission-denied', 'This account has been suspended.');
    const transactionEmail = typeof current.data()?.contactEmail === 'string' ? current.data()!.contactEmail : registeredEmail;
    transaction.set(accessRef, { contactEmail: transactionEmail, status: 'active', contactEmailCreatedAt: current.data()?.contactEmailCreatedAt ?? now, updatedAt: now }, { merge: true });
    transaction.create(db.collection('userModerationTokens').doc(tokenHash), { uid, email: transactionEmail, createdAt: now, usedAt: null });
    return transactionEmail;
  });
  await sendNewUserEmail(uid, effectiveEmail, token);
  await accessRef.set({ moderationNotifiedAt: new Date().toISOString() }, { merge: true });
  await recordAuditEvent(db, { action: 'register_contact_email', actorUid: uid });
  return { email: effectiveEmail };
});

export const moderateUserAccess = onRequest({ region }, async (request, response) => {
  response.set('Cache-Control', 'no-store');
  const token = typeof request.query.token === 'string' ? request.query.token : '';
  if (token.length < 32 || token.length > 256) {
    response.status(400).send('<h1>Lien invalide</h1>');
    return;
  }
  const tokenRef = db.collection('userModerationTokens').doc(hashLinkCode(token));
  const tokenDocument = await tokenRef.get();
  const tokenData = tokenDocument.data();
  if (!tokenDocument.exists || tokenData?.usedAt) {
    response.status(410).send('<h1>Lien expiré ou déjà utilisé</h1>');
    return;
  }
  const moderation = tokenData!;
  if (request.method === 'GET') {
    response.status(200).send(`<!doctype html><html lang="fr"><meta name="viewport" content="width=device-width"><title>Désapprouver Zadiag</title><body><main><h1>Désapprouver cet utilisateur ?</h1><p>${escapeHtml(String(moderation.email ?? 'Utilisateur inconnu'))}</p><form method="post"><button type="submit">Confirmer la désapprobation</button></form></main></body></html>`);
    return;
  }
  if (request.method !== 'POST') {
    response.status(405).send('Method not allowed');
    return;
  }
  const uid = String(moderation.uid ?? '');
  if (!isFirestoreDocumentId(uid)) {
    response.status(400).send('<h1>Lien invalide</h1>');
    return;
  }
  await db.runTransaction(async (transaction) => {
    const currentToken = await transaction.get(tokenRef);
    if (currentToken.data()?.usedAt) throw new Error('moderation_token_used');
    const now = new Date().toISOString();
    transaction.set(db.collection('userAccess').doc(uid), { status: 'suspended', suspendedAt: now, updatedAt: now }, { merge: true });
    transaction.update(tokenRef, { usedAt: now });
  });
  await recordAuditEvent(db, { action: 'suspend_user_access', actorUid: 'moderation-email', metadata: { suspendedUid: uid } });
  response.status(200).send('<h1>Accès suspendu</h1><p>Cet appareil ne peut plus utiliser Zadiag.</p>');
});

export const createParticipant = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  let displayName: string;
  try { displayName = assertChildName(request.data?.displayName); }
  catch { throw new HttpsError('invalid-argument', 'A valid participant name is required.'); }
  const selfManaged = request.data?.selfManaged === true;
  const participantRef = db.collection('participants').doc();
  const membershipRef = participantRef.collection('memberships').doc(uid);
  const participantIndexRef = db.collection('users').doc(uid).collection('participantRefs').doc(participantRef.id);
  const userRef = db.collection('users').doc(uid);
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const user = await transaction.get(userRef);
    const existingAccountName = typeof user.data()?.displayName === 'string' ? user.data()!.displayName.trim() : '';
    const accountDisplayName = existingAccountName || (selfManaged ? displayName : '');
    transaction.create(participantRef, {
      displayName,
      ...(selfManaged ? { userId: uid } : {}),
      status: 'active',
      createdBy: uid,
      relationshipModelVersion: 2,
      createdAt: now,
      updatedAt: now,
    });
    transaction.create(membershipRef, createMembership({
      uid,
      role: 'owner',
      ...(accountDisplayName ? { displayName: accountDisplayName } : {}),
      ...(selfManaged ? { label: 'self' as const } : {}),
      now,
    }));
    transaction.set(participantIndexRef, {
      participantId: participantRef.id,
      role: 'owner',
      status: 'active',
      updatedAt: now,
    });
    transaction.set(userRef, {
      relationshipModelVersion: 2,
      ...(accountDisplayName ? { displayName: accountDisplayName } : {}),
      updatedAt: now,
    }, { merge: true });
  });
  await recordAuditEvent(db, {
    action: 'create_participant',
    actorUid: uid,
    participantId: participantRef.id,
    metadata: { selfManaged },
  });
  return { participantId: participantRef.id };
});

export const updateAccountProfile = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  let displayName: string;
  try { displayName = assertChildName(request.data?.displayName); }
  catch { throw new HttpsError('invalid-argument', 'A valid account name is required.'); }

  const userRef = db.collection('users').doc(uid);
  const participantRefs = await userRef.collection('participantRefs').where('status', '==', 'active').get();
  const membershipRefs = participantRefs.docs.map((reference) => (
    db.collection('participants').doc(reference.id).collection('memberships').doc(uid)
  ));
  const membershipSnapshots = membershipRefs.length ? await db.getAll(...membershipRefs) : [];
  const activeMemberships = membershipSnapshots.filter((membership) => (
    membership.exists && membership.data()?.uid === uid && membership.data()?.status === 'active'
  ));
  const now = new Date().toISOString();
  const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [
    (batch) => batch.set(userRef, { displayName, relationshipModelVersion: 2, updatedAt: now }, { merge: true }),
    ...activeMemberships.map((membership) => (batch: FirebaseFirestore.WriteBatch) => (
      batch.set(membership.ref, { displayName, updatedAt: now }, { merge: true })
    )),
  ];
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db.batch();
    writes.slice(offset, offset + 400).forEach((write) => write(batch));
    await batch.commit();
  }
  await recordAuditEvent(db, {
    action: 'update_account_profile',
    actorUid: uid,
    metadata: { updatedMemberships: activeMemberships.length },
  });
  return { displayName, updatedMemberships: activeMemberships.length };
});

export const renameParticipant = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  let displayName: string;
  try { displayName = assertChildName(request.data?.displayName); }
  catch { throw new HttpsError('invalid-argument', 'A valid participant name is required.'); }
  const participantRef = db.collection('participants').doc(participantId);
  const membershipRef = participantRef.collection('memberships').doc(uid);
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const [participant, membership] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(membershipRef),
    ]);
    const participantData = participant.data();
    if (!participant.exists || !canRenameParticipant(participantData, membership.data(), uid)) {
      throw new HttpsError('permission-denied', 'This account cannot rename the participant.');
    }
    const updates = participantRenameUpdates(participantData ?? {}, displayName, now);
    const legacyFamilyRef = updates.legacyFamily && isFirestoreDocumentId(updates.legacyFamily.familyId)
      ? db.collection('families').doc(updates.legacyFamily.familyId)
      : undefined;
    const legacyFamily = legacyFamilyRef ? await transaction.get(legacyFamilyRef) : undefined;
    transaction.update(participantRef, updates.participant);
    if (legacyFamilyRef && legacyFamily?.exists) {
      transaction.update(legacyFamilyRef, updates.legacyFamily!.data);
    }
  });
  await recordAuditEvent(db, {
    action: 'rename_participant',
    actorUid: uid,
    participantId,
    metadata: {},
  });
  return { participantId, displayName };
});

export const updateParticipantColor = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const profileColor = request.data?.profileColor;
  if (!isProfileColorKey(profileColor)) throw new HttpsError('invalid-argument', 'The profile color is invalid.');
  const participantRef = db.collection('participants').doc(participantId);
  const membershipRef = participantRef.collection('memberships').doc(uid);
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const [participant, membership] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(membershipRef),
    ]);
    if (!participant.exists || participant.data()?.status !== 'active') {
      throw new HttpsError('not-found', 'The participant could not be found.');
    }
    const membershipData = membership.data();
    if (!membership.exists || membershipData?.status !== 'active' || !['owner', 'participant'].includes(String(membershipData.role ?? ''))) {
      throw new HttpsError('permission-denied', 'Only a primary responsible person or the participant can change this color.');
    }
    transaction.update(participantRef, { profileColor, updatedAt: now });
  });
  await recordAuditEvent(db, {
    action: 'update_participant_color',
    actorUid: uid,
    participantId,
    metadata: { profileColor },
  });
  return { participantId, profileColor };
});

export const createRelationshipInvitation = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const intendedRole = String(request.data?.role ?? '') as MembershipRole;
  if (!membershipRoles.includes(intendedRole)) {
    throw new HttpsError('invalid-argument', 'The invitation role is invalid.');
  }
  const membership = await db.collection('participants').doc(participantId).collection('memberships').doc(uid).get();
  if (!hasParticipantPermission(membership.data(), 'manageCaregivers')) {
    throw new HttpsError('permission-denied', 'Only an owner can invite another member.');
  }
  const code = createRelationshipInvitationCode();
  const invitationRef = db.collection('relationshipInvitations').doc(hashLinkCode(code));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + relationshipInvitationLifetimeMs);
  await invitationRef.create({
    participantId,
    intendedRole,
    permissions: createMembership({ uid: 'invited', role: intendedRole }).permissions,
    createdBy: uid,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    consumedAt: null,
  });
  await recordAuditEvent(db, {
    action: 'create_relationship_invitation',
    actorUid: uid,
    participantId,
    metadata: { intendedRole },
  });
  return { code, expiresAt: expiresAt.toISOString() };
});

export const acceptRelationshipInvitation = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const code = normalizeLinkCode(String(request.data?.code ?? ''));
  if (!isRelationshipInvitationCode(code)) throw new HttpsError('invalid-argument', 'The invitation code is invalid.');
  await recordSensitiveCodeAttempt(uid);
  const invitationRef = db.collection('relationshipInvitations').doc(hashLinkCode(code));

  const participantId = await db.runTransaction(async (transaction) => {
    const invitation = await transaction.get(invitationRef);
    if (!invitation.exists) throw new HttpsError('not-found', 'The invitation code is invalid.');
    const invitationData = invitation.data() ?? {};
    const targetParticipantId = String(invitationData.participantId ?? '');
    const intendedRole = String(invitationData.intendedRole ?? '') as MembershipRole;
    if (!targetParticipantId || !membershipRoles.includes(intendedRole)) {
      throw new HttpsError('failed-precondition', 'The invitation is invalid.');
    }
    if (invitationData.consumedAt) {
      if (invitationData.consumedBy === uid) return targetParticipantId;
      throw new HttpsError('failed-precondition', 'The invitation has already been used.');
    }
    if (Date.parse(String(invitationData.expiresAt ?? '')) <= Date.now()) {
      throw new HttpsError('failed-precondition', 'The invitation has expired.');
    }
    const participantRef = db.collection('participants').doc(targetParticipantId);
    const membershipRef = participantRef.collection('memberships').doc(uid);
    const participantIndexRef = db.collection('users').doc(uid).collection('participantRefs').doc(targetParticipantId);
    const userRef = db.collection('users').doc(uid);
    const [participant, existingMembership, user] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(membershipRef),
      transaction.get(userRef),
    ]);
    if (!participant.exists || participant.data()?.status !== 'active') {
      throw new HttpsError('not-found', 'The participant could not be found.');
    }
    if (existingMembership.exists && (
      existingMembership.data()?.status !== 'active'
      || existingMembership.data()?.role !== intendedRole
    )) {
      throw new HttpsError('already-exists', 'This account already has a different relationship.');
    }
    if (intendedRole === 'participant') {
      const participantUserId = participant.data()?.userId;
      if (participantUserId && participantUserId !== uid) {
        throw new HttpsError('already-exists', 'The participant is already linked to another account.');
      }
      if (!participantUserId) transaction.update(participantRef, { userId: uid, updatedAt: new Date().toISOString() });
    }
    const now = new Date().toISOString();
    const existingAccountName = typeof user.data()?.displayName === 'string' ? user.data()!.displayName.trim() : '';
    const accountDisplayName = existingAccountName || (intendedRole === 'participant'
      ? String(participant.data()?.displayName ?? '').trim()
      : '');
    if (!existingMembership.exists) {
      transaction.create(membershipRef, createMembership({
        uid,
        role: intendedRole,
        ...(accountDisplayName ? { displayName: accountDisplayName } : {}),
        invitedBy: String(invitationData.createdBy ?? ''),
        now,
      }));
    } else if (accountDisplayName && existingMembership.data()?.displayName !== accountDisplayName) {
      transaction.set(membershipRef, { displayName: accountDisplayName, updatedAt: now }, { merge: true });
    }
    transaction.set(participantIndexRef, {
      participantId: targetParticipantId,
      role: intendedRole,
      status: 'active',
      updatedAt: now,
    });
    transaction.set(userRef, {
      relationshipModelVersion: 2,
      ...(accountDisplayName ? { displayName: accountDisplayName } : {}),
      updatedAt: now,
    }, { merge: true });
    transaction.update(invitationRef, { consumedAt: now, consumedBy: uid });
    transaction.delete(db.collection('recoveryAttempts').doc(uid));
    return targetParticipantId;
  });
  await recordAuditEvent(db, {
    action: 'accept_relationship_invitation',
    actorUid: uid,
    participantId,
  });
  return { participantId };
});

export const removeParticipantMembership = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const targetUid = requireDocumentId(request.data?.targetUid ?? uid, 'Member ID');
  const participantRef = db.collection('participants').doc(participantId);
  const actorRef = participantRef.collection('memberships').doc(uid);
  const targetRef = participantRef.collection('memberships').doc(targetUid);
  const targetIndexRef = db.collection('users').doc(targetUid).collection('participantRefs').doc(participantId);
  const targetSubscriptionRef = participantRef.collection('pushSubscriptions').doc(targetUid);

  const removedRole = await db.runTransaction(async (transaction) => {
    const [participant, actor, target, memberships] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(actorRef),
      transaction.get(targetRef),
      transaction.get(participantRef.collection('memberships')),
    ]);
    if (!participant.exists) throw new HttpsError('not-found', 'The participant could not be found.');
    if (!actor.exists || actor.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'An active relationship is required.');
    }
    if (!target.exists) throw new HttpsError('not-found', 'The relationship could not be found.');
    if (target.data()?.status === 'suspended') return String(target.data()?.role ?? '');
    const activeOwnerCount = memberships.docs.filter((membership) => (
      membership.data().role === 'owner' && membership.data().status === 'active'
    )).length;
    const allowed = targetUid === uid
      ? canLeaveMembership(target.data(), activeOwnerCount)
      : canRemoveMembership({ actor: actor.data(), target: target.data(), activeOwnerCount });
    if (!allowed) {
      throw new HttpsError('failed-precondition', target.data()?.role === 'owner' && activeOwnerCount <= 1
        ? 'The last owner cannot be removed.'
        : 'This account cannot remove the relationship.');
    }
    const now = new Date().toISOString();
    transaction.set(targetRef, { status: 'suspended', updatedAt: now, suspendedBy: uid }, { merge: true });
    transaction.set(targetIndexRef, { status: 'suspended', updatedAt: now }, { merge: true });
    transaction.delete(targetSubscriptionRef);
    if (participant.data()?.userId === targetUid) {
      transaction.update(participantRef, { userId: FieldValue.delete(), updatedAt: now });
    }
    return String(target.data()?.role ?? '');
  });
  await recordAuditEvent(db, {
    action: 'remove_participant_membership',
    actorUid: uid,
    participantId,
    metadata: { targetUid, removedRole, selfRemoval: targetUid === uid },
  });
  return { participantId, targetUid };
});

export const deleteParticipantProfile = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const participantRef = db.collection('participants').doc(participantId);
  const [participant, actor, memberships, invitations, recoveryCodes] = await Promise.all([
    participantRef.get(),
    participantRef.collection('memberships').doc(uid).get(),
    participantRef.collection('memberships').get(),
    db.collection('relationshipInvitations').where('participantId', '==', participantId).get(),
    db.collection('relationshipRecoveryCodes').where('participantId', '==', participantId).get(),
  ]);
  if (!participant.exists) throw new HttpsError('not-found', 'The followed profile could not be found.');
  if (actor.data()?.status !== 'active' || actor.data()?.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Only a primary owner can delete this followed profile.');
  }

  const batch = db.batch();
  memberships.docs.forEach((membership) => {
    batch.delete(db.collection('users').doc(membership.id).collection('participantRefs').doc(participantId));
  });
  invitations.docs.forEach((invitation) => batch.delete(invitation.ref));
  recoveryCodes.docs.forEach((recoveryCode) => batch.delete(recoveryCode.ref));
  const sourceFamilyId = participant.data()?.sourceFamilyId;
  if (typeof sourceFamilyId === 'string' && sourceFamilyId) {
    memberships.docs.forEach((membership) => {
      batch.set(db.collection('users').doc(membership.id), {
        familyId: FieldValue.delete(),
        role: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });
  }
  await batch.commit();
  await db.recursiveDelete(participantRef);
  await bucket.deleteFiles({ prefix: `participants/${participantId}/` }).catch((error) => {
    console.warn('Unable to delete participant storage files', { participantId, error });
  });
  if (typeof sourceFamilyId === 'string' && sourceFamilyId) {
    await db.recursiveDelete(db.collection('families').doc(sourceFamilyId));
  }
  await recordAuditEvent(db, {
    action: 'delete_participant_profile',
    actorUid: uid,
    participantId,
    metadata: { memberCount: memberships.size },
  });
  return { participantId };
});

export const createRelationshipRecovery = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const membershipRef = db.collection('participants').doc(participantId).collection('memberships').doc(uid);
  const code = createRecoveryCode();
  const codeHash = hashLinkCode(code);
  const recoveryRef = db.collection('relationshipRecoveryCodes').doc(codeHash);
  const expiresAt = new Date(Date.now() + recoveryLifetimeMs);

  await db.runTransaction(async (transaction) => {
    const membership = await transaction.get(membershipRef);
    if (!membership.exists || membership.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'An active relationship is required.');
    }
    const previousHash = String(membership.data()?.recoveryCodeHash ?? '');
    transaction.create(recoveryRef, {
      participantId,
      membershipUid: uid,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      consumedAt: null,
    });
    transaction.set(membershipRef, { recoveryCodeHash: codeHash, updatedAt: new Date().toISOString() }, { merge: true });
    if (previousHash && previousHash !== codeHash) {
      transaction.delete(db.collection('relationshipRecoveryCodes').doc(previousHash));
    }
  });
  await recordAuditEvent(db, {
    action: 'create_relationship_recovery',
    actorUid: uid,
    participantId,
  });
  return { recoveryCode: code, expiresAt: expiresAt.toISOString() };
});

export const recoverRelationship = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const code = normalizeLinkCode(String(request.data?.code ?? ''));
  if (!isRecoveryCode(code)) throw new HttpsError('invalid-argument', 'The recovery code is invalid.');
  await recordSensitiveCodeAttempt(uid);
  const recoveryRef = db.collection('relationshipRecoveryCodes').doc(hashLinkCode(code));
  const nextCode = createRecoveryCode();
  const nextCodeHash = hashLinkCode(nextCode);
  const nextExpiresAt = new Date(Date.now() + recoveryLifetimeMs);
  const nextRecoveryRef = db.collection('relationshipRecoveryCodes').doc(nextCodeHash);

  const recoveryResult = await db.runTransaction(async (transaction) => {
    const recovery = await transaction.get(recoveryRef);
    if (!recovery.exists) throw new HttpsError('not-found', 'The recovery code is invalid.');
    const recoveryData = recovery.data() ?? {};
    const targetParticipantId = String(recoveryData.participantId ?? '');
    const previousUid = String(recoveryData.membershipUid ?? '');
    if (recoveryData.consumedAt) {
      if (recoveryData.consumedBy === uid) return { participantId: targetParticipantId, replayed: true };
      throw new HttpsError('failed-precondition', 'The recovery code has already been used.');
    }
    if (!targetParticipantId || !previousUid || Date.parse(String(recoveryData.expiresAt ?? '')) <= Date.now()) {
      throw new HttpsError('failed-precondition', 'The recovery code has expired or is invalid.');
    }
    const participantRef = db.collection('participants').doc(targetParticipantId);
    const previousMembershipRef = participantRef.collection('memberships').doc(previousUid);
    const nextMembershipRef = participantRef.collection('memberships').doc(uid);
    const nextIndexRef = db.collection('users').doc(uid).collection('participantRefs').doc(targetParticipantId);
    const previousIndexRef = db.collection('users').doc(previousUid).collection('participantRefs').doc(targetParticipantId);
    const userRef = db.collection('users').doc(uid);
    const [participant, previousMembership, nextMembership, user] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(previousMembershipRef),
      transaction.get(nextMembershipRef),
      transaction.get(userRef),
    ]);
    if (!participant.exists || !previousMembership.exists || previousMembership.data()?.status !== 'active') {
      throw new HttpsError('failed-precondition', 'The relationship can no longer be recovered.');
    }
    if (previousUid !== uid && nextMembership.exists && nextMembership.data()?.status === 'active') {
      throw new HttpsError('already-exists', 'This account already has an active relationship.');
    }
    const now = new Date().toISOString();
    const previousData = previousMembership.data()!;
    const existingAccountName = typeof user.data()?.displayName === 'string' ? user.data()!.displayName.trim() : '';
    const accountDisplayName = existingAccountName || (previousData.role === 'participant'
      ? String(participant.data()?.displayName ?? '').trim()
      : '');
    const nextMembershipData = { ...previousData };
    delete nextMembershipData.displayName;
    transaction.set(nextMembershipRef, {
      ...nextMembershipData,
      uid,
      ...(accountDisplayName ? { displayName: accountDisplayName } : {}),
      status: 'active',
      recoveryCodeHash: nextCodeHash,
      recoveredFrom: previousUid,
      updatedAt: now,
    });
    transaction.set(nextIndexRef, {
      participantId: targetParticipantId,
      role: previousData.role,
      status: 'active',
      updatedAt: now,
    });
    transaction.set(userRef, {
      relationshipModelVersion: 2,
      ...(accountDisplayName ? { displayName: accountDisplayName } : {}),
      updatedAt: now,
    }, { merge: true });
    if (previousUid !== uid) {
      transaction.set(previousMembershipRef, {
        status: 'suspended',
        recoveryCodeHash: FieldValue.delete(),
        transferredTo: uid,
        updatedAt: now,
      }, { merge: true });
      transaction.set(previousIndexRef, { status: 'suspended', updatedAt: now }, { merge: true });
      transaction.delete(participantRef.collection('pushSubscriptions').doc(previousUid));
      if (participant.data()?.userId === previousUid) transaction.update(participantRef, { userId: uid, updatedAt: now });
    }
    transaction.create(nextRecoveryRef, {
      participantId: targetParticipantId,
      membershipUid: uid,
      expiresAt: nextExpiresAt.toISOString(),
      createdAt: now,
      consumedAt: null,
    });
    transaction.update(recoveryRef, { consumedAt: now, consumedBy: uid, rotatedTo: nextCodeHash });
    transaction.delete(db.collection('recoveryAttempts').doc(uid));
    return { participantId: targetParticipantId, replayed: false };
  });
  const { participantId } = recoveryResult;
  await recordAuditEvent(db, {
    action: 'recover_relationship',
    actorUid: uid,
    participantId,
  });
  return recoveryResult.replayed
    ? { participantId }
    : { participantId, recoveryCode: nextCode, expiresAt: nextExpiresAt.toISOString() };
});

export const createFamily = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  let childName: string;
  try { childName = assertChildName(request.data?.childName); }
  catch { throw new HttpsError('invalid-argument', 'A valid child name is required.'); }

  const familyRef = db.collection('families').doc();
  const userRef = db.collection('users').doc(uid);
  const code = createLinkCode();
  const linkRef = db.collection('linkCodes').doc(hashLinkCode(code));
  const recoveryCode = createRecoveryCode();
  const now = new Date();
  const recoveryExpiresAt = new Date(now.getTime() + recoveryLifetimeMs);
  const recoveryRef = db.collection('parentRecoveryCodes').doc(hashLinkCode(recoveryCode));
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(userRef);
    if (existing.exists) throw new HttpsError('already-exists', 'This account already belongs to a family.');
    transaction.create(familyRef, {
      childName,
      members: { [uid]: 'parent' },
      routineMigrationVersion: 1,
      createdAt: now.toISOString(),
    });
    transaction.create(familyRef.collection('routineAssignments').doc(DEFAULT_ROUTINE_ID), createDefaultRoutineAssignment(defaultPlan, now.toISOString()));
    transaction.create(userRef, {
      familyId: familyRef.id,
      role: 'parent',
      linkingCode: code,
      linkingCodeExpiresAt: expiresAt.toISOString(),
      parentRecoveryCode: recoveryCode,
      parentRecoveryCodeExpiresAt: recoveryExpiresAt.toISOString(),
      createdAt: now.toISOString(),
    });
    transaction.create(linkRef, {
      familyId: familyRef.id,
      createdBy: uid,
      expiresAt: expiresAt.toISOString(),
      consumedAt: null,
    });
    transaction.create(recoveryRef, createRecoveryRecord(familyRef.id, recoveryExpiresAt));
  });
  await recordAuditEvent(db, {
    action: 'create_family',
    actorUid: uid,
    familyId: familyRef.id,
    role: 'parent',
    metadata: { defaultRoutineId: DEFAULT_ROUTINE_ID },
  });
  return { familyId: familyRef.id, code, recoveryCode, expiresAt: expiresAt.toISOString() };
});

export const migrateFamilyRoutines = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const familyRef = db.collection('families').doc(familyId);
  const [family, profile] = await Promise.all([
    familyRef.get(),
    db.collection('users').doc(uid).get(),
  ]);
  if (
    !family.exists
    || !profile.exists
    || profile.data()?.familyId !== familyId
    || !['parent', 'child'].includes(String(family.data()?.members?.[uid] ?? ''))
  ) {
    throw new HttpsError('permission-denied', 'Only a family member can migrate routines.');
  }
  await ensureFamilyRoutineMigration(familyRef);
});

export const migrateFamilyRelationships = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const familyRef = db.collection('families').doc(familyId);
  const profileRef = db.collection('users').doc(uid);

  await db.runTransaction(async (transaction) => {
    const [family, profile] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(profileRef),
    ]);
    if (
      !family.exists
      || !profile.exists
      || profile.data()?.familyId !== familyId
      || family.data()?.members?.[uid] !== 'parent'
    ) {
      throw new HttpsError('permission-denied', 'Only a linked parent can migrate family relationships.');
    }
    const now = new Date().toISOString();
    let migration;
    try { migration = migrateLegacyFamilyRelationships(familyId, family.data() ?? {}, now); }
    catch { throw new HttpsError('failed-precondition', 'The legacy family cannot be migrated safely.'); }
    const participantRef = db.collection('participants').doc(migration.participantId);
    const membershipRefs = migration.memberships.map(({ uid: memberUid }) => participantRef.collection('memberships').doc(memberUid));
    const participantIndexRefs = migration.participantRefs.map(({ uid: memberUid }) => (
      db.collection('users').doc(memberUid).collection('participantRefs').doc(migration.participantId)
    ));
    const targetSnapshots = await transaction.getAll(participantRef, ...membershipRefs, ...participantIndexRefs);
    const participantSnapshot = targetSnapshots[0];
    const membershipSnapshots = targetSnapshots.slice(1, 1 + membershipRefs.length);
    const participantIndexSnapshots = targetSnapshots.slice(1 + membershipRefs.length);
    if (!isCompatibleParticipantMigration(participantSnapshot.data(), migration.participant)) {
      throw new HttpsError('already-exists', 'The target participant contains conflicting data.');
    }
    migration.memberships.forEach((membership, index) => {
      if (!isCompatibleMembershipMigration(membershipSnapshots[index]?.data(), membership)) {
        throw new HttpsError('already-exists', `The membership for ${membership.uid} contains conflicting data.`);
      }
    });
    migration.participantRefs.forEach((participantIndex, index) => {
      if (!isCompatibleParticipantRefMigration(participantIndexSnapshots[index]?.data(), participantIndex)) {
        throw new HttpsError('already-exists', `The participant index for ${participantIndex.uid} contains conflicting data.`);
      }
    });
    if (!participantSnapshot.exists) transaction.create(participantRef, migration.participant);
    migration.memberships.forEach((membership, index) => {
      if (!membershipSnapshots[index]?.exists) transaction.create(membershipRefs[index], membership);
    });
    migration.participantRefs.forEach((participantIndex, index) => {
      if (!participantIndexSnapshots[index]?.exists) transaction.create(participantIndexRefs[index], {
        participantId: participantIndex.participantId,
        role: participantIndex.role,
        status: participantIndex.status,
        updatedAt: participantIndex.updatedAt,
      });
    });
    transaction.set(familyRef, { relationshipMigrationVersion: 2, relationshipMigratedAt: now }, { merge: true });
  });
  await recordAuditEvent(db, {
    action: 'migrate_family_relationships',
    actorUid: uid,
    familyId,
    participantId: familyId,
  });
  return { participantId: familyId };
});

export const migrateFamilyContent = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const familyRef = db.collection('families').doc(familyId);
  const participantRef = db.collection('participants').doc(familyId);
  const [family, participant, profile] = await Promise.all([
    familyRef.get(),
    participantRef.get(),
    db.collection('users').doc(uid).get(),
  ]);
  if (
    !family.exists
    || !participant.exists
    || !profile.exists
    || profile.data()?.familyId !== familyId
    || family.data()?.members?.[uid] !== 'parent'
    || participant.data()?.sourceFamilyId !== familyId
  ) {
    throw new HttpsError('permission-denied', 'Only a linked owner can migrate family content.');
  }
  const [routineAssignments, checks, pushSubscriptions] = await Promise.all([
    copyLegacyParticipantSubcollection(
      familyId,
      familyRef.collection('routineAssignments'),
      participantRef.collection('routineAssignments'),
    ),
    copyLegacyParticipantSubcollection(
      familyId,
      familyRef.collection('checks'),
      participantRef.collection('checks'),
    ),
    copyLegacyParticipantSubcollection(
      familyId,
      familyRef.collection('pushSubscriptions'),
      participantRef.collection('pushSubscriptions'),
    ),
  ]);
  const migratedAt = new Date().toISOString();
  await Promise.all([
    familyRef.set({ relationshipContentMigrationVersion: 1, relationshipContentMigratedAt: migratedAt }, { merge: true }),
    participantRef.set({ contentMigrationVersion: 1, contentMigratedAt: migratedAt }, { merge: true }),
  ]);
  await recordAuditEvent(db, {
    action: 'migrate_family_content',
    actorUid: uid,
    familyId,
    participantId: familyId,
    metadata: { routineAssignments, checks, pushSubscriptions },
  });
  return { participantId: familyId, routineAssignments, checks, pushSubscriptions };
});

export const recoverParent = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const code = normalizeLinkCode(String(request.data?.code ?? ''));
  if (!isRecoveryCode(code) && !isLegacyRecoveryCode(code)) throw new HttpsError('invalid-argument', 'The recovery code is invalid.');
  await recordSensitiveCodeAttempt(uid);
  const userRef = db.collection('users').doc(uid);
  const recoveryRef = isRecoveryCode(code)
    ? db.collection('parentRecoveryCodes').doc(hashLinkCode(code))
    : undefined;
  const recovery = recoveryRef ? await recoveryRef.get() : undefined;
  const legacyFamilies = recoveryRef
    ? undefined
    : await db.collection('families').where('parentRecoveryCode', '==', code).limit(1).get();
  const familyId = recovery?.exists ? String(recovery.data()?.familyId ?? '') : legacyFamilies?.docs[0]?.id;
  const familyDoc = familyId ? await db.collection('families').doc(familyId).get() : undefined;
  if (!familyDoc?.exists) throw new HttpsError('not-found', 'The recovery code is invalid.');
  if (recovery && (!recovery.exists || Date.parse(String(recovery.data()?.expiresAt ?? '')) <= Date.now())) {
    throw new HttpsError('failed-precondition', 'The recovery code has expired.');
  }

  const familyRef = familyDoc.ref;
  const nextCode = createRecoveryCode();
  const nextExpiresAt = new Date(Date.now() + recoveryLifetimeMs);
  const nextRecoveryRef = db.collection('parentRecoveryCodes').doc(hashLinkCode(nextCode));
  await db.runTransaction(async (transaction) => {
    const [existingUser, family] = await Promise.all([transaction.get(userRef), transaction.get(familyRef)]);
    if (existingUser.exists && existingUser.data()?.familyId !== familyRef.id) {
      throw new HttpsError('already-exists', 'This account already belongs to a family.');
    }
    if (existingUser.exists && existingUser.data()?.role !== 'parent') {
      throw new HttpsError('already-exists', 'This device already uses the child profile.');
    }
    if (!family.exists) throw new HttpsError('not-found', 'The family could not be found.');
    const previousParentIds = Object.entries((family.data()?.members ?? {}) as Record<string, string>)
      .filter(([memberId, role]) => role === 'parent' && memberId !== uid)
      .map(([memberId]) => memberId);
    const familyUpdate: Record<string, unknown> = {
      [`members.${uid}`]: 'parent',
      parentRecoveryCode: FieldValue.delete(),
      parentRecoveryCodeExpiresAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    previousParentIds.forEach((memberId) => { familyUpdate[`members.${memberId}`] = FieldValue.delete(); });
    transaction.update(familyRef, familyUpdate);
    previousParentIds.forEach((memberId) => transaction.delete(db.collection('users').doc(memberId)));
    transaction.set(userRef, {
      familyId: familyRef.id,
      role: 'parent',
      parentRecoveryCode: nextCode,
      parentRecoveryCodeExpiresAt: nextExpiresAt.toISOString(),
      recoveredAt: new Date().toISOString(),
    });
    transaction.create(nextRecoveryRef, createRecoveryRecord(familyRef.id, nextExpiresAt));
    if (recoveryRef) transaction.delete(recoveryRef);
    transaction.delete(db.collection('recoveryAttempts').doc(uid));
  });
  await recordAuditEvent(db, {
    action: 'recover_parent',
    actorUid: uid,
    familyId: familyRef.id,
    role: 'parent',
  });
  return { familyId: familyRef.id, childName: String(familyDoc.data()?.childName ?? ''), recoveryCode: nextCode };
});

export const ensureParentRecoveryCode = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const familyRef = db.collection('families').doc(familyId);
  const profileRef = db.collection('users').doc(uid);
  const [family, profile] = await Promise.all([familyRef.get(), profileRef.get()]);
  if (
    !family.exists
    || !profile.exists
    || profile.data()?.familyId !== familyId
    || profile.data()?.role !== 'parent'
    || family.data()?.members?.[uid] !== 'parent'
  ) {
    throw new HttpsError('permission-denied', 'Only the parent can refresh the recovery code.');
  }
  const existingCode = String(profile.data()?.parentRecoveryCode ?? '');
  const existingExpiry = Date.parse(String(profile.data()?.parentRecoveryCodeExpiresAt ?? ''));
  const legacyFamilyCode = String(family.data()?.parentRecoveryCode ?? '');
  if (isRecoveryCode(existingCode) && existingExpiry > Date.now()) {
    if (legacyFamilyCode || family.data()?.parentRecoveryCodeExpiresAt) {
      const cleanup = db.batch();
      cleanup.update(familyRef, {
        parentRecoveryCode: FieldValue.delete(),
        parentRecoveryCodeExpiresAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (isRecoveryCode(legacyFamilyCode) && legacyFamilyCode !== existingCode) {
        cleanup.delete(db.collection('parentRecoveryCodes').doc(hashLinkCode(legacyFamilyCode)));
      }
      await cleanup.commit();
    }
    return { recoveryCode: existingCode };
  }

  const recoveryCode = createRecoveryCode();
  const expiresAt = new Date(Date.now() + recoveryLifetimeMs);
  const recoveryRef = db.collection('parentRecoveryCodes').doc(hashLinkCode(recoveryCode));
  await db.runTransaction(async (transaction) => {
    const [currentFamily, current] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(profileRef),
    ]);
    const currentCode = String(current.data()?.parentRecoveryCode ?? '');
    const currentExpiry = Date.parse(String(current.data()?.parentRecoveryCodeExpiresAt ?? ''));
    if (isRecoveryCode(currentCode) && currentExpiry > Date.now()) return;
    transaction.update(profileRef, {
      parentRecoveryCode: recoveryCode,
      parentRecoveryCodeExpiresAt: expiresAt.toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (currentFamily.data()?.parentRecoveryCode || currentFamily.data()?.parentRecoveryCodeExpiresAt) {
      transaction.update(familyRef, {
        parentRecoveryCode: FieldValue.delete(),
        parentRecoveryCodeExpiresAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.create(recoveryRef, createRecoveryRecord(familyId, expiresAt));
    if (isRecoveryCode(currentCode)) {
      transaction.delete(db.collection('parentRecoveryCodes').doc(hashLinkCode(currentCode)));
    }
    if (isRecoveryCode(legacyFamilyCode) && legacyFamilyCode !== currentCode) {
      transaction.delete(db.collection('parentRecoveryCodes').doc(hashLinkCode(legacyFamilyCode)));
    }
  });
  const refreshed = await profileRef.get();
  return { recoveryCode: String(refreshed.data()?.parentRecoveryCode ?? recoveryCode) };
});

export const joinFamily = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const code = normalizeLinkCode(String(request.data?.code ?? ''));
  if (!/^ZD-\d{6}$/.test(code)) throw new HttpsError('invalid-argument', 'The linking code is invalid.');
  const linkRef = db.collection('linkCodes').doc(hashLinkCode(code));
  const userRef = db.collection('users').doc(uid);

  const familyId = await db.runTransaction(async (transaction) => {
    const [link, existingUser] = await Promise.all([transaction.get(linkRef), transaction.get(userRef)]);
    if (!link.exists) throw new HttpsError('not-found', 'The linking code is invalid.');
    const data = link.data();
    if (!data) throw new HttpsError('not-found', 'The linking code is invalid.');
    if (data.consumedAt || Date.parse(data.expiresAt) <= Date.now()) {
      throw new HttpsError('failed-precondition', 'The linking code has expired or was already used.');
    }
    const targetFamilyId = String(data.familyId);
    const existingUserData = existingUser.data();
    const isSameParticipant = existingUser.exists
      && existingUserData?.familyId === targetFamilyId
      && existingUserData?.role === 'child';
    if (existingUser.exists && !isSameParticipant) {
      throw new HttpsError('already-exists', 'This account already belongs to a family.');
    }
    const familyRef = db.collection('families').doc(targetFamilyId);
    transaction.update(familyRef, { [`members.${uid}`]: 'child', updatedAt: FieldValue.serverTimestamp() });
    if (existingUser.exists) {
      transaction.set(userRef, {
        familyId: targetFamilyId,
        role: 'child',
        relinkedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      transaction.create(userRef, { familyId: targetFamilyId, role: 'child', createdAt: new Date().toISOString() });
    }
    transaction.update(linkRef, { consumedAt: new Date().toISOString(), consumedBy: uid });
    return targetFamilyId;
  });
  await recordAuditEvent(db, {
    action: 'join_family',
    actorUid: uid,
    familyId,
    role: 'child',
  });
  return { familyId };
});

export const savePushSubscription = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const subscription = normalizePushSubscription(request.data?.subscription);
  const locale = request.data?.locale === 'fr' ? 'fr' : 'en';
  const preferences = normalizePushPreferences(request.data?.preferences);
  if (!subscription) {
    throw new HttpsError('invalid-argument', 'A valid push subscription is required.');
  }

  const aggregateRef = await requireAggregatePermission(uid, familyId, 'view');
  const roles = await pushRolesForAggregate(uid, aggregateRef);
  const role = primaryPushRole(roles);
  const userRef = db.collection('users').doc(uid);
  const subscriptionRef = aggregateRef.collection('pushSubscriptions').doc(uid);
  const currentSubscription = await subscriptionRef.get();
  const currentReceiptToken = currentSubscription.data()?.receiptToken;
  const receiptToken = typeof currentReceiptToken === 'string' && currentReceiptToken.length >= 32
    ? currentReceiptToken
    : randomBytes(32).toString('base64url');
  const batch = db.batch();
  batch.set(subscriptionRef, {
    ...subscription,
    locale,
    role,
    roles,
    endpointPresent: true,
    receiptToken,
    receiptTokenHash: hashLinkCode(receiptToken),
    deliveryStatus: 'ready',
    recoveryRequired: false,
    lastSuccessfulSaveAt: FieldValue.serverTimestamp(),
    ...(preferences ? { preferences } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(userRef, { notificationsEnabled: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
});

export const updatePushSubscriptionSettings = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const aggregateId = requireDocumentId(request.data?.aggregateId, 'Profile ID');
  const locale = request.data?.locale === 'fr' ? 'fr' : request.data?.locale === 'en' ? 'en' : undefined;
  const preferences = normalizePushPreferences(request.data?.preferences);
  if (!locale || !preferences) throw new HttpsError('invalid-argument', 'Valid notification settings are required.');
  const aggregateRef = await requireAggregatePermission(uid, aggregateId, 'view');
  const subscriptionRef = aggregateRef.collection('pushSubscriptions').doc(uid);
  const subscription = await subscriptionRef.get();
  if (!subscription.exists) throw new HttpsError('failed-precondition', 'No push subscription is available for this device.');
  const roles = await pushRolesForAggregate(uid, aggregateRef);
  await subscriptionRef.update({
    locale,
    preferences,
    role: primaryPushRole(roles),
    roles,
    updatedAt: FieldValue.serverTimestamp(),
  });
});

export const sendTestPushNotification = onCall({
  region,
  cors,
  enforceAppCheck: true,
  secrets: [vapidPrivateKey, vapidPublicKey],
}, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const aggregateRef = await requireAggregatePermission(uid, familyId, 'view');
  const role = primaryPushRole(await pushRolesForAggregate(uid, aggregateRef));
  const subscriptionDocument = await aggregateRef.collection('pushSubscriptions').doc(uid).get();
  const subscription = subscriptionDocument.data() as (PushSubscription & { locale?: string }) | undefined;
  if (!subscription?.endpoint) {
    throw new HttpsError('failed-precondition', 'No push subscription is available for this device.');
  }
  const syntheticMonitor = await loadSyntheticMonitorTarget(aggregateRef);
  const receipt = syntheticReceiptPayload(syntheticMonitor, uid, crypto.randomUUID());
  const basePayload = buildTestNotificationPayload({ locale: subscription.locale, role });
  webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());
  const dispatch = await dispatchPushNotifications([subscriptionDocument], {
    familyId,
    notificationType: 'test',
  }, async (document) => {
    const expectedAt = new Date();
    const result = await sendPushPayload(document, receipt ? { ...basePayload, syntheticReceipt: receipt } : basePayload);
    if (result === 'success' && receipt && syntheticMonitor) {
      await markSyntheticPushExpected(syntheticMonitor, receipt.receiptId, expectedAt);
    }
    return result;
  });
  if (dispatch.success !== 1) {
    throw new HttpsError('unavailable', 'The test notification could not be delivered.');
  }
});

const pushReceiptOrigins = new Set([
  'https://zadiag.com',
  'https://www.zadiag.com',
  'https://zadiag.vercel.app',
]);

const applyPushReceiptCors = (
  request: { get: (name: string) => string | undefined },
  response: { set: (name: string, value: string) => unknown },
) => {
  const origin = request.get('origin');
  const allowedOrigin = origin && (
    pushReceiptOrigins.has(origin)
    || /^https:\/\/zadiag-[a-z0-9-]+\.vercel\.app$/.test(origin)
  ) ? origin : undefined;
  if (allowedOrigin) response.set('Access-Control-Allow-Origin', allowedOrigin);
  response.set('Vary', 'Origin');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.set('Cache-Control', 'no-store');
  return allowedOrigin;
};

export const recordPushReceipt = onRequest({ region }, async (request, response) => {
  const allowedOrigin = applyPushReceiptCors(request, response);
  if (request.method === 'OPTIONS') {
    response.status(allowedOrigin ? 204 : 403).send('');
    return;
  }
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const body = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {};
  const aggregate = body.aggregate === 'families' || body.aggregate === 'participants' ? body.aggregate : undefined;
  const stage = body.stage === 'received' || body.stage === 'opened' ? body.stage : undefined;
  const token = typeof body.token === 'string' ? body.token : '';
  if (!aggregate || !stage || !isFirestoreDocumentId(body.aggregateId) || !isFirestoreDocumentId(body.subscriptionId)
    || !isFirestoreDocumentId(body.receiptId) || token.length < 32 || token.length > 256) {
    response.status(400).json({ error: 'invalid_receipt' });
    return;
  }
  const subscriptionRef = db.collection(aggregate).doc(body.aggregateId).collection('pushSubscriptions').doc(body.subscriptionId);
  let accepted = false;
  try {
    await db.runTransaction(async (transaction) => {
      const subscription = await transaction.get(subscriptionRef);
      const data = subscription.data();
      if (!subscription.exists || data?.receiptTokenHash !== hashLinkCode(token)) {
        throw new HttpsError('permission-denied', 'Push receipt rejected.');
      }
      if (data.lastExpectedReceiptId !== body.receiptId) return;
      accepted = true;
      const now = FieldValue.serverTimestamp();
      transaction.set(subscriptionRef, {
        deliveryStatus: stage,
        recoveryRequired: false,
        lastReceivedReceiptId: body.receiptId,
        lastPushReceivedAt: now,
        ...(stage === 'opened' ? { lastPushOpenedAt: now } : {}),
        recoveryExpectedReceiptId: FieldValue.delete(),
        updatedAt: now,
      }, { merge: true });
    });
  } catch (error) {
    if (error instanceof HttpsError && error.code === 'permission-denied') {
      response.status(403).json({ error: 'receipt_rejected' });
      return;
    }
    reportOperationalAlert({
      kind: 'push_send_failed',
      familyId: String(body.aggregateId ?? ''),
      actorUid: String(body.subscriptionId ?? ''),
      details: { phase: 'push_receipt_write' },
      error,
    });
    response.status(500).json({ error: 'receipt_unavailable' });
    return;
  }
  if (accepted) reportOperationalRecovery('push_delivery_unconfirmed');
  response.status(accepted ? 204 : 202).send('');
});

export const recordSyntheticPushReceipt = onRequest({ region }, async (request, response) => {
  const allowedOrigin = applyPushReceiptCors(request, response);
  if (request.method === 'OPTIONS') {
    response.status(allowedOrigin ? 204 : 403).send('');
    return;
  }
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const body = request.body && typeof request.body === 'object'
    ? request.body as Record<string, unknown>
    : {};
  if (!isFirestoreDocumentId(body.monitorId) || !isFirestoreDocumentId(body.receiptId)) {
    response.status(400).json({ error: 'invalid_receipt' });
    return;
  }
  const monitorId = body.monitorId;
  const receiptId = body.receiptId;
  const token = typeof body.token === 'string' ? body.token : '';
  const stage = body.stage === 'received' || body.stage === 'opened' || body.stage === 'heartbeat'
    ? body.stage
    : undefined;
  if (!stage || token.length < 32 || token.length > 256) {
    response.status(400).json({ error: 'invalid_receipt' });
    return;
  }
  const monitorRef = db.collection('syntheticMonitors').doc(monitorId);
  const receiptRef = monitorRef.collection('receipts').doc(`${receiptId}_${stage}`);
  let participantId = '';
  let renewPushSubscription = false;
  try {
    await db.runTransaction(async (transaction) => {
      const monitor = await transaction.get(monitorRef);
      const data = monitor.data();
      participantId = typeof data?.participantId === 'string' ? data.participantId : '';
      if (!monitor.exists || data?.enabled !== true || data.receiptTokenHash !== hashLinkCode(token)) {
        throw new HttpsError('permission-denied', 'Synthetic monitor receipt rejected.');
      }
      const timestampMillis = (value: unknown) => (
        value && typeof (value as { toMillis?: unknown }).toMillis === 'function'
          ? (value as { toMillis: () => number }).toMillis()
          : undefined
      );
      renewPushSubscription = stage === 'heartbeat' && shouldRecoverSyntheticPush({
        expectedAtMs: timestampMillis(data.lastPushExpectedAt),
        receivedAtMs: timestampMillis(data.lastPushReceivedAt),
        recoveryRequestedAtMs: timestampMillis(data.lastRecoveryRequestedAt),
      }, Date.now());
      const now = FieldValue.serverTimestamp();
      transaction.set(receiptRef, {
        stage,
        receiptId,
        participantId,
        ...(typeof body.kind === 'string' ? { kind: body.kind.slice(0, 64) } : {}),
        ...(isFirestoreDocumentId(body.checkId) ? { checkId: body.checkId } : {}),
        ...(typeof body.sessionId === 'string' ? { sessionId: body.sessionId.slice(0, 128) } : {}),
        ...(isFirestoreDocumentId(body.routineId) ? { routineId: body.routineId } : {}),
        receivedAt: now,
      }, { merge: true });
      transaction.set(monitorRef, {
        lastSeenAt: now,
        lastStage: stage,
        ...(stage === 'received' ? { lastPushReceivedAt: now } : {}),
        ...(stage === 'opened' ? { lastPushOpenedAt: now } : {}),
        ...(stage === 'heartbeat' ? { lastHeartbeatAt: now } : {}),
        ...(renewPushSubscription ? { lastRecoveryRequestedAt: now } : {}),
        updatedAt: now,
      }, { merge: true });
    });
  } catch (error) {
    if (error instanceof HttpsError && error.code === 'permission-denied') {
      response.status(403).json({ error: 'receipt_rejected' });
      return;
    }
    reportOperationalAlert({
      kind: 'scheduler_dispatch_failed',
      actorUid: monitorId,
      details: { phase: 'synthetic_receipt_write' },
      error,
    });
    response.status(500).json({ error: 'receipt_unavailable' });
    return;
  }
  reportOperationalEvent({
    kind: 'synthetic_push_receipt',
    familyId: participantId,
    actorUid: monitorId,
    ...(isFirestoreDocumentId(body.checkId) ? { checkId: body.checkId } : {}),
    ...(isFirestoreDocumentId(body.routineId) ? { routineId: body.routineId } : {}),
    details: {
      stage,
      ...(typeof body.kind === 'string' ? { notificationType: body.kind.slice(0, 64) } : {}),
    },
  });
  if (stage === 'received' || stage === 'opened') reportOperationalRecovery('push_delivery_unconfirmed');
  if (renewPushSubscription) {
    reportOperationalAlert({
      kind: 'push_delivery_unconfirmed',
      familyId: participantId,
      actorUid: monitorId,
      details: { recovery: 'renew_subscription' },
    });
    response.status(200).json({ renewPushSubscription: true });
    return;
  }
  response.status(204).send('');
});

export const regenerateLinkCode = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const userRef = db.collection('users').doc(uid);
  const familyRef = db.collection('families').doc(familyId);
  const [profile, family, links] = await Promise.all([
    userRef.get(),
    familyRef.get(),
    db.collection('linkCodes').where('familyId', '==', familyId).get(),
  ]);

  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Only the parent can generate a new linking code.');
  }
  if (!family.exists || family.data()?.members?.[uid] !== 'parent') {
    throw new HttpsError('not-found', 'The family could not be found.');
  }

  const childIds = Object.entries((family.data()?.members ?? {}) as Record<string, string>)
    .filter(([, role]) => role === 'child')
    .map(([memberId]) => memberId);
  const code = createLinkCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const linkRef = db.collection('linkCodes').doc(hashLinkCode(code));
  const familyUpdate: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  childIds.forEach((childId) => { familyUpdate[`members.${childId}`] = FieldValue.delete(); });

  const batch = db.batch();
  links.docs.forEach((link) => batch.delete(link.ref));
  childIds.forEach((childId) => batch.delete(db.collection('users').doc(childId)));
  childIds.forEach((childId) => batch.delete(familyRef.collection('pushSubscriptions').doc(childId)));
  batch.update(familyRef, familyUpdate);
  batch.update(userRef, {
    linkingCode: code,
    linkingCodeExpiresAt: expiresAt.toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.create(linkRef, {
    familyId,
    createdBy: uid,
    expiresAt: expiresAt.toISOString(),
    consumedAt: null,
  });
  await batch.commit();

  await recordAuditEvent(db, {
    action: 'regenerate_link_code',
    actorUid: uid,
    familyId,
    role: 'parent',
    metadata: { detachedChildCount: childIds.length },
  });
  return { code, expiresAt: expiresAt.toISOString() };
});

export const requestCheckNow = onCall({
  region,
  cors,
  enforceAppCheck: true,
  secrets: [vapidPrivateKey, vapidPublicKey],
}, async (request) => {
  type RequestedCheck = {
    id: string;
    routineId: string;
    sessionId: string;
    requestedAt: string;
    expiresAt: string;
    status: string;
    requestedBy?: string;
    challenge?: { response?: { kind?: string }; quiz?: { questions?: unknown[] } };
  };
  type RequestCheckResult = { check: RequestedCheck; resend: boolean };
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const routineId = requireDocumentId(request.data?.routineId ?? DEFAULT_ROUTINE_ID, 'Routine ID');
  const familyRef = await requireAggregatePermission(uid, familyId, 'requestChecks');
  const actorName = await responsibleActorName(uid);
  await ensureFamilyRoutineMigration(familyRef);
  const assignmentRef = familyRef.collection('routineAssignments').doc(routineId);
  const checkRef = familyRef.collection('checks').doc();
  const pendingChecks = familyRef.collection('checks')
    .where('routineId', '==', routineId)
    .where('status', '==', 'pending')
    .limit(10);

  let { check, resend } = await db.runTransaction(async (transaction): Promise<RequestCheckResult> => {
    const [family, assignment, pending] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(assignmentRef),
      transaction.get(pendingChecks),
    ]);
    if (!family.exists) throw new HttpsError('not-found', 'The followed person could not be found.');
    if (!assignment.exists || assignment.data()?.status !== 'active') {
      throw new HttpsError('failed-precondition', 'The routine is not active.');
    }

    const now = new Date();
    if (isCheckRequestRateLimited(assignment.data()?.lastCheckRequestAt, now.getTime())) {
      throw new HttpsError('resource-exhausted', 'Please wait before requesting another check.');
    }
    const parsedPlan = monitoringPlanSchema.safeParse(assignment.data()?.plan);
    const plan = parsedPlan.success ? parsedPlan.data : defaultPlan;
    const activePendingCheck = pending.docs.find((doc) => Date.parse(String(doc.data().expiresAt)) > now.getTime());
    const lockUpdate = { lastCheckRequestAt: now.toISOString() };
    if (activePendingCheck) {
      const currentCheck = { id: activePendingCheck.id, ...activePendingCheck.data() } as RequestedCheck;
      const renewedExpiresAt = checkExpiresAt(plan, now);
      const responsibleActions = [
        ...(Array.isArray(activePendingCheck.data().responsibleActions) ? activePendingCheck.data().responsibleActions : []),
        { type: 'reminded', at: now.toISOString(), actorUid: uid, actorName },
      ].slice(-20);
      if (renewedExpiresAt.getTime() > Date.parse(currentCheck.expiresAt)) {
        const expiresAt = renewedExpiresAt.toISOString();
        transaction.update(assignmentRef, lockUpdate);
        transaction.update(activePendingCheck.ref, { expiresAt, responsibleActions });
        return { check: { ...currentCheck, expiresAt }, resend: true };
      }
      transaction.update(assignmentRef, lockUpdate);
      transaction.update(activePendingCheck.ref, { responsibleActions });
      return { check: currentCheck, resend: true };
    }

    const expiresAt = checkExpiresAt(plan, now);
    const check = {
      routineId,
      ...routineAssignmentProvenance(assignment.data() as RoutineAssignmentDocument),
      challenge: challengeForAssignment(assignment.data() as RoutineAssignmentDocument),
      sessionId: crypto.randomUUID(),
      requestedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
      requestedBy: uid,
      responsibleActions: [{ type: 'requested', at: now.toISOString(), actorUid: uid, actorName }],
    };

    transaction.update(assignmentRef, lockUpdate);
    transaction.create(checkRef, check);
    return { check: { id: checkRef.id, ...check }, resend: false };
  });

  if (check.challenge?.response?.kind === 'quiz' && !check.challenge.quiz?.questions?.length) {
    try {
      check = await prepareQuizForCheck(familyRef, check.id, request.data?.locale === 'fr' ? 'fr' : 'en') as RequestedCheck;
    } catch {
      reportOperationalAlert({ kind: 'analysis_failed', familyId, checkId: check.id, routineId, actorUid: uid, details: { capability: 'dynamicQuizGeneration', phase: 'request_check' } });
    }
  }

  const assignment = await assignmentRef.get();
  const routineNames = getRoutineNotificationNames(assignment.data(), routineId);
  await sendCheckPushNotifications(familyRef, { ...check, checkId: check.id, ...routineNames }, resend);
  await recordAuditEvent(db, {
    action: 'request_check',
    actorUid: uid,
    familyId,
    role: 'parent',
    metadata: {
      checkId: check.id,
      routineId,
      resend,
    },
  });
  return check;
});

export const createRoutineDraft = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const draftRef = participantRef.collection('routineDrafts').doc();
  let document: RoutineDraftDocument;
  try {
    document = createRoutineDraftDocument(uid, request.data?.package);
  } catch (error) {
    return routineDraftInputError(error);
  }
  await db.runTransaction(async (transaction) => {
    await requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid);
    transaction.create(draftRef, document);
  });
  await recordAuditEvent(db, {
    action: 'create_routine_draft', actorUid: uid, participantId, metadata: { draftId: draftRef.id, revision: document.revision },
  });
  return { id: draftRef.id, ...document };
});

export const forkRoutineAssignmentDraft = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const routineId = requireDocumentId(request.data?.routineId, 'Routine ID');
  const preferredLocale = request.data?.locale === 'fr' ? 'fr' : 'en';
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const assignmentRef = participantRef.collection('routineAssignments').doc(routineId);
  const ownedDraftsQuery = participantRef.collection('routineDrafts').where('ownerId', '==', uid);
  const sessionRef = participantRef.collection('routineDraftSessions').doc(routineDraftSessionId(uid, routineId));
  let result: IdentifiedRoutineDraft | undefined;
  let reused = false;
  await db.runTransaction(async (transaction) => {
    const [, assignment, ownedDrafts] = await Promise.all([
      requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid),
      transaction.get(assignmentRef),
      transaction.get(ownedDraftsQuery),
      transaction.get(sessionRef),
    ]);
    if (!assignment.exists) throw new HttpsError('not-found', 'The routine assignment could not be found.');
    const assignmentData = assignment.data() as RoutineAssignmentDocument;
    if (!assignmentData.routine) throw new HttpsError('failed-precondition', 'The assigned routine content is unavailable.');
    const existing = selectReusableAssignmentDraft(
      ownedDrafts.docs.map((draft) => ({ id: draft.id, ...draft.data() } as IdentifiedRoutineDraft)),
      uid,
      routineId,
      assignmentData.sourceVersion,
    );
    if (existing) {
      result = existing;
      reused = true;
    } else {
      const draftRef = participantRef.collection('routineDrafts').doc();
      try {
        const routinePackage = createAssignmentForkPackage(assignmentData.routine, assignmentData.sourceVersion, preferredLocale);
        const document: RoutineDraftDocument = {
          ...createRoutineDraftDocument(uid, routinePackage),
          forkedFrom: { routineId, ...(assignmentData.sourceVersion ? { sourceVersion: assignmentData.sourceVersion } : {}), origin: assignmentData.sourceCatalogEntryId ? 'community' : assignmentData.sourceDraftId ? 'private' : 'builtin' },
        };
        result = { id: draftRef.id, ...document };
        transaction.create(draftRef, document);
      } catch (error) {
        return routineDraftInputError(error);
      }
    }
    if (!result) throw new HttpsError('internal', 'The routine draft could not be prepared.');
    transaction.set(sessionRef, {
      ownerId: uid,
      routineId,
      sourceVersion: assignmentData.sourceVersion ?? 0,
      draftId: result.id,
      updatedAt: new Date().toISOString(),
    });
  });
  if (!result) throw new HttpsError('internal', 'The routine draft could not be prepared.');
  await recordAuditEvent(db, {
    action: reused ? 'resume_routine_assignment_draft' : 'fork_routine_assignment_draft',
    actorUid: uid,
    participantId,
    metadata: { draftId: result.id, routineId, sourceVersion: result.forkedFrom?.sourceVersion },
  });
  return result;
});

export const exportRoutinePackage = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const draftId = requireDocumentId(request.data?.draftId, 'Draft ID');
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const draft = await participantRef.collection('routineDrafts').doc(draftId).get();
  if (!draft.exists || draft.data()?.ownerId !== uid) throw new HttpsError('not-found', 'The routine draft could not be found.');
  const data = draft.data() as RoutineDraftDocument;
  await recordAuditEvent(db, { action: 'export_routine_package', actorUid: uid, participantId, metadata: { draftId, revision: data.revision } });
  return { content: serializeRoutinePackage(draftId, data.revision, data.updatedAt, data.package), mimeType: ROUTINE_PACKAGE_MIME, fileName: `${data.package.routine.id}-v${data.package.version}.zadiag-routine` };
});

export const importRoutinePackage = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const conflict = request.data?.conflict === 'copy' ? 'copy' : 'reject';
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  let envelope;
  try { envelope = parseRoutinePackageEnvelope(request.data?.content, request.data?.mimeType); } catch (error) { return routineDraftInputError(error); }
  const importedPackage = structuredClone(envelope.package);
  if (conflict === 'copy') importedPackage.routine.id = `private-${randomBytes(12).toString('hex')}`;
  const draftRef = participantRef.collection('routineDrafts').doc();
  const document = createRoutineDraftDocument(uid, importedPackage);
  await db.runTransaction(async (transaction) => {
    await requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid);
    const conflicts = await transaction.get(participantRef.collection('routineDrafts').where('package.routine.id', '==', importedPackage.routine.id).limit(1));
    if (!conflicts.empty) throw new HttpsError('already-exists', 'A routine with this ID already exists. Import it explicitly as a copy.');
    transaction.create(draftRef, { ...document, importProvenance: envelope.provenance });
  });
  await recordAuditEvent(db, { action: 'import_routine_package', actorUid: uid, participantId, metadata: { draftId: draftRef.id, sourceDraftId: envelope.provenance.sourceDraftId, conflict } });
  return { id: draftRef.id, ...document };
});

export const listRoutineDrafts = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const drafts = await participantRef.collection('routineDrafts').where('ownerId', '==', uid).get();
  return {
    drafts: drafts.docs
      .map((document) => ({ id: document.id, ...document.data() } as { id: string } & RoutineDraftDocument))
      .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt))),
  };
});

export const updateRoutineDraft = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const draftId = requireDocumentId(request.data?.draftId, 'Draft ID');
  const expectedRevision = requireDraftRevision(request.data?.expectedRevision);
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const draftRef = participantRef.collection('routineDrafts').doc(draftId);
  let updated: RoutineDraftDocument | undefined;
  try {
    await db.runTransaction(async (transaction) => {
      const [, draft] = await Promise.all([
        requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid),
        transaction.get(draftRef),
      ]);
      if (!draft.exists || draft.data()?.ownerId !== uid) throw new HttpsError('not-found', 'The routine draft could not be found.');
      const current = draft.data() as RoutineDraftDocument;
      assertRoutineDraftRevision(current.revision, expectedRevision);
      if (current.state !== 'active') throw new HttpsError('failed-precondition', 'An archived routine draft cannot be edited.');
      updated = updateRoutineDraftDocument(current, request.data?.package);
      transaction.set(draftRef, updated);
    });
  } catch (error) {
    routineDraftInputError(error);
  }
  if (!updated) throw new HttpsError('internal', 'The routine draft could not be updated.');
  await recordAuditEvent(db, {
    action: 'update_routine_draft', actorUid: uid, participantId, metadata: { draftId, revision: updated.revision },
  });
  return { id: draftId, ...updated };
});

export const deleteRoutineDraft = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const draftId = requireDocumentId(request.data?.draftId, 'Draft ID');
  const expectedRevision = requireDraftRevision(request.data?.expectedRevision);
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const draftRef = participantRef.collection('routineDrafts').doc(draftId);
  await db.runTransaction(async (transaction) => {
    const [, draft] = await Promise.all([
      requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid),
      transaction.get(draftRef),
    ]);
    if (!draft.exists || draft.data()?.ownerId !== uid) throw new HttpsError('not-found', 'The routine draft could not be found.');
    try {
      assertRoutineDraftRevision(Number(draft.data()?.revision), expectedRevision);
    } catch (error) {
      routineDraftInputError(error);
    }
    transaction.delete(draftRef);
  });
  await recordAuditEvent(db, {
    action: 'delete_routine_draft', actorUid: uid, participantId, metadata: { draftId, revision: expectedRevision },
  });
  return { success: true };
});

export const assignRoutineDraft = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const draftId = requireDocumentId(request.data?.draftId, 'Draft ID');
  const expectedRevision = requireDraftRevision(request.data?.expectedRevision);
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const draftRef = participantRef.collection('routineDrafts').doc(draftId);
  let routineId = '';
  await db.runTransaction(async (transaction) => {
    const [, draft] = await Promise.all([
      requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid),
      transaction.get(draftRef),
    ]);
    if (!draft.exists || draft.data()?.ownerId !== uid) throw new HttpsError('not-found', 'The routine draft could not be found.');
    const current = draft.data() as RoutineDraftDocument;
    try { assertRoutineDraftRevision(current.revision, expectedRevision); } catch (error) { routineDraftInputError(error); }
    if (current.state !== 'active' || current.validation.status !== 'valid') throw new HttpsError('failed-precondition', 'Only a valid active draft can be assigned.');
    assertActivatableAiRoutine(current.package.routine as RoutineDocument);
    routineId = current.package.routine.id;
    const assignmentRef = participantRef.collection('routineAssignments').doc(routineId);
    if ((await transaction.get(assignmentRef)).exists) throw new HttpsError('already-exists', 'This routine is already assigned.');
    transaction.create(assignmentRef, createDraftRoutineAssignment(current.package.routine as RoutineDocument, defaultPlan, draftId, current.revision));
  });
  await recordAuditEvent(db, { action: 'assign_routine_draft', actorUid: uid, participantId, metadata: { draftId, revision: expectedRevision, routineId } });
  return { success: true, routineId };
});

export const publishRoutineDraft = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const draftId = requireDocumentId(request.data?.draftId, 'Draft ID');
  const expectedRevision = requireDraftRevision(request.data?.expectedRevision);
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const authorName = await responsibleActorName(uid);
  const draftRef = participantRef.collection('routineDrafts').doc(draftId);
  let published: PublishedRoutineVersionDocument | undefined;
  await db.runTransaction(async (transaction) => {
    const [, draft] = await Promise.all([requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid), transaction.get(draftRef)]);
    if (!draft.exists || draft.data()?.ownerId !== uid) throw new HttpsError('not-found', 'The routine draft could not be found.');
    const current = draft.data() as RoutineDraftDocument;
    try { assertRoutineDraftRevision(current.revision, expectedRevision); } catch (error) { routineDraftInputError(error); }
    if (current.state !== 'active' || current.validation.status !== 'valid') throw new HttpsError('failed-precondition', 'Only a valid active draft can be published.');
    const routineId = current.package.routine.id;
    if (current.forkedFrom) {
      if (current.forkedFrom.routineId !== routineId || current.package.version !== (current.forkedFrom.sourceVersion ?? 0) + 1) {
        throw new HttpsError('failed-precondition', 'The routine draft version lineage is invalid.');
      }
      const assignment = await transaction.get(participantRef.collection('routineAssignments').doc(routineId));
      if (!assignment.exists || (assignment.data()?.sourceVersion ?? undefined) !== current.forkedFrom.sourceVersion) {
        throw new HttpsError('failed-precondition', 'The assigned routine changed after this draft was created. Create a new editable copy.');
      }
    }
    const versionRef = participantRef.collection('routinePublications').doc(routineId).collection('versions').doc(String(current.package.version));
    if ((await transaction.get(versionRef)).exists) throw new HttpsError('already-exists', 'This routine version is already published.');
    const now = new Date().toISOString();
    published = { ownerId: uid, authorName, origin: current.forkedFrom?.origin ?? 'private', sourceDraftId: draftId, sourceRevision: current.revision, version: current.package.version, package: structuredClone(current.package), publishedAt: now };
    transaction.create(versionRef, published);
    transaction.update(draftRef, { state: 'archived', revision: current.revision + 1, updatedAt: now });
  });
  await recordAuditEvent(db, { action: 'publish_routine_version', actorUid: uid, participantId, metadata: { draftId, revision: expectedRevision, version: published?.version } });
  return published;
});

export const upgradeRoutineAssignment = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const routineId = requireDocumentId(request.data?.routineId, 'Routine ID');
  const targetVersion = requireDraftRevision(request.data?.targetVersion);
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const assignmentRef = participantRef.collection('routineAssignments').doc(routineId);
  const versionRef = participantRef.collection('routinePublications').doc(routineId).collection('versions').doc(String(targetVersion));
  const changeRef = assignmentRef.collection('versionChanges').doc();
  let previousVersion: number | undefined;
  await db.runTransaction(async (transaction) => {
    const [, assignment, version] = await Promise.all([requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid), transaction.get(assignmentRef), transaction.get(versionRef)]);
    if (!assignment.exists) throw new HttpsError('not-found', 'The routine assignment could not be found.');
    if (!version.exists || version.data()?.archivedAt) throw new HttpsError('failed-precondition', 'The target routine version is unavailable.');
    const current = assignment.data() as RoutineAssignmentDocument;
    previousVersion = current.sourceVersion;
    if (current.sourceVersion === targetVersion) throw new HttpsError('already-exists', 'This routine version is already applied.');
    const published = version.data() as PublishedRoutineVersionDocument;
    assertActivatableAiRoutine(published.package.routine as RoutineDocument);
    const now = new Date().toISOString();
    transaction.create(changeRef, createRoutineAssignmentVersionChange(current, { sourceDraftId: published.sourceDraftId, sourceRevision: published.sourceRevision, sourceVersion: published.version }, uid, now));
    transaction.update(assignmentRef, { routine: structuredClone(published.package.routine), sourceDraftId: published.sourceDraftId, sourceRevision: published.sourceRevision, sourceVersion: published.version, contentUpdatedAt: now, validationMode: published.package.routine.recommendedValidationMode ?? 'ai' });
  });
  await recordAuditEvent(db, { action: 'upgrade_routine_assignment', actorUid: uid, participantId, metadata: { routineId, fromVersion: previousVersion, version: targetVersion, changeId: changeRef.id } });
  return { success: true };
});

export const listPublishedRoutineVersions = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const publications = await participantRef.collection('routinePublications').get();
  const storedVersions = (await Promise.all(publications.docs.map(async (publication) =>
    (await publication.ref.collection('versions').get()).docs.map((version) => ({ routineId: publication.id, ...(version.data() as PublishedRoutineVersionDocument) }))))).flat();
  const owners = [...new Set(storedVersions.map((version) => String(version.ownerId ?? '')).filter(Boolean))];
  const authorNames = new Map(await Promise.all(owners.map(async (ownerId) => [ownerId, await responsibleActorName(ownerId)] as const)));
  const versions = storedVersions.map((version) => ({ ...version, authorName: String(version.authorName ?? '').trim() || authorNames.get(String(version.ownerId)) || 'Responsable', origin: version.origin ?? 'private' }));
  return { versions };
});

export const createNextRoutineDraft = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const routineId = requireDocumentId(request.data?.routineId, 'Routine ID');
  const sourceVersion = requireDraftRevision(request.data?.sourceVersion);
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const versionRef = participantRef.collection('routinePublications').doc(routineId).collection('versions').doc(String(sourceVersion));
  const draftRef = participantRef.collection('routineDrafts').doc();
  let document: RoutineDraftDocument | undefined;
  await db.runTransaction(async (transaction) => {
    const [, version] = await Promise.all([requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid), transaction.get(versionRef)]);
    if (!version.exists || version.data()?.archivedAt) throw new HttpsError('failed-precondition', 'The source version is unavailable.');
    const source = version.data() as PublishedRoutineVersionDocument;
    const routinePackage = structuredClone(source.package);
    routinePackage.version = source.version + 1;
    document = createRoutineDraftDocument(uid, routinePackage);
    transaction.create(draftRef, document);
  });
  return { id: draftRef.id, ...document };
});

export const sharePublishedRoutine = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const routineId = requireDocumentId(request.data?.routineId, 'Routine ID');
  const version = requireDraftRevision(request.data?.version);
  const visibility = request.data?.visibility === 'listed' ? 'listed' : 'unlisted';
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const versionRef = participantRef.collection('routinePublications').doc(routineId).collection('versions').doc(String(version));
  const published = await versionRef.get();
  if (!published.exists || published.data()?.archivedAt || published.data()?.ownerId !== uid) throw new HttpsError('not-found', 'The published routine version is unavailable.');
  const source = published.data() as PublishedRoutineVersionDocument;
  const entryId = hashLinkCode(`${participantId}:${routineId}:${version}`);
  const shareCode = randomBytes(18).toString('base64url');
  const shareCodeHash = hashLinkCode(shareCode);
  const moderationStatus = visibility === 'listed' ? 'pending' : 'unlisted';
  const effectiveVisibility = visibility === 'listed' ? 'unlisted' : visibility;
  const entry = { ownerId: uid, authorName: await responsibleActorName(uid), routineId, version, visibility: effectiveVisibility, requestedVisibility: visibility, moderationStatus, license: 'All rights reserved', attribution: uid, package: structuredClone(source.package), publishedAt: source.publishedAt, sharedAt: new Date().toISOString(), shareCodeHash };
  const batch = db.batch();
  batch.set(db.collection('routineCatalogEntries').doc(entryId), entry);
  batch.set(db.collection('routineShareCodes').doc(shareCodeHash), { entryId, ownerId: uid, createdAt: entry.sharedAt });
  await batch.commit();
  await recordAuditEvent(db, { action: 'share_routine_version', actorUid: uid, participantId, metadata: { routineId, version, visibility } });
  return { entryId, shareCode };
});

const publicCatalogEntry = (id: string, data: FirebaseFirestore.DocumentData) => ({
  id,
  authorName: data.authorName,
  routineId: data.routineId,
  version: data.version,
  visibility: data.visibility,
  package: data.package,
  publishedAt: data.publishedAt,
  sharedAt: data.sharedAt,
  source: data.source,
  license: data.license,
  checksum: data.checksum,
});

export const searchRoutineCatalog = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  await requireUid(request.auth);
  const query = String(request.data?.query ?? '').trim().toLocaleLowerCase().slice(0, 120);
  const snapshot = await db.collection('routineCatalogEntries').where('visibility', '==', 'listed').limit(100).get();
  const entries = snapshot.docs.filter((doc) => !doc.data().revokedAt && (doc.data().source === 'external' || doc.data().moderationStatus === 'approved')).map((doc) => publicCatalogEntry(doc.id, doc.data())).filter((entry) => !query || JSON.stringify(entry).toLocaleLowerCase().includes(query)).slice(0, 30);
  return { entries };
});

export const getExternalRoutineRegistryStatus = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  await requireUid(request.auth);
  const state = await db.collection('routineRegistry').doc('state').get();
  return state.exists ? state.data() : { status: process.env.ROUTINE_REGISTRY_URL ? 'pending' : 'disabled' };
});

export const getAiAuthoringCapabilities = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  await requireUid(request.auth);
  const config = currentAiAuthoringConfig();
  return {
    prescriptionExtraction: { enabled: aiAuthoringCapabilityEnabled(config, 'prescriptionExtraction'), promptVersion: aiAuthoringRegistry.prescriptionExtraction.promptVersion },
    routineTranslation: { enabled: aiAuthoringCapabilityEnabled(config, 'routineTranslation'), promptVersion: aiAuthoringRegistry.routineTranslation.promptVersion },
    routineGeneration: { enabled: aiAuthoringCapabilityEnabled(config, 'routineGeneration'), promptVersion: aiAuthoringRegistry.routineGeneration.promptVersion },
    dynamicQuizGeneration: { enabled: aiAuthoringCapabilityEnabled(config, 'dynamicQuizGeneration'), promptVersion: aiAuthoringRegistry.dynamicQuizGeneration.promptVersion },
    manualFallback: true,
  };
});

export const proposeRoutineChallenge = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const startedAt = Date.now();
  const uid = await requireUid(request.auth);
  const intent = typeof request.data?.intent === 'string' ? request.data.intent.trim() : '';
  const refinement = typeof request.data?.refinement === 'string' ? request.data.refinement.trim() : undefined;
  const responseKinds = new Set<ProposedResponseKind>(['photo', 'confirmation', 'checklist', 'quiz']);
  const preferredResponseKind = responseKinds.has(request.data?.preferredResponseKind) ? request.data.preferredResponseKind as ProposedResponseKind : undefined;
  if (intent.length < 2 || intent.length > 2_000 || (refinement && refinement.length > 1_000)) throw new HttpsError('invalid-argument', 'The routine intent or refinement is invalid.');
  let currentProposal;
  try {
    const currentInput = request.data?.currentProposal ? structuredClone(request.data.currentProposal) : undefined;
    if (Array.isArray(currentInput?.response?.items)) currentInput.response.items = currentInput.response.items.map((item: unknown) => typeof item === 'object' && item !== null ? (item as { label?: unknown }).label : item);
    currentProposal = currentInput ? parseRoutineProposal(currentInput, preferredResponseKind) : undefined;
  }
  catch { throw new HttpsError('invalid-argument', 'The current proposal is invalid.'); }
  try {
    const registry = requireAiAuthoringCapability(currentAiAuthoringConfig(), 'routineGeneration');
    const output = await generateRoutineProposalWithGemini({ intent, locale: request.data?.locale === 'fr' ? 'fr' : 'en', preferredResponseKind, refinement, currentProposal }, { model: registry.model, getAccessToken: () => geminiAuth.getAccessToken() });
    reportOperationalEvent({ kind: 'analysis_completed', actorUid: uid, details: { capability: 'routineGeneration', status: 'success', durationMs: Date.now() - startedAt, refined: Boolean(refinement) } });
    return unapprovedAiDraft('routineGeneration', output);
  } catch (error) {
    if (error instanceof AiAuthoringDisabledError) throw new HttpsError('failed-precondition', 'AI routine authoring is disabled. Manual authoring remains available.');
    reportOperationalAlert({ kind: 'analysis_failed', actorUid: uid, details: { capability: 'routineGeneration', durationMs: Date.now() - startedAt } });
    throw new HttpsError('unavailable', 'The proposal could not be generated. Manual authoring remains available.');
  }
});

export const resolveSharedRoutine = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  await requireUid(request.auth);
  const code = String(request.data?.shareCode ?? '').trim();
  if (!code) throw new HttpsError('invalid-argument', 'A share code is required.');
  const shareCodeHash = hashLinkCode(code);
  const mapping = await db.collection('routineShareCodes').doc(shareCodeHash).get();
  if (!mapping.exists) throw new HttpsError('not-found', 'This shared routine is unavailable.');
  const entry = await db.collection('routineCatalogEntries').doc(String(mapping.data()?.entryId)).get();
  if (!entry.exists || !marketplaceEntryInstallable(entry.data() ?? {}) || entry.data()?.shareCodeHash !== shareCodeHash) throw new HttpsError('not-found', 'This shared routine is unavailable.');
  return publicCatalogEntry(entry.id, entry.data()!);
});

export const installCatalogRoutine = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const participantId = requireDocumentId(request.data?.participantId, 'Participant ID');
  const entryId = requireDocumentId(request.data?.entryId, 'Catalog entry ID');
  const shareCode = typeof request.data?.shareCode === 'string' ? request.data.shareCode.trim() : '';
  const suppliedShareCodeHash = shareCode ? hashLinkCode(shareCode) : undefined;
  const participantRef = await requireParticipantRoutineDraftAccess(uid, participantId);
  const entryRef = db.collection('routineCatalogEntries').doc(entryId);
  let routineId = '';
  await db.runTransaction(async (transaction) => {
    const [, entry] = await Promise.all([requireParticipantRoutineDraftTransactionAccess(transaction, participantRef, uid), transaction.get(entryRef)]);
    if (!entry.exists || !marketplaceEntryAuthorizedForInstall(entry.data() ?? {}, suppliedShareCodeHash)) {
      throw new HttpsError('failed-precondition', 'This routine is no longer available for installation.');
    }
    const data = entry.data() as { routineId: string; version: number; package: PublishedRoutineVersionDocument['package'] };
    assertActivatableAiRoutine(data.package.routine as RoutineDocument);
    routineId = requireDocumentId(data.routineId, 'Routine ID');
    const assignmentRef = participantRef.collection('routineAssignments').doc(routineId);
    if ((await transaction.get(assignmentRef)).exists) throw new HttpsError('already-exists', 'This routine is already installed.');
    transaction.create(assignmentRef, { ...createDraftRoutineAssignment(data.package.routine as RoutineDocument, defaultPlan, entryId, data.version), sourceVersion: data.version, sourceCatalogEntryId: entryId });
  });
  await recordAuditEvent(db, { action: 'install_catalog_routine', actorUid: uid, participantId, metadata: { entryId, routineId } });
  return { success: true, routineId };
});

export const revokeSharedRoutine = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const entryId = requireDocumentId(request.data?.entryId, 'Catalog entry ID');
  const entryRef = db.collection('routineCatalogEntries').doc(entryId);
  const entry = await entryRef.get();
  if (!entry.exists || entry.data()?.ownerId !== uid) throw new HttpsError('permission-denied', 'Only the author can revoke this routine.');
  await entryRef.update({ revokedAt: new Date().toISOString(), visibility: 'unlisted', moderationStatus: 'revoked' });
  await recordAuditEvent(db, { action: 'revoke_catalog_routine', actorUid: uid, metadata: { entryId } });
  return { success: true };
});

export const moderateRoutineCatalogEntry = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const role = marketplaceRole(request.auth?.token as Record<string, unknown> | undefined);
  if (!role) throw new HttpsError('permission-denied', 'A marketplace moderation role is required.');
  const entryId = requireDocumentId(request.data?.entryId, 'Catalog entry ID');
  const action = String(request.data?.action) as ModerationAction;
  if (!['approve', 'reject', 'suspend', 'restore', 'revoke'].includes(action)) throw new HttpsError('invalid-argument', 'Unknown moderation action.');
  const entryRef = db.collection('routineCatalogEntries').doc(entryId);
  let next: ModerationStatus | undefined;
  await db.runTransaction(async (transaction) => {
    const entry = await transaction.get(entryRef);
    if (!entry.exists) throw new HttpsError('not-found', 'Catalog entry not found.');
    const current = (entry.data()?.moderationStatus ?? (entry.data()?.visibility === 'listed' ? 'approved' : 'unlisted')) as ModerationStatus;
    try { next = moderateMarketplaceStatus(current, action, role); } catch (error) { throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'invalid_transition'); }
    transaction.update(entryRef, { moderationStatus: next, visibility: next === 'approved' ? 'listed' : 'unlisted', moderatedAt: new Date().toISOString(), moderatedBy: uid, ...(next === 'revoked' ? { revokedAt: new Date().toISOString() } : {}) });
  });
  await recordAuditEvent(db, { action: action === 'revoke' ? 'emergency_revoke_catalog' : 'moderate_catalog_routine', actorUid: uid, metadata: { entryId, moderationAction: action, moderationStatus: next } });
  return { status: next };
});

export const reportRoutineCatalogEntry = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const entryId = requireDocumentId(request.data?.entryId, 'Catalog entry ID');
  const reason = ['unsafe', 'privacy', 'copyright', 'other'].includes(String(request.data?.reason)) ? String(request.data?.reason) : 'other';
  if (!(await db.collection('routineCatalogEntries').doc(entryId).get()).exists) throw new HttpsError('not-found', 'Catalog entry not found.');
  const reportId = hashLinkCode(`${uid}:${entryId}`);
  await db.collection('routineCatalogReports').doc(reportId).set({ entryId, reporterUid: uid, reason, status: 'open', reportedAt: new Date().toISOString() });
  await recordAuditEvent(db, { action: 'report_catalog_routine', actorUid: uid, metadata: { entryId, reason } });
  return { success: true };
});

export const assignRoutine = onCall({
  region,
  cors,
  enforceAppCheck: true,
}, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const routineId = requireDocumentId(request.data?.routineId, 'Routine ID');
  const routine = routineFromCatalog(routineId);
  if (!routine) throw new HttpsError('invalid-argument', 'Unknown routine.');
  assertActivatableAiRoutine(routine);

  const familyRef = await requireAggregatePermission(uid, familyId, 'manageRoutines', 'parent');
  const assignmentRef = familyRef.collection('routineAssignments').doc(routine.id);

  await ensureFamilyRoutineMigration(familyRef);
  await db.runTransaction(async (transaction) => {
    const [family, assignment] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(assignmentRef),
    ]);
    if (!family.exists) throw new HttpsError('not-found', 'The followed person could not be found.');
    if (assignment.exists) throw new HttpsError('already-exists', 'This routine is already assigned.');

    transaction.create(assignmentRef, createRoutineAssignment(routine, defaultPlan, new Date().toISOString(), 'parent'));
  });

  await recordAuditEvent(db, {
    action: 'assign_routine',
    actorUid: uid,
    familyId,
    metadata: { routineId: routine.id },
  });

  return { success: true };
});

export const deleteRoutine = onCall({
  region,
  cors,
  enforceAppCheck: true,
}, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const routineId = requireDocumentId(request.data?.routineId, 'Routine ID');

  const familyRef = await requireAggregatePermission(uid, familyId, 'manageRoutines', 'parent');
  const assignmentRef = familyRef.collection('routineAssignments').doc(routineId);
  const assignmentsQuery = familyRef.collection('routineAssignments').limit(2);
  const routineChecksQuery = familyRef.collection('checks').where('routineId', '==', routineId);
  const routineChecks = routineChecksQuery.limit(400);

  await ensureFamilyRoutineMigration(familyRef);
  const deletedInTransaction = await db.runTransaction(async (transaction) => {
    const [family, assignment, assignments, checks] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(assignmentRef),
      transaction.get(assignmentsQuery),
      transaction.get(routineChecks),
    ]);
    if (!family.exists) throw new HttpsError('not-found', 'The followed person could not be found.');
    if (!assignment.exists) throw new HttpsError('not-found', 'The routine could not be found.');
    if (assignments.size <= 1) {
      throw new HttpsError('failed-precondition', 'At least one active routine is required.');
    }

    transaction.delete(assignmentRef);
    checks.docs.forEach((check) => transaction.delete(check.ref));
    return checks.size;
  });

  const deletedAfterTransaction = await deleteQueryDocumentsInBatches(routineChecksQuery);
  await recordAuditEvent(db, {
    action: 'delete_routine',
    actorUid: uid,
    familyId,
    metadata: {
      routineId,
      deletedCheckCount: deletedInTransaction + deletedAfterTransaction,
    },
  });

  return { success: true };
});

export const updateRoutineAssignment = onCall({
  region,
  cors,
  enforceAppCheck: true,
}, async (request) => {
  try {
  const uid = await requireUid(request.auth);
    const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
    const routineId = requireDocumentId(request.data?.routineId ?? DEFAULT_ROUTINE_ID, 'Routine ID');
    const plan = request.data?.plan;
    const rawAppearance = request.data?.appearance;
    const rawValidationMode = request.data?.validationMode;
    if (rawValidationMode !== undefined && rawValidationMode !== null && !isRoutineValidationMode(rawValidationMode)) {
      throw new HttpsError('invalid-argument', 'The validation mode is invalid.');
    }
    const validationMode = isRoutineValidationMode(rawValidationMode) ? rawValidationMode : undefined;
    const appearanceIcons = new Set([
      'alarm', 'bandage', 'barbell', 'basket', 'basketball', 'bed', 'bicycle', 'body', 'book', 'bulb',
      'cafe', 'call', 'calendar', 'camera', 'car', 'cart', 'chat', 'check', 'color-palette', 'ear', 'eye',
      'fast-food', 'fitness', 'flag', 'flame', 'flower', 'football', 'footsteps', 'game-controller', 'gift',
      'glasses', 'heart', 'home', 'hourglass', 'leaf', 'mail', 'medical', 'medkit', 'megaphone', 'moon',
      'musical-notes', 'notifications', 'nutrition', 'paper-plane', 'paw', 'people', 'person', 'pulse',
      'restaurant', 'ribbon', 'rocket', 'school', 'send', 'shield', 'shirt', 'sparkles', 'star', 'stopwatch',
      'sunny', 'tennis', 'thermometer', 'thumbs-up', 'time', 'timer', 'today', 'tooth', 'trophy', 'walk', 'water',
    ]);
    const appearance = rawAppearance && typeof rawAppearance === 'object' && !Array.isArray(rawAppearance)
      && typeof rawAppearance.name === 'string' && rawAppearance.name.trim().length > 0 && rawAppearance.name.trim().length <= 120
      && typeof rawAppearance.icon === 'string' && appearanceIcons.has(rawAppearance.icon)
      && typeof rawAppearance.accentColor === 'string' && /^#[0-9A-F]{6}$/i.test(rawAppearance.accentColor)
      ? { name: rawAppearance.name.trim(), icon: rawAppearance.icon, accentColor: rawAppearance.accentColor.toUpperCase() }
      : undefined;
    if (rawAppearance !== undefined && !appearance) {
      throw new HttpsError('invalid-argument', 'The routine appearance is invalid.');
    }

    if (!plan || typeof plan !== 'object') {
      throw new HttpsError('invalid-argument', 'Plan is required and must be an object.');
    }

    // Validate plan structure
    const parsedPlan = monitoringPlanSchema.safeParse(plan);
    if (!parsedPlan.success) {
      console.error('Invalid plan structure:', parsedPlan.error.issues);
      throw new HttpsError('invalid-argument', 'Invalid monitoring plan structure.');
    }

    const familyRef = await requireAggregatePermission(uid, familyId, 'manageRoutines', 'parent');
    const assignmentRef = familyRef.collection('routineAssignments').doc(routineId);

    await ensureFamilyRoutineMigration(familyRef);
    const assignment = await assignmentRef.get();
    if (!assignment.exists) throw new HttpsError('not-found', 'The routine could not be found.');
    if (validationMode === 'auto' && assignment.data()?.createdBy !== 'child') {
      throw new HttpsError('failed-precondition', 'Auto-validation is only available for participant-created routines.');
    }

    // Update the assignment plan
    const update: Record<string, unknown> = {
      plan: parsedPlan.data,
      updatedAt: new Date().toISOString(),
    };
    if (validationMode) update.validationMode = validationMode;
    if (appearance) {
      const routine = assignment.data()?.routine ?? {};
      const translations = Object.fromEntries(Object.entries(routine.translations ?? {}).map(([locale, content]) => [
        locale,
        { ...(content as Record<string, unknown>), name: appearance.name },
      ]));
      update.routine = { ...routine, ...appearance, ...(Object.keys(translations).length ? { translations } : {}) };
    }
    await assignmentRef.update(update);

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('updateRoutineAssignment error:', error);
    throw new HttpsError('internal', 'Failed to update routine assignment.');
  }
});

const loadScheduledAggregates = async () => {
  const [families, participants] = await Promise.all([
    db.collection('families').where('members', '!=', {}).get(),
    db.collection('participants').where('status', '==', 'active').get(),
  ]);
  const paths = scheduledAggregatePaths(
    families.docs.map(({ id }) => id),
    participants.docs.map((document) => ({ id: document.id, ...document.data() })),
  );
  const documents = new Map([
    ...families.docs.map((document) => [document.ref.path, document] as const),
    ...participants.docs.map((document) => [document.ref.path, document] as const),
  ]);
  return paths.map((path) => documents.get(path)).filter((document): document is FirebaseFirestore.QueryDocumentSnapshot => Boolean(document));
};

const aggregateHasActiveParticipant = async (aggregate: FirebaseFirestore.QueryDocumentSnapshot) => {
  if (aggregate.ref.parent.id === 'families') {
    return Object.values((aggregate.data().members ?? {}) as Record<string, string>).includes('child');
  }
  const memberships = await aggregate.ref.collection('memberships').get();
  return memberships.docs.some((membership) => (
    membership.data().status === 'active'
    && (membership.data().role === 'participant' || membership.data().label === 'self')
  ));
};

export const dispatchPlannedChecks = onSchedule({
  region,
  schedule: plannedCheckDispatchSchedule,
  timeZone: 'UTC',
  secrets: [vapidPrivateKey, vapidPublicKey],
}, async () => {
  const startedAt = Date.now();
  const now = new Date();
  const stats = {
    aggregatesFound: 0,
    aggregatesEligible: 0,
    assignmentsExamined: 0,
    invalidPlans: 0,
    checksCreated: 0,
    pushSuccess: 0,
    pushFailed: 0,
    pushInvalidated: 0,
    pushSkipped: 0,
    pushUnconfirmed: 0,
    failures: 0,
  };
  try {
    const aggregates = await loadScheduledAggregates();
    stats.aggregatesFound = aggregates.length;
    const aggregateResults = await Promise.allSettled(aggregates.map(async (familyDoc) => {
      const hasChild = await aggregateHasActiveParticipant(familyDoc);
      if (!hasChild) return;
      stats.aggregatesEligible += 1;
      await ensureFamilyRoutineMigration(familyDoc.ref);
      const [assignments, pushSubscriptions] = await Promise.all([
        familyDoc.ref.collection('routineAssignments').where('status', '==', 'active').get(),
        familyDoc.ref.collection('pushSubscriptions').get(),
      ]);
      stats.pushUnconfirmed += await markUnconfirmedPushSubscriptions(pushSubscriptions, now);
      stats.assignmentsExamined += assignments.size;
      const recentSince = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const assignmentResults = await Promise.allSettled(assignments.docs.map(async (assignmentDoc) => {
        const assignmentData = assignmentDoc.data() as RoutineAssignmentDocument;
        const routineId = assignmentData.routineId || assignmentDoc.id;
        const parsedPlan = monitoringPlanSchema.safeParse(assignmentData.plan);
        if (!parsedPlan.success) {
          stats.invalidPlans += 1;
          reportOperationalAlert({
            kind: 'scheduler_dispatch_failed',
            familyId: familyDoc.id,
            routineId,
            details: { phase: 'invalid_monitoring_plan' },
            error: parsedPlan.error,
          });
          return;
        }
        const plan = parsedPlan.data;
        const childSubscriptions = pushSubscriptions.docs.filter((subscription) => pushRecipientRoles(subscription).includes('child'));
        if (childSubscriptions.length && !childSubscriptions.every((subscription) => (
          notificationWindowIsOpen(normalizePushPreferences(subscription.data().preferences), now, plan.timeZone)
        ))) return;
        const recentChecksQuery = familyDoc.ref.collection('checks')
          .where('routineId', '==', routineId)
          .where('requestedAt', '>=', recentSince)
          .orderBy('requestedAt', 'desc');
        const recentChecksSnapshot = await recentChecksQuery.get();
        const recentChecks = recentChecksSnapshot.docs.map((doc) => doc.data() as {
          requestedAt?: string; status?: string; expiresAt?: string; dispatchKey?: string;
        });
        const activePendingCheck = recentChecks.some((check) => {
          const expiresAt = Date.parse(String(check.expiresAt ?? ''));
          return check.status === 'pending' && Number.isFinite(expiresAt) && expiresAt > now.getTime();
        });
        const decision = shouldAutoDispatchCheck(plan, recentChecks, now, plan.timeZone, activePendingCheck);
        if (!decision.shouldDispatch || !decision.dispatchKey) return;

        const checkRef = familyDoc.ref.collection('checks').doc();
        const expiresAt = checkExpiresAt(plan, now);
        const check = {
          routineId,
          sessionId: crypto.randomUUID(),
          requestedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          status: 'pending',
          requestedBy: 'system',
          dispatchKey: decision.dispatchKey,
          dispatchSource: 'schedule',
        };

        const created = await db.runTransaction(async (transaction): Promise<boolean> => {
          const freshAssignmentRef = familyDoc.ref.collection('routineAssignments').doc(assignmentDoc.id);
          const activePendingQuery = familyDoc.ref.collection('checks')
            .where('routineId', '==', routineId)
            .where('status', '==', 'pending')
            .limit(5);
          const [freshFamily, freshAssignment, activePending, freshRecentChecks, freshMemberships] = await Promise.all([
            transaction.get(familyDoc.ref),
            transaction.get(freshAssignmentRef),
            transaction.get(activePendingQuery),
            transaction.get(recentChecksQuery),
            familyDoc.ref.parent.id === 'participants'
              ? transaction.get(familyDoc.ref.collection('memberships'))
              : Promise.resolve(undefined),
          ]);
          const freshAssignmentData = freshAssignment.data() as RoutineAssignmentDocument | undefined;
          if (!freshFamily.exists || !freshAssignment.exists || freshAssignmentData?.status !== 'active') return false;
          const hasActiveParticipant = familyDoc.ref.parent.id === 'families'
            ? Object.values(freshFamily.data()?.members ?? {}).includes('child')
            : freshMemberships?.docs.some((membership) => (
              membership.data().status === 'active'
              && (membership.data().role === 'participant' || membership.data().label === 'self')
            ));
          if (!hasActiveParticipant) return false;
          const freshPlan = monitoringPlanSchema.safeParse(freshAssignmentData.plan);
          if (!freshPlan.success) return false;
          const stillHasActivePending = activePending.docs.some((pending) => Date.parse(String(pending.data().expiresAt ?? '')) > now.getTime());
          if (stillHasActivePending) return false;
          const freshDecision = shouldAutoDispatchCheck(
            freshPlan.data,
            freshRecentChecks.docs.map((doc) => doc.data() as { requestedAt?: string; status?: string; dispatchKey?: string }),
            now,
            freshPlan.data.timeZone,
            false,
          );
          if (!freshDecision.shouldDispatch || freshDecision.dispatchKey !== decision.dispatchKey) return false;
          transaction.update(freshAssignmentRef, { lastScheduledCheckDispatchAt: now.toISOString() });
          transaction.create(checkRef, {
            ...check,
            ...routineAssignmentProvenance(freshAssignmentData),
            challenge: challengeForAssignment(freshAssignmentData),
          });
          return true;
        });

        if (!created) return;
        stats.checksCreated += 1;
        if (assignmentData.routine.response?.kind === 'quiz') {
          try {
            const locale = childSubscriptions.find((subscription) => subscription.data().locale === 'fr') ? 'fr' : 'en';
            await prepareQuizForCheck(familyDoc.ref, checkRef.id, locale);
          } catch {
            reportOperationalAlert({ kind: 'analysis_failed', familyId: familyDoc.id, checkId: checkRef.id, routineId, details: { capability: 'dynamicQuizGeneration', phase: 'scheduled_check' } });
          }
        }
        const dispatch = await sendCheckPushNotifications(familyDoc.ref, {
          checkId: checkRef.id,
          sessionId: check.sessionId,
          routineId,
          ...getRoutineNotificationNames(assignmentData, routineId),
        }, false);
        stats.pushSuccess += dispatch.success;
        stats.pushFailed += dispatch.failed;
        stats.pushInvalidated += dispatch.invalidated;
        stats.pushSkipped += dispatch.skipped;
      }));
      assignmentResults.forEach((result, index) => {
        if (result.status === 'fulfilled') return;
        stats.failures += 1;
        const assignment = assignments.docs[index];
        reportOperationalAlert({
          kind: 'scheduler_dispatch_failed',
          familyId: familyDoc.id,
          routineId: assignment?.data().routineId || assignment?.id,
          details: { phase: 'routine_dispatch' },
          error: result.reason,
        });
      });
    }));
    aggregateResults.forEach((result, index) => {
      if (result.status === 'fulfilled') return;
      stats.failures += 1;
      reportOperationalAlert({
        kind: 'scheduler_dispatch_failed',
        familyId: aggregates[index]?.id,
        details: { phase: 'aggregate_dispatch' },
        error: result.reason,
      });
    });
  } catch (error) {
    stats.failures += 1;
    reportOperationalAlert({
      kind: 'scheduler_dispatch_failed',
      details: { phase: 'scheduler_run' },
      error,
    });
    throw error;
  } finally {
    reportOperationalEvent({
      kind: 'scheduler_run_summary',
      details: { ...stats, durationMs: Date.now() - startedAt },
    });
    if (stats.failures === 0 && stats.invalidPlans === 0) reportOperationalRecovery('scheduler_dispatch_failed');
  }
});

export const updatePlan = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const routineId = requireDocumentId(request.data?.routineId ?? DEFAULT_ROUTINE_ID, 'Routine ID');
  const parsedPlan = monitoringPlanSchema.safeParse(request.data?.plan);
  if (!parsedPlan.success) throw new HttpsError('invalid-argument', 'The monitoring plan is invalid.');
  const familyRef = await requireAggregatePermission(uid, familyId, 'manageRoutines', 'parent');
  await ensureFamilyRoutineMigration(familyRef);
  const assignmentRef = familyRef.collection('routineAssignments').doc(routineId);
  const assignment = await assignmentRef.get();
  if (!assignment.exists) throw new HttpsError('not-found', 'The routine assignment could not be found.');
  await assignmentRef.update({ plan: parsedPlan.data, updatedAt: FieldValue.serverTimestamp() });
});

const prepareQuizForCheck = async (
  aggregateRef: FirebaseFirestore.DocumentReference,
  checkId: string,
  locale: 'en' | 'fr',
): Promise<Record<string, unknown>> => {
  const checkRef = aggregateRef.collection('checks').doc(checkId);
  const initial = await checkRef.get();
  const initialData = initial.data();
  if (!initial.exists || !initialData || initialData.status !== 'pending') throw new HttpsError('failed-precondition', 'This quiz is no longer available.');
  if (initialData.challenge?.quiz?.questions?.length) return { id: initial.id, ...initialData };
  const definition = initialData.challenge?.response as RoutineResponseDefinition | undefined;
  if (!definition || definition.kind !== 'quiz' || definition.mode !== 'generated') throw new HttpsError('failed-precondition', 'This check is not a generated quiz.');
  const config = currentAiAuthoringConfig();
  const registry = requireAiAuthoringCapability(config, 'dynamicQuizGeneration');
  const recent = await aggregateRef.collection('checks').where('routineId', '==', String(initialData.routineId ?? definition.topic)).orderBy('requestedAt', 'desc').limit(10).get();
  const recentQuestions = recent.docs.flatMap((document) => {
    const questions = document.data().challenge?.quiz?.questions;
    return Array.isArray(questions) ? questions.flatMap((question) => typeof question?.prompt === 'string' ? [question.prompt.slice(0, 500)] : []) : [];
  }).slice(0, 10);
  const weakConcepts = recent.docs.flatMap((document) => {
    const result = document.data().quizResult;
    if (!result || !Array.isArray(result.corrections)) return [];
    return result.corrections.flatMap((correction: { correct?: unknown; questionId?: unknown }) => correction?.correct === false
      ? document.data().challenge?.quiz?.questions?.flatMap((question: { id?: unknown; concept?: unknown }) => question.id === correction.questionId && typeof question.concept === 'string' ? [question.concept] : []) ?? []
      : []);
  }).filter((concept): concept is string => typeof concept === 'string').slice(0, 10);
  const generatedAt = new Date().toISOString();
  const generated: GeneratedQuiz = await generateQuizWithGemini({
    topic: definition.topic,
    questionCount: definition.questionCount,
    choiceCount: definition.choiceCount,
    locale,
    recentQuestions,
    weakConcepts,
  }, { model: registry.model, getAccessToken: () => geminiAuth.getAccessToken() });
  const publicQuiz = {
    questions: generated.questions,
    generatedAt,
    provider: registry.provider,
    model: registry.model,
    promptVersion: registry.promptVersion,
  };
  const answerKeyRef = aggregateRef.collection('quizAnswerKeys').doc(checkId);
  return db.runTransaction(async (transaction) => {
    const [fresh, existingKey] = await Promise.all([transaction.get(checkRef), transaction.get(answerKeyRef)]);
    const freshData = fresh.data();
    if (!fresh.exists || !freshData || freshData.status !== 'pending') throw new HttpsError('failed-precondition', 'This quiz is no longer available.');
    if (freshData.challenge?.quiz?.questions?.length) return { id: fresh.id, ...freshData };
    if (existingKey.exists) throw new HttpsError('aborted', 'The quiz is already being prepared. Retry shortly.');
    transaction.create(answerKeyRef, {
      checkId,
      routineId: String(freshData.routineId ?? ''),
      answerKey: generated.answerKey,
      questions: generated.questions,
      provider: registry.provider,
      model: registry.model,
      promptVersion: registry.promptVersion,
      generatedAt,
      expiresAt: freshData.expiresAt,
    });
    transaction.update(checkRef, { 'challenge.quiz': publicQuiz });
    return { id: fresh.id, ...freshData, challenge: { ...freshData.challenge, quiz: publicQuiz } };
  });
};

export const prepareQuizChallenge = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const startedAt = Date.now();
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const checkId = requireDocumentId(request.data?.checkId, 'Check ID');
  const locale = request.data?.locale === 'fr' ? 'fr' : 'en';
  const aggregateRef = await requireFamilyRole(uid, familyId, 'child');
  try {
    const prepared = await prepareQuizForCheck(aggregateRef, checkId, locale);
    reportOperationalEvent({ kind: 'analysis_completed', familyId, checkId, actorUid: uid, details: { capability: 'dynamicQuizGeneration', status: 'success', durationMs: Date.now() - startedAt } });
    return prepared;
  } catch (error) {
    reportOperationalAlert({ kind: 'analysis_failed', familyId, checkId, actorUid: uid, details: { capability: 'dynamicQuizGeneration', durationMs: Date.now() - startedAt } });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('unavailable', 'The quiz could not be prepared. Retry shortly.');
  }
});

export const submitRoutineResponse = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const checkId = requireDocumentId(request.data?.checkId, 'Check ID');
  const submittedAt = String(request.data?.submittedAt ?? '');
  const aggregateRef = await requireFamilyRole(uid, familyId, 'child');
  const checkRef = aggregateRef.collection('checks').doc(checkId);
  let responseKind = '';
  let itemCount = 0;
  let routineId = DEFAULT_ROUTINE_ID;
  const response = await db.runTransaction(async (transaction) => {
    const check = await transaction.get(checkRef);
    const checkData = check.data();
    if (!check.exists || !checkData || !isFreshCheckSubmission(checkData, submittedAt)) {
      throw new HttpsError('failed-precondition', 'This check is expired, completed, or invalid.');
    }
    const definition = checkData.challenge?.response as RoutineResponseDefinition | undefined;
    if (!definition || !['confirmation', 'checklist'].includes(definition.kind)) {
      throw new HttpsError('failed-precondition', 'This check does not accept a structured response.');
    }
    let submission;
    try {
      submission = parseRoutineResponseSubmission(definition, request.data?.submission);
    } catch (error) {
      if (error instanceof RoutineResponseInputError) throw new HttpsError('invalid-argument', 'The structured response is invalid or incomplete.');
      throw error;
    }
    responseKind = submission.kind;
    itemCount = submission.kind === 'checklist' ? submission.items.length : 1;
    routineId = typeof checkData.routineId === 'string' && checkData.routineId ? checkData.routineId : DEFAULT_ROUTINE_ID;
    const update = { status: 'answered', submittedAt, submission };
    transaction.update(checkRef, update);
    return { id: check.id, ...checkData, ...update };
  });
  await recordAuditEvent(db, {
    action: 'submit_proof',
    actorUid: uid,
    familyId,
    role: 'child',
    metadata: { checkId, routineId, responseKind, itemCount },
  });
  return response;
});

export const submitQuizResponse = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const checkId = requireDocumentId(request.data?.checkId, 'Check ID');
  const submittedAt = String(request.data?.submittedAt ?? '');
  const aggregateRef = await requireFamilyRole(uid, familyId, 'child');
  const checkRef = aggregateRef.collection('checks').doc(checkId);
  const answerKeyRef = aggregateRef.collection('quizAnswerKeys').doc(checkId);
  let routineId = DEFAULT_ROUTINE_ID;
  let questionCount = 0;
  const response = await db.runTransaction(async (transaction) => {
    const [check, secret] = await Promise.all([transaction.get(checkRef), transaction.get(answerKeyRef)]);
    const checkData = check.data();
    const secretData = secret.data();
    if (!check.exists || !checkData || !isFreshCheckSubmission(checkData, submittedAt)) throw new HttpsError('failed-precondition', 'This quiz is expired, completed, or invalid.');
    if (!secret.exists || !secretData || !Array.isArray(checkData.challenge?.quiz?.questions) || !Array.isArray(secretData.answerKey)) throw new HttpsError('failed-precondition', 'This quiz has not been prepared.');
    let graded;
    try {
      graded = gradeQuizSubmission(checkData.challenge.quiz.questions as PublicQuizQuestion[], secretData.answerKey as QuizAnswerKeyEntry[], request.data?.submission);
    } catch {
      throw new HttpsError('invalid-argument', 'Every quiz question must have one valid answer.');
    }
    routineId = typeof checkData.routineId === 'string' && checkData.routineId ? checkData.routineId : DEFAULT_ROUTINE_ID;
    questionCount = graded.result.totalCount;
    const quizResult = {
      ...graded.result,
      provider: String(secretData.provider),
      model: String(secretData.model),
      promptVersion: String(secretData.promptVersion),
    };
    const update = { status: 'answered', submittedAt, submission: graded.submission, quizResult };
    transaction.update(checkRef, update);
    transaction.delete(answerKeyRef);
    return { id: check.id, ...checkData, ...update };
  });
  await recordAuditEvent(db, { action: 'submit_proof', actorUid: uid, familyId, role: 'child', metadata: { checkId, routineId, responseKind: 'quiz', questionCount } });
  return response;
});

export const reportQuizQuestion = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const checkId = requireDocumentId(request.data?.checkId, 'Check ID');
  const questionId = requireDocumentId(request.data?.questionId, 'Question ID');
  const aggregateRef = await requireFamilyRole(uid, familyId, 'child');
  const check = await aggregateRef.collection('checks').doc(checkId).get();
  const questionExists = check.data()?.challenge?.quiz?.questions?.some((question: { id?: unknown }) => question.id === questionId);
  if (!check.exists || check.data()?.status !== 'answered' || !questionExists) throw new HttpsError('not-found', 'The quiz question could not be found.');
  await aggregateRef.collection('quizQuestionReports').doc(`${checkId}_${questionId}_${uid}`).set({ checkId, questionId, routineId: String(check.data()?.routineId ?? ''), reporterUid: uid, createdAt: new Date().toISOString(), status: 'open' });
  return { success: true };
});

export const analyzeCheck = onCall({
  region,
  cors,
  enforceAppCheck: true,
  secrets: [vapidPrivateKey, vapidPublicKey],
}, async (request) => {
  const requestStartedAt = Date.now();
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const checkId = requireDocumentId(request.data?.checkId, 'Check ID');
  const capturedAt = String(request.data?.capturedAt ?? '');
  const imageDataUrl = String(request.data?.imageDataUrl ?? '');
  const locale = request.data?.locale === 'fr' ? 'fr' : 'en';
  const aggregateRef = await requireFamilyRole(uid, familyId, 'child');
  if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(imageDataUrl) || imageDataUrl.length > maxImageDataUrlLength) {
    throw new HttpsError('invalid-argument', 'A valid image is required.');
  }
  const checkRef = aggregateRef.collection('checks').doc(checkId);
  const routineId = await db.runTransaction(async (transaction) => {
    const check = await transaction.get(checkRef);
    const checkData = check.data();
    if (!check.exists || !checkData || !isFreshCheckSubmission(checkData, capturedAt)) {
      throw new HttpsError('failed-precondition', 'This check is expired, completed, or invalid.');
    }
    const responseKind = String(checkData.challenge?.response?.kind ?? 'photo');
    if (responseKind !== 'photo') {
      throw new HttpsError('failed-precondition', 'This check does not accept a photo response.');
    }
    if (checkData.status === 'analyzing') {
      throw new HttpsError('already-exists', 'This check is already being analyzed.');
    }
    transaction.update(checkRef, {
      capturedAt,
      status: 'analyzing',
      analysisStartedAt: FieldValue.serverTimestamp(),
    });
    return typeof checkData.routineId === 'string' && checkData.routineId ? checkData.routineId : DEFAULT_ROUTINE_ID;
  });
  let proofImagePath: string | undefined;
  try {
    proofImagePath = await storeProofImage(aggregateRef.parent.id as 'families' | 'participants', familyId, checkId, imageDataUrl);
  } catch (error) {
    console.error('Unable to store proof image for review', error);
    await checkRef.update({
      capturedAt: FieldValue.delete(),
      status: 'pending',
      analysisStartedAt: FieldValue.delete(),
    });
    throw new HttpsError('unavailable', 'The proof image could not be stored. Please retake the photo.');
  }
  const assignment = await aggregateRef.collection('routineAssignments').doc(routineId).get();
  const assignmentData = assignment.data() as Partial<RoutineAssignmentDocument> | undefined;
  if (assignmentData?.validationMode === 'auto') {
    const autoUpdate = {
      capturedAt,
      status: 'detected',
      analysisSource: 'self',
      reason: 'self_validated',
      ...(proofImagePath ? { proofImagePath } : {}),
      ...(proofImagePath ? { proofImageExpiresAt: new Date(Date.now() + proofImageRetentionDays * 86_400_000).toISOString() } : {}),
    };
    const response = await db.runTransaction(async (transaction) => {
      const check = await transaction.get(checkRef);
      const checkData = check.data();
      if (!check.exists || !checkData || checkData.status !== 'analyzing' || checkData.capturedAt !== capturedAt) {
        throw new HttpsError('failed-precondition', 'This check is no longer awaiting this analysis.');
      }
      transaction.update(checkRef, autoUpdate);
      return { id: check.id, ...checkData, ...autoUpdate };
    });
    await recordAuditEvent(db, {
      action: 'submit_proof',
      actorUid: uid,
      familyId,
      role: 'child',
      metadata: {
        checkId,
        routineId,
        status: 'detected',
        analysisSource: 'self',
        hasProofImage: Boolean(proofImagePath),
      },
    });
    reportOperationalEvent({
      kind: 'analysis_completed',
      familyId,
      checkId,
      routineId,
      actorUid: uid,
      details: {
        status: 'detected',
        analysisSource: 'self',
        reviewRequired: false,
        hasProofImage: Boolean(proofImagePath),
        durationMs: Date.now() - requestStartedAt,
      },
    });
    return response;
  }
  const routineAnalysis = getRoutineAnalysisContext(assignmentData, routineId, locale);
  const fallbackResult: Partial<AnalysisResult> = {
    status: 'uncertain',
    reason: 'analysis_unavailable',
  };
  let result: Partial<AnalysisResult> = fallbackResult;
  try {
    result = await analyzeWithGemini(imageDataUrl, {
      model: geminiModel,
      getAccessToken: () => geminiAuth.getAccessToken(),
      locale,
      routineAnalysis,
    });
  } catch (error) {
    reportOperationalAlert({
      kind: 'analysis_failed',
      familyId,
      checkId,
      routineId,
      actorUid: uid,
      details: { model: geminiModel, locale },
      error,
    });
    console.error('AI analysis failed, returning fallback result', error);
  }
  const routedAnalysis = routeAnalysisStatusForReview(result.status ?? 'uncertain', Boolean(proofImagePath));
  const analysisUpdate = {
    capturedAt,
    status: routedAnalysis.status,
    automatedStatus: routedAnalysis.automatedStatus,
    analysisSource: result.reason === 'analysis_unavailable' ? 'fallback' : 'ai',
    ...(proofImagePath ? { proofImagePath } : {}),
    ...(proofImagePath ? { proofImageExpiresAt: new Date(Date.now() + proofImageRetentionDays * 86_400_000).toISOString() } : {}),
    ...(routedAnalysis.reviewRequired ? { reviewStatus: 'pending' } : {}),
    ...(result.confidence !== undefined ? { confidence: result.confidence } : {}),
    ...(result.imageQuality !== undefined ? { imageQuality: result.imageQuality } : {}),
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.reasonRaw ? { reasonRaw: result.reasonRaw } : {}),
  };
  const response = await db.runTransaction(async (transaction) => {
    const check = await transaction.get(checkRef);
    const checkData = check.data();
    if (!check.exists || !checkData || checkData.status !== 'analyzing' || checkData.capturedAt !== capturedAt) {
      throw new HttpsError('failed-precondition', 'This check is no longer awaiting this analysis.');
    }
    transaction.update(checkRef, analysisUpdate);
    return { id: check.id, ...checkData, ...analysisUpdate };
  });
  let reviewDispatch: PushDispatchSummary | undefined;
  if (analysisUpdate.reviewStatus === 'pending') {
    try {
      reviewDispatch = await sendReviewPushNotifications(checkRef.parent.parent!, {
        checkId: checkRef.id,
        routineId,
        ...getRoutineNotificationNames(assignmentData, routineId),
      });
    } catch (error) {
      reportOperationalAlert({
        kind: 'push_send_failed',
        familyId,
        checkId,
        routineId,
        details: { notificationType: 'review', phase: 'review_dispatch' },
        error,
      });
    }
  }
  await recordAuditEvent(db, {
    action: 'submit_proof',
    actorUid: uid,
    familyId,
    role: 'child',
    metadata: {
      checkId,
      routineId,
      status: analysisUpdate.status,
      automatedStatus: analysisUpdate.automatedStatus,
      analysisSource: analysisUpdate.analysisSource,
      reviewStatus: analysisUpdate.reviewStatus ?? null,
      hasProofImage: Boolean(proofImagePath),
    },
  });
  reportOperationalEvent({
    kind: 'analysis_completed',
    familyId,
    checkId,
    routineId,
    actorUid: uid,
    details: {
      status: analysisUpdate.status,
      automatedStatus: analysisUpdate.automatedStatus,
      analysisSource: analysisUpdate.analysisSource,
      reviewRequired: analysisUpdate.reviewStatus === 'pending',
      hasProofImage: Boolean(proofImagePath),
      reviewPushSuccess: reviewDispatch?.success ?? 0,
      reviewPushFailed: reviewDispatch?.failed ?? 0,
      durationMs: Date.now() - requestStartedAt,
    },
  });
  if (analysisUpdate.analysisSource === 'ai') reportOperationalRecovery('analysis_failed');
  return response;
});

export const getProofImageUrl = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const checkId = requireDocumentId(request.data?.checkId, 'Check ID');
  const aggregateRef = await requireFamilyMember(uid, familyId);
  const checkRef = aggregateRef.collection('checks').doc(checkId);
  const check = await checkRef.get();
  if (!check.exists) {
    throw new HttpsError('not-found', 'No proof image is available for this check.');
  }
  const storedProofImagePath = check.data()?.proofImagePath;
  const candidatePaths = [
    ...(typeof storedProofImagePath === 'string' && storedProofImagePath ? [storedProofImagePath] : []),
    `families/${familyId}/checks/${checkId}/proof.jpg`,
    `families/${familyId}/checks/${checkId}/proof.png`,
    `families/${familyId}/checks/${checkId}/proof.webp`,
    `participants/${familyId}/checks/${checkId}/proof.jpg`,
    `participants/${familyId}/checks/${checkId}/proof.png`,
    `participants/${familyId}/checks/${checkId}/proof.webp`,
  ];
  const uniqueCandidatePaths = [...new Set(candidatePaths)];
  let proofImagePath: string | undefined;
  for (const candidatePath of uniqueCandidatePaths) {
    const [exists] = await bucket.file(candidatePath).exists();
    if (exists) {
      proofImagePath = candidatePath;
      break;
    }
  }
  if (!proofImagePath) throw new HttpsError('not-found', 'The proof image is no longer available.');
  if (proofImagePath !== storedProofImagePath) {
    await checkRef.update({
      proofImagePath,
      proofImageExpiresAt: new Date(Date.now() + proofImageRetentionDays * 86_400_000).toISOString(),
    });
  }
  const proofFile = bucket.file(proofImagePath);
  try {
    const [url] = await proofFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + proofImageSignedUrlMinutes * 60 * 1000,
    });
    return { url };
  } catch (error) {
    reportOperationalEvent({
      kind: 'proof_image_fallback',
      familyId,
      checkId,
      actorUid: uid,
      details: { fallback: 'inline_data_url' },
      error,
    });
    const [[buffer], [metadata]] = await Promise.all([
      proofFile.download(),
      proofFile.getMetadata(),
    ]);
    const contentType = typeof metadata.contentType === 'string' && metadata.contentType
      ? metadata.contentType
      : 'image/jpeg';
    return { url: `data:${contentType};base64,${buffer.toString('base64')}` };
  }
});

export const reviewCheck = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const familyId = requireDocumentId(request.data?.familyId, 'Family ID');
  const checkId = requireDocumentId(request.data?.checkId, 'Check ID');
  const decision = String(request.data?.decision ?? '');
  if (!['detected', 'not_detected'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'A valid review decision is required.');
  }
  const aggregateRef = await requireFamilyRole(uid, familyId, 'parent');
  const actorName = await responsibleActorName(uid);
  const checkRef = aggregateRef.collection('checks').doc(checkId);
  const reviewedAt = new Date().toISOString();
  const reviewedCheck = await db.runTransaction<ReviewedCheckPayload>(async (transaction) => {
    const check = await transaction.get(checkRef);
    const checkData = check.data();
    if (!check.exists || !checkData) throw new HttpsError('not-found', 'The check could not be found.');
    if (checkData.status !== 'uncertain' || ['approved', 'rejected'].includes(String(checkData.reviewStatus ?? ''))) {
      throw new HttpsError('failed-precondition', 'This check is not waiting for responsible review.');
    }
    const update = {
      status: decision as 'detected' | 'not_detected',
      reviewStatus: decision === 'detected' ? 'approved' : 'rejected',
      reviewedAt,
      reviewedBy: uid,
      responsibleActions: [
        ...(Array.isArray(checkData.responsibleActions) ? checkData.responsibleActions : []),
        { type: decision === 'detected' ? 'approved' : 'rejected', at: reviewedAt, actorUid: uid, actorName },
      ].slice(-20),
    };
    transaction.update(checkRef, update);
    return { id: check.id, ...checkData, ...update };
  });
  const proofImagePath = reviewedCheck.proofImagePath;
  if (shouldDeleteProofAfterReview(decision) && typeof proofImagePath === 'string' && proofImagePath) {
    try {
      await bucket.file(proofImagePath).delete({ ignoreNotFound: true });
      await checkRef.update({
        proofImagePath: FieldValue.delete(),
        proofImageExpiresAt: FieldValue.delete(),
      });
      delete reviewedCheck.proofImagePath;
      delete reviewedCheck.proofImageExpiresAt;
    } catch (error) {
      reportOperationalAlert({
        kind: 'storage_cleanup_failed',
        familyId,
        checkId,
        actorUid: uid,
        details: { phase: 'review_proof_delete' },
        error,
      });
      console.error('Unable to delete reviewed proof image', { familyId, checkId, proofImagePath, error });
    }
  }
  await recordAuditEvent(db, {
    action: 'review_proof',
    actorUid: uid,
    familyId,
    role: 'parent',
    metadata: {
      checkId,
      decision,
      reviewStatus: reviewedCheck.reviewStatus as string,
    },
  });
  return reviewedCheck;
});

export const cleanupExpiredProofImages = onSchedule({
  region,
  schedule: 'every 24 hours',
  timeZone: 'UTC',
  timeoutSeconds: 540,
}, async () => {
  const expiredBefore = new Date().toISOString();
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let failures = 0;
  while (true) {
    let expiredQuery: FirebaseFirestore.Query = db.collectionGroup('checks')
      .where('proofImageExpiresAt', '<', expiredBefore)
      .orderBy('proofImageExpiresAt')
      .orderBy(FieldPath.documentId())
      .limit(200);
    if (cursor) expiredQuery = expiredQuery.startAfter(cursor);
    const expired = await expiredQuery.get();
    if (expired.empty) break;
    const results = await Promise.allSettled(expired.docs.map(async (check) => {
      const proofImagePath = check.data().proofImagePath;
      if (typeof proofImagePath === 'string' && proofImagePath) {
        try {
          await bucket.file(proofImagePath).delete({ ignoreNotFound: true });
        } catch (error) {
          reportOperationalAlert({
            kind: 'storage_cleanup_failed',
            familyId: check.ref.parent.parent?.id,
            checkId: check.id,
            details: { phase: 'expired_proof_delete' },
            error,
          });
          throw error;
        }
      }
      await check.ref.update({
        proofImagePath: FieldValue.delete(),
        proofImageExpiresAt: FieldValue.delete(),
      });
    }));
    failures += results.filter((result) => result.status === 'rejected').length;
    cursor = expired.docs.at(-1);
  }
  if (failures === 0) reportOperationalRecovery('storage_cleanup_failed');
});

export const triggerOperationalTestAlert = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  await requireUid(request.auth);
  const operationsRole = request.auth?.token.operationsRole;
  if (operationsRole !== 'operator' && operationsRole !== 'admin') {
    throw new HttpsError('permission-denied', 'An operations role is required.');
  }
  if (request.data?.phase === 'recovery') {
    reportOperationalRecovery('operational_test');
    return { success: true, phase: 'recovery' as const };
  }
  reportOperationalAlert({ kind: 'operational_test', details: { source: 'manual_test' } });
  return { success: true, phase: 'alert' as const };
});

export const cleanupStaleOperationalData = onSchedule({
  region,
  schedule: 'every 24 hours',
  timeZone: 'UTC',
}, async () => {
  const now = new Date();
  const cutoffs = staleCleanupCutoffs(now);
  const [
    expiredLinks,
    consumedLinks,
    expiredRecoveryCodes,
    expiredRelationshipInvitations,
    consumedRelationshipInvitations,
    expiredRelationshipRecoveryCodes,
    staleRecoveryAttempts,
    expiredPendingChecks,
    expiredAuditEvents,
  ] = await Promise.all([
    db.collection('linkCodes').where('expiresAt', '<', cutoffs.expiredBefore).limit(200).get(),
    db.collection('linkCodes').where('consumedAt', '<', cutoffs.consumedBefore).limit(200).get(),
    db.collection('parentRecoveryCodes').where('expiresAt', '<', cutoffs.expiredBefore).limit(200).get(),
    db.collection('relationshipInvitations').where('expiresAt', '<', cutoffs.expiredBefore).limit(200).get(),
    db.collection('relationshipInvitations').where('consumedAt', '<', cutoffs.consumedBefore).limit(200).get(),
    db.collection('relationshipRecoveryCodes').where('expiresAt', '<', cutoffs.expiredBefore).limit(200).get(),
    db.collection('recoveryAttempts').where('windowStartedAt', '<', cutoffs.recoveryAttemptBefore).limit(200).get(),
    db.collectionGroup('checks')
      .where('status', '==', 'pending')
      .where('expiresAt', '<', cutoffs.pendingCheckExpiredBefore)
      .limit(200)
      .get(),
    db.collection('auditEvents').where('createdAt', '<', Timestamp.fromMillis(now.getTime() - 35 * 86_400_000)).limit(200).get(),
  ]);

  const touchedPaths = new Set<string>();
  const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  const deleteOnce = (document: FirebaseFirestore.QueryDocumentSnapshot) => {
    if (touchedPaths.has(document.ref.path)) return;
    touchedPaths.add(document.ref.path);
    operations.push((batch) => batch.delete(document.ref));
  };
  expiredLinks.docs.forEach(deleteOnce);
  consumedLinks.docs.forEach(deleteOnce);
  expiredRecoveryCodes.docs.forEach(deleteOnce);
  expiredRelationshipInvitations.docs.forEach(deleteOnce);
  consumedRelationshipInvitations.docs.forEach(deleteOnce);
  expiredRelationshipRecoveryCodes.docs.forEach(deleteOnce);
  staleRecoveryAttempts.docs.forEach(deleteOnce);
  expiredAuditEvents.docs.forEach(deleteOnce);
  const missedUpdate = expiredPendingCheckCleanupUpdate(now);
  expiredPendingChecks.docs.forEach((document) => {
    if (touchedPaths.has(document.ref.path)) return;
    touchedPaths.add(document.ref.path);
    operations.push((batch) => batch.update(document.ref, missedUpdate));
    const aggregateRef = document.ref.parent.parent;
    if (aggregateRef) operations.push((batch) => batch.delete(aggregateRef.collection('quizAnswerKeys').doc(document.id)));
  });
  if (!operations.length) return;
  const batchSize = 400;
  for (let offset = 0; offset < operations.length; offset += batchSize) {
    const batch = db.batch();
    operations.slice(offset, offset + batchSize).forEach((operation) => operation(batch));
    await batch.commit();
  }
});

export const deleteAccountData = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = await requireUid(request.auth);
  const userRef = db.collection('users').doc(uid);
  const [profile, participantRefs] = await Promise.all([
    userRef.get(),
    userRef.collection('participantRefs').get(),
  ]);
  const deleteAccessRecords = async (userIds: string[]) => {
    const tokens = await Promise.all(userIds.map((userId) => db.collection('userModerationTokens').where('uid', '==', userId).get()));
    const batch = db.batch();
    userIds.forEach((userId) => batch.delete(db.collection('userAccess').doc(userId)));
    tokens.flatMap((snapshot) => snapshot.docs).forEach((token) => batch.delete(token.ref));
    await batch.commit();
  };
  if (!profile.exists) {
    await deleteAccessRecords([uid]);
    await recordAuditEvent(db, { action: 'reset_account', actorUid: uid, metadata: { scope: 'contact' } });
    return;
  }
  if (!participantRefs.empty) {
    const relationships = await Promise.all(participantRefs.docs.map(async (participantIndex) => {
      const participantRef = db.collection('participants').doc(participantIndex.id);
      const [participant, membership, memberships] = await Promise.all([
        participantRef.get(),
        participantRef.collection('memberships').doc(uid).get(),
        participantRef.collection('memberships').get(),
      ]);
      const activeOwnerCount = memberships.docs.filter((item) => (
        item.data().role === 'owner' && item.data().status === 'active'
      )).length;
      return { participantIndex, participantRef, participant, membership, activeOwnerCount };
    }));
    const blocked = relationships.find(({ membership, activeOwnerCount }) => (
      membership.data()?.status === 'active'
      && membership.data()?.role === 'owner'
      && activeOwnerCount <= 1
    ));
    if (blocked) {
      throw new HttpsError('failed-precondition', 'Transfer ownership or explicitly delete the followed person before deleting this account.');
    }
    const now = new Date().toISOString();
    const batch = db.batch();
    relationships.forEach(({ participantIndex, participantRef, participant, membership }) => {
      batch.delete(participantIndex.ref);
      batch.delete(participantRef.collection('pushSubscriptions').doc(uid));
      if (membership.exists) {
        batch.set(membership.ref, { status: 'suspended', updatedAt: now, suspendedBy: uid }, { merge: true });
      }
      if (participant.data()?.userId === uid) {
        batch.update(participantRef, { userId: FieldValue.delete(), updatedAt: now });
      }
      const sourceFamilyId = participant.data()?.sourceFamilyId;
      if (typeof sourceFamilyId === 'string' && sourceFamilyId) {
        batch.set(db.collection('families').doc(sourceFamilyId), {
          [`members.${uid}`]: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        batch.delete(db.collection('families').doc(sourceFamilyId).collection('pushSubscriptions').doc(uid));
      }
    });
    batch.delete(userRef);
    await batch.commit();
    await deleteAccessRecords([uid]);
    await recordAuditEvent(db, {
      action: 'reset_account',
      actorUid: uid,
      metadata: { scope: 'relationships', relationshipCount: relationships.length },
    });
    return;
  }
  const { familyId, role } = profile.data() as { familyId: string; role: 'parent' | 'child' };
  const familyRef = db.collection('families').doc(familyId);

  if (role === 'child') {
    await Promise.all([
      familyRef.update({ [`members.${uid}`]: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }),
      familyRef.collection('pushSubscriptions').doc(uid).delete(),
      userRef.delete(),
    ]);
    await deleteAccessRecords([uid]);
    await recordAuditEvent(db, {
      action: 'reset_account',
      actorUid: uid,
      familyId,
      role,
      metadata: { scope: 'child' },
    });
    return;
  }

  const family = await familyRef.get();
  const memberIds = Object.keys((family.data()?.members ?? {}) as Record<string, string>);
  const links = await db.collection('linkCodes').where('familyId', '==', familyId).get();
  const batch = db.batch();
  memberIds.forEach((memberId) => batch.delete(db.collection('users').doc(memberId)));
  links.docs.forEach((link) => batch.delete(link.ref));
  await batch.commit();
  await deleteAccessRecords(memberIds);
  await bucket.deleteFiles({ prefix: `families/${familyId}/` }).catch((error) => {
    reportOperationalAlert({
      kind: 'storage_cleanup_failed',
      familyId,
      actorUid: uid,
      details: { phase: 'reset_family_delete_files' },
      error,
    });
    console.error('Unable to delete family proof images', error);
  });
  await db.recursiveDelete(familyRef);
  await recordAuditEvent(db, {
    action: 'reset_account',
    actorUid: uid,
    familyId,
    role,
    metadata: { scope: 'family', memberCount: memberIds.length },
  });
});
