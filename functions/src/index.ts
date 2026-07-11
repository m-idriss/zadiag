import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleAuth } from 'google-auth-library';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import webpush, { type PushSubscription } from 'web-push';
import { assertChildName, createLinkCode, createRecoveryCode, createRelationshipInvitationCode, hashLinkCode, isFreshCheckSubmission, isLegacyRecoveryCode, isRecoveryCode, isRelationshipInvitationCode, normalizeLinkCode } from './helpers.js';
import { analyzeWithGemini, parseImageDataUrl, type AnalysisResult, type RoutineAnalysisContext } from './analysis.js';
import { checkExpiresAt, getLocalDateKey, getWindowForDate, monitoringPlanSchema, shouldAutoDispatchCheck } from './planning.js';
import { createDefaultRoutineAssignment, createRoutineAssignment, DEFAULT_ROUTINE_ID, routineFromCatalog, type RoutineAssignmentDocument } from './routines.js';
import { buildCheckNotificationPayload, buildReviewNotificationPayload, buildTestNotificationPayload } from './notifications.js';
import { normalizeReminderRepeatMinutes, shouldSendCheckReminder } from './reminders.js';
import { recordAuditEvent } from './audit.js';
import { expiredPendingCheckCleanupUpdate, staleCleanupCutoffs } from './cleanup.js';
import { reportOperationalAlert } from './observability.js';
import { canLeaveMembership, canRemoveMembership, createMembership, hasParticipantPermission, isCompatibleLegacyContentTarget, isCompatibleMembershipMigration, isCompatibleParticipantMigration, isCompatibleParticipantRefMigration, membershipRoles, migrateLegacyFamilyRelationships, scheduledAggregatePaths, type MembershipRole } from './relationships.js';

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
  ?? (process.env.GCLOUD_PROJECT ? `${process.env.GCLOUD_PROJECT}.firebasestorage.app` : undefined);

initializeApp(storageBucket ? { storageBucket } : undefined);
const db = getFirestore();
const bucket = getStorage().bucket();
const region = 'europe-west1';
const vapidPrivateKey = defineSecret('WEB_PUSH_VAPID_PRIVATE_KEY');
const vapidPublicKey = defineSecret('WEB_PUSH_VAPID_PUBLIC_KEY');
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

const requireUid = (auth: { uid: string } | undefined) => {
  if (!auth) throw new HttpsError('unauthenticated', 'Authentication is required.');
  return auth.uid;
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

const pushRoleForAggregate = async (uid: string, aggregateRef: FirebaseFirestore.DocumentReference): Promise<PushRecipientRole> => {
  if (aggregateRef.parent.id === 'families') {
    const profile = await db.collection('users').doc(uid).get();
    return profile.data()?.role === 'child' ? 'child' : 'parent';
  }
  const membership = await aggregateRef.collection('memberships').doc(uid).get();
  return membership.data()?.role === 'participant' ? 'child' : 'parent';
};

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

const recordRecoveryAttempt = async (uid: string) => {
  const attemptRef = db.collection('recoveryAttempts').doc(uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(attemptRef);
    const data = snapshot.data();
    const windowStartedAt = Date.parse(String(data?.windowStartedAt ?? ''));
    const inWindow = Number.isFinite(windowStartedAt) && Date.now() - windowStartedAt < 15 * 60 * 1000;
    const attempts = inWindow ? Number(data?.attempts ?? 0) : 0;
    if (attempts >= 5) throw new HttpsError('resource-exhausted', 'Too many recovery attempts. Try again later.');
    transaction.set(attemptRef, {
      attempts: attempts + 1,
      windowStartedAt: inWindow ? data?.windowStartedAt : new Date().toISOString(),
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
) => {
  const subscription = subscriptionDocument.data() as PushSubscription & { locale?: string } | undefined;
  if (!subscription) return;
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
    }
  }
};

const sendCheckPushNotification = async (
  subscriptionDocument: PushNotificationDocument,
  check: { sessionId: string; routineId: string } & RoutineNotificationNames,
  resend: boolean,
) => {
  if (pushRecipientRole(subscriptionDocument) !== 'child') return;
  const subscription = subscriptionDocument.data() as { locale?: string } | undefined;
  const payload = buildCheckNotificationPayload({
    sessionId: check.sessionId,
    routineId: check.routineId,
    routineName: check.routineName,
    routineNames: check.routineNames,
    routineIcon: check.routineIcon,
    resend,
    locale: subscription?.locale,
  });
  await sendPushPayload(subscriptionDocument, payload);
};

const sendReviewPushNotification = async (
  subscriptionDocument: PushNotificationDocument,
  check: { checkId: string; routineId: string } & RoutineNotificationNames,
) => {
  if (pushRecipientRole(subscriptionDocument) !== 'parent') return;
  const subscription = subscriptionDocument.data() as { locale?: string } | undefined;
  const payload = buildReviewNotificationPayload({
    checkId: check.checkId,
    routineId: check.routineId,
    routineName: check.routineName,
    routineNames: check.routineNames,
    routineIcon: check.routineIcon,
    locale: subscription?.locale,
  });
  await sendPushPayload(subscriptionDocument, payload);
};

const sendCheckPushNotifications = async (
  familyRef: FirebaseFirestore.DocumentReference,
  check: { sessionId: string; routineId: string } & RoutineNotificationNames,
  resend: boolean,
) => {
  const subscriptions = await familyRef.collection('pushSubscriptions').get();
  if (subscriptions.empty) return;
  webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());
  await Promise.allSettled(subscriptions.docs.map((document) => sendCheckPushNotification(document, check, resend)));
};

const sendReviewPushNotifications = async (
  familyRef: FirebaseFirestore.DocumentReference,
  check: { checkId: string; routineId: string } & RoutineNotificationNames,
) => {
  const subscriptions = await familyRef.collection('pushSubscriptions').get();
  if (subscriptions.empty) return;
  webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());
  await Promise.allSettled(subscriptions.docs.map((document) => sendReviewPushNotification(document, check)));
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

export const createParticipant = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
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
      ...(selfManaged ? { label: 'self' as const } : {}),
      now,
    }));
    transaction.set(participantIndexRef, {
      participantId: participantRef.id,
      role: 'owner',
      status: 'active',
      updatedAt: now,
    });
    transaction.set(userRef, { relationshipModelVersion: 2, updatedAt: now }, { merge: true });
  });
  await recordAuditEvent(db, {
    action: 'create_participant',
    actorUid: uid,
    participantId: participantRef.id,
    metadata: { selfManaged },
  });
  return { participantId: participantRef.id };
});

export const createRelationshipInvitation = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const participantId = String(request.data?.participantId ?? '');
  const intendedRole = String(request.data?.role ?? '') as MembershipRole;
  if (!participantId) throw new HttpsError('invalid-argument', 'Participant ID is required.');
  if (!membershipRoles.includes(intendedRole) || intendedRole === 'owner') {
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
  const uid = requireUid(request.auth);
  const code = normalizeLinkCode(String(request.data?.code ?? ''));
  if (!isRelationshipInvitationCode(code)) throw new HttpsError('invalid-argument', 'The invitation code is invalid.');
  const invitationRef = db.collection('relationshipInvitations').doc(hashLinkCode(code));

  const participantId = await db.runTransaction(async (transaction) => {
    const invitation = await transaction.get(invitationRef);
    if (!invitation.exists) throw new HttpsError('not-found', 'The invitation code is invalid.');
    const invitationData = invitation.data() ?? {};
    const targetParticipantId = String(invitationData.participantId ?? '');
    const intendedRole = String(invitationData.intendedRole ?? '') as MembershipRole;
    if (!targetParticipantId || !membershipRoles.includes(intendedRole) || intendedRole === 'owner') {
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
    const [participant, existingMembership] = await Promise.all([
      transaction.get(participantRef),
      transaction.get(membershipRef),
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
    if (!existingMembership.exists) {
      transaction.create(membershipRef, createMembership({
        uid,
        role: intendedRole,
        invitedBy: String(invitationData.createdBy ?? ''),
        now,
      }));
    }
    transaction.set(participantIndexRef, {
      participantId: targetParticipantId,
      role: intendedRole,
      status: 'active',
      updatedAt: now,
    });
    transaction.set(userRef, { relationshipModelVersion: 2, updatedAt: now }, { merge: true });
    transaction.update(invitationRef, { consumedAt: now, consumedBy: uid });
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
  const uid = requireUid(request.auth);
  const participantId = String(request.data?.participantId ?? '');
  const targetUid = String(request.data?.targetUid ?? uid);
  if (!participantId || !targetUid) throw new HttpsError('invalid-argument', 'Participant and member IDs are required.');
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

export const createFamily = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
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
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
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
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  if (!familyId) throw new HttpsError('invalid-argument', 'Family ID is required.');
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
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  if (!familyId) throw new HttpsError('invalid-argument', 'Family ID is required.');
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
  const uid = requireUid(request.auth);
  const code = normalizeLinkCode(String(request.data?.code ?? ''));
  if (!isRecoveryCode(code) && !isLegacyRecoveryCode(code)) throw new HttpsError('invalid-argument', 'The recovery code is invalid.');
  await recordRecoveryAttempt(uid);
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
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
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
  const uid = requireUid(request.auth);
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
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const subscription = request.data?.subscription as Partial<PushSubscription> | undefined;
  const endpoint = String(subscription?.endpoint ?? '');
  const p256dh = String(subscription?.keys?.p256dh ?? '');
  const auth = String(subscription?.keys?.auth ?? '');
  const locale = request.data?.locale === 'fr' ? 'fr' : 'en';
  const rawPreferences = request.data?.preferences as Record<string, unknown> | undefined;
  const preferences = rawPreferences ? {
    notificationWindowStart: String(rawPreferences.notificationWindowStart ?? '08:00'),
    notificationWindowEnd: String(rawPreferences.notificationWindowEnd ?? '21:00'),
    reminderRepeatMinutes: Number(rawPreferences.reminderRepeatMinutes ?? 20),
  } : undefined;
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    throw new HttpsError('invalid-argument', 'A valid push subscription is required.');
  }

  const aggregateRef = await requireAggregatePermission(uid, familyId, 'view');
  const role = await pushRoleForAggregate(uid, aggregateRef);
  const userRef = db.collection('users').doc(uid);
  const subscriptionRef = aggregateRef.collection('pushSubscriptions').doc(uid);
  const batch = db.batch();
  batch.set(subscriptionRef, {
    endpoint,
    keys: { p256dh, auth },
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
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const aggregateRef = await requireAggregatePermission(uid, familyId, 'view');
  const role = await pushRoleForAggregate(uid, aggregateRef);
  const subscriptionDocument = await aggregateRef.collection('pushSubscriptions').doc(uid).get();
  const subscription = subscriptionDocument.data() as (PushSubscription & { locale?: string }) | undefined;
  if (!subscription?.endpoint) {
    throw new HttpsError('failed-precondition', 'No push subscription is available for this device.');
  }
  webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());
  await sendPushPayload(subscriptionDocument, buildTestNotificationPayload({
    locale: subscription.locale,
    role,
  }));
});

export const updateNotificationPreferences = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const reminderRepeatMinutes = normalizeReminderRepeatMinutes(request.data?.reminderRepeatMinutes);
  const aggregateRef = await requireAggregatePermission(uid, familyId, 'manageRoutines', 'parent');
  await aggregateRef.update({
    'notificationPreferences.reminderRepeatMinutes': reminderRepeatMinutes,
    updatedAt: FieldValue.serverTimestamp(),
  });
});

export const regenerateLinkCode = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
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
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const routineId = String(request.data?.routineId ?? DEFAULT_ROUTINE_ID);
  const familyRef = await requireAggregatePermission(uid, familyId, 'requestChecks');
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
    const parsedPlan = monitoringPlanSchema.safeParse(assignment.data()?.plan);
    const plan = parsedPlan.success ? parsedPlan.data : defaultPlan;
    const activePendingCheck = pending.docs.find((doc) => Date.parse(String(doc.data().expiresAt)) > now.getTime());
    const lockUpdate = { lastCheckRequestAt: now.toISOString() };
    if (activePendingCheck) {
      const currentCheck = { id: activePendingCheck.id, ...activePendingCheck.data() } as RequestedCheck;
      const renewedExpiresAt = checkExpiresAt(plan, now);
      if (renewedExpiresAt.getTime() > Date.parse(currentCheck.expiresAt)) {
        const expiresAt = renewedExpiresAt.toISOString();
        transaction.update(assignmentRef, lockUpdate);
        transaction.update(activePendingCheck.ref, { expiresAt });
        return { check: { ...currentCheck, expiresAt }, resend: true };
      }
      transaction.update(assignmentRef, lockUpdate);
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
    };

    transaction.update(assignmentRef, lockUpdate);
    transaction.create(checkRef, check);
    return { check: { id: checkRef.id, ...check }, resend: false };
  });

  const assignment = await assignmentRef.get();
  const routineNames = getRoutineNotificationNames(assignment.data(), routineId);
  await sendCheckPushNotifications(familyRef, { ...check, ...routineNames }, resend);
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

export const assignRoutine = onCall({
  region,
  cors,
  enforceAppCheck: true,
}, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const routineId = String(request.data?.routineId ?? '');
  const routine = routineFromCatalog(routineId);
  if (!familyId) throw new HttpsError('invalid-argument', 'Family ID is required.');
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

  return { success: true };
});

export const deleteRoutine = onCall({
  region,
  cors,
  enforceAppCheck: true,
}, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const routineId = String(request.data?.routineId ?? '');
  if (!familyId) throw new HttpsError('invalid-argument', 'Family ID is required.');
  if (!routineId) throw new HttpsError('invalid-argument', 'Routine ID is required.');

  const familyRef = await requireAggregatePermission(uid, familyId, 'manageRoutines', 'parent');
  const assignmentRef = familyRef.collection('routineAssignments').doc(routineId);
  const assignmentsQuery = familyRef.collection('routineAssignments').limit(2);
  const routineChecks = familyRef.collection('checks').where('routineId', '==', routineId).limit(450);

  await ensureFamilyRoutineMigration(familyRef);
  await db.runTransaction(async (transaction) => {
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
  });

  return { success: true };
});

export const updateRoutineAssignment = onCall({
  region,
  cors,
  enforceAppCheck: true,
}, async (request) => {
  try {
    const uid = requireUid(request.auth);
    const familyId = String(request.data?.familyId ?? '');
    const routineId = String(request.data?.routineId ?? DEFAULT_ROUTINE_ID);
    const plan = request.data?.plan;
    const validationMode = request.data?.validationMode === 'auto' ? 'auto' : request.data?.validationMode === 'ai' ? 'ai' : undefined;

    if (!familyId) throw new HttpsError('invalid-argument', 'Family ID is required.');
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
  schedule: 'every 30 minutes',
  timeZone: 'UTC',
  secrets: [vapidPrivateKey, vapidPublicKey],
}, async () => {
  // Query only families that likely have active routines (have children and recent activity)
  const aggregates = await loadScheduledAggregates();
  if (!aggregates.length) return;

  const now = new Date();
  await Promise.allSettled(aggregates.map(async (familyDoc) => {
    const familyData = familyDoc.data() as {
      members?: Record<string, string>;
    };
    const hasChild = await aggregateHasActiveParticipant(familyDoc);
    if (!hasChild) return;
    await ensureFamilyRoutineMigration(familyDoc.ref);
    const assignments = await familyDoc.ref.collection('routineAssignments').where('status', '==', 'active').get();
    const recentSince = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    await Promise.allSettled(assignments.docs.map(async (assignmentDoc) => {
      const assignmentData = assignmentDoc.data() as RoutineAssignmentDocument;
      const routineId = assignmentData.routineId || assignmentDoc.id;
      const parsedPlan = monitoringPlanSchema.safeParse(assignmentData.plan);
      if (!parsedPlan.success) {
        console.error('Skipping routine with invalid monitoring plan', familyDoc.id, routineId, parsedPlan.error.issues);
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

      if (created) await sendCheckPushNotifications(familyDoc.ref, {
        sessionId: check.sessionId,
        routineId,
        ...getRoutineNotificationNames(assignmentData, routineId),
      }, false);
    }));
  }));
});

export const dispatchCheckReminders = onSchedule({
  region,
  schedule: 'every 5 minutes',
  timeZone: 'UTC',
  secrets: [vapidPrivateKey, vapidPublicKey],
}, async () => {
  const aggregates = await loadScheduledAggregates();
  if (!aggregates.length) return;

  const now = new Date();
  webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());

  await Promise.allSettled(aggregates.map(async (familyDoc) => {
    const familyData = familyDoc.data() as {
      members?: Record<string, string>;
      notificationPreferences?: { reminderRepeatMinutes?: unknown };
    };
    if (!await aggregateHasActiveParticipant(familyDoc)) return;

    const repeatMinutes = normalizeReminderRepeatMinutes(familyData.notificationPreferences?.reminderRepeatMinutes);
    if (repeatMinutes <= 0) return;

    const [pendingChecks, subscriptions] = await Promise.all([
      familyDoc.ref.collection('checks')
        .where('status', '==', 'pending')
        .limit(20)
        .get(),
      familyDoc.ref.collection('pushSubscriptions').get(),
    ]);
    if (pendingChecks.empty || subscriptions.empty) return;

    const assignmentCache = new Map<string, Promise<FirebaseFirestore.DocumentSnapshot>>();
    const assignmentFor = (routineId: string) => {
      const cached = assignmentCache.get(routineId);
      if (cached) return cached;
      const next = familyDoc.ref.collection('routineAssignments').doc(routineId).get();
      assignmentCache.set(routineId, next);
      return next;
    };

    await Promise.allSettled(pendingChecks.docs.map(async (checkDoc) => {
      const checkData = checkDoc.data() as {
        routineId?: string;
        sessionId?: string;
        requestedAt?: string;
        expiresAt?: string;
        status?: string;
      };
      if (!shouldSendCheckReminder({
        requestedAt: checkData.requestedAt,
        expiresAt: checkData.expiresAt,
        repeatMinutes,
        now,
      })) return;

      const routineId = String(checkData.routineId ?? DEFAULT_ROUTINE_ID);
      const assignment = await assignmentFor(routineId);
      const notificationNames = getRoutineNotificationNames(assignment.data(), routineId);

      await Promise.allSettled(subscriptions.docs.map(async (subscriptionDoc) => {
        const reminderRef = checkDoc.ref.collection('reminders').doc(subscriptionDoc.id);
        const reserved = await db.runTransaction(async (transaction): Promise<boolean> => {
          const [freshCheck, reminder] = await Promise.all([
            transaction.get(checkDoc.ref),
            transaction.get(reminderRef),
          ]);
          const freshCheckData = freshCheck.data() as {
            requestedAt?: string;
            expiresAt?: string;
            status?: string;
          } | undefined;
          if (!freshCheck.exists || freshCheckData?.status !== 'pending') return false;
          const lastReminderAt = reminder.data()?.lastSentAt;
          if (!shouldSendCheckReminder({
            requestedAt: freshCheckData.requestedAt,
            expiresAt: freshCheckData.expiresAt,
            lastReminderAt: typeof lastReminderAt === 'string' ? lastReminderAt : undefined,
            repeatMinutes,
            now,
          })) return false;
          transaction.set(reminderRef, {
            lastSentAt: now.toISOString(),
            repeatMinutes,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          return true;
        });
        if (!reserved) return;
        await sendCheckPushNotification(subscriptionDoc, {
          sessionId: String(checkData.sessionId ?? checkDoc.id),
          routineId,
          ...notificationNames,
        }, true);
      }));
    }));
  }));
});

export const updatePlan = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const routineId = String(request.data?.routineId ?? DEFAULT_ROUTINE_ID);
  const parsedPlan = monitoringPlanSchema.safeParse(request.data?.plan);
  if (!parsedPlan.success) throw new HttpsError('invalid-argument', 'The monitoring plan is invalid.');
  const familyRef = await requireAggregatePermission(uid, familyId, 'manageRoutines', 'parent');
  await ensureFamilyRoutineMigration(familyRef);
  const assignmentRef = familyRef.collection('routineAssignments').doc(routineId);
  const assignment = await assignmentRef.get();
  if (!assignment.exists) throw new HttpsError('not-found', 'The routine assignment could not be found.');
  await assignmentRef.update({ plan: parsedPlan.data, updatedAt: FieldValue.serverTimestamp() });
});

export const analyzeCheck = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const checkId = String(request.data?.checkId ?? '');
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
  const analysisUpdate = {
    capturedAt,
    status: result.status ?? 'uncertain',
    analysisSource: result.reason === 'analysis_unavailable' ? 'fallback' : 'ai',
    ...(proofImagePath ? { proofImagePath } : {}),
    ...(proofImagePath ? { proofImageExpiresAt: new Date(Date.now() + proofImageRetentionDays * 86_400_000).toISOString() } : {}),
    ...((result.status ?? 'uncertain') === 'uncertain' && proofImagePath ? { reviewStatus: 'pending' } : {}),
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
  if (analysisUpdate.reviewStatus === 'pending') {
    try {
      await sendReviewPushNotifications(checkRef.parent.parent!, {
        checkId: checkRef.id,
        routineId,
        ...getRoutineNotificationNames(assignmentData, routineId),
      });
    } catch (error) {
      console.error('Unable to send review push notifications', error);
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
      analysisSource: analysisUpdate.analysisSource,
      reviewStatus: analysisUpdate.reviewStatus ?? null,
      hasProofImage: Boolean(proofImagePath),
    },
  });
  return response;
});

export const getProofImageUrl = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const checkId = String(request.data?.checkId ?? '');
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
    console.error('Unable to create signed proof image URL, returning inline proof image', error);
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
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const checkId = String(request.data?.checkId ?? '');
  const decision = String(request.data?.decision ?? '');
  if (!['detected', 'not_detected'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'A valid review decision is required.');
  }
  const aggregateRef = await requireFamilyRole(uid, familyId, 'parent');
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
    };
    transaction.update(checkRef, update);
    return { id: check.id, ...checkData, ...update };
  });
  const proofImagePath = reviewedCheck.proofImagePath;
  if (decision === 'detected' && typeof proofImagePath === 'string' && proofImagePath) {
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
    staleRecoveryAttempts,
    expiredPendingChecks,
  ] = await Promise.all([
    db.collection('linkCodes').where('expiresAt', '<', cutoffs.expiredBefore).limit(200).get(),
    db.collection('linkCodes').where('consumedAt', '<', cutoffs.consumedBefore).limit(200).get(),
    db.collection('parentRecoveryCodes').where('expiresAt', '<', cutoffs.expiredBefore).limit(200).get(),
    db.collection('recoveryAttempts').where('windowStartedAt', '<', cutoffs.recoveryAttemptBefore).limit(200).get(),
    db.collectionGroup('checks')
      .where('status', '==', 'pending')
      .where('expiresAt', '<', cutoffs.pendingCheckExpiredBefore)
      .limit(200)
      .get(),
  ]);

  const batch = db.batch();
  const touchedPaths = new Set<string>();
  const deleteOnce = (document: FirebaseFirestore.QueryDocumentSnapshot) => {
    if (touchedPaths.has(document.ref.path)) return;
    touchedPaths.add(document.ref.path);
    batch.delete(document.ref);
  };
  expiredLinks.docs.forEach(deleteOnce);
  consumedLinks.docs.forEach(deleteOnce);
  expiredRecoveryCodes.docs.forEach(deleteOnce);
  staleRecoveryAttempts.docs.forEach(deleteOnce);
  const missedUpdate = expiredPendingCheckCleanupUpdate(now);
  expiredPendingChecks.docs.forEach((document) => {
    if (touchedPaths.has(document.ref.path)) return;
    touchedPaths.add(document.ref.path);
    batch.update(document.ref, missedUpdate);
  });
  const operationCount = expiredLinks.size
    + consumedLinks.size
    + expiredRecoveryCodes.size
    + staleRecoveryAttempts.size
    + expiredPendingChecks.size;
  if (operationCount === 0) return;
  await batch.commit();
});

export const deleteAccountData = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const userRef = db.collection('users').doc(uid);
  const profile = await userRef.get();
  if (!profile.exists) return;
  const { familyId, role } = profile.data() as { familyId: string; role: 'parent' | 'child' };
  const familyRef = db.collection('families').doc(familyId);

  if (role === 'child') {
    await Promise.all([
      familyRef.update({ [`members.${uid}`]: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }),
      familyRef.collection('pushSubscriptions').doc(uid).delete(),
      userRef.delete(),
    ]);
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
