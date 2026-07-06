import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleAuth } from 'google-auth-library';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import webpush, { type PushSubscription } from 'web-push';
import { assertChildName, createLinkCode, createRecoveryCode, hashLinkCode, isFreshCheckSubmission, isLegacyRecoveryCode, isRecoveryCode, normalizeLinkCode } from './helpers.js';
import { analyzeWithGemini, parseImageDataUrl, type AnalysisResult, type RoutineAnalysisContext } from './analysis.js';
import { getLocalDateKey, getWindowForDate, monitoringPlanSchema, shouldAutoDispatchCheck } from './planning.js';
import { createDefaultRoutineAssignment, createRoutineAssignment, DEFAULT_ROUTINE_ID, routineFromCatalog, type RoutineAssignmentDocument } from './routines.js';
import { buildCheckNotificationPayload } from './notifications.js';

initializeApp();
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
  expiryMinutes: 20,
  timeZone: 'Europe/Paris',
};
const recoveryLifetimeMs = 90 * 24 * 60 * 60 * 1000;
const maxImageDataUrlLength = 5 * 1024 * 1024;
const proofImageSignedUrlMinutes = 5;
const proofImageRetentionDays = 30;
const createRecoveryRecord = (familyId: string, expiresAt: Date) => ({
  familyId,
  expiresAt: expiresAt.toISOString(),
  createdAt: new Date().toISOString(),
});

const requireFamilyRole = async (uid: string, familyId: string, role: 'parent' | 'child') => {
  const [profile, family] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('families').doc(familyId).get(),
  ]);
  const profileMatches = profile.exists
    && profile.data()?.familyId === familyId
    && profile.data()?.role === role;
  const familyMatches = family.exists && family.data()?.members?.[uid] === role;
  if (!profileMatches && !familyMatches) {
    throw new HttpsError('permission-denied', `Only the linked ${role} can perform this action.`);
  }
  return profile;
};

const imageExtensionFor = (mimeType: string) => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
};

const storeProofImage = async (familyId: string, checkId: string, imageDataUrl: string) => {
  const { mimeType, data } = parseImageDataUrl(imageDataUrl);
  const path = `families/${familyId}/checks/${checkId}/proof.${imageExtensionFor(mimeType)}`;
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

const sendCheckPushNotifications = async (
  familyRef: FirebaseFirestore.DocumentReference,
  check: { sessionId: string; routineId: string } & RoutineNotificationNames,
  resend: boolean,
) => {
  const subscriptions = await familyRef.collection('pushSubscriptions').get();
  if (subscriptions.empty) return;
  webpush.setVapidDetails('https://www.zadiag.com', vapidPublicKey.value(), vapidPrivateKey.value());
  await Promise.allSettled(subscriptions.docs.map(async (document) => {
    const subscription = document.data() as PushSubscription & { locale?: string };
    try {
      const payload = buildCheckNotificationPayload({
        sessionId: check.sessionId,
        routineId: check.routineId,
        routineName: check.routineName,
        routineNames: check.routineNames,
        routineIcon: check.routineIcon,
        resend,
        locale: subscription.locale,
      });
      await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 120 });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) await document.ref.delete();
      else console.error('Unable to send Web Push notification', error);
    }
  }));
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
    if (existingUser.exists) throw new HttpsError('already-exists', 'This account already belongs to a family.');
    if (!link.exists) throw new HttpsError('not-found', 'The linking code is invalid.');
    const data = link.data();
    if (!data) throw new HttpsError('not-found', 'The linking code is invalid.');
    if (data.consumedAt || Date.parse(data.expiresAt) <= Date.now()) {
      throw new HttpsError('failed-precondition', 'The linking code has expired or was already used.');
    }
    const targetFamilyId = String(data.familyId);
    const familyRef = db.collection('families').doc(targetFamilyId);
    transaction.update(familyRef, { [`members.${uid}`]: 'child', updatedAt: FieldValue.serverTimestamp() });
    transaction.create(userRef, { familyId: targetFamilyId, role: 'child', createdAt: new Date().toISOString() });
    transaction.update(linkRef, { consumedAt: new Date().toISOString(), consumedBy: uid });
    return targetFamilyId;
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
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    throw new HttpsError('invalid-argument', 'A valid push subscription is required.');
  }

  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'child') {
    throw new HttpsError('permission-denied', 'Only the linked child can enable notifications.');
  }

  const subscriptionRef = db.collection('families').doc(familyId).collection('pushSubscriptions').doc(uid);
  const batch = db.batch();
  batch.set(subscriptionRef, {
    endpoint,
    keys: { p256dh, auth },
    locale,
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.update(profile.ref, { notificationsEnabled: true, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
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
  const familyRef = db.collection('families').doc(familyId);
  const userRef = db.collection('users').doc(uid);
  const authorizationProfile = await userRef.get();
  if (!authorizationProfile.exists || authorizationProfile.data()?.familyId !== familyId || authorizationProfile.data()?.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Only the parent can request a check.');
  }
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
    if (!family.exists || family.data()?.members?.[uid] !== 'parent') {
      throw new HttpsError('not-found', 'The family could not be found.');
    }
    if (!assignment.exists || assignment.data()?.status !== 'active') {
      throw new HttpsError('failed-precondition', 'The routine is not active.');
    }

    const activePendingCheck = pending.docs.find((doc) => Date.parse(String(doc.data().expiresAt)) > Date.now());
    if (activePendingCheck) {
      return { check: { id: activePendingCheck.id, ...activePendingCheck.data() } as RequestedCheck, resend: true };
    }

    const configuredMinutes = Number(assignment.data()?.plan?.expiryMinutes);
    const expiryMinutes = Number.isFinite(configuredMinutes)
      ? Math.min(120, Math.max(1, configuredMinutes))
      : defaultPlan.expiryMinutes;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);
    const check = {
      routineId,
      sessionId: crypto.randomUUID(),
      requestedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
      requestedBy: uid,
    };

    transaction.create(checkRef, check);
    return { check: { id: checkRef.id, ...check }, resend: false };
  });

  const assignment = await assignmentRef.get();
  const routineNames = getRoutineNotificationNames(assignment.data(), routineId);
  await sendCheckPushNotifications(familyRef, { ...check, ...routineNames }, resend);
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

  const userRef = db.collection('users').doc(uid);
  const familyRef = db.collection('families').doc(familyId);
  const assignmentRef = familyRef.collection('routineAssignments').doc(routine.id);

  await ensureFamilyRoutineMigration(familyRef);
  await db.runTransaction(async (transaction) => {
    const [profile, family, assignment] = await Promise.all([
      transaction.get(userRef),
      transaction.get(familyRef),
      transaction.get(assignmentRef),
    ]);
    const profileRole = profile.data()?.role;
    const role = profileRole === 'parent' || profileRole === 'child' ? profileRole : undefined;
    if (!profile.exists || profile.data()?.familyId !== familyId || !role) {
      throw new HttpsError('permission-denied', 'Only family members can assign a routine.');
    }
    if (!family.exists || family.data()?.members?.[uid] !== role) {
      throw new HttpsError('not-found', 'The family could not be found.');
    }
    if (assignment.exists) throw new HttpsError('already-exists', 'This routine is already assigned.');

    transaction.create(assignmentRef, createRoutineAssignment(routine, defaultPlan, new Date().toISOString(), role));
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

  const userRef = db.collection('users').doc(uid);
  const familyRef = db.collection('families').doc(familyId);
  const assignmentRef = familyRef.collection('routineAssignments').doc(routineId);
  const routineChecks = familyRef.collection('checks').where('routineId', '==', routineId).limit(450);

  await ensureFamilyRoutineMigration(familyRef);
  await db.runTransaction(async (transaction) => {
    const [profile, family, assignment, checks] = await Promise.all([
      transaction.get(userRef),
      transaction.get(familyRef),
      transaction.get(assignmentRef),
      transaction.get(routineChecks),
    ]);
    const profileRole = profile.data()?.role;
    const role = profileRole === 'parent' || profileRole === 'child' ? profileRole : undefined;
    if (!profile.exists || profile.data()?.familyId !== familyId || !role) {
      throw new HttpsError('permission-denied', 'Only family members can delete a routine.');
    }
    if (!family.exists || family.data()?.members?.[uid] !== role) {
      throw new HttpsError('not-found', 'The family could not be found.');
    }
    if (!assignment.exists) throw new HttpsError('not-found', 'The routine could not be found.');

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

    const userRef = db.collection('users').doc(uid);
    const familyRef = db.collection('families').doc(familyId);
    const assignmentRef = familyRef.collection('routineAssignments').doc(routineId);

    // Check authorization
    const authorizationProfile = await userRef.get();
    const profileRole = authorizationProfile.data()?.role;
    const role = profileRole === 'parent' || profileRole === 'child' ? profileRole : undefined;
    if (!authorizationProfile.exists || authorizationProfile.data()?.familyId !== familyId || !role) {
      throw new HttpsError('permission-denied', 'Only family members can update a routine.');
    }

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

export const dispatchPlannedChecks = onSchedule({
  region,
  schedule: 'every 30 minutes',
  timeZone: 'UTC',
  secrets: [vapidPrivateKey, vapidPublicKey],
}, async () => {
  // Query only families that likely have active routines (have children and recent activity)
  const families = await db.collection('families')
    .where('members', '!=', {})
    .get();
  if (families.empty) return;

  const now = new Date();
  await Promise.allSettled(families.docs.map(async (familyDoc) => {
    const familyData = familyDoc.data() as {
      members?: Record<string, string>;
    };
    const hasChild = Object.values(familyData.members ?? {}).includes('child');
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
      const expiresAt = new Date(now.getTime() + plan.expiryMinutes * 60 * 1000);
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
        const [freshFamily, freshAssignment, activePending, freshRecentChecks] = await Promise.all([
          transaction.get(familyDoc.ref),
          transaction.get(freshAssignmentRef),
          transaction.get(activePendingQuery),
          transaction.get(recentChecksQuery),
        ]);
        const freshAssignmentData = freshAssignment.data() as RoutineAssignmentDocument | undefined;
        if (!freshFamily.exists || !freshAssignment.exists || freshAssignmentData?.status !== 'active') return false;
        if (!Object.values(freshFamily.data()?.members ?? {}).includes('child')) return false;
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

export const updatePlan = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const routineId = String(request.data?.routineId ?? DEFAULT_ROUTINE_ID);
  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists || profile.data()?.familyId !== familyId || profile.data()?.role !== 'parent') {
    throw new HttpsError('permission-denied', 'Only the parent can update this plan.');
  }
  const parsedPlan = monitoringPlanSchema.safeParse(request.data?.plan);
  if (!parsedPlan.success) throw new HttpsError('invalid-argument', 'The monitoring plan is invalid.');
  const familyRef = db.collection('families').doc(familyId);
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
  await requireFamilyRole(uid, familyId, 'child');
  if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(imageDataUrl) || imageDataUrl.length > maxImageDataUrlLength) {
    throw new HttpsError('invalid-argument', 'A valid image is required.');
  }
  const checkRef = db.collection('families').doc(familyId).collection('checks').doc(checkId);
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
    proofImagePath = await storeProofImage(familyId, checkId, imageDataUrl);
  } catch (error) {
    console.error('Unable to store proof image for review', error);
    await checkRef.update({
      capturedAt: FieldValue.delete(),
      status: 'pending',
      analysisStartedAt: FieldValue.delete(),
    });
    throw new HttpsError('unavailable', 'The proof image could not be stored. Please retake the photo.');
  }
  const assignment = await db.collection('families').doc(familyId).collection('routineAssignments').doc(routineId).get();
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
  return response;
});

export const getProofImageUrl = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const checkId = String(request.data?.checkId ?? '');
  await requireFamilyRole(uid, familyId, 'parent');
  const check = await db.collection('families').doc(familyId).collection('checks').doc(checkId).get();
  const proofImagePath = check.data()?.proofImagePath;
  if (!check.exists || typeof proofImagePath !== 'string' || !proofImagePath) {
    throw new HttpsError('not-found', 'No proof image is available for this check.');
  }
  const [exists] = await bucket.file(proofImagePath).exists();
  if (!exists) throw new HttpsError('not-found', 'The proof image is no longer available.');
  const [url] = await bucket.file(proofImagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + proofImageSignedUrlMinutes * 60 * 1000,
  });
  return { url };
});

export const reviewCheck = onCall({ region, cors, enforceAppCheck: true }, async (request) => {
  const uid = requireUid(request.auth);
  const familyId = String(request.data?.familyId ?? '');
  const checkId = String(request.data?.checkId ?? '');
  const decision = String(request.data?.decision ?? '');
  if (!['detected', 'not_detected'].includes(decision)) {
    throw new HttpsError('invalid-argument', 'A valid review decision is required.');
  }
  await requireFamilyRole(uid, familyId, 'parent');
  const checkRef = db.collection('families').doc(familyId).collection('checks').doc(checkId);
  const reviewedAt = new Date().toISOString();
  return db.runTransaction(async (transaction) => {
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
      await bucket.file(proofImagePath).delete({ ignoreNotFound: true });
    }
    await check.ref.update({
      proofImagePath: FieldValue.delete(),
      proofImageExpiresAt: FieldValue.delete(),
    });
  }));
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
    console.error('Unable to delete family proof images', error);
  });
  await db.recursiveDelete(familyRef);
});
