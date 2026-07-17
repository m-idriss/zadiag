import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleAuth } from 'google-auth-library';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { randomBytes } from 'node:crypto';
import webpush, { type PushSubscription } from 'web-push';
import { assertChildName, createLinkCode, createRecoveryCode, createRelationshipInvitationCode, hashLinkCode, isFirestoreDocumentId, isFreshCheckSubmission, isLegacyRecoveryCode, isRecoveryCode, isRelationshipInvitationCode, normalizeLinkCode, sensitiveCodeAttemptState } from './helpers.js';
import { analyzeWithGemini, parseImageDataUrl, routeAnalysisStatusForReview, type AnalysisResult, type RoutineAnalysisContext } from './analysis.js';
import { checkExpiresAt, getLocalDateKey, getWindowForDate, monitoringPlanSchema, plannedCheckDispatchSchedule, shouldAutoDispatchCheck } from './planning.js';
import { createDefaultRoutineAssignment, createDraftRoutineAssignment, createRoutineAssignment, DEFAULT_ROUTINE_ID, isRoutineValidationMode, routineFromCatalog, type RoutineAssignmentDocument, type RoutineDocument } from './routines.js';
import { buildCheckNotificationPayload, buildReviewNotificationPayload, buildTestNotificationPayload, normalizePushPreferences, normalizePushSubscription, type SyntheticReceiptPayload } from './notifications.js';
import { isCheckRequestRateLimited } from './reminders.js';
import { recordAuditEvent, recordJourneyEvent, type JourneyStage } from './audit.js';
import { expiredPendingCheckCleanupUpdate, shouldDeleteProofAfterReview, staleCleanupCutoffs } from './cleanup.js';
import { reportOperationalAlert, reportOperationalEvent } from './observability.js';
import { shouldRecoverSyntheticPush } from './syntheticMonitor.js';
import { canLeaveMembership, canRemoveMembership, createMembership, hasParticipantPermission, isCompatibleLegacyContentTarget, isCompatibleMembershipMigration, isCompatibleParticipantMigration, isCompatibleParticipantRefMigration, isProfileColorKey, membershipRoles, migrateLegacyFamilyRelationships, scheduledAggregatePaths, type MembershipRole } from './relationships.js';
import { assertRoutineDraftRevision, createRoutineDraftDocument, RoutineDraftConflictError, RoutineDraftInputError, updateRoutineDraftDocument, type RoutineDraftDocument } from './routineDrafts.js';

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
const pilotConsentVersion = '2026-07-17';
const geminiAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/generative-language'],
});
const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const cors = [
  'https://zadiag.vercel.app',
  'https://zadiag.com',
  'https://www.zadiag.com',
  /^https:\/\/zadiag-.*\.vercel\.app$/,
  'http://localhost:5173',
  /^http:\/\/localhost:\d+$/,
];

interface RoutineNotificationNames {
  routineName: string;
  routineIcon?: string;
  routineNames: {
    en?: string;
    fr?: string;
  };
}

type PushRecipientRole = 'child' | 'parent';
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

const pushRoleForAggregate = async (uid: string, aggregateRef: FirebaseFirestore.DocumentReference): Promise<PushRecipientRole> => {
  if (aggregateRef.parent.id === 'families') {
    const profile = await db.collection('users').doc(uid).get();
    return profile.data()?.role === 'child' ? 'child' : 'parent';
  }
  const membership = await aggregateRef.collection('memberships').doc(uid).get();
  return membership.data()?.role === 'participant' ? 'child' : 'parent';
};

const journeyStages = new Set<JourneyStage>(['app_ready', 'notifications_enabled', 'notification_opened', 'check_opened']);
const journeySources = new Set(['startup', 'settings', 'push', 'notification_center', 'dashboard', 'history']);

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
  const role = await pushRoleForAggregate(uid, aggregateRef);
  await recordJourneyEvent(db, {
    stage,
    actorUid: uid,
    ...(aggregateRef.parent.id === 'participants' ? { participantId: aggregateId } : { familyId: aggregateId }),
    role: role === 'child' ? 'child' as const : 'parent' as const,
    contextId,
    metadata: { source, ...(contextId ? { contextId } : {}) },
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
  const role = await pushRoleForAggregate(uid, aggregateRef);
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
  if (Number(currentFamily.data()?.routineMigrationVersion ?? 0) >= 1 && currentAssignment.exists) return currentAssignment;

  await db.runTransaction(async (transaction) => {
    const [family, assignment] = await Promise.all([
      transaction.get(familyRef),
      transaction.get(assignmentRef),
    ]);
    if (!family.exists) throw new HttpsError('not-found', 'The family could not be found.');
    if (assignment.exists) return;
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

const pushRecipientRole = (subscriptionDocument: PushNotificationDocument): PushRecipientRole => {
  const role = subscriptionDocument.data()?.role;
  return role === 'parent' ? 'parent' : 'child';
};

const sendPushPayload = async (
  subscriptionDocument: PushNotificationDocument,
  payload: unknown,
  ttl = 120,
): Promise<PushDispatchResult> => {
  const subscription = subscriptionDocument.data() as PushSubscription & { locale?: string } | undefined;
  if (!subscription) return 'skipped';
  const recordDispatch = async (result: 'success' | 'failed' | 'invalidated', error?: unknown) => {
    await subscriptionDocument.ref.set({
      lastDispatchResult: result,
      lastDispatchAt: FieldValue.serverTimestamp(),
      ...(error ? { lastDispatchError: String((error as { message?: string }).message ?? error).slice(0, 180) } : { lastDispatchError: FieldValue.delete() }),
    }, { merge: true });
  };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: ttl });
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
  if (pushRecipientRole(subscriptionDocument) !== 'child') return 'skipped' as const;
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
  if (pushRecipientRole(subscriptionDocument) !== 'parent') return 'skipped';
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
  return summary;
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
  const role = await pushRoleForAggregate(uid, aggregateRef);
  const userRef = db.collection('users').doc(uid);
  const subscriptionRef = aggregateRef.collection('pushSubscriptions').doc(uid);
  const batch = db.batch();
  batch.set(subscriptionRef, {
    ...subscription,
    locale,
    role,
    endpointPresent: true,
    lastSuccessfulSaveAt: FieldValue.serverTimestamp(),
    ...(preferences ? { preferences } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(userRef, { notificationsEnabled: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
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
  const role = await pushRoleForAggregate(uid, aggregateRef);
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

const syntheticReceiptOrigins = new Set([
  'https://zadiag.com',
  'https://www.zadiag.com',
  'https://zadiag.vercel.app',
]);

export const recordSyntheticPushReceipt = onRequest({ region }, async (request, response) => {
  const origin = request.get('origin');
  const allowedOrigin = origin && (
    syntheticReceiptOrigins.has(origin)
    || /^https:\/\/zadiag-[a-z0-9-]+\.vercel\.app$/.test(origin)
  ) ? origin : undefined;
  if (allowedOrigin) response.set('Access-Control-Allow-Origin', allowedOrigin);
  response.set('Vary', 'Origin');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.set('Cache-Control', 'no-store');
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

  const { check, resend } = await db.runTransaction(async (transaction): Promise<RequestCheckResult> => {
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
    routineId = current.package.routine.id;
    const assignmentRef = participantRef.collection('routineAssignments').doc(routineId);
    if ((await transaction.get(assignmentRef)).exists) throw new HttpsError('already-exists', 'This routine is already assigned.');
    transaction.create(assignmentRef, createDraftRoutineAssignment(current.package.routine as RoutineDocument, defaultPlan, draftId, current.revision));
  });
  await recordAuditEvent(db, { action: 'assign_routine_draft', actorUid: uid, participantId, metadata: { draftId, revision: expectedRevision, routineId } });
  return { success: true, routineId };
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
    const rawValidationMode = request.data?.validationMode;
    if (rawValidationMode !== undefined && rawValidationMode !== null && !isRoutineValidationMode(rawValidationMode)) {
      throw new HttpsError('invalid-argument', 'The validation mode is invalid.');
    }
    const validationMode = isRoutineValidationMode(rawValidationMode) ? rawValidationMode : undefined;

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
      const assignments = await familyDoc.ref.collection('routineAssignments').where('status', '==', 'active').get();
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
          transaction.create(checkRef, check);
          return true;
        });

        if (!created) return;
        stats.checksCreated += 1;
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
      reviewReason: 'responsible_review',
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
}, async () => {
  const expired = await db.collectionGroup('checks')
    .where('proofImageExpiresAt', '<', new Date().toISOString())
    .limit(200)
    .get();
  if (expired.empty) return;
  await Promise.allSettled(expired.docs.map(async (check) => {
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
